import { Schema, model } from 'mongoose';
import { ILoanAudit } from '../models/loan.model';

const LoanAuditSchema = new Schema<ILoanAudit>({
  loanId: {
    type: Schema.Types.ObjectId,
    ref: 'Loan',
    required: true,
    index: true,
  },
  action: {
    type: String,
    required: true,
    enum: [
      'CREATE',
      'UPDATE',
      'DELETE',
      'STATUS_CHANGE',
      'PAYMENT',
      'MODIFICATION',
      'RATE_CHANGE',
      'TERM_CHANGE',
      'BALANCE_UPDATE',
      'ESCROW_UPDATE',
      'BORROWER_UPDATE',
      'METADATA_UPDATE',
    ],
  },
  changes: {
    type: Schema.Types.Mixed,
    required: true,
  },
  performedBy: {
    type: String,
    required: true,
  },
  performedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  reason: String,
  metadata: {
    type: Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: false, // We use performedAt instead
});

// Compound index for efficient audit queries
LoanAuditSchema.index({ loanId: 1, performedAt: -1 });
LoanAuditSchema.index({ performedBy: 1, performedAt: -1 });
LoanAuditSchema.index({ action: 1, performedAt: -1 });

// TTL index to automatically delete old audit entries after 7 years
// (configurable based on regulatory requirements)
LoanAuditSchema.index({ performedAt: 1 }, { expireAfterSeconds: 7 * 365 * 24 * 60 * 60 });

export const LoanAuditModel = model<ILoanAudit>('LoanAudit', LoanAuditSchema);