import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { asyncHandler } from '../utils/async-handler';
import { documentService, DocumentCategory } from '../../services/document.service';
import { documentRepository } from '../../repositories/document.repository';
import { userRepository } from '../../repositories/user.repository';
import { loanRepository } from '../../repositories/loan.repository';
import * as yup from 'yup';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (req, file, cb) => {
    if (!documentService.isValidDocumentType(file.mimetype)) {
      cb(new Error('Invalid file type'));
      return;
    }
    cb(null, true);
  },
});

// Apply authentication to all routes
router.use(authenticate);

/**
 * POST /documents/upload
 * Upload a new document
 */
router.post('/upload',
  upload.single('document'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({
        error: {
          code: 'NO_FILE',
          message: 'No file uploaded',
        },
      });
      return;
    }

    const schema = yup.object({
      category: yup.string().oneOf(Object.values(DocumentCategory)).required(),
      entityType: yup.string().oneOf(['loan', 'user', 'application']).required(),
      entityId: yup.string().required(),
      tags: yup.array().of(yup.string()),
      description: yup.string(),
      expiresAt: yup.date(),
    });

    const body = await schema.validate(req.body);

    // Verify entity exists and user has access
    if (body.entityType === 'loan') {
      const loan = await loanRepository.findById(body.entityId);
      if (!loan) {
        res.status(404).json({
          error: {
            code: 'ENTITY_NOT_FOUND',
            message: 'Loan not found',
          },
        });
        return;
      }

      // Check if user has access to this loan
      const userRole = req.user?.roles?.[0] || 'BORROWER';
      if (userRole === 'BORROWER' && loan.borrowerId !== req.user?.id) {
        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have access to this loan',
          },
        });
        return;
      }
    } else if (body.entityType === 'user') {
      const user = await userRepository.findById(body.entityId);
      if (!user) {
        res.status(404).json({
          error: {
            code: 'ENTITY_NOT_FOUND',
            message: 'User not found',
          },
        });
        return;
      }

      // Users can only upload their own documents unless admin
      const userRole = req.user?.roles?.[0] || 'BORROWER';
      if (userRole === 'BORROWER' && body.entityId !== req.user?.id) {
        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'You can only upload documents for your own profile',
          },
        });
        return;
      }
    }

    // Check file size limit for category
    const maxSize = documentService.getMaxFileSize(body.category as DocumentCategory);
    if (req.file.size > maxSize) {
      res.status(400).json({
        error: {
          code: 'FILE_TOO_LARGE',
          message: `File size exceeds limit of ${maxSize / (1024 * 1024)}MB for this category`,
        },
      });
      return;
    }

    // Upload to S3
    const documentMetadata = await documentService.uploadDocument({
      fileName: req.file.originalname,
      fileBuffer: req.file.buffer,
      mimeType: req.file.mimetype,
      category: body.category as DocumentCategory,
      uploadedBy: req.user?.id || 'unknown',
      entityType: body.entityType as 'loan' | 'user' | 'application',
      entityId: body.entityId,
      tags: body.tags,
      description: body.description,
      expiresAt: body.expiresAt,
    });

    // Save to database
    const document = await documentRepository.create({
      ...documentMetadata,
      uploadedBy: req.user?.id || 'unknown',
    });

    res.status(201).json({
      data: document,
    });
  }),
);

/**
 * GET /documents/:documentId
 * Get document metadata
 */
router.get('/:documentId',
  asyncHandler(async (req, res) => {
    const { documentId } = req.params;

    const document = await documentRepository.findById(documentId);
    if (!document) {
      res.status(404).json({
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Document not found',
        },
      });
      return;
    }

    // Check access permissions
    const userRole = req.user?.roles?.[0] || 'BORROWER';
    const userId = req.user?.id;

    if (userRole === 'BORROWER') {
      // Check if user has access
      const hasAccess = 
        document.uploadedBy === userId ||
        document.sharedWith.includes(userId || '') ||
        (document.entityType === 'user' && document.entityId === userId);

      if (!hasAccess) {
        // Check if user has access to the associated entity
        if (document.entityType === 'loan') {
          const loan = await loanRepository.findById(document.entityId);
          if (!loan || loan.borrowerId !== userId) {
            res.status(403).json({
              error: {
                code: 'ACCESS_DENIED',
                message: 'You do not have access to this document',
              },
            });
            return;
          }
        } else {
          res.status(403).json({
            error: {
              code: 'ACCESS_DENIED',
              message: 'You do not have access to this document',
            },
          });
          return;
        }
      }
    }

    // Update last accessed
    await documentRepository.updateLastAccessed(documentId);

    res.json({
      data: document,
    });
  }),
);

/**
 * GET /documents/:documentId/download
 * Download document
 */
router.get('/:documentId/download',
  asyncHandler(async (req, res) => {
    const { documentId } = req.params;

    const document = await documentRepository.findById(documentId);
    if (!document) {
      res.status(404).json({
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Document not found',
        },
      });
      return;
    }

    // Check access permissions (same as above)
    const userRole = req.user?.roles?.[0] || 'BORROWER';
    const userId = req.user?.id;

    if (userRole === 'BORROWER') {
      const hasAccess = 
        document.uploadedBy === userId ||
        document.sharedWith.includes(userId || '') ||
        (document.entityType === 'user' && document.entityId === userId);

      if (!hasAccess && document.entityType === 'loan') {
        const loan = await loanRepository.findById(document.entityId);
        if (!loan || loan.borrowerId !== userId) {
          res.status(403).json({
            error: {
              code: 'ACCESS_DENIED',
              message: 'You do not have access to this document',
            },
          });
          return;
        }
      } else if (!hasAccess) {
        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have access to this document',
          },
        });
        return;
      }
    }

    // Generate signed URL for download
    const signedUrl = await documentService.getSignedUrl(document.s3Key, 'getObject', {
      expiresIn: 3600, // 1 hour
      responseContentDisposition: `attachment; filename="${document.fileName}"`,
      responseContentType: document.mimeType,
    });

    // Update last accessed
    await documentRepository.updateLastAccessed(documentId);

    res.json({
      data: {
        url: signedUrl,
        fileName: document.fileName,
        mimeType: document.mimeType,
        fileSize: document.fileSize,
        expiresIn: 3600,
      },
    });
  }),
);

/**
 * GET /documents/:documentId/thumbnail
 * Get document thumbnail (for images)
 */
router.get('/:documentId/thumbnail',
  asyncHandler(async (req, res) => {
    const { documentId } = req.params;

    const document = await documentRepository.findById(documentId);
    if (!document || !document.thumbnailKey) {
      res.status(404).json({
        error: {
          code: 'THUMBNAIL_NOT_FOUND',
          message: 'Thumbnail not found',
        },
      });
      return;
    }

    // Generate signed URL for thumbnail
    const signedUrl = await documentService.getSignedUrl(document.thumbnailKey, 'getObject', {
      expiresIn: 3600,
    });

    res.json({
      data: {
        url: signedUrl,
        expiresIn: 3600,
      },
    });
  }),
);

/**
 * DELETE /documents/:documentId
 * Delete document (soft delete)
 */
router.delete('/:documentId',
  asyncHandler(async (req, res) => {
    const { documentId } = req.params;

    const document = await documentRepository.findById(documentId);
    if (!document) {
      res.status(404).json({
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Document not found',
        },
      });
      return;
    }

    // Check permissions
    const userRole = req.user?.roles?.[0] || 'BORROWER';
    const userId = req.user?.id || '';

    if (userRole === 'BORROWER' && document.uploadedBy !== userId) {
      res.status(403).json({
        error: {
          code: 'ACCESS_DENIED',
          message: 'You can only delete documents you uploaded',
        },
      });
      return;
    }

    // Soft delete in database
    await documentRepository.softDelete(documentId, userId);

    // Optionally delete from S3 (based on your retention policy)
    // await documentService.deleteDocument(document.s3Key);

    res.json({
      message: 'Document deleted successfully',
    });
  }),
);

/**
 * PUT /documents/:documentId/verify
 * Verify document (admin/loan officer only)
 */
router.put('/:documentId/verify',
  authorize(['ADMIN', 'SUPER_ADMIN', 'LOAN_OFFICER']),
  asyncHandler(async (req, res) => {
    const { documentId } = req.params;
    const { notes } = req.body;

    const document = await documentRepository.findById(documentId);
    if (!document) {
      res.status(404).json({
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Document not found',
        },
      });
      return;
    }

    // Verify document integrity
    const isValid = await documentService.verifyDocumentIntegrity(
      document.s3Key,
      document.checksum,
    );

    if (!isValid) {
      res.status(400).json({
        error: {
          code: 'INTEGRITY_CHECK_FAILED',
          message: 'Document integrity check failed',
        },
      });
      return;
    }

    // Update verification status
    const verifiedDocument = await documentRepository.verify(
      documentId,
      req.user?.id || 'unknown',
      notes,
    );

    res.json({
      data: verifiedDocument,
    });
  }),
);

/**
 * POST /documents/:documentId/share
 * Share document with users
 */
router.post('/:documentId/share',
  asyncHandler(async (req, res) => {
    const { documentId } = req.params;
    const schema = yup.object({
      userIds: yup.array().of(yup.string().required()).required().min(1),
    });

    const { userIds } = await schema.validate(req.body);

    const document = await documentRepository.findById(documentId);
    if (!document) {
      res.status(404).json({
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Document not found',
        },
      });
      return;
    }

    // Check permissions
    const userRole = req.user?.roles?.[0] || 'BORROWER';
    const userId = req.user?.id || '';

    if (userRole === 'BORROWER' && document.uploadedBy !== userId) {
      res.status(403).json({
        error: {
          code: 'ACCESS_DENIED',
          message: 'You can only share documents you uploaded',
        },
      });
      return;
    }

    // Verify all user IDs exist
    for (const targetUserId of userIds) {
      const user = await userRepository.findById(targetUserId);
      if (!user) {
        res.status(400).json({
          error: {
            code: 'INVALID_USER',
            message: `User ${targetUserId} not found`,
          },
        });
        return;
      }
    }

    // Share document
    const sharedDocument = await documentRepository.shareWithUsers(documentId, userIds);

    res.json({
      data: sharedDocument,
    });
  }),
);

/**
 * GET /documents/entity/:entityType/:entityId
 * Get all documents for an entity
 */
router.get('/entity/:entityType/:entityId',
  asyncHandler(async (req, res) => {
    const { entityType, entityId } = req.params;
    const { category, verified } = req.query;

    if (!['loan', 'user', 'application'].includes(entityType)) {
      res.status(400).json({
        error: {
          code: 'INVALID_ENTITY_TYPE',
          message: 'Invalid entity type',
        },
      });
      return;
    }

    // Check access permissions
    const userRole = req.user?.roles?.[0] || 'BORROWER';
    const userId = req.user?.id;

    if (userRole === 'BORROWER') {
      if (entityType === 'user' && entityId !== userId) {
        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'You can only view your own documents',
          },
        });
        return;
      } else if (entityType === 'loan') {
        const loan = await loanRepository.findById(entityId);
        if (!loan || loan.borrowerId !== userId) {
          res.status(403).json({
            error: {
              code: 'ACCESS_DENIED',
              message: 'You do not have access to this loan',
            },
          });
          return;
        }
      }
    }

    // Build search criteria
    const criteria: any = {
      entityType: entityType as 'loan' | 'user' | 'application',
      entityId,
    };

    if (category) {
      criteria.category = category as DocumentCategory;
    }

    if (verified !== undefined) {
      criteria.isVerified = verified === 'true';
    }

    const { documents } = await documentRepository.search(criteria);

    res.json({
      data: documents,
    });
  }),
);

/**
 * GET /documents/search
 * Search documents
 */
router.get('/search',
  asyncHandler(async (req, res) => {
    const schema = yup.object({
      entityType: yup.string().oneOf(['loan', 'user', 'application']),
      entityId: yup.string(),
      category: yup.string().oneOf(Object.values(DocumentCategory)),
      uploadedBy: yup.string(),
      verified: yup.boolean(),
      tags: yup.array().of(yup.string()),
      startDate: yup.date(),
      endDate: yup.date(),
      fileTypes: yup.array().of(yup.string()),
      limit: yup.number().min(1).max(100).default(50),
      offset: yup.number().min(0).default(0),
    });

    const query = await schema.validate(req.query);

    // Restrict search for borrowers
    const userRole = req.user?.roles?.[0] || 'BORROWER';
    const userId = req.user?.id;

    const searchCriteria: any = {};

    if (userRole === 'BORROWER') {
      // Borrowers can only search their own documents
      searchCriteria.uploadedBy = userId;
    } else {
      // Admins can search with provided criteria
      Object.assign(searchCriteria, {
        entityType: query.entityType,
        entityId: query.entityId,
        category: query.category,
        uploadedBy: query.uploadedBy,
        isVerified: query.verified,
        tags: query.tags,
        startDate: query.startDate,
        endDate: query.endDate,
        fileTypes: query.fileTypes,
      });
    }

    const { documents, total } = await documentRepository.search(
      searchCriteria,
      query.limit,
      query.offset,
    );

    res.json({
      data: documents,
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
      },
    });
  }),
);

/**
 * GET /documents/statistics
 * Get document statistics
 */
router.get('/statistics',
  authorize(['ADMIN', 'SUPER_ADMIN', 'LOAN_OFFICER']),
  asyncHandler(async (req, res) => {
    const { entityType, entityId } = req.query;

    const stats = await documentRepository.getStatistics(
      entityType as 'loan' | 'user' | 'application' | undefined,
      entityId as string | undefined,
    );

    res.json({
      data: stats,
    });
  }),
);

/**
 * GET /documents/verification-queue
 * Get documents requiring verification
 */
router.get('/verification-queue',
  authorize(['ADMIN', 'SUPER_ADMIN', 'LOAN_OFFICER']),
  asyncHandler(async (req, res) => {
    const { limit = 50 } = req.query;

    const documents = await documentRepository.getDocumentsRequiringVerification(
      Number(limit),
    );

    res.json({
      data: documents,
    });
  }),
);

/**
 * POST /documents/presigned-upload
 * Get presigned URL for direct browser upload
 */
router.post('/presigned-upload',
  asyncHandler(async (req, res) => {
    const schema = yup.object({
      fileName: yup.string().required(),
      mimeType: yup.string().required(),
      category: yup.string().oneOf(Object.values(DocumentCategory)).required(),
      entityType: yup.string().oneOf(['loan', 'user', 'application']).required(),
      entityId: yup.string().required(),
    });

    const body = await schema.validate(req.body);

    // Validate file type
    if (!documentService.isValidDocumentType(body.mimeType)) {
      res.status(400).json({
        error: {
          code: 'INVALID_FILE_TYPE',
          message: 'Invalid file type',
        },
      });
      return;
    }

    // Check entity access (same as upload endpoint)
    // ... (access check logic)

    const documentId = uuidv4();
    const fileExtension = body.fileName.split('.').pop() || 'bin';
    const s3Key = `documents/${body.entityType}/${body.entityId}/${body.category}/${documentId}.${fileExtension}`;

    const presignedPost = await documentService.generatePresignedPost(
      s3Key,
      body.mimeType,
      documentService.getMaxFileSize(body.category as DocumentCategory),
    );

    res.json({
      data: {
        documentId,
        uploadUrl: presignedPost.url,
        fields: presignedPost.fields,
      },
    });
  }),
);

// Helper function
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export { router as documentsRouter };