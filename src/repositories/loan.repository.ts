import { ClientSession, Types } from 'mongoose';
import Big from 'big.js';
import { v4 as uuidv4 } from 'uuid';
import { LoanModel } from '../schemas/loan.schema';
import { LoanAuditModel } from '../schemas/loan-audit.schema';
import { 
  ILoan, 
  ILoanAudit, 
  IPaymentUpdateInfo, 
  IModification,
  LoanStatus,
  ILoanSearchCriteria,
  ILoanStatistics,
} from '../models/loan.model';

export class LoanRepository {
  /**
   * Creates a new loan
   */
  async create(loanData: Partial<ILoan>, session?: ClientSession): Promise<ILoan> {
    // Generate loan number if not provided
    if (!loanData.loanNumber) {
      const year = new Date().getFullYear();
      // New format: LN-YYYY-TimestampSuffixRandomChars
      const timestampSuffix = Date.now().toString().slice(-8); // Last 8 digits of current timestamp
      const randomChars = Math.random().toString(36).substring(2, 5).toUpperCase(); // 3 random alphanumeric chars
      loanData.loanNumber = `LN-${year}-${timestampSuffix}${randomChars}`;
    }

    // Create the loan
    const [loan] = await LoanModel.create([loanData], { session });

    // Create audit entry
    await this.createAuditEntry({
      loanId: loan._id,
      action: 'CREATE',
      changes: { created: loanData },
      performedBy: loanData.createdBy || 'SYSTEM',
      reason: 'Loan originated',
    }, session);

    return loan;
  }

  /**
   * Finds a loan by ID
   */
  async findById(id: string, session?: ClientSession): Promise<ILoan | null> {
    return LoanModel.findById(id).session(session || null).exec();
  }

  /**
   * Finds a loan by loan number
   */
  async findByLoanNumber(loanNumber: string, session?: ClientSession): Promise<ILoan | null> {
    return LoanModel.findOne({ loanNumber }).session(session || null).exec();
  }

  /**
   * Finds loans by borrower ID
   */
  async findByBorrowerId(borrowerId: string, session?: ClientSession): Promise<ILoan[]> {
    return LoanModel.find({ borrowerId }).session(session || null).exec();
  }

  /**
   * Finds all active loans
   */
  async findActiveLoans(session?: ClientSession): Promise<ILoan[]> {
    return LoanModel.find({ status: LoanStatus.ACTIVE }).session(session || null).exec();
  }

  /**
   * Advanced loan search
   */
  async search(criteria: ILoanSearchCriteria, session?: ClientSession): Promise<ILoan[]> {
    const query: any = {};

    if (criteria.borrowerId) {
      query.borrowerId = criteria.borrowerId;
    }

    if (criteria.status) {
      if (Array.isArray(criteria.status)) {
        query.status = { $in: criteria.status };
      } else {
        query.status = criteria.status;
      }
    }

    if (criteria.loanType) {
      query.loanType = criteria.loanType;
    }

    if (criteria.minBalance || criteria.maxBalance) {
      query.currentBalance = {};
      if (criteria.minBalance) {
        query.currentBalance.$gte = criteria.minBalance.toString();
      }
      if (criteria.maxBalance) {
        query.currentBalance.$lte = criteria.maxBalance.toString();
      }
    }

    if (criteria.isDelinquent !== undefined) {
      query.isDelinquent = criteria.isDelinquent;
    }

    if (criteria.minDaysPastDue !== undefined) {
      query.daysPastDue = { $gte: criteria.minDaysPastDue };
    }

    if (criteria.originatedAfter || criteria.originatedBefore) {
      query.originationDate = {};
      if (criteria.originatedAfter) {
        query.originationDate.$gte = criteria.originatedAfter;
      }
      if (criteria.originatedBefore) {
        query.originationDate.$lte = criteria.originatedBefore;
      }
    }

    if (criteria.tags && criteria.tags.length > 0) {
      query.tags = { $in: criteria.tags };
    }

    if (criteria.metadata) {
      Object.entries(criteria.metadata).forEach(([key, value]) => {
        query[`metadata.${key}`] = value;
      });
    }

    // Time Travel filter: only show loans that existed as of the specified date
    if (criteria.asOfDate) {
      query.createdAt = { $lte: criteria.asOfDate };
    }

    return LoanModel.find(query).session(session || null).exec();
  }

  /**
   * Updates loan balance after a payment
   */
  async updateBalance(
    loanId: string,
    newBalance: Big,
    paymentInfo: IPaymentUpdateInfo,
    session?: ClientSession,
  ): Promise<ILoan> {
    const loan = await this.findById(loanId, session);
    if (!loan) {
      throw new Error(`Loan not found: ${loanId}`);
    }

    const previousBalance = loan.currentBalance;

    // Update loan fields
    loan.currentBalance = newBalance;
    loan.lastPaymentDate = paymentInfo.paymentDate;
    loan.lastPaymentAmount = paymentInfo.paymentAmount;
    loan.totalPrincipalPaid = loan.totalPrincipalPaid.plus(paymentInfo.principalPaid);
    loan.totalInterestPaid = loan.totalInterestPaid.plus(paymentInfo.interestPaid);
    
    if (paymentInfo.feesPaid) {
      loan.totalFeesPaid = loan.totalFeesPaid.plus(paymentInfo.feesPaid);
    }

    // Update next payment date
    const nextPaymentDate = new Date(loan.nextPaymentDate);
    nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
    loan.nextPaymentDate = nextPaymentDate;

    // Update remaining term
    if (loan.remainingTermMonths > 0) {
      loan.remainingTermMonths -= 1;
    }

    // Check if loan is paid off
    if (newBalance.eq(0)) {
      loan.status = LoanStatus.CLOSED;
      loan.statusHistory.push({
        status: LoanStatus.CLOSED,
        changedAt: new Date(),
        reason: 'Loan paid in full',
      });
    }

    // Add to payment history
    loan.paymentHistory.push({
      paymentDate: paymentInfo.paymentDate,
      scheduledAmount: loan.monthlyPayment,
      actualAmount: paymentInfo.paymentAmount,
      principalPaid: paymentInfo.principalPaid,
      interestPaid: paymentInfo.interestPaid,
      feesPaid: paymentInfo.feesPaid || new Big(0),
      escrowPaid: paymentInfo.escrowPaid || new Big(0),
      remainingBalance: newBalance,
      status: 'completed',
      transactionId: paymentInfo.transactionId,
    });

    // Save the loan
    const updatedLoan = await loan.save({ session });

    // Create audit entry
    await this.createAuditEntry({
      loanId: loan._id,
      action: 'PAYMENT',
      changes: {
        previousBalance: previousBalance.toString(),
        newBalance: newBalance.toString(),
        payment: paymentInfo,
      },
      performedBy: 'SYSTEM',
      reason: 'Payment processed',
    }, session);

    return updatedLoan;
  }

  /**
   * Updates loan status
   */
  async updateStatus(
    loanId: string,
    newStatus: LoanStatus,
    reason: string,
    performedBy = 'SYSTEM',
    session?: ClientSession,
  ): Promise<ILoan> {
    const loan = await this.findById(loanId, session);
    if (!loan) {
      throw new Error(`Loan not found: ${loanId}`);
    }

    const previousStatus = loan.status;
    loan.status = newStatus;
    loan.statusHistory.push({
      status: newStatus,
      changedAt: new Date(),
      reason,
      changedBy: performedBy,
    });

    const updatedLoan = await loan.save({ session });

    // Create audit entry
    await this.createAuditEntry({
      loanId: loan._id,
      action: 'STATUS_CHANGE',
      changes: {
        previousStatus,
        newStatus,
        reason,
      },
      performedBy,
      reason,
    }, session);

    return updatedLoan;
  }

  /**
   * Adds a modification to the loan
   */
  async addModification(
    loanId: string,
    modification: Partial<IModification>,
    session?: ClientSession,
  ): Promise<ILoan> {
    const loan = await this.findById(loanId, session);
    if (!loan) {
      throw new Error(`Loan not found: ${loanId}`);
    }

    // Generate modification ID
    const modificationWithId: IModification = {
      ...modification,
      id: modification.id || uuidv4(),
      createdAt: new Date(),
    } as IModification;

    // Apply modification changes
    if (modification.newRate) {
      loan.interestRate = modification.newRate;
    }
    if (modification.newTerm) {
      loan.termMonths = modification.newTerm;
      loan.remainingTermMonths = modification.newTerm;
    }
    if (modification.newPayment) {
      loan.monthlyPayment = modification.newPayment;
    }

    loan.modifications.push(modificationWithId);
    loan.hasModifications = true;

    const updatedLoan = await loan.save({ session });

    // Create audit entry
    await this.createAuditEntry({
      loanId: loan._id,
      action: 'MODIFICATION',
      changes: {
        modification: modificationWithId,
      },
      performedBy: modification.approvedBy || 'SYSTEM',
      reason: modification.reason,
    }, session);

    return updatedLoan;
  }

  /**
   * Gets loan statistics
   */
  async getStatistics(asOfDate?: Date): Promise<ILoanStatistics> {
    const matchCriteria: any = {};
    
    // Time Travel filter: only include loans that existed as of the specified date
    if (asOfDate) {
      matchCriteria.createdAt = { $lte: asOfDate };
    }

    const stats = await LoanModel.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: null,
          totalLoans: { $sum: 1 },
          activeLoans: {
            $sum: { $cond: [{ $eq: ['$status', LoanStatus.ACTIVE] }, 1, 0] },
          },
          delinquentLoans: {
            $sum: { $cond: ['$isDelinquent', 1, 0] },
          },
          totalOutstandingBalance: { $sum: { $toDecimal: '$currentBalance' } },
          totalOriginalPrincipal: { $sum: { $toDecimal: '$principal' } },
          sumInterestRates: { $sum: { $toDecimal: '$interestRate' } },
          defaultedLoans: {
            $sum: { $cond: [{ $eq: ['$status', LoanStatus.DEFAULT] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          totalLoans: 1,
          activeLoans: 1,
          delinquentLoans: 1,
          totalOutstandingBalance: { $toString: '$totalOutstandingBalance' },
          totalOriginalPrincipal: { $toString: '$totalOriginalPrincipal' },
          averageInterestRate: {
            $toString: {
              $cond: [
                { $eq: ['$totalLoans', 0] },
                0,
                { $divide: ['$sumInterestRates', '$totalLoans'] },
              ],
            },
          },
          averageLoanAmount: {
            $toString: {
              $cond: [
                { $eq: ['$totalLoans', 0] },
                0,
                { $divide: ['$totalOriginalPrincipal', '$totalLoans'] },
              ],
            },
          },
          delinquencyRate: {
            $cond: [
              { $eq: ['$activeLoans', 0] },
              0,
              { $divide: ['$delinquentLoans', '$activeLoans'] },
            ],
          },
          defaultRate: {
            $cond: [
              { $eq: ['$totalLoans', 0] },
              0,
              { $divide: ['$defaultedLoans', '$totalLoans'] },
            ],
          },
        },
      },
    ]);

    if (stats.length === 0) {
      return {
        totalLoans: 0,
        activeLoans: 0,
        delinquentLoans: 0,
        totalOutstandingBalance: new Big(0),
        totalOriginalPrincipal: new Big(0),
        averageInterestRate: new Big(0),
        averageLoanAmount: new Big(0),
        delinquencyRate: 0,
        defaultRate: 0,
      };
    }

    const result = stats[0];
    return {
      ...result,
      totalOutstandingBalance: new Big(result.totalOutstandingBalance),
      totalOriginalPrincipal: new Big(result.totalOriginalPrincipal),
      averageInterestRate: new Big(result.averageInterestRate),
      averageLoanAmount: new Big(result.averageLoanAmount),
    };
  }

  /**
   * Gets audit trail for a loan
   */
  async getAuditTrail(loanId: string, limit = 100, asOfDate?: Date): Promise<ILoanAudit[]> {
    const query: any = { loanId: new Types.ObjectId(loanId) };
    
    // Time Travel filter: only show audit entries up to the specified date
    if (asOfDate) {
      query.performedAt = { $lte: asOfDate };
    }
    
    return LoanAuditModel
      .find(query)
      .sort({ performedAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Executes operations within a transaction
   */
  async executeInTransaction<T>(
    operation: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    const session = await LoanModel.startSession();
    session.startTransaction();

    try {
      const result = await operation(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Creates an audit entry
   */
  private async createAuditEntry(
    auditData: Partial<ILoanAudit>,
    session?: ClientSession,
  ): Promise<void> {
    await LoanAuditModel.create([{
      ...auditData,
      performedAt: new Date(),
    }], { session });
  }

  /**
   * Updates a loan by ID with partial data
   */
  async updateById(
    loanId: string,
    updateData: Partial<ILoan>,
    session?: ClientSession,
  ): Promise<ILoan> {
    const loan = await this.findById(loanId, session);
    if (!loan) {
      throw new Error(`Loan not found: ${loanId}`);
    }

    // Update the loan fields
    Object.assign(loan, updateData);
    const updatedLoan = await loan.save({ session });

    // Create audit entry
    await this.createAuditEntry({
      loanId: loan._id,
      action: 'UPDATE',
      changes: updateData,
      performedBy: (updateData as any).updatedBy || 'SYSTEM',
      reason: 'Loan updated',
    }, session);

    return updatedLoan;
  }
}

// Export singleton instance
export const loanRepository = new LoanRepository();