import { ClientSession } from 'mongoose';
import { DocumentModel, IDocument } from '../models/document.model';
import { DocumentCategory } from '../services/document.service';
import { logger } from '../utils/logger';

export interface DocumentSearchCriteria {
  entityType?: 'loan' | 'user' | 'application';
  entityId?: string;
  category?: DocumentCategory | DocumentCategory[];
  uploadedBy?: string;
  isVerified?: boolean;
  tags?: string[];
  startDate?: Date;
  endDate?: Date;
  fileTypes?: string[];
  isDeleted?: boolean;
  sharedWith?: string;
}

export interface DocumentStatistics {
  totalDocuments: number;
  totalSize: number;
  byCategory: Record<string, number>;
  byFileType: Record<string, number>;
  verifiedCount: number;
  unverifiedCount: number;
  averageFileSize: number;
}

export class DocumentRepository {
  /**
   * Create a new document record
   */
  async create(documentData: Partial<IDocument>, session?: ClientSession): Promise<IDocument> {
    try {
      const [document] = await DocumentModel.create([documentData], { session });
      logger.info('Document record created', { documentId: document.documentId });
      return document;
    } catch (error) {
      logger.error('Failed to create document record', error);
      throw error;
    }
  }

  /**
   * Find document by ID
   */
  async findById(documentId: string, session?: ClientSession): Promise<IDocument | null> {
    return DocumentModel.findOne({ documentId, isDeleted: false })
      .session(session || null)
      .exec();
  }

  /**
   * Find documents by entity
   */
  async findByEntity(
    entityType: 'loan' | 'user' | 'application',
    entityId: string,
    session?: ClientSession
  ): Promise<IDocument[]> {
    return DocumentModel.find({
      entityType,
      entityId,
      isDeleted: false,
    })
      .sort('-uploadedAt')
      .session(session || null)
      .exec();
  }

  /**
   * Search documents with criteria
   */
  async search(
    criteria: DocumentSearchCriteria,
    limit: number = 100,
    offset: number = 0,
    session?: ClientSession
  ): Promise<{ documents: IDocument[]; total: number }> {
    const query: any = { isDeleted: criteria.isDeleted ?? false };

    if (criteria.entityType) {
      query.entityType = criteria.entityType;
    }

    if (criteria.entityId) {
      query.entityId = criteria.entityId;
    }

    if (criteria.category) {
      query.category = Array.isArray(criteria.category)
        ? { $in: criteria.category }
        : criteria.category;
    }

    if (criteria.uploadedBy) {
      query.uploadedBy = criteria.uploadedBy;
    }

    if (criteria.isVerified !== undefined) {
      query.isVerified = criteria.isVerified;
    }

    if (criteria.tags && criteria.tags.length > 0) {
      query.tags = { $in: criteria.tags };
    }

    if (criteria.startDate || criteria.endDate) {
      query.uploadedAt = {};
      if (criteria.startDate) {
        query.uploadedAt.$gte = criteria.startDate;
      }
      if (criteria.endDate) {
        query.uploadedAt.$lte = criteria.endDate;
      }
    }

    if (criteria.fileTypes && criteria.fileTypes.length > 0) {
      query.fileType = { $in: criteria.fileTypes };
    }

    if (criteria.sharedWith) {
      query.sharedWith = criteria.sharedWith;
    }

    const [documents, total] = await Promise.all([
      DocumentModel.find(query)
        .sort('-uploadedAt')
        .limit(limit)
        .skip(offset)
        .session(session || null)
        .exec(),
      DocumentModel.countDocuments(query).session(session || null).exec(),
    ]);

    return { documents, total };
  }

  /**
   * Update document
   */
  async update(
    documentId: string,
    updateData: Partial<IDocument>,
    session?: ClientSession
  ): Promise<IDocument | null> {
    const document = await DocumentModel.findOneAndUpdate(
      { documentId, isDeleted: false },
      { $set: updateData },
      { new: true, session }
    );

    if (document) {
      logger.info('Document updated', { documentId });
    }

    return document;
  }

  /**
   * Soft delete document
   */
  async softDelete(
    documentId: string,
    deletedBy: string,
    session?: ClientSession
  ): Promise<boolean> {
    const result = await DocumentModel.updateOne(
      { documentId, isDeleted: false },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy,
        },
      },
      { session }
    );

    if (result.modifiedCount > 0) {
      logger.info('Document soft deleted', { documentId, deletedBy });
      return true;
    }

    return false;
  }

  /**
   * Verify document
   */
  async verify(
    documentId: string,
    verifiedBy: string,
    notes?: string,
    session?: ClientSession
  ): Promise<IDocument | null> {
    const updateData: any = {
      isVerified: true,
      verifiedBy,
      verifiedAt: new Date(),
    };

    if (notes) {
      updateData.verificationNotes = notes;
    }

    return this.update(documentId, updateData, session);
  }

  /**
   * Share document with users
   */
  async shareWithUsers(
    documentId: string,
    userIds: string[],
    session?: ClientSession
  ): Promise<IDocument | null> {
    return DocumentModel.findOneAndUpdate(
      { documentId, isDeleted: false },
      { $addToSet: { sharedWith: { $each: userIds } } },
      { new: true, session }
    );
  }

  /**
   * Unshare document with users
   */
  async unshareWithUsers(
    documentId: string,
    userIds: string[],
    session?: ClientSession
  ): Promise<IDocument | null> {
    return DocumentModel.findOneAndUpdate(
      { documentId, isDeleted: false },
      { $pull: { sharedWith: { $in: userIds } } },
      { new: true, session }
    );
  }

  /**
   * Get document statistics
   */
  async getStatistics(
    entityType?: 'loan' | 'user' | 'application',
    entityId?: string
  ): Promise<DocumentStatistics> {
    const matchStage: any = { isDeleted: false };
    
    if (entityType) {
      matchStage.entityType = entityType;
    }
    
    if (entityId) {
      matchStage.entityId = entityId;
    }

    const stats = await DocumentModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalDocuments: { $sum: 1 },
          totalSize: { $sum: '$fileSize' },
          verifiedCount: {
            $sum: { $cond: ['$isVerified', 1, 0] },
          },
          categories: { $push: '$category' },
          fileTypes: { $push: '$fileType' },
          fileSizes: { $push: '$fileSize' },
        },
      },
      {
        $project: {
          totalDocuments: 1,
          totalSize: 1,
          verifiedCount: 1,
          unverifiedCount: { $subtract: ['$totalDocuments', '$verifiedCount'] },
          averageFileSize: { $avg: '$fileSizes' },
          categories: 1,
          fileTypes: 1,
        },
      },
    ]);

    if (stats.length === 0) {
      return {
        totalDocuments: 0,
        totalSize: 0,
        byCategory: {},
        byFileType: {},
        verifiedCount: 0,
        unverifiedCount: 0,
        averageFileSize: 0,
      };
    }

    const result = stats[0];

    // Count by category
    const byCategory: Record<string, number> = {};
    result.categories.forEach((cat: string) => {
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    });

    // Count by file type
    const byFileType: Record<string, number> = {};
    result.fileTypes.forEach((type: string) => {
      byFileType[type] = (byFileType[type] || 0) + 1;
    });

    return {
      totalDocuments: result.totalDocuments,
      totalSize: result.totalSize,
      byCategory,
      byFileType,
      verifiedCount: result.verifiedCount,
      unverifiedCount: result.unverifiedCount,
      averageFileSize: Math.round(result.averageFileSize || 0),
    };
  }

  /**
   * Find expired documents
   */
  async findExpiredDocuments(session?: ClientSession): Promise<IDocument[]> {
    return DocumentModel.find({
      expiresAt: { $lt: new Date() },
      isDeleted: false,
    })
      .session(session || null)
      .exec();
  }

  /**
   * Find unverified documents older than specified days
   */
  async findUnverifiedDocuments(
    daysOld: number = 7,
    session?: ClientSession
  ): Promise<IDocument[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return DocumentModel.find({
      isVerified: false,
      uploadedAt: { $lt: cutoffDate },
      isDeleted: false,
    })
      .session(session || null)
      .exec();
  }

  /**
   * Update last accessed timestamp
   */
  async updateLastAccessed(
    documentId: string,
    session?: ClientSession
  ): Promise<void> {
    await DocumentModel.updateOne(
      { documentId, isDeleted: false },
      { $set: { lastAccessedAt: new Date() } },
      { session }
    );
  }

  /**
   * Get documents requiring verification
   */
  async getDocumentsRequiringVerification(
    limit: number = 50,
    session?: ClientSession
  ): Promise<IDocument[]> {
    return DocumentModel.find({
      isVerified: false,
      isDeleted: false,
      category: {
        $in: [
          DocumentCategory.IDENTITY,
          DocumentCategory.INCOME,
          DocumentCategory.EMPLOYMENT,
          DocumentCategory.BANK_STATEMENT,
        ],
      },
    })
      .sort('uploadedAt')
      .limit(limit)
      .session(session || null)
      .exec();
  }

  /**
   * Bulk update documents
   */
  async bulkUpdate(
    documentIds: string[],
    updateData: Partial<IDocument>,
    session?: ClientSession
  ): Promise<number> {
    const result = await DocumentModel.updateMany(
      { documentId: { $in: documentIds }, isDeleted: false },
      { $set: updateData },
      { session }
    );

    return result.modifiedCount;
  }

  /**
   * Create new version of document
   */
  async createVersion(
    originalDocumentId: string,
    newDocumentData: Partial<IDocument>,
    session?: ClientSession
  ): Promise<IDocument> {
    // Mark current version as not latest
    await DocumentModel.updateOne(
      { documentId: originalDocumentId },
      { $set: { isLatestVersion: false } },
      { session }
    );

    // Create new version
    const newVersion = await this.create(
      {
        ...newDocumentData,
        previousVersionId: originalDocumentId,
        version: (newDocumentData.version || 1) + 1,
        isLatestVersion: true,
      },
      session
    );

    logger.info('Document version created', {
      originalDocumentId,
      newDocumentId: newVersion.documentId,
      version: newVersion.version,
    });

    return newVersion;
  }

  /**
   * Get document versions
   */
  async getVersionHistory(
    documentId: string,
    session?: ClientSession
  ): Promise<IDocument[]> {
    const document = await this.findById(documentId, session);
    if (!document) {
      return [];
    }

    // Find all documents in the version chain
    const versions: IDocument[] = [document];
    let currentDoc = document;

    // Traverse backward through versions
    while (currentDoc.previousVersionId) {
      const prevDoc = await this.findById(currentDoc.previousVersionId, session);
      if (!prevDoc) break;
      versions.push(prevDoc);
      currentDoc = prevDoc;
    }

    // Traverse forward to find newer versions
    const newerVersions = await DocumentModel.find({
      previousVersionId: documentId,
      isDeleted: false,
    })
      .session(session || null)
      .exec();

    versions.unshift(...newerVersions);

    return versions.sort((a, b) => b.version - a.version);
  }
}

// Export singleton instance
export const documentRepository = new DocumentRepository();