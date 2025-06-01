import { logger } from '../utils/logger';
import { ILoan } from '../models/loan.model';
import { IUser } from '../models/user.model';
import { getNotificationService } from './notification.service';
import { analyticsService } from './analytics.service';

export interface ApprovalRule {
  id: string;
  name: string;
  condition: (loan: ILoan, user: IUser) => boolean;
  weight: number;
  description: string;
  category: 'credit' | 'income' | 'risk' | 'history' | 'compliance';
}

export interface CreditCheckResult {
  score: number;
  factors: Array<{
    name: string;
    value: number;
    impact: 'positive' | 'negative' | 'neutral';
    weight: number;
  }>;
  recommendation: 'approve' | 'reject' | 'manual_review';
  confidence: number;
}

export interface ApprovalResult {
  decision: 'approved' | 'rejected' | 'manual_review';
  confidence: number;
  reasons: string[];
  riskScore: number;
  recommendedTerms?: {
    interestRate?: number;
    amount?: number;
    duration?: number;
  };
  conditions?: string[];
  nextSteps: string[];
  reviewerId?: string;
  timestamp: Date;
}

export interface ApprovalWorkflowConfig {
  autoApprovalThreshold: number;
  autoRejectionThreshold: number;
  maxLoanAmount: number;
  minCreditScore: number;
  maxDebtToIncomeRatio: number;
  enableMachineLearning: boolean;
  requireManualReview: boolean;
  notificationEnabled: boolean;
}

export class ApprovalWorkflowService {
  private rules: ApprovalRule[] = [];
  private config: ApprovalWorkflowConfig;

  constructor() {
    this.config = {
      autoApprovalThreshold: 80,
      autoRejectionThreshold: 40,
      maxLoanAmount: 100000,
      minCreditScore: 600,
      maxDebtToIncomeRatio: 0.43,
      enableMachineLearning: true,
      requireManualReview: false,
      notificationEnabled: true,
    };

    this.initializeDefaultRules();
  }

  /**
   * Initialize default approval rules
   */
  private initializeDefaultRules(): void {
    this.rules = [
      // Credit Score Rules
      {
        id: 'credit-score-excellent',
        name: 'Excellent Credit Score',
        condition: (loan, user) => this.getCreditScore(user) >= 750,
        weight: 25,
        description: 'User has excellent credit score (750+)',
        category: 'credit',
      },
      {
        id: 'credit-score-good',
        name: 'Good Credit Score',
        condition: (loan, user) => this.getCreditScore(user) >= 650,
        weight: 15,
        description: 'User has good credit score (650+)',
        category: 'credit',
      },
      {
        id: 'credit-score-poor',
        name: 'Poor Credit Score',
        condition: (loan, user) => this.getCreditScore(user) < 600,
        weight: -30,
        description: 'User has poor credit score (<600)',
        category: 'credit',
      },

      // Income Rules
      {
        id: 'high-income',
        name: 'High Income Verification',
        condition: (loan, user) => this.getAnnualIncome(user) >= 75000,
        weight: 20,
        description: 'User has high verified income (75k+)',
        category: 'income',
      },
      {
        id: 'stable-employment',
        name: 'Stable Employment',
        condition: (loan, user) => this.getEmploymentDuration(user) >= 24,
        weight: 15,
        description: 'User has stable employment (2+ years)',
        category: 'income',
      },
      {
        id: 'debt-to-income-low',
        name: 'Low Debt-to-Income Ratio',
        condition: (loan, user) => this.getDebtToIncomeRatio(loan, user) <= 0.3,
        weight: 20,
        description: 'User has low debt-to-income ratio (≤30%)',
        category: 'income',
      },
      {
        id: 'debt-to-income-high',
        name: 'High Debt-to-Income Ratio',
        condition: (loan, user) => this.getDebtToIncomeRatio(loan, user) > 0.43,
        weight: -25,
        description: 'User has high debt-to-income ratio (>43%)',
        category: 'income',
      },

      // Risk Assessment Rules
      {
        id: 'loan-amount-reasonable',
        name: 'Reasonable Loan Amount',
        condition: (loan, user) => Number(loan.principal) <= this.getAnnualIncome(user) * 0.5,
        weight: 15,
        description: 'Loan amount is reasonable relative to income',
        category: 'risk',
      },
      {
        id: 'loan-amount-excessive',
        name: 'Excessive Loan Amount',
        condition: (loan, user) => Number(loan.principal) > this.getAnnualIncome(user),
        weight: -20,
        description: 'Loan amount exceeds annual income',
        category: 'risk',
      },
      {
        id: 'collateral-provided',
        name: 'Collateral Provided',
        condition: (loan, user) => this.hasCollateral(loan),
        weight: 10,
        description: 'Loan is secured with collateral',
        category: 'risk',
      },

      // Credit History Rules
      {
        id: 'no-recent-defaults',
        name: 'No Recent Defaults',
        condition: (loan, user) => !this.hasRecentDefaults(user),
        weight: 20,
        description: 'No defaults in the last 3 years',
        category: 'history',
      },
      {
        id: 'recent-defaults',
        name: 'Recent Defaults',
        condition: (loan, user) => this.hasRecentDefaults(user),
        weight: -35,
        description: 'Has defaults in the last 3 years',
        category: 'history',
      },
      {
        id: 'existing-customer',
        name: 'Existing Customer',
        condition: (loan, user) => this.isExistingCustomer(user),
        weight: 10,
        description: 'Existing customer with good history',
        category: 'history',
      },

      // Compliance Rules
      {
        id: 'identity-verified',
        name: 'Identity Verified',
        condition: (loan, user) => this.isIdentityVerified(user),
        weight: 15,
        description: 'User identity has been verified',
        category: 'compliance',
      },
      {
        id: 'kyc-complete',
        name: 'KYC Complete',
        condition: (loan, user) => this.isKYCComplete(user),
        weight: 10,
        description: 'Know Your Customer process completed',
        category: 'compliance',
      },
      {
        id: 'aml-clear',
        name: 'AML Clear',
        condition: (loan, user) => this.isAMLClear(user),
        weight: 15,
        description: 'Anti-Money Laundering checks passed',
        category: 'compliance',
      },
    ];
  }

  /**
   * Process loan application through approval workflow
   */
  async processLoanApplication(
    loan: ILoan,
    user: IUser,
    options: { skipManualReview?: boolean } = {}
  ): Promise<ApprovalResult> {
    try {
      logger.info(`Processing loan application ${loan._id} for user ${user._id}`);

      // Perform credit check
      const creditCheck = await this.performCreditCheck(loan, user);
      
      // Evaluate approval rules
      const ruleResults = this.evaluateRules(loan, user);
      
      // Calculate overall score
      const overallScore = this.calculateOverallScore(ruleResults, creditCheck);
      
      // Determine decision
      const decision = this.makeDecision(overallScore, creditCheck, options);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(loan, user, creditCheck, overallScore);
      
      const result: ApprovalResult = {
        decision: decision.decision,
        confidence: decision.confidence,
        reasons: decision.reasons,
        riskScore: overallScore,
        recommendedTerms: recommendations.terms,
        conditions: recommendations.conditions,
        nextSteps: decision.nextSteps,
        timestamp: new Date(),
      };

      // Log decision
      await this.logApprovalDecision(loan, user, result);
      
      // Send notifications
      if (this.config.notificationEnabled) {
        await this.sendNotifications(loan, user, result);
      }
      
      // Track analytics
      await this.trackApprovalMetrics(loan, user, result);

      return result;
    } catch (error) {
      logger.error('Approval workflow failed:', error);
      throw error;
    }
  }

  /**
   * Perform comprehensive credit check
   */
  private async performCreditCheck(loan: ILoan, user: IUser): Promise<CreditCheckResult> {
    const factors: Array<{
      name: string;
      value: number;
      impact: 'positive' | 'negative' | 'neutral';
      weight: number;
    }> = [
      {
        name: 'Credit Score',
        value: this.getCreditScore(user),
        impact: this.getCreditScore(user) >= 700 ? 'positive' : 
               this.getCreditScore(user) >= 600 ? 'neutral' : 'negative',
        weight: 0.3,
      },
      {
        name: 'Debt-to-Income Ratio',
        value: this.getDebtToIncomeRatio(loan, user) * 100,
        impact: this.getDebtToIncomeRatio(loan, user) <= 0.3 ? 'positive' :
               this.getDebtToIncomeRatio(loan, user) <= 0.43 ? 'neutral' : 'negative',
        weight: 0.25,
      },
      {
        name: 'Income Stability',
        value: this.getEmploymentDuration(user),
        impact: this.getEmploymentDuration(user) >= 24 ? 'positive' :
               this.getEmploymentDuration(user) >= 12 ? 'neutral' : 'negative',
        weight: 0.2,
      },
      {
        name: 'Payment History',
        value: this.getPaymentHistoryScore(user),
        impact: this.getPaymentHistoryScore(user) >= 80 ? 'positive' :
               this.getPaymentHistoryScore(user) >= 60 ? 'neutral' : 'negative',
        weight: 0.25,
      },
    ];

    // Calculate weighted score
    const score = factors.reduce((sum, factor) => {
      const normalizedValue = Math.min(100, Math.max(0, factor.value)) / 100;
      return sum + (normalizedValue * factor.weight * 100);
    }, 0);

    // Determine recommendation
    let recommendation: 'approve' | 'reject' | 'manual_review';
    let confidence: number;

    if (score >= this.config.autoApprovalThreshold) {
      recommendation = 'approve';
      confidence = Math.min(95, score + 10);
    } else if (score <= this.config.autoRejectionThreshold) {
      recommendation = 'reject';
      confidence = Math.min(95, 100 - score + 10);
    } else {
      recommendation = 'manual_review';
      confidence = Math.abs(score - 60) + 50;
    }

    return {
      score,
      factors,
      recommendation,
      confidence,
    };
  }

  /**
   * Evaluate all approval rules
   */
  private evaluateRules(loan: ILoan, user: IUser): Array<{ rule: ApprovalRule; passed: boolean; weight: number }> {
    return this.rules.map(rule => ({
      rule,
      passed: rule.condition(loan, user),
      weight: rule.weight,
    }));
  }

  /**
   * Calculate overall approval score
   */
  private calculateOverallScore(
    ruleResults: Array<{ rule: ApprovalRule; passed: boolean; weight: number }>,
    creditCheck: CreditCheckResult
  ): number {
    // Base score from credit check
    let score = creditCheck.score;

    // Apply rule weights
    const ruleScore = ruleResults.reduce((sum, result) => {
      return sum + (result.passed ? result.weight : 0);
    }, 0);

    // Normalize rule score to 0-100 range
    const maxPossibleRuleScore = ruleResults
      .filter(r => r.weight > 0)
      .reduce((sum, r) => sum + r.weight, 0);
    
    const normalizedRuleScore = maxPossibleRuleScore > 0 
      ? (ruleScore / maxPossibleRuleScore) * 100 
      : 0;

    // Combine scores (70% credit check, 30% rules)
    score = (score * 0.7) + (normalizedRuleScore * 0.3);

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Make approval decision
   */
  private makeDecision(
    score: number,
    creditCheck: CreditCheckResult,
    options: { skipManualReview?: boolean }
  ): {
    decision: 'approved' | 'rejected' | 'manual_review';
    confidence: number;
    reasons: string[];
    nextSteps: string[];
  } {
    const reasons: string[] = [];
    const nextSteps: string[] = [];

    // Check for automatic approval
    if (score >= this.config.autoApprovalThreshold && !this.config.requireManualReview) {
      reasons.push(`High approval score (${score.toFixed(1)}/100)`);
      reasons.push(...creditCheck.factors.filter(f => f.impact === 'positive').map(f => f.name));
      
      nextSteps.push('Loan approved automatically');
      nextSteps.push('Prepare loan documentation');
      nextSteps.push('Schedule fund disbursement');

      return {
        decision: 'approved',
        confidence: Math.min(95, score + 5),
        reasons,
        nextSteps,
      };
    }

    // Check for automatic rejection
    if (score <= this.config.autoRejectionThreshold && !options.skipManualReview) {
      reasons.push(`Low approval score (${score.toFixed(1)}/100)`);
      reasons.push(...creditCheck.factors.filter(f => f.impact === 'negative').map(f => f.name));
      
      nextSteps.push('Loan application rejected');
      nextSteps.push('Send rejection notice to applicant');
      nextSteps.push('Provide feedback for improvement');

      return {
        decision: 'rejected',
        confidence: Math.min(95, 100 - score + 5),
        reasons,
        nextSteps,
      };
    }

    // Manual review required
    reasons.push(`Moderate approval score (${score.toFixed(1)}/100)`);
    reasons.push('Application requires manual review');
    
    nextSteps.push('Assign to loan officer for manual review');
    nextSteps.push('Schedule applicant interview if needed');
    nextSteps.push('Verify additional documentation');

    return {
      decision: 'manual_review',
      confidence: 70,
      reasons,
      nextSteps,
    };
  }

  /**
   * Generate loan recommendations
   */
  private generateRecommendations(
    loan: ILoan,
    user: IUser,
    creditCheck: CreditCheckResult,
    score: number
  ): {
    terms?: {
      interestRate?: number;
      amount?: number;
      duration?: number;
    };
    conditions?: string[];
  } {
    const terms: any = {};
    const conditions: string[] = [];

    // Interest rate based on risk
    const baseRate = 5.0; // Base interest rate
    const riskAdjustment = (100 - score) * 0.1; // Higher risk = higher rate
    terms.interestRate = Math.max(3.0, Math.min(25.0, baseRate + riskAdjustment));

    // Loan amount adjustment
    const maxSafeAmount = this.getAnnualIncome(user) * 0.5;
    const loanAmount = Number(loan.principal);
    if (loanAmount > maxSafeAmount) {
      terms.amount = maxSafeAmount;
      conditions.push(`Loan amount reduced to ${maxSafeAmount} based on income verification`);
    }

    // Duration adjustment based on amount and income
    const idealDuration = Math.ceil(loanAmount / (this.getAnnualIncome(user) * 0.2));
    if (idealDuration !== loan.termMonths) {
      terms.duration = idealDuration;
      conditions.push(`Loan duration adjusted to ${idealDuration} months for manageable payments`);
    }

    // Additional conditions based on risk factors
    if (this.getCreditScore(user) < 650) {
      conditions.push('Require cosigner due to credit score');
    }

    if (this.getDebtToIncomeRatio(loan, user) > 0.35) {
      conditions.push('Provide additional income verification');
    }

    if (!this.hasCollateral(loan) && loanAmount > 50000) {
      conditions.push('Consider providing collateral for large loan amount');
    }

    return { terms, conditions };
  }

  /**
   * Log approval decision for audit trail
   */
  private async logApprovalDecision(loan: ILoan, user: IUser, result: ApprovalResult): Promise<void> {
    const auditLog = {
      loanId: loan._id,
      userId: user._id,
      decision: result.decision,
      score: result.riskScore,
      confidence: result.confidence,
      reasons: result.reasons,
      timestamp: result.timestamp,
      systemVersion: '1.0.0',
    };

    logger.info('Loan approval decision:', auditLog);

    // In a real system, this would be stored in a dedicated audit database
    // For now, we'll just log it
  }

  /**
   * Send notifications for approval decision
   */
  private async sendNotifications(loan: ILoan, user: IUser, result: ApprovalResult): Promise<void> {
    try {
      let message: string;
      let type: 'info' | 'success' | 'warning' | 'error';

      switch (result.decision) {
        case 'approved':
          message = `Your loan application for $${Number(loan.principal).toLocaleString()} has been approved!`;
          type = 'success';
          break;
        case 'rejected':
          message = `Your loan application has been rejected. Please review the feedback and consider reapplying.`;
          type = 'error';
          break;
        case 'manual_review':
          message = `Your loan application is under review. We'll contact you within 2-3 business days.`;
          type = 'info';
          break;
      }

      await getNotificationService().sendNotification({
        userId: user._id.toString(),
        type: type as any,
        title: 'Loan Application Update',
        message,
        data: {
          loanId: loan._id.toString(),
          decision: result.decision,
          nextSteps: result.nextSteps,
        },
      });
    } catch (error) {
      logger.error('Failed to send approval notification:', error);
    }
  }

  /**
   * Track approval metrics for analytics
   */
  private async trackApprovalMetrics(loan: ILoan, user: IUser, result: ApprovalResult): Promise<void> {
    try {
      await (analyticsService as any).recordEvent({
        eventType: 'loan_application_processed',
        userId: user._id.toString(),
        entityType: 'loan',
        entityId: loan._id.toString(),
        metadata: {
          decision: result.decision,
          riskScore: result.riskScore,
          confidence: result.confidence,
          loanAmount: Number(loan.principal),
          interestRate: Number(loan.interestRate),
          duration: loan.termMonths,
          processingTime: Date.now() - new Date(loan.originationDate).getTime(),
        },
      });
    } catch (error) {
      logger.error('Failed to track approval metrics:', error);
    }
  }

  // Helper methods for extracting user/loan data
  private getCreditScore(user: IUser): number {
    // In a real system, this would integrate with credit bureaus
    return (user as any).creditScore || 650;
  }

  private getAnnualIncome(user: IUser): number {
    return (user as any).annualIncome || 50000;
  }

  private getEmploymentDuration(user: IUser): number {
    // Duration in months
    return (user as any).employmentDuration || 12;
  }

  private getDebtToIncomeRatio(loan: ILoan, user: IUser): number {
    const monthlyIncome = this.getAnnualIncome(user) / 12;
    const monthlyLoanPayment = Number(loan.monthlyPayment);
    const existingMonthlyDebt = (user as any).monthlyDebtPayments || 0;
    
    return (monthlyLoanPayment + existingMonthlyDebt) / monthlyIncome;
  }

  private hasCollateral(loan: ILoan): boolean {
    return !!(loan as any).collateral;
  }

  private hasRecentDefaults(user: IUser): boolean {
    return (user as any).hasRecentDefaults || false;
  }

  private isExistingCustomer(user: IUser): boolean {
    return (user as any).isExistingCustomer || false;
  }

  private isIdentityVerified(user: IUser): boolean {
    return (user as any).identityVerified || false;
  }

  private isKYCComplete(user: IUser): boolean {
    return (user as any).kycComplete || false;
  }

  private isAMLClear(user: IUser): boolean {
    return (user as any).amlClear || false;
  }

  private getPaymentHistoryScore(user: IUser): number {
    return (user as any).paymentHistoryScore || 70;
  }

  /**
   * Update workflow configuration
   */
  updateConfig(newConfig: Partial<ApprovalWorkflowConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Approval workflow config updated:', this.config);
  }

  /**
   * Add or update approval rule
   */
  addRule(rule: ApprovalRule): void {
    const existingIndex = this.rules.findIndex(r => r.id === rule.id);
    if (existingIndex >= 0) {
      this.rules[existingIndex] = rule;
    } else {
      this.rules.push(rule);
    }
    logger.info(`Approval rule ${rule.id} added/updated`);
  }

  /**
   * Remove approval rule
   */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId);
    logger.info(`Approval rule ${ruleId} removed`);
  }

  /**
   * Get current configuration
   */
  getConfig(): ApprovalWorkflowConfig {
    return { ...this.config };
  }

  /**
   * Get all approval rules
   */
  getRules(): ApprovalRule[] {
    return [...this.rules];
  }
}

// Export singleton instance
export const approvalWorkflowService = new ApprovalWorkflowService();