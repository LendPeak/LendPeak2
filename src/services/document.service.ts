import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { Readable } from 'stream';
import { logger } from '../utils/logger';
import { config } from '../config';

export interface DocumentMetadata {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  mimeType: string;
  category: DocumentCategory;
  uploadedBy: string;
  uploadedAt: Date;
  entityType: 'loan' | 'user' | 'application';
  entityId: string;
  tags?: string[];
  description?: string;
  isVerified?: boolean;
  verifiedBy?: string;
  verifiedAt?: Date;
  expiresAt?: Date;
  checksum: string;
  s3Key: string;
  s3Bucket: string;
  thumbnailKey?: string;
}

export enum DocumentCategory {
  IDENTITY = 'identity',
  INCOME = 'income',
  EMPLOYMENT = 'employment',
  BANK_STATEMENT = 'bank_statement',
  TAX_RETURN = 'tax_return',
  COLLATERAL = 'collateral',
  CONTRACT = 'contract',
  AGREEMENT = 'agreement',
  CORRESPONDENCE = 'correspondence',
  OTHER = 'other',
}

export interface DocumentUploadOptions {
  fileName: string;
  fileBuffer: Buffer;
  mimeType: string;
  category: DocumentCategory;
  uploadedBy: string;
  entityType: 'loan' | 'user' | 'application';
  entityId: string;
  tags?: string[];
  description?: string;
  expiresAt?: Date;
}

export interface DocumentSearchCriteria {
  entityType?: 'loan' | 'user' | 'application';
  entityId?: string;
  category?: DocumentCategory;
  uploadedBy?: string;
  isVerified?: boolean;
  tags?: string[];
  startDate?: Date;
  endDate?: Date;
  fileTypes?: string[];
}

export interface SignedUrlOptions {
  expiresIn?: number; // seconds
  responseContentDisposition?: string;
  responseContentType?: string;
}

export class DocumentService {
  private s3: AWS.S3;
  private bucketName: string;
  private cloudFront?: AWS.CloudFront;
  private cloudFrontDomain?: string;

  constructor() {
    this.s3 = new AWS.S3({
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey,
      region: config.aws.region,
    });

    this.bucketName = config.aws.s3.documentBucket || 'lendpeak2-documents';

    if (config.aws.cloudFront?.enabled) {
      this.cloudFront = new AWS.CloudFront({
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
        region: config.aws.region,
      });
      this.cloudFrontDomain = config.aws.cloudFront.domain;
    }
  }

  /**
   * Upload a document to S3
   */
  async uploadDocument(options: DocumentUploadOptions): Promise<DocumentMetadata> {
    try {
      const documentId = uuidv4();
      const fileExtension = this.getFileExtension(options.fileName);
      const s3Key = this.generateS3Key(
        options.entityType,
        options.entityId,
        options.category,
        documentId,
        fileExtension,
      );

      // Calculate checksum
      const checksum = this.calculateChecksum(options.fileBuffer);

      // Upload to S3
      const uploadParams: AWS.S3.PutObjectRequest = {
        Bucket: this.bucketName,
        Key: s3Key,
        Body: options.fileBuffer,
        ContentType: options.mimeType,
        ServerSideEncryption: 'AES256',
        Metadata: {
          documentId,
          uploadedBy: options.uploadedBy,
          category: options.category,
          entityType: options.entityType,
          entityId: options.entityId,
          checksum,
        },
        Tagging: this.buildTagString({
          category: options.category,
          entityType: options.entityType,
          ...(options.tags && { customTags: options.tags.join(',') }),
        }),
      };

      await this.s3.putObject(uploadParams).promise();

      // Generate thumbnail for images
      let thumbnailKey: string | undefined;
      if (this.isImage(options.mimeType)) {
        thumbnailKey = await this.generateThumbnail(
          options.fileBuffer,
          s3Key,
          options.mimeType,
        );
      }

      const metadata: DocumentMetadata = {
        id: documentId,
        fileName: options.fileName,
        fileType: fileExtension,
        fileSize: options.fileBuffer.length,
        mimeType: options.mimeType,
        category: options.category,
        uploadedBy: options.uploadedBy,
        uploadedAt: new Date(),
        entityType: options.entityType,
        entityId: options.entityId,
        tags: options.tags,
        description: options.description,
        expiresAt: options.expiresAt,
        checksum,
        s3Key,
        s3Bucket: this.bucketName,
        thumbnailKey,
      };

      logger.info('Document uploaded successfully', { documentId, s3Key });

      return metadata;
    } catch (error) {
      logger.error('Document upload failed', error);
      throw new Error('Failed to upload document');
    }
  }

  /**
   * Download a document from S3
   */
  async downloadDocument(s3Key: string): Promise<Buffer> {
    try {
      const params: AWS.S3.GetObjectRequest = {
        Bucket: this.bucketName,
        Key: s3Key,
      };

      const data = await this.s3.getObject(params).promise();
      
      if (!data.Body) {
        throw new Error('Document body is empty');
      }

      return data.Body as Buffer;
    } catch (error) {
      logger.error('Document download failed', error);
      throw new Error('Failed to download document');
    }
  }

  /**
   * Get a signed URL for document access
   */
  async getSignedUrl(
    s3Key: string,
    operation: 'getObject' | 'putObject' = 'getObject',
    options: SignedUrlOptions = {},
  ): Promise<string> {
    try {
      const params: any = {
        Bucket: this.bucketName,
        Key: s3Key,
        Expires: options.expiresIn || 3600, // 1 hour default
      };

      if (options.responseContentDisposition) {
        params.ResponseContentDisposition = options.responseContentDisposition;
      }

      if (options.responseContentType) {
        params.ResponseContentType = options.responseContentType;
      }

      // Use CloudFront signed URL if available
      if (this.cloudFrontDomain && operation === 'getObject') {
        return this.getCloudFrontSignedUrl(s3Key, options);
      }

      return await this.s3.getSignedUrlPromise(operation, params);
    } catch (error) {
      logger.error('Failed to generate signed URL', error);
      throw new Error('Failed to generate document URL');
    }
  }

  /**
   * Delete a document from S3
   */
  async deleteDocument(s3Key: string): Promise<void> {
    try {
      const params: AWS.S3.DeleteObjectRequest = {
        Bucket: this.bucketName,
        Key: s3Key,
      };

      await this.s3.deleteObject(params).promise();

      // Delete thumbnail if exists
      const thumbnailKey = s3Key.replace('/documents/', '/thumbnails/').replace(/\.[^.]+$/, '_thumb.jpg');
      try {
        await this.s3.deleteObject({ ...params, Key: thumbnailKey }).promise();
      } catch (error) {
        // Ignore thumbnail deletion errors
      }

      logger.info('Document deleted successfully', { s3Key });
    } catch (error) {
      logger.error('Document deletion failed', error);
      throw new Error('Failed to delete document');
    }
  }

  /**
   * Copy a document to a new location
   */
  async copyDocument(
    sourceKey: string,
    destinationKey: string,
    metadata?: Partial<DocumentMetadata>,
  ): Promise<string> {
    try {
      const copyParams: AWS.S3.CopyObjectRequest = {
        Bucket: this.bucketName,
        CopySource: `${this.bucketName}/${sourceKey}`,
        Key: destinationKey,
        ServerSideEncryption: 'AES256',
        MetadataDirective: metadata ? 'REPLACE' : 'COPY',
        Metadata: metadata ? this.metadataToS3Metadata(metadata) : undefined,
      };

      await this.s3.copyObject(copyParams).promise();

      logger.info('Document copied successfully', { sourceKey, destinationKey });

      return destinationKey;
    } catch (error) {
      logger.error('Document copy failed', error);
      throw new Error('Failed to copy document');
    }
  }

  /**
   * List documents by prefix
   */
  async listDocuments(prefix: string, maxKeys = 1000): Promise<AWS.S3.Object[]> {
    try {
      const params: AWS.S3.ListObjectsV2Request = {
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: maxKeys,
      };

      const data = await this.s3.listObjectsV2(params).promise();

      return data.Contents || [];
    } catch (error) {
      logger.error('Failed to list documents', error);
      throw new Error('Failed to list documents');
    }
  }

  /**
   * Verify document integrity
   */
  async verifyDocumentIntegrity(s3Key: string, expectedChecksum: string): Promise<boolean> {
    try {
      const document = await this.downloadDocument(s3Key);
      const actualChecksum = this.calculateChecksum(document);

      return actualChecksum === expectedChecksum;
    } catch (error) {
      logger.error('Document integrity verification failed', error);
      return false;
    }
  }

  /**
   * Generate pre-signed POST data for direct browser uploads
   */
  async generatePresignedPost(
    key: string,
    contentType: string,
    maxSize = 10485760, // 10MB default
    expiresIn = 3600, // 1 hour
  ): Promise<AWS.S3.PresignedPost> {
    try {
      const params = {
        Bucket: this.bucketName,
        Conditions: [
          ['content-length-range', 0, maxSize],
          ['starts-with', '$Content-Type', contentType],
        ],
        Fields: {
          key,
          'Content-Type': contentType,
          'x-amz-server-side-encryption': 'AES256',
        },
        Expires: expiresIn,
      };

      return await new Promise((resolve, reject) => {
        this.s3.createPresignedPost(params, (err, data) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        });
      });
    } catch (error) {
      logger.error('Failed to generate presigned POST', error);
      throw new Error('Failed to generate upload URL');
    }
  }

  /**
   * Batch delete documents
   */
  async batchDeleteDocuments(s3Keys: string[]): Promise<void> {
    try {
      if (s3Keys.length === 0) {
        return;
      }

      const deleteParams: AWS.S3.DeleteObjectsRequest = {
        Bucket: this.bucketName,
        Delete: {
          Objects: s3Keys.map(Key => ({ Key })),
          Quiet: true,
        },
      };

      const result = await this.s3.deleteObjects(deleteParams).promise();

      if (result.Errors && result.Errors.length > 0) {
        logger.error('Some documents failed to delete', result.Errors);
        throw new Error('Failed to delete some documents');
      }

      logger.info(`Batch deleted ${s3Keys.length} documents`);
    } catch (error) {
      logger.error('Batch document deletion failed', error);
      throw new Error('Failed to batch delete documents');
    }
  }

  // Helper methods

  private generateS3Key(
    entityType: string,
    entityId: string,
    category: string,
    documentId: string,
    extension: string,
  ): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    return `documents/${entityType}/${entityId}/${category}/${year}/${month}/${documentId}.${extension}`;
  }

  private getFileExtension(fileName: string): string {
    const parts = fileName.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'bin';
  }

  private calculateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  private async generateThumbnail(
    imageBuffer: Buffer,
    originalKey: string,
    mimeType: string,
  ): Promise<string> {
    // In a production environment, you would use AWS Lambda with Sharp or ImageMagick
    // For now, we'll just create a placeholder
    const thumbnailKey = originalKey.replace('/documents/', '/thumbnails/').replace(/\.[^.]+$/, '_thumb.jpg');
    
    // TODO: Implement actual thumbnail generation
    // This would typically be done using AWS Lambda triggered by S3 events
    
    return thumbnailKey;
  }

  private buildTagString(tags: Record<string, string>): string {
    return Object.entries(tags)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
  }

  private metadataToS3Metadata(metadata: Partial<DocumentMetadata>): Record<string, string> {
    const s3Metadata: Record<string, string> = {};

    if (metadata.id) {
      s3Metadata.documentId = metadata.id;
    }
    if (metadata.uploadedBy) {
      s3Metadata.uploadedBy = metadata.uploadedBy;
    }
    if (metadata.category) {
      s3Metadata.category = metadata.category;
    }
    if (metadata.entityType) {
      s3Metadata.entityType = metadata.entityType;
    }
    if (metadata.entityId) {
      s3Metadata.entityId = metadata.entityId;
    }
    if (metadata.checksum) {
      s3Metadata.checksum = metadata.checksum;
    }

    return s3Metadata;
  }

  private getCloudFrontSignedUrl(
    s3Key: string,
    options: SignedUrlOptions,
  ): string {
    // Implement CloudFront signed URL generation
    // This requires CloudFront key pair setup
    const url = `https://${this.cloudFrontDomain}/${s3Key}`;
    
    // TODO: Implement actual CloudFront URL signing
    // This would use AWS.CloudFront.Signer
    
    return url;
  }

  /**
   * Get document categories by entity type
   */
  static getRequiredDocuments(entityType: 'loan' | 'user'): DocumentCategory[] {
    switch (entityType) {
    case 'user':
      return [
        DocumentCategory.IDENTITY,
        DocumentCategory.INCOME,
        DocumentCategory.BANK_STATEMENT,
      ];
    case 'loan':
      return [
        DocumentCategory.CONTRACT,
        DocumentCategory.AGREEMENT,
      ];
    default:
      return [];
    }
  }

  /**
   * Validate document type
   */
  static isValidDocumentType(mimeType: string): boolean {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    return allowedTypes.includes(mimeType);
  }

  /**
   * Get maximum file size by category
   */
  static getMaxFileSize(category: DocumentCategory): number {
    const limits: Record<DocumentCategory, number> = {
      [DocumentCategory.IDENTITY]: 5 * 1024 * 1024, // 5MB
      [DocumentCategory.INCOME]: 10 * 1024 * 1024, // 10MB
      [DocumentCategory.EMPLOYMENT]: 10 * 1024 * 1024, // 10MB
      [DocumentCategory.BANK_STATEMENT]: 20 * 1024 * 1024, // 20MB
      [DocumentCategory.TAX_RETURN]: 20 * 1024 * 1024, // 20MB
      [DocumentCategory.COLLATERAL]: 50 * 1024 * 1024, // 50MB
      [DocumentCategory.CONTRACT]: 10 * 1024 * 1024, // 10MB
      [DocumentCategory.AGREEMENT]: 10 * 1024 * 1024, // 10MB
      [DocumentCategory.CORRESPONDENCE]: 5 * 1024 * 1024, // 5MB
      [DocumentCategory.OTHER]: 10 * 1024 * 1024, // 10MB
    };

    return limits[category] || 10 * 1024 * 1024;
  }
}

// Export singleton instance
export const documentService = new DocumentService();