import { RecommendationService } from '../recommendation.service';
import { LoanRepository } from '../../repositories/loan.repository';
import { UserRepository } from '../../repositories/user.repository';
import Big from 'big.js';

// Mock repositories
jest.mock('../../repositories/loan.repository');
jest.mock('../../repositories/user.repository');

describe('RecommendationService', () => {
  let recommendationService: RecommendationService;
  let mockLoanRepository: jest.Mocked<LoanRepository>;
  let mockUserRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockLoanRepository = new LoanRepository() as jest.Mocked<LoanRepository>;
    mockUserRepository = new UserRepository() as jest.Mocked<UserRepository>;
    recommendationService = new RecommendationService(mockLoanRepository, mockUserRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('recommendLoanProducts', () => {
    it('should recommend appropriate loan products based on user profile', async () => {
      const userProfile = {
        userId: 'user123',
        creditScore: 720,
        annualIncome: 75000,
        employmentYears: 5,
        existingDebt: 15000,
        purpose: 'home_improvement',
      };

      const recommendations = await recommendationService.recommendLoanProducts(userProfile);

      expect(recommendations).toHaveLength(3);
      expect(recommendations[0]).toHaveProperty('productName');
      expect(recommendations[0]).toHaveProperty('recommendedAmount');
      expect(recommendations[0]).toHaveProperty('interestRate');
      expect(recommendations[0]).toHaveProperty('term');
      expect(recommendations[0]).toHaveProperty('monthlyPayment');
      expect(recommendations[0]).toHaveProperty('score');
      expect(recommendations[0]).toHaveProperty('reasons');
    });

    it('should recommend lower amounts for users with lower credit scores', async () => {
      const highCreditProfile = {
        userId: 'user1',
        creditScore: 800,
        annualIncome: 100000,
        employmentYears: 10,
        existingDebt: 10000,
        purpose: 'debt_consolidation',
      };

      const lowCreditProfile = {
        userId: 'user2',
        creditScore: 620,
        annualIncome: 100000,
        employmentYears: 10,
        existingDebt: 10000,
        purpose: 'debt_consolidation',
      };

      const highCreditRecs = await recommendationService.recommendLoanProducts(highCreditProfile);
      const lowCreditRecs = await recommendationService.recommendLoanProducts(lowCreditProfile);

      expect(Number(highCreditRecs[0].recommendedAmount)).toBeGreaterThan(
        Number(lowCreditRecs[0].recommendedAmount)
      );
      expect(Number(highCreditRecs[0].interestRate)).toBeLessThan(
        Number(lowCreditRecs[0].interestRate)
      );
    });

    it('should consider debt-to-income ratio in recommendations', async () => {
      const lowDebtProfile = {
        userId: 'user1',
        creditScore: 700,
        annualIncome: 80000,
        employmentYears: 5,
        existingDebt: 5000,
        purpose: 'personal',
      };

      const highDebtProfile = {
        userId: 'user2',
        creditScore: 700,
        annualIncome: 80000,
        employmentYears: 5,
        existingDebt: 40000,
        purpose: 'personal',
      };

      const lowDebtRecs = await recommendationService.recommendLoanProducts(lowDebtProfile);
      const highDebtRecs = await recommendationService.recommendLoanProducts(highDebtProfile);

      expect(Number(lowDebtRecs[0].recommendedAmount)).toBeGreaterThan(
        Number(highDebtRecs[0].recommendedAmount)
      );
    });
  });

  describe('getSimilarLoans', () => {
    it('should find similar successful loans', async () => {
      const userProfile = {
        creditScore: 700,
        loanAmount: 20000,
        purpose: 'auto',
      };

      const mockSimilarLoans = [
        {
          _id: '1',
          borrowerId: 'user1',
          principal: new Big('22000'),
          interestRate: new Big('0.045'),
          term: 60,
          status: 'ACTIVE',
          creditScore: 710,
          purpose: 'auto',
        },
        {
          _id: '2',
          borrowerId: 'user2',
          principal: new Big('18000'),
          interestRate: new Big('0.05'),
          term: 48,
          status: 'CLOSED',
          creditScore: 690,
          purpose: 'auto',
        },
      ];

      mockLoanRepository.findByCriteria = jest.fn().mockResolvedValue(mockSimilarLoans);

      const similarLoans = await recommendationService.getSimilarLoans(userProfile);

      expect(similarLoans).toHaveLength(2);
      expect(mockLoanRepository.findByCriteria).toHaveBeenCalledWith(
        expect.objectContaining({
          creditScoreRange: { min: 650, max: 750 },
          purpose: 'auto',
          status: { $in: ['ACTIVE', 'CLOSED'] },
        })
      );
    });
  });

  describe('calculateLoanAffordability', () => {
    it('should calculate maximum affordable loan amount', async () => {
      const financialProfile = {
        monthlyIncome: 6000,
        monthlyExpenses: 2000,
        existingDebtPayments: 500,
        creditScore: 720,
      };

      const affordability = await recommendationService.calculateLoanAffordability(financialProfile);

      expect(affordability).toHaveProperty('maxMonthlyPayment');
      expect(affordability).toHaveProperty('maxLoanAmount');
      expect(affordability).toHaveProperty('recommendedLoanAmount');
      expect(affordability).toHaveProperty('debtToIncomeRatio');
      expect(affordability).toHaveProperty('disposableIncome');

      // Should follow 28/36 rule
      const maxDebtPayment = financialProfile.monthlyIncome * 0.36;
      const availableForNewDebt = maxDebtPayment - financialProfile.existingDebtPayments;
      expect(Number(affordability.maxMonthlyPayment)).toBeLessThanOrEqual(availableForNewDebt);
    });

    it('should recommend lower amounts for high debt-to-income ratios', async () => {
      const highDebtProfile = {
        monthlyIncome: 5000,
        monthlyExpenses: 2000,
        existingDebtPayments: 1500,
        creditScore: 680,
      };

      const affordability = await recommendationService.calculateLoanAffordability(highDebtProfile);

      expect(Number(affordability.recommendedLoanAmount)).toBeLessThan(
        Number(affordability.maxLoanAmount)
      );
      expect(affordability.warnings).toContain('High existing debt burden');
    });
  });

  describe('predictLoanSuccess', () => {
    it('should predict loan success probability', async () => {
      const loanApplication = {
        userId: 'user123',
        requestedAmount: 25000,
        purpose: 'debt_consolidation',
        term: 60,
        creditScore: 720,
        annualIncome: 80000,
        employmentYears: 5,
        homeOwnership: 'own',
      };

      const prediction = await recommendationService.predictLoanSuccess(loanApplication);

      expect(prediction).toHaveProperty('successProbability');
      expect(prediction).toHaveProperty('riskScore');
      expect(prediction).toHaveProperty('factors');
      expect(prediction.successProbability).toBeGreaterThanOrEqual(0);
      expect(prediction.successProbability).toBeLessThanOrEqual(1);
      expect(prediction.factors).toBeInstanceOf(Array);
    });

    it('should identify risk factors', async () => {
      const riskyApplication = {
        userId: 'user123',
        requestedAmount: 50000,
        purpose: 'business',
        term: 36,
        creditScore: 580,
        annualIncome: 40000,
        employmentYears: 1,
        homeOwnership: 'rent',
      };

      const prediction = await recommendationService.predictLoanSuccess(riskyApplication);

      expect(prediction.successProbability).toBeLessThan(0.5);
      expect(prediction.riskScore).toBeGreaterThan(70);
      expect(prediction.factors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            factor: 'Low credit score',
            impact: 'negative',
          }),
          expect.objectContaining({
            factor: 'High loan-to-income ratio',
            impact: 'negative',
          }),
        ])
      );
    });
  });

  describe('recommendRefinanceOptions', () => {
    it('should recommend refinance options for existing loans', async () => {
      const existingLoan = {
        loanId: 'loan123',
        currentBalance: new Big('15000'),
        currentRate: new Big('0.08'),
        remainingTerm: 36,
        paymentHistory: 'excellent',
        creditScoreImprovement: 50,
      };

      mockLoanRepository.findById = jest.fn().mockResolvedValue({
        _id: 'loan123',
        currentBalance: new Big('15000'),
        interestRate: new Big('0.08'),
        monthlyPayment: new Big('470'),
        borrowerId: 'user123',
      });

      const options = await recommendationService.recommendRefinanceOptions(existingLoan);

      expect(options).toHaveLength(2);
      expect(options[0]).toHaveProperty('newRate');
      expect(options[0]).toHaveProperty('newMonthlyPayment');
      expect(options[0]).toHaveProperty('monthlySavings');
      expect(options[0]).toHaveProperty('totalSavings');
      expect(Number(options[0].newRate)).toBeLessThan(0.08);
    });
  });

  describe('getPersonalizedTips', () => {
    it('should provide personalized financial tips', async () => {
      const userProfile = {
        userId: 'user123',
        creditScore: 650,
        debtToIncomeRatio: 0.45,
        paymentHistory: 'fair',
        savingsBalance: 1000,
      };

      const tips = await recommendationService.getPersonalizedTips(userProfile);

      expect(tips).toBeInstanceOf(Array);
      expect(tips.length).toBeGreaterThan(0);
      expect(tips[0]).toHaveProperty('category');
      expect(tips[0]).toHaveProperty('tip');
      expect(tips[0]).toHaveProperty('priority');
      expect(tips[0]).toHaveProperty('potentialImpact');

      // Should include credit improvement tips for lower scores
      const creditTips = tips.filter(t => t.category === 'credit_improvement');
      expect(creditTips.length).toBeGreaterThan(0);
    });

    it('should prioritize tips based on user needs', async () => {
      const highDebtProfile = {
        userId: 'user123',
        creditScore: 700,
        debtToIncomeRatio: 0.5,
        paymentHistory: 'good',
        savingsBalance: 500,
      };

      const tips = await recommendationService.getPersonalizedTips(highDebtProfile);

      // Should prioritize debt reduction tips
      expect(tips[0].category).toBe('debt_reduction');
      expect(tips[0].priority).toBe('high');
    });
  });

  describe('Machine Learning Integration', () => {
    it('should use historical data to improve recommendations', async () => {
      const mockHistoricalLoans = [
        {
          creditScore: 720,
          loanAmount: new Big('20000'),
          interestRate: new Big('0.05'),
          defaulted: false,
          onTimePaymentRate: 0.98,
        },
        {
          creditScore: 680,
          loanAmount: new Big('15000'),
          interestRate: new Big('0.06'),
          defaulted: false,
          onTimePaymentRate: 0.92,
        },
      ];

      mockLoanRepository.getHistoricalLoans = jest.fn().mockResolvedValue(mockHistoricalLoans);

      await recommendationService.trainModel();

      const userProfile = {
        userId: 'user123',
        creditScore: 700,
        annualIncome: 70000,
        employmentYears: 5,
        existingDebt: 10000,
        purpose: 'personal',
      };

      const recommendations = await recommendationService.recommendLoanProducts(userProfile);

      // Model should be used for recommendations
      expect(recommendations[0].modelConfidence).toBeGreaterThan(0.7);
    });
  });
});