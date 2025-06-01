/**
 * Loan Calculation Cache Service
 * Provides intelligent caching with change detection and state persistence
 */

// Note: Import LoanEngine only when needed to avoid Babel decimal issues
// import { LoanEngine, LoanParameters } from '@lendpeak/engine';
// Simple hash function for browser compatibility
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export interface CachedCalculation {
  hash: string;
  timestamp: number;
  loanParameters: any;
  calculatedState: LoanCalculatedState;
  paymentHistory?: PaymentRecord[];
  modifications?: ModificationRecord[];
}

export interface LoanCalculatedState {
  currentBalance: number;
  monthlyPayment: number;
  totalInterest: number;
  totalPayments: number;
  principalRemaining: number;
  interestRemaining: number;
  payoffAmount: number;
  payoffDate: Date;
  amortizationSchedule?: ScheduleEntry[];
  aprCalculation?: number;
  nextPaymentDate: Date;
  remainingTermMonths: number;
  totalPrincipalPaid: number;
  totalInterestPaid: number;
  totalFeesPaid: number;
  daysPastDue: number;
  status: 'ACTIVE' | 'DELINQUENT' | 'PAID_OFF' | 'DEFAULTED';
}

export interface ScheduleEntry {
  paymentNumber: number;
  dueDate: Date;
  principal: number;
  interest: number;
  beginningBalance: number;
  endingBalance: number;
  totalPayment: number;
}

export interface PaymentRecord {
  date: Date;
  amount: number;
  type: 'REGULAR' | 'PREPAYMENT' | 'LATE' | 'PARTIAL';
  allocation: {
    principal: number;
    interest: number;
    fees: number;
  };
}

export interface ModificationRecord {
  date: Date;
  type: 'RATE_CHANGE' | 'TERM_EXTENSION' | 'PAYMENT_REDUCTION';
  previousValue: number;
  newValue: number;
  reason: string;
}

class LoanCalculationCache {
  private cache = new Map<string, CachedCalculation>();
  private readonly CACHE_VERSION = '1.0';
  private readonly CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Generate a hash for loan parameters and state
   */
  private generateHash(
    loanParameters: LoanParameters,
    paymentHistory: PaymentRecord[] = [],
    modifications: ModificationRecord[] = []
  ): string {
    const hashInput = {
      version: this.CACHE_VERSION,
      loanParameters: this.normalizeParameters(loanParameters),
      paymentHistory: paymentHistory.map(p => ({
        date: p.date.toISOString(),
        amount: p.amount,
        type: p.type,
        allocation: p.allocation,
      })),
      modifications: modifications.map(m => ({
        date: m.date.toISOString(),
        type: m.type,
        previousValue: m.previousValue,
        newValue: m.newValue,
        reason: m.reason,
      })),
    };

    return simpleHash(JSON.stringify(hashInput));
  }

  /**
   * Normalize loan parameters for consistent hashing
   */
  private normalizeParameters(params: any): any {
    return {
      principal: Number(params.principal),
      interestRate: Number(params.interestRate),
      termMonths: Number(params.termMonths),
      paymentFrequency: params.paymentFrequency,
      startDate: params.startDate?.toISOString(),
      calendarType: params.calendarType,
      accrualTiming: params.accrualTiming,
      perDiemMethod: params.perDiemMethod,
      fees: params.fees,
    };
  }

  /**
   * Get cached calculation if valid, otherwise calculate and cache
   */
  public async getOrCalculate(
    loanId: string,
    loanParameters: any,
    paymentHistory: PaymentRecord[] = [],
    modifications: ModificationRecord[] = []
  ): Promise<LoanCalculatedState> {
    const hash = this.generateHash(loanParameters, paymentHistory, modifications);
    const cacheKey = `${loanId}_${hash}`;
    
    // Check if we have a valid cached calculation
    const cached = this.cache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      console.log(`📋 Cache hit for loan ${loanId} (${hash})`);
      return cached.calculatedState;
    }

    // Calculate fresh state
    console.log(`🔄 Calculating state for loan ${loanId} (${hash})`);
    const calculatedState = await this.performCalculation(loanParameters, paymentHistory, modifications);
    
    // Cache the result
    const cachedCalculation: CachedCalculation = {
      hash,
      timestamp: Date.now(),
      loanParameters,
      calculatedState,
      paymentHistory,
      modifications,
    };
    
    this.cache.set(cacheKey, cachedCalculation);
    this.saveToStorage();
    
    return calculatedState;
  }

  /**
   * Perform the actual loan calculation using simplified math (avoiding engine import)
   */
  private async performCalculation(
    loanParameters: any,
    paymentHistory: PaymentRecord[],
    modifications: ModificationRecord[]
  ): Promise<LoanCalculatedState> {
    const startTime = performance.now();
    
    try {
      // Simplified calculation to avoid import issues
      // In production, this would use the loan engine via API call
      const principal = Number(loanParameters.principal);
      const rate = Number(loanParameters.interestRate) / 100 / 12; // Monthly rate
      const term = Number(loanParameters.termMonths);
      
      // Calculate monthly payment using standard amortization formula
      const monthlyPayment = principal * (rate * Math.pow(1 + rate, term)) / (Math.pow(1 + rate, term) - 1);
      const totalPayments = monthlyPayment * term;
      const totalInterest = totalPayments - principal;
      
      // Apply payment history to calculate current state
      let currentBalance = principal;
      let totalPrincipalPaid = 0;
      let totalInterestPaid = 0;
      let totalFeesPaid = 0;
      
      for (const payment of paymentHistory) {
        totalPrincipalPaid += payment.allocation.principal;
        totalInterestPaid += payment.allocation.interest;
        totalFeesPaid += payment.allocation.fees;
        currentBalance -= payment.allocation.principal;
      }
      
      // Calculate remaining term
      const paymentsRemaining = Math.max(0, term - paymentHistory.length);
      
      // Determine status
      let status: LoanCalculatedState['status'] = 'ACTIVE';
      let daysPastDue = 0;
      
      if (currentBalance <= 0) {
        status = 'PAID_OFF';
      } else if (paymentHistory.length > 0) {
        const lastPayment = paymentHistory[paymentHistory.length - 1];
        const daysSinceLastPayment = Math.floor((Date.now() - lastPayment.date.getTime()) / (24 * 60 * 60 * 1000));
        if (daysSinceLastPayment > 30) {
          status = 'DELINQUENT';
          daysPastDue = daysSinceLastPayment - 30;
        }
      }
      
      // Calculate next payment date
      const nextPaymentDate = new Date();
      nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
      nextPaymentDate.setDate(1); // First of next month
      
      // Calculate payoff date
      const payoffDate = new Date();
      payoffDate.setMonth(payoffDate.getMonth() + paymentsRemaining);
      
      // Generate simplified amortization schedule
      const amortizationSchedule: ScheduleEntry[] = [];
      let balance = principal;
      
      for (let i = 0; i < Math.min(term, 12); i++) { // Only generate first 12 payments for performance
        const interestPayment = balance * rate;
        const principalPayment = monthlyPayment - interestPayment;
        const dueDate = new Date();
        dueDate.setMonth(dueDate.getMonth() + i + 1);
        
        amortizationSchedule.push({
          paymentNumber: i + 1,
          dueDate,
          principal: principalPayment,
          interest: interestPayment,
          beginningBalance: balance,
          endingBalance: balance - principalPayment,
          totalPayment: monthlyPayment,
        });
        
        balance -= principalPayment;
        if (balance <= 0) break;
      }
      
      const calculatedState: LoanCalculatedState = {
        currentBalance,
        monthlyPayment,
        totalInterest,
        totalPayments,
        principalRemaining: currentBalance,
        interestRemaining: totalInterest - totalInterestPaid,
        payoffAmount: currentBalance,
        payoffDate,
        amortizationSchedule,
        aprCalculation: loanParameters.interestRate,
        nextPaymentDate,
        remainingTermMonths: paymentsRemaining,
        totalPrincipalPaid,
        totalInterestPaid,
        totalFeesPaid,
        daysPastDue,
        status,
      };
      
      const endTime = performance.now();
      console.log(`⚡ Calculation completed in ${(endTime - startTime).toFixed(2)}ms`);
      
      return calculatedState;
      
    } catch (error) {
      console.error('Error performing loan calculation:', error);
      throw error;
    }
  }

  /**
   * Check if cached calculation is still valid
   */
  private isCacheValid(cached: CachedCalculation): boolean {
    const age = Date.now() - cached.timestamp;
    return age < this.CACHE_EXPIRY_MS;
  }

  /**
   * Load cache from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('loanCalculationCache');
      if (stored) {
        const data = JSON.parse(stored);
        // Convert back to Map and restore dates
        for (const [key, value] of Object.entries(data)) {
          const cached = value as any;
          // Restore Date objects
          cached.calculatedState.payoffDate = new Date(cached.calculatedState.payoffDate);
          cached.calculatedState.nextPaymentDate = new Date(cached.calculatedState.nextPaymentDate);
          if (cached.calculatedState.amortizationSchedule) {
            cached.calculatedState.amortizationSchedule.forEach((entry: any) => {
              entry.dueDate = new Date(entry.dueDate);
            });
          }
          this.cache.set(key, cached);
        }
        console.log(`📁 Loaded ${this.cache.size} cached calculations from storage`);
      }
    } catch (error) {
      console.error('Error loading cache from storage:', error);
    }
  }

  /**
   * Save cache to localStorage
   */
  private saveToStorage(): void {
    try {
      const data = Object.fromEntries(this.cache.entries());
      localStorage.setItem('loanCalculationCache', JSON.stringify(data));
    } catch (error) {
      console.error('Error saving cache to storage:', error);
    }
  }

  /**
   * Clear cache (useful for development/testing)
   */
  public clearCache(): void {
    this.cache.clear();
    localStorage.removeItem('loanCalculationCache');
    console.log('🗑️ Cache cleared');
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    size: number;
    hitRate: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  } {
    let oldest: number | null = null;
    let newest: number | null = null;
    
    for (const cached of this.cache.values()) {
      if (!oldest || cached.timestamp < oldest) oldest = cached.timestamp;
      if (!newest || cached.timestamp > newest) newest = cached.timestamp;
    }
    
    return {
      size: this.cache.size,
      hitRate: 0, // Would need to track hits/misses for this
      oldestEntry: oldest ? new Date(oldest) : null,
      newestEntry: newest ? new Date(newest) : null,
    };
  }

  /**
   * Invalidate cache for a specific loan
   */
  public invalidateLoan(loanId: string): void {
    const keysToDelete = Array.from(this.cache.keys()).filter(key => key.startsWith(`${loanId}_`));
    keysToDelete.forEach(key => this.cache.delete(key));
    this.saveToStorage();
    console.log(`🗑️ Invalidated ${keysToDelete.length} cache entries for loan ${loanId}`);
  }
}

// Export singleton instance
export const loanCalculationCache = new LoanCalculationCache();