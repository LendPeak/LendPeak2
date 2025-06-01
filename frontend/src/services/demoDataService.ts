/**
 * Enhanced Demo Data Service for Frontend
 * Provides comprehensive demo data management with realistic scenarios
 */

// Removed LoanEngine import to avoid Babel decimal syntax issues
// In production, calculations would be done via API calls
import { loanCalculationCache, LoanCalculatedState } from './loanCalculationCache';

// Minimal static data for fast loading
const DEMO_CATEGORIES = {
  STANDARD: { name: 'Standard Loans', description: 'Standard loan scenarios' },
  DELINQUENT: { name: 'Delinquent Loans', description: 'Delinquent loan scenarios' },
  PREPAYMENT: { name: 'Prepayment', description: 'Prepayment scenarios' },
  MODIFICATION: { name: 'Modifications', description: 'Loan modification scenarios' },
  SPECIAL: { name: 'Special Cases', description: 'Special loan scenarios' },
};

const DEMO_STATS = {
  totalLoans: 5,
  totalCategories: 5,
  avgCalculationTime: '15ms',
  cacheHitRate: '85%',
};

interface DemoLoanScenario {
  id: string;
  name: string;
  description: string;
  category: keyof typeof DEMO_CATEGORIES;
  loanParameters: any;
  borrowerProfile: any;
  displayOrder: number;
}

export interface DemoLoan {
  id: string;
  loanNumber: string;
  borrowerId: string;
  scenario: DemoLoanScenario;
  currentState: LoanCurrentState;
  calculatedData: LoanCalculatedData;
  timelineEvents: TimelineEvent[];
}

export interface LoanCurrentState {
  currentBalance: number;
  monthlyPayment: number;
  nextPaymentDate: Date;
  status: 'PENDING' | 'ACTIVE' | 'PAID_OFF' | 'DELINQUENT' | 'DEFAULTED';
  daysPastDue: number;
  delinquentAmount?: number;
  remainingTermMonths: number;
  totalInterestPaid: number;
  totalPrincipalPaid: number;
  totalFeesPaid: number;
}

export interface LoanCalculatedData {
  originalPayment: number;
  totalInterest: number;
  totalPayments: number;
  principalRemaining: number;
  interestRemaining: number;
  payoffAmount: number;
  payoffDate: Date;
  amortizationSchedule?: AmortizationEntry[];
}

export interface AmortizationEntry {
  paymentNumber: number;
  paymentDate: Date;
  scheduledPayment: number;
  principalPayment: number;
  interestPayment: number;
  remainingBalance: number;
}

export interface TimelineEvent {
  id: string;
  date: Date;
  type: 'ORIGINATION' | 'PAYMENT' | 'LATE_PAYMENT' | 'MODIFICATION' | 'FORBEARANCE' | 'PAYOFF' | 'DEFAULT';
  title: string;
  description: string;
  amount?: number;
  metadata?: Record<string, any>;
}

class DemoDataService {
  private loans: Map<string, DemoLoan> = new Map();
  private borrowers: Map<string, DemoBorrowerProfile> = new Map();
  private asOfDate: Date = new Date();
  private calculationCache: Map<string, any> = new Map();
  private initialized = false;

  constructor() {
    // Use lazy initialization for better performance
  }

  /**
   * Initialize demo data from scenarios (ultra-fast static data)
   */
  private async initializeDemoData(): Promise<void> {
    if (this.initialized) return;
    
    console.log('🎭 Initializing demo data (ultra-fast mode)...');
    
    // Create minimal static demo loans without heavy calculations
    const staticLoans = [
      {
        id: 'demo_001',
        name: 'Perfect Auto Loan',
        description: 'Standard 5-year auto loan with perfect payment history',
        category: 'STANDARD' as keyof typeof DEMO_CATEGORIES,
        principal: 28500,
        rate: 5.9,
        term: 60,
      },
      {
        id: 'demo_002', 
        name: 'Delinquent Mortgage',
        description: '30-year mortgage with 60-day delinquency',
        category: 'DELINQUENT' as keyof typeof DEMO_CATEGORIES,
        principal: 350000,
        rate: 5.75,
        term: 360,
      },
      {
        id: 'demo_003',
        name: 'Prepayment Scenario',
        description: 'Loan with aggressive principal prepayments',
        category: 'PREPAYMENT' as keyof typeof DEMO_CATEGORIES,
        principal: 200000,
        rate: 4.5,
        term: 180,
      },
      {
        id: 'demo_004',
        name: 'Modified Loan',
        description: 'Loan with rate modification due to hardship',
        category: 'MODIFICATION' as keyof typeof DEMO_CATEGORIES,
        principal: 45000,
        rate: 3.5,
        term: 84,
      },
      {
        id: 'demo_005',
        name: 'Military SCRA Loan',
        description: 'Active duty military with SCRA rate protection',
        category: 'SPECIAL' as keyof typeof DEMO_CATEGORIES,
        principal: 75000,
        rate: 6.0,
        term: 120,
      },
    ];

    staticLoans.forEach((loan, index) => {
      const loanId = loan.id;
      const loanNumber = this.generateLoanNumber(index);
      
      // Create simple borrower
      const borrower = {
        id: `borrower_${index}`,
        firstName: `Demo${index}`,
        lastName: 'Borrower',
        email: `demo${index}@example.com`,
        phone: `555-000-${String(index).padStart(4, '0')}`,
        ssn: '***-**-****',
        dateOfBirth: '1985-01-01',
        creditScore: 720 + (index * 20),
        annualIncome: 50000 + (index * 10000),
        employmentStatus: 'EMPLOYED' as const,
        address: {
          street: `${index * 100} Demo St`,
          city: 'Demo City', 
          state: 'DC',
          zipCode: '12345',
        },
        riskProfile: 'LOW' as const,
      };
      
      this.borrowers.set(borrower.id, borrower);
      
      // Create simple demo loan
      const demoLoan: DemoLoan = {
        id: loanId,
        loanNumber,
        borrowerId: borrower.id,
        scenario: {
          id: loan.id,
          name: loan.name,
          description: loan.description,
          category: loan.category,
          loanParameters: {
            principal: loan.principal,
            interestRate: loan.rate,
            termMonths: loan.term,
            paymentFrequency: 'monthly',
          },
          borrowerProfile: borrower,
          displayOrder: index,
        },
        currentState: {
          currentBalance: loan.principal * 0.8, // Assume 20% paid
          monthlyPayment: Math.round(loan.principal / loan.term * 1.2),
          nextPaymentDate: new Date(),
          status: index === 1 ? 'DELINQUENT' : 'ACTIVE',
          daysPastDue: index === 1 ? 60 : 0,
          remainingTermMonths: Math.round(loan.term * 0.8),
          totalInterestPaid: loan.principal * 0.1,
          totalPrincipalPaid: loan.principal * 0.2,
          totalFeesPaid: 0,
        },
        calculatedData: {
          originalPayment: Math.round(loan.principal / loan.term * 1.2),
          totalInterest: loan.principal * 0.3,
          totalPayments: loan.principal * 1.3,
          principalRemaining: loan.principal * 0.8,
          interestRemaining: loan.principal * 0.2,
          payoffAmount: loan.principal * 0.8,
          payoffDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          _needsCalculation: true, // Flag for lazy calculation
        },
        timelineEvents: [],
      };
      
      this.loans.set(loanId, demoLoan);
    });
    
    this.initialized = true;
    console.log(`✅ Ultra-fast initialized ${this.loans.size} demo loans`);
  }

  /**
   * Get minimal current state for fast initialization
   */
  private getMinimalCurrentState(scenario: DemoLoanScenario): LoanCurrentState {
    return {
      currentBalance: scenario.loanParameters.principal,
      monthlyPayment: 0, // Calculate on demand
      nextPaymentDate: new Date(),
      status: 'ACTIVE',
      daysPastDue: 0,
      remainingTermMonths: scenario.loanParameters.termMonths,
      totalInterestPaid: 0,
      totalPrincipalPaid: 0,
      totalFeesPaid: 0,
    };
  }

  /**
   * Get minimal calculated data for fast initialization
   */
  private getMinimalCalculatedData(scenario: DemoLoanScenario): LoanCalculatedData {
    return {
      originalPayment: 0, // Calculate on demand
      totalInterest: 0,
      totalPayments: 0,
      principalRemaining: scenario.loanParameters.principal,
      interestRemaining: 0,
      payoffAmount: scenario.loanParameters.principal,
      payoffDate: new Date(),
    };
  }

  /**
   * Get loan with full calculated state (using cache)
   */
  public async getLoanWithCalculatedState(loanId: string): Promise<DemoLoan | null> {
    await this.initializeDemoData();
    const loan = this.loans.get(loanId);
    if (!loan) return null;

    // Check if we need to calculate the full state
    if ((loan.calculatedData as any)._needsCalculation) {
      console.log(`🔄 Computing full state for loan ${loanId}...`);
      
      try {
        const calculatedState = await loanCalculationCache.getOrCalculate(
          loanId,
          {
            principal: loan.scenario.loanParameters.principal,
            interestRate: loan.scenario.loanParameters.interestRate,
            termMonths: loan.scenario.loanParameters.termMonths,
            paymentFrequency: loan.scenario.loanParameters.paymentFrequency,
            startDate: new Date().toISOString(),
            calendarType: '30/360',
            accrualTiming: 'DAY_1',
            perDiemMethod: 'STABLE',
          }
        );

        // Update the loan with calculated state
        loan.currentState = {
          currentBalance: calculatedState.currentBalance,
          monthlyPayment: calculatedState.monthlyPayment,
          nextPaymentDate: calculatedState.nextPaymentDate,
          status: calculatedState.status,
          daysPastDue: calculatedState.daysPastDue,
          remainingTermMonths: calculatedState.remainingTermMonths,
          totalInterestPaid: calculatedState.totalInterestPaid,
          totalPrincipalPaid: calculatedState.totalPrincipalPaid,
          totalFeesPaid: calculatedState.totalFeesPaid,
        };

        loan.calculatedData = {
          originalPayment: calculatedState.monthlyPayment,
          totalInterest: calculatedState.totalInterest,
          totalPayments: calculatedState.totalPayments,
          principalRemaining: calculatedState.principalRemaining,
          interestRemaining: calculatedState.interestRemaining,
          payoffAmount: calculatedState.payoffAmount,
          payoffDate: calculatedState.payoffDate,
          amortizationSchedule: calculatedState.amortizationSchedule,
        };

        // Remove the calculation flag
        delete (loan.calculatedData as any)._needsCalculation;
        
      } catch (error) {
        console.error(`Error calculating state for loan ${loanId}:`, error);
      }
    }

    return loan;
  }

  /**
   * Get all demo loans with optional filtering
   */
  public async getLoans(filters?: {
    category?: keyof typeof DEMO_CATEGORIES;
    status?: string[];
    borrowerId?: string;
    searchTerm?: string;
  }): Promise<DemoLoan[]> {
    await this.initializeDemoData();
    let loans = Array.from(this.loans.values());
    
    if (filters) {
      if (filters.category) {
        loans = loans.filter(loan => loan.scenario.category === filters.category);
      }
      
      if (filters.status && filters.status.length > 0) {
        loans = loans.filter(loan => filters.status!.includes(loan.currentState.status));
      }
      
      if (filters.borrowerId) {
        loans = loans.filter(loan => loan.borrowerId === filters.borrowerId);
      }
      
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        loans = loans.filter(loan => 
          loan.scenario.name.toLowerCase().includes(term) ||
          loan.scenario.description.toLowerCase().includes(term) ||
          loan.loanNumber.toLowerCase().includes(term) ||
          this.getBorrowerName(loan.borrowerId).toLowerCase().includes(term)
        );
      }
    }
    
    return loans.sort((a, b) => a.scenario.displayOrder - b.scenario.displayOrder);
  }

  /**
   * Get a specific demo loan by ID
   */
  public getLoan(loanId: string): DemoLoan | undefined {
    return this.loans.get(loanId);
  }

  /**
   * Get borrower profile
   */
  public getBorrower(borrowerId: string): DemoBorrowerProfile | undefined {
    return this.borrowers.get(borrowerId);
  }

  /**
   * Get all borrowers
   */
  public getBorrowers(): DemoBorrowerProfile[] {
    return Array.from(this.borrowers.values());
  }

  /**
   * Get borrower full name
   */
  public getBorrowerName(borrowerId: string): string {
    const borrower = this.getBorrower(borrowerId);
    return borrower ? `${borrower.firstName} ${borrower.lastName}` : 'Unknown Borrower';
  }

  /**
   * Get demo statistics
   */
  public async getStatistics(): Promise<{
    totalLoans: number;
    totalBorrowers: number;
    categories: Record<string, number>;
    portfolioValue: number;
    averageLoanAmount: number;
    delinquencyRate: number;
  }> {
    const loans = await this.getLoans();
    const totalLoans = loans.length;
    const totalBorrowers = this.borrowers.size;
    
    const portfolioValue = loans.reduce((sum, loan) => sum + loan.currentState.currentBalance, 0);
    const averageLoanAmount = portfolioValue / totalLoans;
    
    const delinquentLoans = loans.filter(loan => loan.currentState.status === 'DELINQUENT').length;
    const delinquencyRate = (delinquentLoans / totalLoans) * 100;
    
    const categories: Record<string, number> = {};
    Object.keys(DEMO_CATEGORIES).forEach(category => {
      categories[category] = loans.filter(loan => loan.scenario.category === category).length;
    });
    
    return {
      totalLoans,
      totalBorrowers,
      categories,
      portfolioValue,
      averageLoanAmount,
      delinquencyRate,
    };
  }

  /**
   * Simulate making a payment on a demo loan
   */
  public async makePayment(loanId: string, paymentAmount: number, paymentDate: Date = new Date()): Promise<{
    success: boolean;
    newBalance: number;
    principalPaid: number;
    interestPaid: number;
    feesPaid: number;
    paymentRecord: DemoPaymentRecord;
  }> {
    const loan = this.getLoan(loanId);
    if (!loan) {
      throw new Error(`Loan ${loanId} not found`);
    }

    try {
      // Use the loan engine to calculate payment allocation
      const currentBalance = loan.currentState.currentBalance;
      const interestRate = loan.scenario.loanParameters.interestRate;
      
      // Simplified payment allocation (in production, use full loan engine)
      const monthlyInterestRate = interestRate / 100 / 12;
      const interestPaid = Math.min(paymentAmount, currentBalance * monthlyInterestRate);
      const principalPaid = Math.max(0, paymentAmount - interestPaid);
      const feesPaid = 0; // Simplified
      
      const newBalance = Math.max(0, currentBalance - principalPaid);
      
      // Create payment record
      const paymentRecord: DemoPaymentRecord = {
        date: paymentDate,
        scheduledAmount: loan.currentState.monthlyPayment,
        actualAmount: paymentAmount,
        status: paymentAmount >= loan.currentState.monthlyPayment ? 'ON_TIME' : 'PARTIAL',
        paymentMethod: 'ONLINE',
        transactionId: `DEMO_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };
      
      // Update loan state
      loan.currentState.currentBalance = newBalance;
      loan.currentState.totalPrincipalPaid += principalPaid;
      loan.currentState.totalInterestPaid += interestPaid;
      loan.currentState.totalFeesPaid += feesPaid;
      
      // Update next payment date
      const nextPayment = new Date(loan.currentState.nextPaymentDate);
      nextPayment.setMonth(nextPayment.getMonth() + 1);
      loan.currentState.nextPaymentDate = nextPayment;
      
      // Add timeline event
      loan.timelineEvents.push({
        id: `payment_${Date.now()}`,
        date: paymentDate,
        type: 'PAYMENT',
        title: `Payment Received`,
        description: `Payment of $${paymentAmount.toLocaleString()} received`,
        amount: paymentAmount,
        metadata: { principalPaid, interestPaid, feesPaid, newBalance },
      });
      
      // Check if loan is paid off
      if (newBalance <= 0.01) { // Account for rounding
        loan.currentState.status = 'PAID_OFF';
        loan.timelineEvents.push({
          id: `payoff_${Date.now()}`,
          date: paymentDate,
          type: 'PAYOFF',
          title: 'Loan Paid Off',
          description: 'Congratulations! This loan has been paid in full.',
          metadata: { finalPayment: paymentAmount },
        });
      }
      
      return {
        success: true,
        newBalance,
        principalPaid,
        interestPaid,
        feesPaid,
        paymentRecord,
      };
      
    } catch (error) {
      console.error('Error processing demo payment:', error);
      throw new Error(`Failed to process payment: ${error}`);
    }
  }

  /**
   * Set as-of date for time travel analysis
   */
  public setAsOfDate(date: Date): void {
    this.asOfDate = date;
    // In a full implementation, this would recalculate all loan states as of the specified date
    console.log(`📅 Demo time travel set to: ${date.toLocaleDateString()}`);
  }

  /**
   * Get current as-of date
   */
  public getAsOfDate(): Date {
    return this.asOfDate;
  }

  /**
   * Get loans by category for demo showcase
   */
  public async getLoansByCategory(): Promise<Record<string, DemoLoan[]>> {
    const result: Record<string, DemoLoan[]> = {};
    
    await this.initializeDemoData();
    
    for (const category of Object.keys(DEMO_CATEGORIES)) {
      result[category] = await this.getLoans({ category: category as keyof typeof DEMO_CATEGORIES });
    }
    
    return result;
  }

  /**
   * Generate sample amortization schedule
   */
  public generateAmortizationSchedule(loanId: string, numberOfPayments: number = 12): AmortizationEntry[] {
    const loan = this.getLoan(loanId);
    if (!loan) return [];

    try {
      // Use the loan engine to generate amortization schedule
      const schedule = LoanEngine.generateSchedule(loan.scenario.loanParameters);
      
      // Convert to our demo format and take only requested number of payments
      return schedule.payments.slice(0, numberOfPayments).map((payment, index) => ({
        paymentNumber: index + 1,
        paymentDate: new Date(payment.dueDate),
        scheduledPayment: Number(payment.scheduledPayment.toString()),
        principalPayment: Number(payment.principal.toString()),
        interestPayment: Number(payment.interest.toString()),
        remainingBalance: Number(payment.remainingBalance.toString()),
      }));
      
    } catch (error) {
      console.error('Error generating amortization schedule:', error);
      return [];
    }
  }

  /**
   * Get featured scenarios for homepage/demo
   */
  public async getFeaturedScenarios(): Promise<DemoLoan[]> {
    await this.initializeDemoData();
    return [
      this.loans.get('demo_001'),
      this.loans.get('demo_002'),
      this.loans.get('demo_003'),
      this.loans.get('demo_004'),
      this.loans.get('demo_005'),
    ].filter(Boolean) as DemoLoan[];
  }

  // Private helper methods

  private generateLoanNumber(index: number): string {
    const prefix = 'DEMO';
    const year = new Date().getFullYear();
    const sequence = String(index + 1).padStart(4, '0');
    return `${prefix}${year}${sequence}`;
  }

  private calculateCurrentState(scenario: DemoLoanScenario): LoanCurrentState {
    try {
      // Use loan engine for accurate calculations
      const calculation = LoanEngine.calculatePayment(scenario.loanParameters);
      
      // Calculate current balance based on payment history
      let currentBalance = scenario.loanParameters.principal;
      let totalInterestPaid = 0;
      let totalPrincipalPaid = 0;
      const totalFeesPaid = 0;
      
      if (scenario.paymentHistory) {
        scenario.paymentHistory.forEach(payment => {
          // Simplified allocation - in production, use loan engine
          const interestPortion = payment.actualAmount * 0.7; // Rough estimate
          const principalPortion = payment.actualAmount * 0.3;
          
          totalInterestPaid += interestPortion;
          totalPrincipalPaid += principalPortion;
          currentBalance -= principalPortion;
        });
      }
      
      // Determine status
      let status: LoanCurrentState['status'] = 'ACTIVE';
      let daysPastDue = 0;
      let delinquentAmount = 0;
      
      if (scenario.category === 'DELINQUENT') {
        status = 'DELINQUENT';
        if (scenario.name.includes('30')) daysPastDue = 35;
        else if (scenario.name.includes('60')) daysPastDue = 65;
        else if (scenario.name.includes('90')) daysPastDue = 95;
        
        delinquentAmount = Math.ceil(daysPastDue / 30) * Number(calculation.paymentAmount.toString());
      }
      
      if (currentBalance <= 0) {
        status = 'PAID_OFF';
        currentBalance = 0;
      }
      
      const remainingTermMonths = Math.max(0, scenario.loanParameters.termMonths - (scenario.paymentHistory?.length || 0));
      
      return {
        currentBalance: Math.max(0, currentBalance),
        monthlyPayment: Number(calculation.paymentAmount.toString()),
        nextPaymentDate: this.calculateNextPaymentDate(),
        status,
        daysPastDue,
        delinquentAmount: delinquentAmount > 0 ? delinquentAmount : undefined,
        remainingTermMonths,
        totalInterestPaid,
        totalPrincipalPaid,
        totalFeesPaid,
      };
      
    } catch (error) {
      console.error(`Error calculating current state for ${scenario.id}:`, error);
      
      // Fallback values
      return {
        currentBalance: scenario.loanParameters.principal,
        monthlyPayment: 1000,
        nextPaymentDate: this.calculateNextPaymentDate(),
        status: 'ACTIVE',
        daysPastDue: 0,
        remainingTermMonths: scenario.loanParameters.termMonths,
        totalInterestPaid: 0,
        totalPrincipalPaid: 0,
        totalFeesPaid: 0,
      };
    }
  }

  private calculateLoanData(scenario: DemoLoanScenario): LoanCalculatedData {
    try {
      const calculation = LoanEngine.calculatePayment(scenario.loanParameters);
      const schedule = LoanEngine.generateSchedule(scenario.loanParameters);
      
      const originalPayment = Number(calculation.paymentAmount.toString());
      const totalInterest = Number(calculation.totalInterest.toString());
      const totalPayments = scenario.loanParameters.termMonths;
      
      // Calculate remaining amounts
      const paymentsMade = scenario.paymentHistory?.length || 0;
      const principalRemaining = Math.max(0, scenario.loanParameters.principal - (paymentsMade * originalPayment * 0.3));
      const interestRemaining = Math.max(0, totalInterest - (paymentsMade * originalPayment * 0.7));
      
      const payoffAmount = principalRemaining + (principalRemaining * scenario.loanParameters.interestRate / 100 / 12);
      
      const payoffDate = new Date();
      payoffDate.setMonth(payoffDate.getMonth() + (totalPayments - paymentsMade));
      
      return {
        originalPayment,
        totalInterest,
        totalPayments,
        principalRemaining,
        interestRemaining,
        payoffAmount,
        payoffDate,
      };
      
    } catch (error) {
      console.error(`Error calculating loan data for ${scenario.id}:`, error);
      
      // Fallback values
      return {
        originalPayment: 1000,
        totalInterest: scenario.loanParameters.principal * 0.5,
        totalPayments: scenario.loanParameters.termMonths,
        principalRemaining: scenario.loanParameters.principal,
        interestRemaining: scenario.loanParameters.principal * 0.25,
        payoffAmount: scenario.loanParameters.principal,
        payoffDate: new Date(),
      };
    }
  }

  private generateTimelineEvents(scenario: DemoLoanScenario): TimelineEvent[] {
    const events: TimelineEvent[] = [];
    
    // Origination event
    events.push({
      id: `orig_${scenario.id}`,
      date: scenario.loanParameters.startDate,
      type: 'ORIGINATION',
      title: 'Loan Originated',
      description: `${scenario.name} originated for $${scenario.loanParameters.principal.toLocaleString()}`,
      amount: scenario.loanParameters.principal,
    });
    
    // Payment events
    if (scenario.paymentHistory) {
      scenario.paymentHistory.forEach((payment, index) => {
        events.push({
          id: `pay_${scenario.id}_${index}`,
          date: payment.date,
          type: payment.status === 'LATE' ? 'LATE_PAYMENT' : 'PAYMENT',
          title: payment.status === 'LATE' ? 'Late Payment' : 'Payment Received',
          description: `Payment of $${payment.actualAmount.toLocaleString()} ${payment.status === 'LATE' ? `(${payment.daysLate} days late)` : ''}`,
          amount: payment.actualAmount,
          metadata: payment,
        });
      });
    }
    
    // Modification events
    if (scenario.modifications) {
      scenario.modifications.forEach((mod, index) => {
        events.push({
          id: `mod_${scenario.id}_${index}`,
          date: mod.date,
          type: mod.type === 'FORBEARANCE' ? 'FORBEARANCE' : 'MODIFICATION',
          title: `Loan ${mod.type.replace('_', ' ').toLowerCase()}`,
          description: mod.reason,
          metadata: mod,
        });
      });
    }
    
    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private calculateNextPaymentDate(): Date {
    const today = new Date();
    const nextPayment = new Date(today);
    nextPayment.setDate(15); // Assume 15th of month
    
    if (nextPayment <= today) {
      nextPayment.setMonth(nextPayment.getMonth() + 1);
    }
    
    return nextPayment;
  }
}

// Singleton instance
export const demoDataService = new DemoDataService();

// Export cache for debugging/stats
export { loanCalculationCache };

// Export types
export type { DemoLoan, LoanCurrentState, LoanCalculatedData, AmortizationEntry, TimelineEvent };

// Export demo categories and stats for components
export { DEMO_CATEGORIES, DEMO_STATS };