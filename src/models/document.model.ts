import { Document, Schema, model } from 'mongoose';
import { DocumentCategory } from '../services/document.service';

export interface IDocument extends Document {
  // Document identification
  documentId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  mimeType: string;
  
  // Categorization
  category: DocumentCategory;
  tags: string[];
  description?: string;
  
  // Ownership and association
  uploadedBy: string;
  entityType: 'loan' | 'user' | 'application';
  entityId: string;
  
  // Storage information
  s3Key: string;
  s3Bucket: string;
  thumbnailKey?: string;
  checksum: string;
  
  // Verification status
  isVerified: boolean;
  verifiedBy?: string;
  verifiedAt?: Date;
  verificationNotes?: string;
  
  // Lifecycle
  uploadedAt: Date;
  lastAccessedAt?: Date;
  expiresAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  
  // Access control
  isPublic: boolean;
  allowedRoles: string[];
  sharedWith: string[]; // User IDs
  
  // Metadata
  extractedText?: string; // For OCR/text extraction
  metadata?: Record<string, any>;
  
  // Versioning
  version: number;
  previousVersionId?: string;
  isLatestVersion: boolean;
}

const DocumentSchema = new Schema<IDocument>({
  documentId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  fileName: {
    type: String,
    required: true,
  },
  fileType: {
    type: String,
    required: true,
  },
  fileSize: {
    type: Number,
    required: true,
    min: 0,
  },
  mimeType: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    enum: Object.values(DocumentCategory),
    required: true,
    index: true,
  },
  tags: {
    type: [String],
    default: [],
    index: true,
  },
  description: {
    type: String,
  },
  uploadedBy: {
    type: String,
    required: true,
    index: true,
  },
  entityType: {
    type: String,
    enum: ['loan', 'user', 'application'],
    required: true,
    index: true,
  },
  entityId: {
    type: String,
    required: true,
    index: true,
  },
  s3Key: {
    type: String,
    required: true,
    unique: true,
  },
  s3Bucket: {
    type: String,
    required: true,
  },
  thumbnailKey: {
    type: String,
  },
  checksum: {
    type: String,
    required: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
    index: true,
  },
  verifiedBy: {
    type: String,
  },
  verifiedAt: {
    type: Date,
  },
  verificationNotes: {
    type: String,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
    required: true,
    index: true,
  },
  lastAccessedAt: {
    type: Date,
  },
  expiresAt: {
    type: Date,
    index: true,
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true,
  },
  deletedAt: {
    type: Date,
  },
  deletedBy: {
    type: String,
  },
  isPublic: {
    type: Boolean,
    default: false,
    index: true,
  },
  allowedRoles: {
    type: [String],
    default: [],
  },
  sharedWith: {
    type: [String],
    default: [],
    index: true,
  },
  extractedText: {
    type: String,
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {},
  },
  version: {
    type: Number,
    default: 1,
  },
  previousVersionId: {
    type: String,
  },
  isLatestVersion: {
    type: Boolean,
    default: true,
    index: true,
  },
}, {
  timestamps: true,
});

// Compound indexes for efficient querying
DocumentSchema.index({ entityType: 1, entityId: 1, category: 1 });
DocumentSchema.index({ uploadedBy: 1, uploadedAt: -1 });
DocumentSchema.index({ isDeleted: 1, expiresAt: 1 });
DocumentSchema.index({ tags: 1, category: 1 });

// Virtual for document URL (to be implemented based on your needs)
DocumentSchema.virtual('url').get(function() {
  // This would typically return a signed URL or API endpoint
  return `/api/v1/documents/${this.documentId}/download`;
});

// Virtual for thumbnail URL
DocumentSchema.virtual('thumbnailUrl').get(function() {
  if (!this.thumbnailKey) {
    return null;
  }
  return `/api/v1/documents/${this.documentId}/thumbnail`;
});

// Methods
DocumentSchema.methods.markAsDeleted = function(deletedBy: string) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  return this.save();
};

DocumentSchema.methods.verify = function(verifiedBy: string, notes?: string) {
  this.isVerified = true;
  this.verifiedBy = verifiedBy;
  this.verifiedAt = new Date();
  if (notes) {
    this.verificationNotes = notes;
  }
  return this.save();
};

DocumentSchema.methods.updateLastAccessed = function() {
  this.lastAccessedAt = new Date();
  return this.save();
};

DocumentSchema.methods.shareWith = function(userId: string) {
  if (!this.sharedWith.includes(userId)) {
    this.sharedWith.push(userId);
    return this.save();
  }
  return Promise.resolve(this);
};

DocumentSchema.methods.unshareWith = function(userId: string) {
  this.sharedWith = this.sharedWith.filter(id => id !== userId);
  return this.save();
};

// Statics
DocumentSchema.statics.findByEntity = function(entityType: string, entityId: string) {
  return this.find({
    entityType,
    entityId,
    isDeleted: false,
  }).sort('-uploadedAt');
};

DocumentSchema.statics.findExpiredDocuments = function() {
  return this.find({
    expiresAt: { $lt: new Date() },
    isDeleted: false,
  });
};

DocumentSchema.statics.findUnverifiedDocuments = function(daysOld = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.find({
    isVerified: false,
    uploadedAt: { $lt: cutoffDate },
    isDeleted: false,
  });
};

export const DocumentModel = model<IDocument>('Document', DocumentSchema);