import { LoanRepository } from '../repositories/loan.repository';
import { UserRepository } from '../repositories/user.repository';
import { logger } from '../utils/logger';
import Big from 'big.js';

export interface UserProfile {
  userId: string;
  creditScore: number;
  annualIncome: number;
  employmentYears: number;
  existingDebt: number;
  purpose: string;
  homeOwnership?: string;
  monthlyIncome?: number;
  monthlyExpenses?: number;
}

export interface LoanRecommendation {
  productName: string;
  recommendedAmount: string;
  interestRate: string;
  term: number;
  monthlyPayment: string;
  totalInterest: string;
  score: number;
  reasons: string[];
  modelConfidence?: number;
}

export interface AffordabilityResult {
  maxMonthlyPayment: string;
  maxLoanAmount: string;
  recommendedLoanAmount: string;
  debtToIncomeRatio: string;
  disposableIncome: string;
  warnings?: string[];
}

export interface LoanPrediction {
  successProbability: number;
  riskScore: number;
  factors: Array<{
    factor: string;
    impact: 'positive' | 'negative' | 'neutral';
    weight: number;
  }>;
}

export interface RefinanceOption {
  newRate: string;
  newTerm: number;
  newMonthlyPayment: string;
  monthlySavings: string;
  totalSavings: string;
  breakEvenMonths: number;
  recommended: boolean;
  reasons: string[];
}

export interface PersonalizedTip {
  category: string;
  tip: string;
  priority: 'high' | 'medium' | 'low';
  potentialImpact: string;
  actionItems: string[];
}

export class RecommendationService {
  private model: any = null; // ML model placeholder

  constructor(
    private loanRepository: LoanRepository,
    private userRepository: UserRepository
  ) {}

  /**
   * Recommend loan products based on user profile
   */
  async recommendLoanProducts(profile: UserProfile): Promise<LoanRecommendation[]> {
    try {
      const recommendations: LoanRecommendation[] = [];

      // Calculate base parameters
      const debtToIncomeRatio = this.calculateDebtToIncomeRatio(
        profile.annualIncome,
        profile.existingDebt
      );

      const maxLoanAmount = this.calculateMaxLoanAmount(
        profile.creditScore,
        profile.annualIncome,
        debtToIncomeRatio
      );

      // Generate recommendations based on credit tiers
      if (profile.creditScore >= 740) {
        // Excellent credit
        recommendations.push(
          this.createRecommendation({
            productName: 'Prime Personal Loan',
            amount: maxLoanAmount.times(0.9),
            rate: new Big('0.035'),
            term: 60,
            profile,
            reasons: [
              'Excellent credit score qualifies for lowest rates',
              'Stable employment history',
              'Low debt-to-income ratio',
            ],
          })
        );

        recommendations.push(
          this.createRecommendation({
            productName: 'Flexible Line of Credit',
            amount: maxLoanAmount.times(0.5),
            rate: new Big('0.045'),
            term: 0, // Revolving
            profile,
            reasons: [
              'Access funds as needed',
              'Only pay interest on what you use',
              'Great for ongoing projects',
            ],
          })
        );
      } else if (profile.creditScore >= 670) {
        // Good credit
        recommendations.push(
          this.createRecommendation({
            productName: 'Standard Personal Loan',
            amount: maxLoanAmount.times(0.7),
            rate: new Big('0.055'),
            term: 48,
            profile,
            reasons: [
              'Good credit score with competitive rates',
              'Manageable monthly payments',
              'Build credit with on-time payments',
            ],
          })
        );
      } else {
        // Fair credit
        recommendations.push(
          this.createRecommendation({
            productName: 'Credit Builder Loan',
            amount: maxLoanAmount.times(0.5),
            rate: new Big('0.085'),
            term: 36,
            profile,
            reasons: [
              'Designed for credit improvement',
              'Lower amount for easier approval',
              'Opportunity to refinance with better credit',
            ],
          })
        );
      }

      // Add secured loan option for all credit levels
      recommendations.push(
        this.createRecommendation({
          productName: 'Secured Personal Loan',
          amount: maxLoanAmount.times(0.8),
          rate: new Big('0.04'),
          term: 60,
          profile,
          reasons: [
            'Lower rate with collateral',
            'Higher approval chances',
            'Good for debt consolidation',
          ],
        })
      );

      // Sort by score and return top 3
      return recommendations
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
    } catch (error) {
      logger.error('Error generating loan recommendations:', error);
      throw error;
    }
  }

  /**
   * Find similar successful loans
   */
  async getSimilarLoans(profile: any): Promise<any[]> {
    try {
      const creditScoreRange = {
        min: profile.creditScore - 50,
        max: profile.creditScore + 50,
      };

      const similarLoans = await this.loanRepository.findByCriteria({
        creditScoreRange,
        purpose: profile.purpose,
        status: { $in: ['ACTIVE', 'CLOSED'] },
      });

      return similarLoans;
    } catch (error) {
      logger.error('Error finding similar loans:', error);
      throw error;
    }
  }

  /**
   * Calculate loan affordability
   */
  async calculateLoanAffordability(profile: {
    monthlyIncome: number;
    monthlyExpenses: number;
    existingDebtPayments: number;
    creditScore: number;
  }): Promise<AffordabilityResult> {
    try {
      const disposableIncome = profile.monthlyIncome - profile.monthlyExpenses;
      
      // Apply 28/36 rule
      const maxTotalDebtPayment = profile.monthlyIncome * 0.36;
      const currentDebtPayments = profile.existingDebtPayments;
      const availableForNewDebt = maxTotalDebtPayment - currentDebtPayments;

      // Further limit based on disposable income
      const maxMonthlyPayment = Math.min(
        availableForNewDebt,
        disposableIncome * 0.5 // Don't use more than 50% of disposable income
      );

      // Calculate max loan amount based on payment
      const interestRate = this.getBaseRate(profile.creditScore);
      const maxLoanAmount = this.calculateLoanAmountFromPayment(
        new Big(maxMonthlyPayment),
        interestRate,
        60 // 5-year term
      );

      // Recommended amount is more conservative
      const recommendedAmount = maxLoanAmount.times(0.8);

      const debtToIncomeRatio = (currentDebtPayments + maxMonthlyPayment) / profile.monthlyIncome;

      const warnings: string[] = [];
      if (debtToIncomeRatio > 0.43) {
        warnings.push('High debt-to-income ratio may affect approval');
      }
      if (currentDebtPayments > profile.monthlyIncome * 0.28) {
        warnings.push('High existing debt burden');
      }
      if (disposableIncome < profile.monthlyIncome * 0.2) {
        warnings.push('Low disposable income');
      }

      return {
        maxMonthlyPayment: maxMonthlyPayment.toFixed(2),
        maxLoanAmount: maxLoanAmount.toFixed(2),
        recommendedLoanAmount: recommendedAmount.toFixed(2),
        debtToIncomeRatio: (debtToIncomeRatio * 100).toFixed(2),
        disposableIncome: disposableIncome.toFixed(2),
        warnings,
      };
    } catch (error) {
      logger.error('Error calculating loan affordability:', error);
      throw error;
    }
  }

  /**
   * Predict loan success probability
   */
  async predictLoanSuccess(application: any): Promise<LoanPrediction> {
    try {
      const factors: Array<{
        factor: string;
        impact: 'positive' | 'negative' | 'neutral';
        weight: number;
      }> = [];

      let baseScore = 50; // Start at 50%

      // Credit score factor
      if (application.creditScore >= 740) {
        baseScore += 20;
        factors.push({
          factor: 'Excellent credit score',
          impact: 'positive',
          weight: 0.3,
        });
      } else if (application.creditScore >= 670) {
        baseScore += 10;
        factors.push({
          factor: 'Good credit score',
          impact: 'positive',
          weight: 0.2,
        });
      } else if (application.creditScore < 620) {
        baseScore -= 20;
        factors.push({
          factor: 'Low credit score',
          impact: 'negative',
          weight: 0.4,
        });
      }

      // Income factor
      const loanToIncomeRatio = application.requestedAmount / application.annualIncome;
      if (loanToIncomeRatio > 0.5) {
        baseScore -= 15;
        factors.push({
          factor: 'High loan-to-income ratio',
          impact: 'negative',
          weight: 0.25,
        });
      } else if (loanToIncomeRatio < 0.3) {
        baseScore += 10;
        factors.push({
          factor: 'Conservative loan amount',
          impact: 'positive',
          weight: 0.15,
        });
      }

      // Employment factor
      if (application.employmentYears >= 5) {
        baseScore += 10;
        factors.push({
          factor: 'Stable employment history',
          impact: 'positive',
          weight: 0.15,
        });
      } else if (application.employmentYears < 2) {
        baseScore -= 10;
        factors.push({
          factor: 'Limited employment history',
          impact: 'negative',
          weight: 0.15,
        });
      }

      // Home ownership
      if (application.homeOwnership === 'own') {
        baseScore += 5;
        factors.push({
          factor: 'Homeowner',
          impact: 'positive',
          weight: 0.1,
        });
      }

      // Purpose factor
      const lowRiskPurposes = ['debt_consolidation', 'home_improvement'];
      const highRiskPurposes = ['business', 'vacation', 'other'];

      if (lowRiskPurposes.includes(application.purpose)) {
        baseScore += 5;
        factors.push({
          factor: `${application.purpose.replace('_', ' ')} is low-risk purpose`,
          impact: 'positive',
          weight: 0.1,
        });
      } else if (highRiskPurposes.includes(application.purpose)) {
        baseScore -= 5;
        factors.push({
          factor: `${application.purpose} carries higher risk`,
          impact: 'negative',
          weight: 0.1,
        });
      }

      // Normalize score to 0-1
      const successProbability = Math.max(0, Math.min(100, baseScore)) / 100;
      const riskScore = Math.round((1 - successProbability) * 100);

      return {
        successProbability,
        riskScore,
        factors: factors.sort((a, b) => b.weight - a.weight),
      };
    } catch (error) {
      logger.error('Error predicting loan success:', error);
      throw error;
    }
  }

  /**
   * Recommend refinance options
   */
  async recommendRefinanceOptions(existingLoan: any): Promise<RefinanceOption[]> {
    try {
      const options: RefinanceOption[] = [];
      const currentLoan = await this.loanRepository.findById(existingLoan.loanId);

      if (!currentLoan) {
        throw new Error('Loan not found');
      }

      const currentRate = Number(currentLoan.interestRate);
      const currentPayment = Number(currentLoan.monthlyPayment);
      const balance = Number(existingLoan.currentBalance);

      // Option 1: Lower rate, same term
      if (existingLoan.creditScoreImprovement > 30) {
        const newRate = currentRate * 0.75; // 25% rate reduction
        const newPayment = this.calculateMonthlyPayment(
          new Big(balance),
          new Big(newRate),
          existingLoan.remainingTerm
        );

        const monthlySavings = currentPayment - Number(newPayment);
        const totalSavings = monthlySavings * existingLoan.remainingTerm;

        options.push({
          newRate: (newRate * 100).toFixed(2),
          newTerm: existingLoan.remainingTerm,
          newMonthlyPayment: newPayment.toFixed(2),
          monthlySavings: monthlySavings.toFixed(2),
          totalSavings: totalSavings.toFixed(2),
          breakEvenMonths: 0, // No fees in this example
          recommended: true,
          reasons: [
            'Significant credit score improvement',
            'Lower rate saves money without extending term',
            'Maintains current payoff timeline',
          ],
        });
      }

      // Option 2: Extended term for lower payment
      const extendedTerm = existingLoan.remainingTerm + 24;
      const extendedRate = currentRate * 0.9;
      const extendedPayment = this.calculateMonthlyPayment(
        new Big(balance),
        new Big(extendedRate),
        extendedTerm
      );

      options.push({
        newRate: (extendedRate * 100).toFixed(2),
        newTerm: extendedTerm,
        newMonthlyPayment: extendedPayment.toFixed(2),
        monthlySavings: (currentPayment - Number(extendedPayment)).toFixed(2),
        totalSavings: '0', // May pay more total interest
        breakEvenMonths: 0,
        recommended: false,
        reasons: [
          'Lower monthly payment improves cash flow',
          'Slightly lower rate',
          'Extended term means more total interest',
        ],
      });

      return options;
    } catch (error) {
      logger.error('Error recommending refinance options:', error);
      throw error;
    }
  }

  /**
   * Get personalized financial tips
   */
  async getPersonalizedTips(profile: any): Promise<PersonalizedTip[]> {
    try {
      const tips: PersonalizedTip[] = [];

      // Credit improvement tips
      if (profile.creditScore < 700) {
        tips.push({
          category: 'credit_improvement',
          tip: 'Focus on improving your credit score',
          priority: 'high',
          potentialImpact: 'Could qualify for 2-3% lower interest rates',
          actionItems: [
            'Pay all bills on time for next 6 months',
            'Reduce credit card utilization below 30%',
            'Don\'t close old credit accounts',
            'Check credit report for errors',
          ],
        });
      }

      // Debt reduction tips
      if (profile.debtToIncomeRatio > 0.4) {
        tips.push({
          category: 'debt_reduction',
          tip: 'Reduce existing debt before taking new loans',
          priority: 'high',
          potentialImpact: 'Improve approval chances and get better rates',
          actionItems: [
            'Pay more than minimum on highest-rate debt',
            'Consider debt avalanche method',
            'Avoid new credit applications',
            'Create a debt payoff timeline',
          ],
        });
      }

      // Savings tips
      if (profile.savingsBalance < 3000) {
        tips.push({
          category: 'emergency_fund',
          tip: 'Build emergency fund before non-essential loans',
          priority: 'medium',
          potentialImpact: 'Avoid future high-interest debt',
          actionItems: [
            'Save 3-6 months of expenses',
            'Automate savings transfers',
            'Cut unnecessary subscriptions',
            'Consider side income opportunities',
          ],
        });
      }

      // Payment history tips
      if (profile.paymentHistory === 'fair' || profile.paymentHistory === 'poor') {
        tips.push({
          category: 'payment_habits',
          tip: 'Establish consistent payment history',
          priority: 'high',
          potentialImpact: 'Improve credit score by 50-100 points',
          actionItems: [
            'Set up automatic payments',
            'Use payment reminders',
            'Pay a few days early',
            'Contact lenders if struggling',
          ],
        });
      }

      // Sort by priority
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return tips.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    } catch (error) {
      logger.error('Error generating personalized tips:', error);
      throw error;
    }
  }

  /**
   * Train ML model with historical data
   */
  async trainModel(): Promise<void> {
    try {
      const historicalLoans = await this.loanRepository.getHistoricalLoans();
      
      // Placeholder for actual ML training
      // In production, this would use TensorFlow.js or similar
      logger.info(`Training model with ${historicalLoans.length} historical loans`);
      
      this.model = {
        trained: true,
        accuracy: 0.85,
        features: ['creditScore', 'debtToIncome', 'employmentYears', 'loanAmount'],
      };
    } catch (error) {
      logger.error('Error training recommendation model:', error);
      throw error;
    }
  }

  // Helper methods
  private calculateDebtToIncomeRatio(annualIncome: number, existingDebt: number): number {
    const monthlyIncome = annualIncome / 12;
    const estimatedMonthlyDebtPayment = existingDebt * 0.03; // Rough estimate
    return estimatedMonthlyDebtPayment / monthlyIncome;
  }

  private calculateMaxLoanAmount(
    creditScore: number,
    annualIncome: number,
    debtToIncomeRatio: number
  ): Big {
    let multiplier = 0.3; // Conservative default

    if (creditScore >= 740 && debtToIncomeRatio < 0.3) {
      multiplier = 0.5;
    } else if (creditScore >= 670 && debtToIncomeRatio < 0.4) {
      multiplier = 0.4;
    }

    return new Big(annualIncome).times(multiplier);
  }

  private getBaseRate(creditScore: number): Big {
    if (creditScore >= 740) return new Big('0.035');
    if (creditScore >= 670) return new Big('0.055');
    if (creditScore >= 620) return new Big('0.085');
    return new Big('0.12');
  }

  private calculateMonthlyPayment(principal: Big, rate: Big, termMonths: number): Big {
    if (termMonths === 0) return new Big(0); // Revolving credit

    const monthlyRate = rate.div(12);
    const factor = monthlyRate.times(
      monthlyRate.plus(1).pow(termMonths)
    ).div(
      monthlyRate.plus(1).pow(termMonths).minus(1)
    );

    return principal.times(factor);
  }

  private calculateLoanAmountFromPayment(payment: Big, rate: Big, termMonths: number): Big {
    const monthlyRate = rate.div(12);
    const factor = monthlyRate.plus(1).pow(termMonths).minus(1).div(
      monthlyRate.times(monthlyRate.plus(1).pow(termMonths))
    );

    return payment.times(factor);
  }

  private createRecommendation(params: {
    productName: string;
    amount: Big;
    rate: Big;
    term: number;
    profile: UserProfile;
    reasons: string[];
  }): LoanRecommendation {
    const monthlyPayment = this.calculateMonthlyPayment(params.amount, params.rate, params.term);
    const totalPayment = monthlyPayment.times(params.term);
    const totalInterest = totalPayment.minus(params.amount);

    // Score based on various factors
    let score = 50;
    
    // Lower rate is better
    score += (0.1 - Number(params.rate)) * 200;
    
    // Appropriate amount for income
    const loanToIncome = Number(params.amount) / params.profile.annualIncome;
    if (loanToIncome < 0.3) score += 20;
    else if (loanToIncome > 0.5) score -= 20;

    // Model confidence if available
    const modelConfidence = this.model?.trained ? 0.85 : undefined;

    return {
      productName: params.productName,
      recommendedAmount: params.amount.toFixed(2),
      interestRate: params.rate.times(100).toFixed(2),
      term: params.term,
      monthlyPayment: monthlyPayment.toFixed(2),
      totalInterest: totalInterest.toFixed(2),
      score: Math.round(score),
      reasons: params.reasons,
      modelConfidence,
    };
  }
}

// Export singleton instance
export const recommendationService = new RecommendationService(
  new LoanRepository(),
  new UserRepository()
);