import { DEMO_LOANS } from '../demo/demoData';

export interface LoanModification {
  id: string;
  loanId: string;
  type: string;
  date: Date;
  changes: Record<string, any>;
  reason: string;
  approvedBy: string;
}

export interface PaymentAllocation {
  interest: number;
  principal: number;
  fees: number;
  penalties: number;
  escrow: number;
  lateFees: number;
  otherFees: number;
}

export interface Payment {
  id: string;
  loanId: string;
  paymentNumber: number;
  paymentDate: Date;
  amount: number;
  allocations: PaymentAllocation;
  remainingBalance: number;
  overpayment?: number;
  status: 'COMPLETED' | 'PENDING' | 'FAILED' | 'REVERSED' | 'PARTIAL' | 'DELETED';
  paymentMethod: string;
  reference?: string;
  notes?: string;
  isDeleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy?: string;
  // Legacy fields for backward compatibility
  principal?: number;
  interest?: number;
  fees?: number;
  penalties?: number;
  escrow?: number;
}

export interface PaymentAuditEntry {
  id: string;
  paymentId: string;
  action: 'CREATED' | 'UPDATED' | 'DELETED';
  timestamp: Date;
  performedBy: string;
  oldValues?: Partial<Payment>;
  newValues?: Partial<Payment>;
  reason?: string;
  fieldChanges?: Array<{
    field: string;
    oldValue: any;
    newValue: any;
  }>;
}

class DemoLoanStorage {
  private readonly LOANS_KEY = 'lendpeak_demo_loans';
  private readonly MODIFICATIONS_KEY = 'lendpeak_demo_modifications';
  private readonly PAYMENTS_KEY = 'lendpeak_demo_payments';
  private readonly PAYMENT_AUDIT_KEY = 'lendpeak_demo_payment_audit';

  constructor() {
    // Initialize with demo data if not already present
    this.initializeStorage();
  }

  private initializeStorage() {
    if (!localStorage.getItem(this.LOANS_KEY)) {
      // Store demo loans with proper date handling
      const loansWithDates = DEMO_LOANS.map(loan => ({
        ...loan,
        applicationDate: loan.applicationDate.toISOString(),
        loanParameters: {
          ...loan.loanParameters,
          startDate: loan.loanParameters.startDate ? loan.loanParameters.startDate.toISOString() : new Date().toISOString(),
        }
      }));
      localStorage.setItem(this.LOANS_KEY, JSON.stringify(loansWithDates));
    }
    
    if (!localStorage.getItem(this.MODIFICATIONS_KEY)) {
      localStorage.setItem(this.MODIFICATIONS_KEY, JSON.stringify([]));
    }
    
    if (!localStorage.getItem(this.PAYMENTS_KEY)) {
      localStorage.setItem(this.PAYMENTS_KEY, JSON.stringify([]));
    }
    
    if (!localStorage.getItem(this.PAYMENT_AUDIT_KEY)) {
      localStorage.setItem(this.PAYMENT_AUDIT_KEY, JSON.stringify([]));
    }
  }

  // Loan CRUD operations
  getLoans() {
    const loansJson = localStorage.getItem(this.LOANS_KEY) || '[]';
    const loans = JSON.parse(loansJson);
    
    // Convert date strings back to Date objects
    return loans.map((loan: any) => ({
      ...loan,
      applicationDate: new Date(loan.applicationDate),
      loanParameters: {
        ...loan.loanParameters,
        startDate: loan.loanParameters.startDate ? new Date(loan.loanParameters.startDate) : new Date(),
      }
    }));
  }

  getLoan(id: string) {
    const loans = this.getLoans();
    return loans.find((loan: any) => loan.id === id);
  }

  updateLoan(id: string, updates: Partial<any>) {
    const loans = this.getLoans();
    const index = loans.findIndex((loan: any) => loan.id === id);
    
    if (index !== -1) {
      // Handle date conversions
      const updatedLoan = {
        ...loans[index],
        ...updates,
        applicationDate: updates.applicationDate?.toISOString() || loans[index].applicationDate.toISOString(),
      };
      
      if (updates.loanParameters) {
        updatedLoan.loanParameters = {
          ...loans[index].loanParameters,
          ...updates.loanParameters,
          startDate: updates.loanParameters.startDate?.toISOString() || loans[index].loanParameters.startDate?.toISOString(),
        };
      }
      
      loans[index] = updatedLoan;
      localStorage.setItem(this.LOANS_KEY, JSON.stringify(loans));
      
      // Return the loan with dates converted back
      return this.getLoan(id);
    }
    
    return null;
  }

  createLoan(loanData: any) {
    const loans = this.getLoans();
    const now = new Date();
    
    // Generate a unique loan ID
    const loanId = `loan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Map payment frequency
    let frequency: 'monthly' | 'bi-weekly' | 'weekly' = 'monthly';
    if (loanData.paymentFrequency === 'bi-weekly') {
      frequency = 'bi-weekly';
    } else if (loanData.paymentFrequency === 'weekly') {
      frequency = 'weekly';
    }
    
    // Map calendar types
    let dayCountConvention: '30/360' | 'actual/360' | 'actual/365' | 'actual/actual' = '30/360';
    if (loanData.loanCalendar === 'ACTUAL_360') {
      dayCountConvention = 'actual/360';
    } else if (loanData.loanCalendar === 'ACTUAL_365') {
      dayCountConvention = 'actual/365';
    }
    
    // Map rounding method
    let roundingMethod: 'HALF_UP' | 'HALF_DOWN' | 'UP' | 'DOWN' | 'BANKERS' = 'HALF_UP';
    switch (loanData.roundingMethod) {
      case 'ROUND_HALF_UP':
        roundingMethod = 'HALF_UP';
        break;
      case 'ROUND_HALF_DOWN':
        roundingMethod = 'HALF_DOWN';
        break;
      case 'ROUND_UP':
        roundingMethod = 'UP';
        break;
      case 'ROUND_DOWN':
        roundingMethod = 'DOWN';
        break;
      case 'ROUND_HALF_EVEN':
        roundingMethod = 'BANKERS';
        break;
    }
    
    // Create the new loan object
    const newLoan = {
      id: loanId,
      customerId: loanData.borrowerId,
      status: 'ACTIVE',
      applicationDate: loanData.originationDate || now,
      purpose: loanData.loanPurpose || 'OTHER',
      loanType: loanData.loanType || 'PERSONAL',
      loanParameters: {
        principal: loanData.originalPrincipal,
        interestRate: loanData.interestRate,
        termMonths: loanData.termMonths,
        startDate: loanData.firstPaymentDate || now,
        paymentFrequency: loanData.paymentFrequency?.toLowerCase() || 'monthly',
        interestType: 'amortized',
        calendarType: this.mapCalendarType(loanData.loanCalendar),
        accrualTiming: loanData.accrualStartTiming === 'SAME_DAY' ? 'daily' : 'monthly',
        paymentDueDay: loanData.paymentDueDay || 1,
        roundingMethod: loanData.roundingMethod || 'ROUND_HALF_UP',
      },
      // Store engine terms for amortization calculations
      engineTerms: {
        principal: loanData.originalPrincipal,
        annualInterestRate: loanData.interestRate,
        termMonths: loanData.termMonths,
        startDate: loanData.originationDate,
        firstPaymentDate: loanData.firstPaymentDate,
        paymentFrequency: frequency,
        interestType: 'amortized' as const,
        dayCountConvention,
        roundingConfig: {
          method: roundingMethod,
          decimalPlaces: 2
        }
      },
      createdAt: now,
      updatedAt: now,
    };
    
    // Add to storage
    const loansWithDates = loans.map(loan => ({
      ...loan,
      applicationDate: loan.applicationDate.toISOString(),
      loanParameters: {
        ...loan.loanParameters,
        startDate: loan.loanParameters.startDate ? loan.loanParameters.startDate.toISOString() : new Date().toISOString(),
      }
    }));
    
    // Add the new loan
    const newLoanForStorage = {
      ...newLoan,
      applicationDate: newLoan.applicationDate.toISOString(),
      loanParameters: {
        ...newLoan.loanParameters,
        startDate: newLoan.loanParameters.startDate.toISOString(),
      }
    };
    
    loansWithDates.push(newLoanForStorage);
    localStorage.setItem(this.LOANS_KEY, JSON.stringify(loansWithDates));
    
    return newLoan;
  }

  private mapCalendarType(loanCalendar: string): string {
    const calendarMap: Record<string, string> = {
      'THIRTY_360': '30/360',
      'ACTUAL_365': 'ACTUAL/365',
      'ACTUAL_360': 'ACTUAL/360',
    };
    return calendarMap[loanCalendar] || '30/360';
  }

  updateLoanStatus(id: string, status: string, reason?: string) {
    const loan = this.getLoan(id);
    if (loan) {
      return this.updateLoan(id, { status, statusChangeReason: reason });
    }
    return null;
  }

  // Modification operations
  getModifications(loanId?: string) {
    const modificationsJson = localStorage.getItem(this.MODIFICATIONS_KEY) || '[]';
    const modifications = JSON.parse(modificationsJson);
    
    const mods = modifications.map((mod: any) => ({
      ...mod,
      date: new Date(mod.date),
      reversedDate: mod.reversedDate ? new Date(mod.reversedDate) : undefined,
    }));
    
    return loanId ? mods.filter((mod: any) => mod.loanId === loanId) : mods;
  }

  addModification(modification: any) {
    const modifications = this.getModifications();
    const newMod = {
      ...modification,
      id: modification.id || `mod_${Date.now()}`,
      date: modification.date?.toISOString ? modification.date.toISOString() : modification.date || new Date().toISOString(),
    };
    
    modifications.push(newMod);
    
    // Handle reversal type - reverse the impact and mark original as reversed
    if (modification.type === 'REVERSAL' && modification.changes?.originalModificationId) {
      this.processReversal(modification.loanId, modification.changes.originalModificationId, modifications);
    } else {
      // Apply the modification to the loan (non-reversal modifications)
      this.applyModificationToLoan(modification);
    }
    
    localStorage.setItem(this.MODIFICATIONS_KEY, JSON.stringify(modifications));
    return { ...newMod, date: new Date(newMod.date) };
  }

  private processReversal(loanId: string, originalModificationId: string, modifications: any[]) {
    // Find the original modification
    const originalMod = modifications.find(m => m.id === originalModificationId);
    if (!originalMod) {
      console.error('Original modification not found for reversal:', originalModificationId);
      return;
    }

    // Mark the original modification as reversed
    originalMod.status = 'REVERSED';
    originalMod.reversedDate = new Date().toISOString();
    originalMod.reversedBy = 'Demo User'; // In real app, get from auth

    // Recalculate the loan parameters by reapplying all non-reversed modifications
    this.recalculateLoanParameters(loanId, modifications);
  }

  private recalculateLoanParameters(loanId: string, modifications: any[]) {
    const loan = this.getLoan(loanId);
    if (!loan) return;

    // Get the original loan parameters (stored when loan was created)
    const originalParameters = this.getOriginalLoanParameters(loanId);
    
    // Start with original parameters
    let currentParameters = { ...originalParameters };

    // Apply all non-reversed modifications in chronological order
    const activeModifications = modifications
      .filter(m => m.loanId === loanId && m.status !== 'REVERSED' && m.type !== 'REVERSAL')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (const mod of activeModifications) {
      currentParameters = this.applyModificationToParameters(currentParameters, mod);
    }

    // Update the loan with recalculated parameters
    this.updateLoan(loanId, {
      loanParameters: currentParameters
    });
  }

  private getOriginalLoanParameters(loanId: string) {
    // Try to get original parameters from loan creation
    const loan = this.getLoan(loanId);
    if (!loan) return null;

    // Check if we have stored original parameters
    if (loan.originalLoanParameters) {
      return loan.originalLoanParameters;
    }

    // If not stored, we'll need to reverse-engineer from modifications
    // For now, we'll use current parameters as fallback and log a warning
    console.warn('Original loan parameters not found, using current as baseline');
    return loan.loanParameters;
  }

  private applyModificationToParameters(parameters: any, modification: any) {
    const updates = { ...parameters };

    if (modification.type === 'RESTRUCTURE' && modification.changes?.projectedParameters) {
      return modification.changes.projectedParameters;
    }

    // Handle individual modification types
    switch (modification.type) {
      case 'RATE_CHANGE':
        if (modification.changes?.newRate) {
          updates.interestRate = modification.changes.newRate;
        }
        break;

      case 'TERM_EXTENSION':
        if (modification.changes?.extensionMonths) {
          updates.termMonths = updates.termMonths + modification.changes.extensionMonths;
        } else if (modification.changes?.additionalMonths) {
          updates.termMonths = updates.termMonths + modification.changes.additionalMonths;
        }
        break;

      case 'PRINCIPAL_REDUCTION':
        if (modification.changes?.principalReduction) {
          updates.principal = updates.principal - modification.changes.principalReduction;
        } else if (modification.changes?.reductionAmount) {
          updates.principal = updates.principal - modification.changes.reductionAmount;
        }
        break;

      case 'PAYMENT_REDUCTION_TEMPORARY':
        // For temporary payment reductions, we might need to store the temporary state
        // This could require more complex state management
        if (modification.changes?.newPaymentAmount) {
          updates.temporaryPaymentAmount = modification.changes.newPaymentAmount;
          updates.temporaryPaymentTerms = modification.changes.numberOfTerms;
          updates.temporaryInterestHandling = modification.changes.interestHandling;
        }
        break;

      case 'PAYMENT_REDUCTION_PERMANENT':
        if (modification.changes?.newPaymentAmount) {
          updates.monthlyPayment = modification.changes.newPaymentAmount;
          if (modification.changes.newTermMonths) {
            updates.termMonths = modification.changes.newTermMonths;
          }
        }
        break;

      case 'BALLOON_PAYMENT_ASSIGNMENT':
        if (modification.changes?.balloonAmount) {
          updates.balloonPayment = modification.changes.balloonAmount;
          updates.balloonDueDate = modification.changes.balloonDueDate;
          updates.balloonReamortization = modification.changes.reamortizationStartType;
        }
        break;

      case 'BALLOON_PAYMENT_REMOVAL':
        // Remove balloon payment properties
        delete updates.balloonPayment;
        delete updates.balloonDueDate;
        delete updates.balloonReamortization;
        if (modification.changes?.newTermMonths) {
          updates.termMonths = modification.changes.newTermMonths;
        }
        if (modification.changes?.newPaymentAmount) {
          updates.monthlyPayment = modification.changes.newPaymentAmount;
        }
        break;

      case 'FORBEARANCE':
        if (modification.changes?.durationMonths) {
          updates.forbearanceEndDate = new Date();
          updates.forbearanceEndDate.setMonth(updates.forbearanceEndDate.getMonth() + modification.changes.durationMonths);
          updates.forbearanceType = modification.changes.forbearanceType;
        }
        break;

      case 'DEFERMENT':
        if (modification.changes?.durationMonths) {
          updates.defermentEndDate = new Date();
          updates.defermentEndDate.setMonth(updates.defermentEndDate.getMonth() + modification.changes.durationMonths);
          updates.defermentReason = modification.changes.eligibilityReason;
          updates.interestSubsidy = modification.changes.interestSubsidy;
        }
        break;

      case 'REAMORTIZATION':
        if (modification.changes?.newTermMonths) {
          updates.termMonths = modification.changes.newTermMonths;
        }
        if (modification.changes?.newInterestRate) {
          updates.interestRate = modification.changes.newInterestRate;
        }
        break;

      default:
        console.warn('Unknown modification type:', modification.type);
    }

    return updates;
  }

  private applyModificationToLoan(modification: any) {
    const loan = this.getLoan(modification.loanId);
    if (!loan || !modification.changes) return;

    // Store original parameters if not already stored
    if (!loan.originalLoanParameters) {
      this.updateLoan(modification.loanId, {
        originalLoanParameters: { ...loan.loanParameters }
      });
    }

    // Apply the modification
    const updatedParameters = this.applyModificationToParameters(loan.loanParameters, modification);
    
    if (JSON.stringify(updatedParameters) !== JSON.stringify(loan.loanParameters)) {
      this.updateLoan(modification.loanId, {
        loanParameters: updatedParameters
      });
    }
  }

  // This method is no longer needed as it's integrated into addModification

  // Payment operations
  getPayments(loanId?: string, includeDeleted: boolean = false) {
    const paymentsJson = localStorage.getItem(this.PAYMENTS_KEY) || '[]';
    const payments = JSON.parse(paymentsJson);
    
    const pmts = payments.map((pmt: any) => {
      // Safely parse dates with validation
      const parseDate = (dateValue: any): Date => {
        if (!dateValue) return new Date();
        const date = new Date(dateValue);
        // Check if date is valid
        if (isNaN(date.getTime())) {
          console.warn('Invalid date value:', dateValue);
          return new Date();
        }
        return date;
      };
      
      return {
        ...pmt,
        paymentDate: parseDate(pmt.paymentDate),
        createdAt: parseDate(pmt.createdAt),
        updatedAt: parseDate(pmt.updatedAt),
      };
    });
    
    let filteredPayments = pmts;
    
    // Filter by loan ID if provided
    if (loanId) {
      filteredPayments = filteredPayments.filter((pmt: any) => pmt.loanId === loanId);
    }
    
    // Filter out deleted payments unless includeDeleted is true
    if (!includeDeleted) {
      filteredPayments = filteredPayments.filter((pmt: any) => !pmt.isDeleted);
    }
    
    return filteredPayments;
  }

  recordPayment(payment: Omit<Payment, 'id' | 'paymentNumber' | 'createdAt' | 'updatedAt'>) {
    const payments = this.getPayments(undefined, true); // Include deleted to get accurate count
    const loan = this.getLoan(payment.loanId);
    
    if (!loan) {
      throw new Error('Loan not found');
    }
    
    const now = new Date();
    
    // Ensure allocations structure exists (backward compatibility)
    const allocations = payment.allocations || {
      interest: payment.interest || 0,
      principal: payment.principal || 0,
      fees: payment.fees || 0,
      penalties: payment.penalties || 0,
      escrow: payment.escrow || 0,
      lateFees: 0,
      otherFees: 0,
    };
    
    const newPayment: Payment = {
      ...payment,
      id: `pmt_${Date.now()}`,
      paymentNumber: payments.filter((p: any) => p.loanId === payment.loanId).length + 1,
      allocations,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      // Add legacy fields for backward compatibility
      principal: allocations.principal,
      interest: allocations.interest,
      fees: allocations.fees + allocations.lateFees + allocations.otherFees,
      penalties: allocations.penalties,
      escrow: allocations.escrow,
    };
    
    // Store with date as ISO string
    const paymentToStore = {
      ...newPayment,
      paymentDate: newPayment.paymentDate.toISOString(),
      createdAt: newPayment.createdAt.toISOString(),
      updatedAt: newPayment.updatedAt.toISOString(),
    };
    
    const allPayments = JSON.parse(localStorage.getItem(this.PAYMENTS_KEY) || '[]');
    allPayments.push(paymentToStore);
    localStorage.setItem(this.PAYMENTS_KEY, JSON.stringify(allPayments));
    
    // Create audit entry
    this.createPaymentAuditEntry({
      paymentId: newPayment.id,
      action: 'CREATED',
      performedBy: payment.createdBy,
      newValues: newPayment,
      reason: 'Payment created',
    });
    
    // Update loan balance if payment is completed
    if (payment.status === 'COMPLETED') {
      const currentBalance = this.calculateCurrentBalance(payment.loanId);
      this.updateLoan(payment.loanId, { currentBalance });
    }
    
    return newPayment;
  }

  // Get a specific payment by ID
  getPayment(paymentId: string): Payment | null {
    const payments = this.getPayments(undefined, true); // Include deleted payments
    return payments.find((p: Payment) => p.id === paymentId) || null;
  }

  // Update an existing payment
  updatePayment(paymentId: string, updates: Partial<Payment>, updatedBy: string, reason?: string): Payment | null {
    const allPayments = JSON.parse(localStorage.getItem(this.PAYMENTS_KEY) || '[]');
    const paymentIndex = allPayments.findIndex((p: any) => p.id === paymentId);
    
    if (paymentIndex === -1) {
      throw new Error('Payment not found');
    }
    
    const existingPayment = {
      ...allPayments[paymentIndex],
      paymentDate: new Date(allPayments[paymentIndex].paymentDate),
      createdAt: new Date(allPayments[paymentIndex].createdAt),
      updatedAt: new Date(allPayments[paymentIndex].updatedAt),
    };
    
    // Create field changes for audit
    const fieldChanges: Array<{ field: string; oldValue: any; newValue: any }> = [];
    Object.keys(updates).forEach(key => {
      if (key !== 'updatedAt' && key !== 'updatedBy') {
        const oldValue = (existingPayment as any)[key];
        const newValue = (updates as any)[key];
        if (oldValue !== newValue) {
          fieldChanges.push({ field: key, oldValue, newValue });
        }
      }
    });
    
    const updatedPayment = {
      ...existingPayment,
      ...updates,
      updatedAt: new Date(),
      updatedBy,
    };
    
    // Store with dates as ISO strings
    const paymentToStore = {
      ...updatedPayment,
      paymentDate: updatedPayment.paymentDate.toISOString(),
      createdAt: updatedPayment.createdAt.toISOString(),
      updatedAt: updatedPayment.updatedAt.toISOString(),
    };
    
    allPayments[paymentIndex] = paymentToStore;
    localStorage.setItem(this.PAYMENTS_KEY, JSON.stringify(allPayments));
    
    // Create audit entry
    this.createPaymentAuditEntry({
      paymentId,
      action: 'UPDATED',
      performedBy: updatedBy,
      oldValues: existingPayment,
      newValues: updatedPayment,
      reason,
      fieldChanges: fieldChanges.length > 0 ? fieldChanges : undefined,
    });
    
    // Update loan balance if payment status changed
    if (updates.status && existingPayment.status !== updates.status) {
      const currentBalance = this.calculateCurrentBalance(updatedPayment.loanId);
      this.updateLoan(updatedPayment.loanId, { currentBalance });
    }
    
    return updatedPayment;
  }

  // Soft delete a payment
  softDeletePayment(paymentId: string, deletedBy: string, reason?: string): Payment | null {
    return this.updatePayment(paymentId, { 
      isDeleted: true, 
      status: 'DELETED' as const 
    }, deletedBy, reason);
  }

  // Restore a soft-deleted payment
  restorePayment(paymentId: string, restoredBy: string, newStatus: Payment['status'], reason?: string): Payment | null {
    const payment = this.getPayment(paymentId);
    if (!payment || !payment.isDeleted) {
      throw new Error('Payment not found or not deleted');
    }
    
    return this.updatePayment(paymentId, { 
      isDeleted: false, 
      status: newStatus 
    }, restoredBy, reason);
  }

  // Create a payment audit entry
  private createPaymentAuditEntry(entry: Omit<PaymentAuditEntry, 'id' | 'timestamp'>): PaymentAuditEntry {
    const auditEntry: PaymentAuditEntry = {
      ...entry,
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    
    const auditEntries = JSON.parse(localStorage.getItem(this.PAYMENT_AUDIT_KEY) || '[]');
    const entryToStore = {
      ...auditEntry,
      timestamp: auditEntry.timestamp.toISOString(),
      oldValues: auditEntry.oldValues ? {
        ...auditEntry.oldValues,
        paymentDate: auditEntry.oldValues.paymentDate?.toISOString?.() || auditEntry.oldValues.paymentDate,
        createdAt: auditEntry.oldValues.createdAt?.toISOString?.() || auditEntry.oldValues.createdAt,
        updatedAt: auditEntry.oldValues.updatedAt?.toISOString?.() || auditEntry.oldValues.updatedAt,
      } : undefined,
      newValues: auditEntry.newValues ? {
        ...auditEntry.newValues,
        paymentDate: auditEntry.newValues.paymentDate?.toISOString?.() || auditEntry.newValues.paymentDate,
        createdAt: auditEntry.newValues.createdAt?.toISOString?.() || auditEntry.newValues.createdAt,
        updatedAt: auditEntry.newValues.updatedAt?.toISOString?.() || auditEntry.newValues.updatedAt,
      } : undefined,
    };
    
    auditEntries.push(entryToStore);
    localStorage.setItem(this.PAYMENT_AUDIT_KEY, JSON.stringify(auditEntries));
    
    return auditEntry;
  }

  // Get payment audit trail
  getPaymentAuditTrail(paymentId: string): PaymentAuditEntry[] {
    const auditJson = localStorage.getItem(this.PAYMENT_AUDIT_KEY) || '[]';
    const auditEntries = JSON.parse(auditJson);
    
    return auditEntries
      .filter((entry: any) => entry.paymentId === paymentId)
      .map((entry: any) => ({
        ...entry,
        timestamp: new Date(entry.timestamp),
        oldValues: entry.oldValues ? {
          ...entry.oldValues,
          paymentDate: entry.oldValues.paymentDate ? new Date(entry.oldValues.paymentDate) : undefined,
          createdAt: entry.oldValues.createdAt ? new Date(entry.oldValues.createdAt) : undefined,
          updatedAt: entry.oldValues.updatedAt ? new Date(entry.oldValues.updatedAt) : undefined,
        } : undefined,
        newValues: entry.newValues ? {
          ...entry.newValues,
          paymentDate: entry.newValues.paymentDate ? new Date(entry.newValues.paymentDate) : undefined,
          createdAt: entry.newValues.createdAt ? new Date(entry.newValues.createdAt) : undefined,
          updatedAt: entry.newValues.updatedAt ? new Date(entry.newValues.updatedAt) : undefined,
        } : undefined,
      }))
      .sort((a: PaymentAuditEntry, b: PaymentAuditEntry) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  calculateCurrentBalance(loanId: string) {
    const loan = this.getLoan(loanId);
    if (!loan) return 0;
    
    const payments = this.getPayments(loanId); // This excludes deleted payments
    const completedPayments = payments.filter((p: Payment) => p.status === 'COMPLETED');
    
    const totalPrincipalPaid = completedPayments.reduce((sum: number, p: Payment) => sum + p.principal, 0);
    return loan.loanParameters.principal - totalPrincipalPaid;
  }

  // Clear all demo data
  clearAllData() {
    localStorage.removeItem(this.LOANS_KEY);
    localStorage.removeItem(this.MODIFICATIONS_KEY);
    localStorage.removeItem(this.PAYMENTS_KEY);
    localStorage.removeItem(this.PAYMENT_AUDIT_KEY);
    this.initializeStorage();
  }

  // Export data for debugging
  exportData() {
    return {
      loans: this.getLoans(),
      modifications: this.getModifications(),
      payments: this.getPayments(undefined, true), // Include deleted payments in export
      paymentAudit: JSON.parse(localStorage.getItem(this.PAYMENT_AUDIT_KEY) || '[]'),
    };
  }
}

// Export singleton instance
export const demoLoanStorage = new DemoLoanStorage();