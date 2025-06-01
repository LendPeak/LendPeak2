import { DocumentService, DocumentCategory } from '../document.service';
import AWS from 'aws-sdk';

// Mock AWS SDK
jest.mock('aws-sdk', () => {
  const mockS3 = {
    putObject: jest.fn().mockReturnThis(),
    getObject: jest.fn().mockReturnThis(),
    deleteObject: jest.fn().mockReturnThis(),
    copyObject: jest.fn().mockReturnThis(),
    listObjectsV2: jest.fn().mockReturnThis(),
    deleteObjects: jest.fn().mockReturnThis(),
    getSignedUrlPromise: jest.fn(),
    createPresignedPost: jest.fn(),
    promise: jest.fn(),
  };

  return {
    S3: jest.fn(() => mockS3),
    CloudFront: jest.fn(),
  };
});

describe('DocumentService', () => {
  let documentService: DocumentService;
  let mockS3: any;

  beforeEach(() => {
    documentService = new DocumentService();
    mockS3 = new AWS.S3();
    jest.clearAllMocks();
  });

  describe('uploadDocument', () => {
    it('should upload document to S3 successfully', async () => {
      const mockBuffer = Buffer.from('test content');
      const uploadOptions = {
        fileName: 'test-document.pdf',
        fileBuffer: mockBuffer,
        mimeType: 'application/pdf',
        category: DocumentCategory.IDENTITY,
        uploadedBy: 'user123',
        entityType: 'user' as const,
        entityId: 'user123',
        tags: ['verification', 'identity'],
        description: 'Passport scan',
      };

      mockS3.putObject.mockReturnValue({
        promise: jest.fn().mockResolvedValue({}),
      });

      const result = await documentService.uploadDocument(uploadOptions);

      expect(mockS3.putObject).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: expect.any(String),
          Key: expect.stringContaining('documents/user/user123/identity'),
          Body: mockBuffer,
          ContentType: 'application/pdf',
          ServerSideEncryption: 'AES256',
        })
      );

      expect(result).toMatchObject({
        fileName: 'test-document.pdf',
        fileType: 'pdf',
        fileSize: mockBuffer.length,
        mimeType: 'application/pdf',
        category: DocumentCategory.IDENTITY,
        uploadedBy: 'user123',
        entityType: 'user',
        entityId: 'user123',
      });

      expect(result.id).toBeDefined();
      expect(result.s3Key).toBeDefined();
      expect(result.checksum).toBeDefined();
    });

    it('should generate thumbnail for image uploads', async () => {
      const mockImageBuffer = Buffer.from('image data');
      const uploadOptions = {
        fileName: 'photo.jpg',
        fileBuffer: mockImageBuffer,
        mimeType: 'image/jpeg',
        category: DocumentCategory.COLLATERAL,
        uploadedBy: 'user123',
        entityType: 'loan' as const,
        entityId: 'loan123',
      };

      mockS3.putObject.mockReturnValue({
        promise: jest.fn().mockResolvedValue({}),
      });

      const result = await documentService.uploadDocument(uploadOptions);

      expect(result.thumbnailKey).toBeDefined();
      expect(result.thumbnailKey).toContain('thumbnails');
      expect(result.thumbnailKey).toContain('_thumb.jpg');
    });
  });

  describe('downloadDocument', () => {
    it('should download document from S3', async () => {
      const mockData = Buffer.from('document content');
      mockS3.getObject.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Body: mockData,
        }),
      });

      const result = await documentService.downloadDocument('test-key');

      expect(mockS3.getObject).toHaveBeenCalledWith({
        Bucket: expect.any(String),
        Key: 'test-key',
      });

      expect(result).toEqual(mockData);
    });

    it('should throw error if document body is empty', async () => {
      mockS3.getObject.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Body: null,
        }),
      });

      await expect(documentService.downloadDocument('test-key'))
        .rejects.toThrow('Document body is empty');
    });
  });

  describe('getSignedUrl', () => {
    it('should generate signed URL for download', async () => {
      const mockUrl = 'https://s3.amazonaws.com/signed-url';
      mockS3.getSignedUrlPromise.mockResolvedValue(mockUrl);

      const result = await documentService.getSignedUrl('test-key');

      expect(mockS3.getSignedUrlPromise).toHaveBeenCalledWith(
        'getObject',
        expect.objectContaining({
          Bucket: expect.any(String),
          Key: 'test-key',
          Expires: 3600,
        })
      );

      expect(result).toBe(mockUrl);
    });

    it('should include response headers if provided', async () => {
      const mockUrl = 'https://s3.amazonaws.com/signed-url';
      mockS3.getSignedUrlPromise.mockResolvedValue(mockUrl);

      await documentService.getSignedUrl('test-key', 'getObject', {
        responseContentDisposition: 'attachment; filename="document.pdf"',
        responseContentType: 'application/pdf',
      });

      expect(mockS3.getSignedUrlPromise).toHaveBeenCalledWith(
        'getObject',
        expect.objectContaining({
          ResponseContentDisposition: 'attachment; filename="document.pdf"',
          ResponseContentType: 'application/pdf',
        })
      );
    });
  });

  describe('deleteDocument', () => {
    it('should delete document from S3', async () => {
      mockS3.deleteObject.mockReturnValue({
        promise: jest.fn().mockResolvedValue({}),
      });

      await documentService.deleteDocument('test-key');

      expect(mockS3.deleteObject).toHaveBeenCalledWith({
        Bucket: expect.any(String),
        Key: 'test-key',
      });

      // Should also attempt to delete thumbnail
      expect(mockS3.deleteObject).toHaveBeenCalledTimes(2);
    });
  });

  describe('copyDocument', () => {
    it('should copy document to new location', async () => {
      mockS3.copyObject.mockReturnValue({
        promise: jest.fn().mockResolvedValue({}),
      });

      const result = await documentService.copyDocument(
        'source-key',
        'destination-key'
      );

      expect(mockS3.copyObject).toHaveBeenCalledWith({
        Bucket: expect.any(String),
        CopySource: expect.stringContaining('source-key'),
        Key: 'destination-key',
        ServerSideEncryption: 'AES256',
        MetadataDirective: 'COPY',
      });

      expect(result).toBe('destination-key');
    });
  });

  describe('verifyDocumentIntegrity', () => {
    it('should verify document checksum matches', async () => {
      const mockData = Buffer.from('document content');
      const expectedChecksum = 'ed7002b439e9ac845f22357d822bac1444730fbdb6016d3ec9432297b9ec9f73';

      mockS3.getObject.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Body: mockData,
        }),
      });

      const result = await documentService.verifyDocumentIntegrity(
        'test-key',
        expectedChecksum
      );

      expect(result).toBe(true);
    });

    it('should return false for mismatched checksum', async () => {
      const mockData = Buffer.from('different content');
      
      mockS3.getObject.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Body: mockData,
        }),
      });

      const result = await documentService.verifyDocumentIntegrity(
        'test-key',
        'wrong-checksum'
      );

      expect(result).toBe(false);
    });
  });

  describe('batchDeleteDocuments', () => {
    it('should batch delete multiple documents', async () => {
      const s3Keys = ['key1', 'key2', 'key3'];

      mockS3.deleteObjects.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Deleted: s3Keys.map(Key => ({ Key })),
        }),
      });

      await documentService.batchDeleteDocuments(s3Keys);

      expect(mockS3.deleteObjects).toHaveBeenCalledWith({
        Bucket: expect.any(String),
        Delete: {
          Objects: s3Keys.map(Key => ({ Key })),
          Quiet: true,
        },
      });
    });

    it('should throw error if some deletions fail', async () => {
      mockS3.deleteObjects.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Errors: [{ Key: 'key1', Message: 'Access Denied' }],
        }),
      });

      await expect(documentService.batchDeleteDocuments(['key1', 'key2']))
        .rejects.toThrow('Failed to delete some documents');
    });
  });

  describe('generatePresignedPost', () => {
    it('should generate presigned POST data', async () => {
      const mockPresignedPost = {
        url: 'https://s3.amazonaws.com/bucket',
        fields: {
          key: 'test-key',
          'Content-Type': 'application/pdf',
        },
      };

      mockS3.createPresignedPost.mockImplementation((params, callback) => {
        callback(null, mockPresignedPost);
      });

      const result = await documentService.generatePresignedPost(
        'test-key',
        'application/pdf',
        10485760,
        3600
      );

      expect(result).toEqual(mockPresignedPost);
      expect(mockS3.createPresignedPost).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: expect.any(String),
          Fields: expect.objectContaining({
            key: 'test-key',
            'Content-Type': 'application/pdf',
          }),
        }),
        expect.any(Function)
      );
    });
  });

  describe('static methods', () => {
    it('should return required documents by entity type', () => {
      const userDocs = DocumentService.getRequiredDocuments('user');
      expect(userDocs).toContain(DocumentCategory.IDENTITY);
      expect(userDocs).toContain(DocumentCategory.INCOME);
      expect(userDocs).toContain(DocumentCategory.BANK_STATEMENT);

      const loanDocs = DocumentService.getRequiredDocuments('loan');
      expect(loanDocs).toContain(DocumentCategory.CONTRACT);
      expect(loanDocs).toContain(DocumentCategory.AGREEMENT);
    });

    it('should validate document types', () => {
      expect(DocumentService.isValidDocumentType('application/pdf')).toBe(true);
      expect(DocumentService.isValidDocumentType('image/jpeg')).toBe(true);
      expect(DocumentService.isValidDocumentType('text/plain')).toBe(false);
      expect(DocumentService.isValidDocumentType('application/x-executable')).toBe(false);
    });

    it('should return max file size by category', () => {
      expect(DocumentService.getMaxFileSize(DocumentCategory.IDENTITY)).toBe(5 * 1024 * 1024);
      expect(DocumentService.getMaxFileSize(DocumentCategory.COLLATERAL)).toBe(50 * 1024 * 1024);
      expect(DocumentService.getMaxFileSize(DocumentCategory.BANK_STATEMENT)).toBe(20 * 1024 * 1024);
    });
  });
});