import Joi from 'joi';
import { LoanStatus, LoanType } from '../../models/loan.model';
// Calendar types from @lendpeak/engine
const LoanCalendar = {
  ACTUAL_365: 'ACTUAL/365',
  ACTUAL_360: 'ACTUAL/360',
  THIRTY_360: '30/360'
};

// Custom validator for Big.js compatible numbers
const bigNumber = () => Joi.string().pattern(/^\d+(\.\d+)?$/).required();

export const createLoanSchema = Joi.object({
  loanNumber: Joi.string().optional(),
  borrowerId: Joi.string().required(),
  coborrowerIds: Joi.array().items(Joi.string()).optional(),
  
  // Loan terms
  principal: bigNumber().required(),
  currentBalance: bigNumber().optional(),
  interestRate: bigNumber().required(),
  termMonths: Joi.number().integer().min(1).max(480).required(),
  monthlyPayment: bigNumber().required(),
  
  // Dates
  originationDate: Joi.date().iso().required(),
  firstPaymentDate: Joi.date().iso().required(),
  
  // Configuration
  loanType: Joi.string().valid(...Object.values(LoanType)).required(),
  calendar: Joi.string().valid(...Object.values(LoanCalendar)).required(),
  gracePeriodDays: Joi.number().integer().min(0).max(60).optional(),
  lateFeAmount: bigNumber().optional(),
  
  // Status
  status: Joi.string().valid(...Object.values(LoanStatus)).default(LoanStatus.ACTIVE),
  
  // Escrow
  hasEscrow: Joi.boolean().optional(),
  escrowBalance: bigNumber().when('hasEscrow', {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  escrowPayment: bigNumber().when('hasEscrow', {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  propertyTaxAmount: bigNumber().optional(),
  insuranceAmount: bigNumber().optional(),
  
  // Metadata
  metadata: Joi.object().optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  notes: Joi.string().optional(),
});

export const updateLoanSchema = Joi.object({
  metadata: Joi.object().optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  notes: Joi.string().optional(),
  gracePeriodDays: Joi.number().integer().min(0).max(60).optional(),
  lateFeAmount: bigNumber().optional(),
});

export const searchLoanSchema = Joi.object({
  borrowerId: Joi.string().optional(),
  status: Joi.alternatives().try(
    Joi.string().valid(...Object.values(LoanStatus)),
    Joi.array().items(Joi.string().valid(...Object.values(LoanStatus)))
  ).optional(),
  loanType: Joi.string().valid(...Object.values(LoanType)).optional(),
  minBalance: bigNumber().optional(),
  maxBalance: bigNumber().optional(),
  isDelinquent: Joi.boolean().optional(),
  minDaysPastDue: Joi.number().integer().min(0).optional(),
  originatedAfter: Joi.date().iso().optional(),
  originatedBefore: Joi.date().iso().optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort: Joi.string().optional(),
});

export const paymentSchema = Joi.object({
  amount: bigNumber().required(),
  paymentDate: Joi.date().iso().required(),
  principalPaid: bigNumber().required(),
  interestPaid: bigNumber().required(),
  feesPaid: bigNumber().optional(),
  escrowPaid: bigNumber().optional(),
  transactionId: Joi.string().optional(),
});

export const statusUpdateSchema = Joi.object({
  status: Joi.string().valid(...Object.values(LoanStatus)).required(),
  reason: Joi.string().required(),
});

export const modificationSchema = Joi.object({
  type: Joi.string().required(),
  previousRate: bigNumber().optional(),
  newRate: bigNumber().optional(),
  previousTerm: Joi.number().integer().optional(),
  newTerm: Joi.number().integer().optional(),
  previousPayment: bigNumber().optional(),
  newPayment: bigNumber().optional(),
  effectiveDate: Joi.date().iso().required(),
  reason: Joi.string().required(),
  approvedBy: Joi.string().optional(),
});