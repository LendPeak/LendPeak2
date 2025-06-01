import { Schema, model } from 'mongoose';
import Big from 'big.js';
import { ILoan, LoanStatus, LoanType } from '../models/loan.model';
// Calendar types from @lendpeak/engine
const LoanCalendar = {
  ACTUAL_365: 'ACTUAL/365',
  ACTUAL_360: 'ACTUAL/360',
  THIRTY_360: '30/360',
};
import { bigDecimalType, bigDecimalWithDefault } from '../utils/mongoose-types';

const StatusHistorySchema = new Schema({
  status: {
    type: String,
    enum: Object.values(LoanStatus),
    required: true,
  },
  changedAt: {
    type: Date,
    default: Date.now,
  },
  reason: String,
  changedBy: String,
}, { _id: false });

const ModificationSchema = new Schema({
  id: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  previousRate: bigDecimalType,
  newRate: bigDecimalType,
  previousTerm: Number,
  newTerm: Number,
  previousPayment: bigDecimalType,
  newPayment: bigDecimalType,
  effectiveDate: {
    type: Date,
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
  approvedBy: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

const PaymentHistorySchema = new Schema({
  paymentDate: {
    type: Date,
    required: true,
  },
  scheduledAmount: {
    ...bigDecimalType,
    required: true,
  },
  actualAmount: {
    ...bigDecimalType,
    required: true,
  },
  principalPaid: {
    ...bigDecimalType,
    required: true,
  },
  interestPaid: {
    ...bigDecimalType,
    required: true,
  },
  feesPaid: bigDecimalType,
  escrowPaid: bigDecimalType,
  remainingBalance: {
    ...bigDecimalType,
    required: true,
  },
  status: {
    type: String,
    enum: ['completed', 'pending', 'failed', 'reversed'],
    required: true,
  },
  transactionId: String,
}, { _id: false });

const LoanSchema = new Schema<ILoan>({
  // Identification
  loanNumber: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  borrowerId: {
    type: String,
    required: true,
    index: true,
  },
  coborrowerIds: [String],
  
  // Loan terms
  principal: {
    ...bigDecimalType,
    required: true,
  },
  currentBalance: {
    ...bigDecimalType,
    required: true,
  },
  interestRate: {
    ...bigDecimalType,
    required: true,
  },
  termMonths: {
    type: Number,
    required: true,
  },
  remainingTermMonths: {
    type: Number,
    // Set in pre-save hook
  },
  
  // Dates
  originationDate: {
    type: Date,
    required: true,
  },
  firstPaymentDate: {
    type: Date,
    required: true,
  },
  maturityDate: {
    type: Date,
    // Set in pre-save hook
  },
  lastPaymentDate: Date,
  nextPaymentDate: {
    type: Date,
    // Set in pre-save hook
  },
  
  // Payment information
  monthlyPayment: {
    ...bigDecimalType,
    required: true,
  },
  lastPaymentAmount: bigDecimalType,
  totalInterestPaid: bigDecimalType,
  totalPrincipalPaid: bigDecimalType,
  totalFeesPaid: bigDecimalType,
  
  // Configuration
  loanType: {
    type: String,
    enum: Object.values(LoanType),
    required: true,
  },
  calendar: {
    type: String,
    enum: Object.values(LoanCalendar),
    required: true,
  },
  paymentDay: {
    type: Number,
    min: 1,
    max: 31,
    // Set in pre-save hook
  },
  gracePeriodDays: {
    type: Number,
    default: 15,
  },
  lateFeAmount: bigDecimalType,
  
  // Status
  status: {
    type: String,
    enum: Object.values(LoanStatus),
    required: true,
    index: true,
  },
  statusHistory: [StatusHistorySchema],
  isDelinquent: {
    type: Boolean,
    default: false,
    index: true,
  },
  daysPastDue: {
    type: Number,
    default: 0,
  },
  delinquentAmount: bigDecimalType,
  
  // Modifications
  modifications: [ModificationSchema],
  hasModifications: {
    type: Boolean,
    default: false,
  },
  
  // Payment history
  paymentHistory: [PaymentHistorySchema],
  missedPayments: {
    type: Number,
    default: 0,
  },
  
  // Escrow
  hasEscrow: {
    type: Boolean,
    default: false,
  },
  escrowBalance: bigDecimalType,
  escrowPayment: bigDecimalType,
  propertyTaxAmount: bigDecimalType,
  insuranceAmount: bigDecimalType,
  
  // Metadata
  metadata: {
    type: Schema.Types.Mixed,
    default: {},
  },
  tags: [String],
  notes: String,
  
  // Audit fields
  createdBy: String,
  updatedBy: String,
  version: {
    type: Number,
    default: 1,
  },
}, {
  timestamps: true,
  optimisticConcurrency: true,
});

// Indexes for performance
LoanSchema.index({ status: 1, nextPaymentDate: 1 });
LoanSchema.index({ isDelinquent: 1, daysPastDue: -1 });
LoanSchema.index({ borrowerId: 1, status: 1 });
LoanSchema.index({ tags: 1 });
LoanSchema.index({ 'metadata.$**': 1 });

// Virtual for days until next payment
LoanSchema.virtual('daysUntilNextPayment').get(function(this: ILoan) {
  const now = new Date();
  const nextPayment = this.nextPaymentDate;
  const diffTime = nextPayment.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to update computed fields
LoanSchema.pre<ILoan>('save', function(next) {
  // Update remaining term months
  if (this.isNew) {
    this.remainingTermMonths = this.termMonths;
    
    // Calculate maturity date
    const maturityDate = new Date(this.firstPaymentDate);
    maturityDate.setMonth(maturityDate.getMonth() + this.termMonths - 1);
    this.maturityDate = maturityDate;
    
    // Set initial next payment date
    this.nextPaymentDate = new Date(this.firstPaymentDate);
    
    // Extract payment day from first payment date
    this.paymentDay = this.firstPaymentDate.getDate();
    
    // Initialize payment totals
    if (!this.totalInterestPaid) {
      this.totalInterestPaid = new Big(0);
    }
    if (!this.totalPrincipalPaid) {
      this.totalPrincipalPaid = new Big(0);
    }
    if (!this.totalFeesPaid) {
      this.totalFeesPaid = new Big(0);
    }
  }
  
  // Update delinquency status
  const now = new Date();
  if (this.nextPaymentDate < now && this.status === LoanStatus.ACTIVE) {
    const daysPastDue = Math.floor((now.getTime() - this.nextPaymentDate.getTime()) / (1000 * 60 * 60 * 24));
    this.daysPastDue = daysPastDue;
    this.isDelinquent = daysPastDue > this.gracePeriodDays;
    
    if (this.isDelinquent && this.status === LoanStatus.ACTIVE) {
      this.status = LoanStatus.DELINQUENT;
      this.statusHistory.push({
        status: LoanStatus.DELINQUENT,
        changedAt: now,
        reason: `Loan is ${daysPastDue} days past due`,
      });
    }
  }
  
  next();
});

// Create text index for search
LoanSchema.index({
  loanNumber: 'text',
  notes: 'text',
  'metadata.propertyAddress': 'text',
});

export const LoanModel = model<ILoan>('Loan', LoanSchema);