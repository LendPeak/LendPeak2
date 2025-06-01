import { ApprovalWorkflowService, ApprovalRule } from '../approval-workflow.service';
import { notificationService } from '../notification.service';
import { analyticsService } from '../analytics.service';

// Mock dependencies
jest.mock('../notification.service');
jest.mock('../analytics.service');
jest.mock('../websocket.service');

describe('ApprovalWorkflowService', () => {
  let approvalService: ApprovalWorkflowService;
  let mockUser: any;
  let mockLoan: any;

  beforeEach(() => {
    approvalService = new ApprovalWorkflowService();
    
    mockUser = {
      _id: 'user123',
      id: 'user123',
      email: 'test@example.com',
      name: 'Test User',
      roles: ['BORROWER'],
      creditScore: 720,
      annualIncome: 75000,
      employmentDuration: 36,
      monthlyDebtPayments: 1500,
      identityVerified: true,
      kycComplete: true,
      amlClear: true,
      hasRecentDefaults: false,
      isExistingCustomer: true,
      paymentHistoryScore: 85,
    };

    mockLoan = {
      _id: 'loan123',
      id: 'loan123',
      borrowerId: 'user123',
      principal: { toString: () => '25000' },
      interestRate: { toString: () => '6.5' },
      termMonths: 36,
      monthlyPayment: { toString: () => '800' },
      purpose: 'debt_consolidation',
      status: 'pending',
      originationDate: new Date(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processLoanApplication', () => {
    it('should approve loan for qualified applicant', async () => {
      const result = await approvalService.processLoanApplication(mockLoan, mockUser);

      expect(result.decision).toBe('approved');
      expect(result.confidence).toBeGreaterThan(80);
      expect(result.riskScore).toBeGreaterThan(70);
      expect(result.reasons).toContain('High approval score');
      expect(result.nextSteps).toContain('Loan approved automatically');
    });

    it('should reject loan for poor credit applicant', async () => {
      const poorCreditUser = {
        ...mockUser,
        creditScore: 550,
        hasRecentDefaults: true,
        annualIncome: 30000,
        paymentHistoryScore: 40,
      };

      const result = await approvalService.processLoanApplication(mockLoan, poorCreditUser);

      expect(result.decision).toBe('rejected');
      expect(result.confidence).toBeGreaterThan(70);
      expect(result.riskScore).toBeLessThan(50);
      expect(result.nextSteps).toContain('Loan application rejected');
    });

    it('should require manual review for borderline applicant', async () => {
      const borderlineUser = {
        ...mockUser,
        creditScore: 640,
        annualIncome: 45000,
        employmentDuration: 8,
        monthlyDebtPayments: 2000,
      };

      const largeLoan = {
        ...mockLoan,
        principal: { toString: () => '50000' },
      };

      const result = await approvalService.processLoanApplication(largeLoan, borderlineUser);

      expect(result.decision).toBe('manual_review');
      expect(result.nextSteps).toContain('Assign to loan officer for manual review');
    });

    it('should send notifications after processing', async () => {
      await approvalService.processLoanApplication(mockLoan, mockUser);

      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          type: 'success',
          title: 'Loan Application Update',
          message: expect.stringContaining('approved'),
        })
      );
    });

    it('should track analytics after processing', async () => {
      await approvalService.processLoanApplication(mockLoan, mockUser);

      expect((analyticsService as any).trackEvent).toHaveBeenCalledWith(
        'loan_application_processed',
        expect.objectContaining({
          loanId: 'loan123',
          userId: 'user123',
          decision: 'approved',
        })
      );
    });
  });

  describe('Credit Check', () => {
    it('should calculate credit score factors correctly', async () => {
      const result = await approvalService.processLoanApplication(mockLoan, mockUser);

      expect(result.riskScore).toBeGreaterThan(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
    });

    it('should handle users with no credit history', async () => {
      const noCreditUser = {
        ...mockUser,
        creditScore: undefined,
        paymentHistoryScore: undefined,
      };

      const result = await approvalService.processLoanApplication(mockLoan, noCreditUser);

      expect(result.decision).toBe('manual_review');
    });
  });

  describe('Rule Evaluation', () => {
    it('should apply credit score rules correctly', () => {
      const rules = approvalService.getRules();
      const creditRules = rules.filter(r => r.category === 'credit');

      expect(creditRules.length).toBeGreaterThan(0);

      const excellentCreditRule = creditRules.find(r => r.id === 'credit-score-excellent');
      expect(excellentCreditRule?.condition(mockLoan, mockUser)).toBe(false); // 720 < 750

      const goodCreditRule = creditRules.find(r => r.id === 'credit-score-good');
      expect(goodCreditRule?.condition(mockLoan, mockUser)).toBe(true); // 720 >= 650
    });

    it('should apply income rules correctly', () => {
      const rules = approvalService.getRules();
      const incomeRules = rules.filter(r => r.category === 'income');

      const highIncomeRule = incomeRules.find(r => r.id === 'high-income');
      expect(highIncomeRule?.condition(mockLoan, mockUser)).toBe(true); // 75000 >= 75000

      const stableEmploymentRule = incomeRules.find(r => r.id === 'stable-employment');
      expect(stableEmploymentRule?.condition(mockLoan, mockUser)).toBe(true); // 36 >= 24
    });

    it('should apply risk assessment rules correctly', () => {
      const rules = approvalService.getRules();
      const riskRules = rules.filter(r => r.category === 'risk');

      const reasonableAmountRule = riskRules.find(r => r.id === 'loan-amount-reasonable');
      expect(reasonableAmountRule?.condition(mockLoan, mockUser)).toBe(true); // 25000 <= 37500

      const excessiveAmountRule = riskRules.find(r => r.id === 'loan-amount-excessive');
      expect(excessiveAmountRule?.condition(mockLoan, mockUser)).toBe(false); // 25000 <= 75000
    });
  });

  describe('Recommendations', () => {
    it('should recommend lower interest rate for low-risk applicant', async () => {
      const lowRiskUser = {
        ...mockUser,
        creditScore: 780,
        annualIncome: 100000,
        monthlyDebtPayments: 500,
      };

      const result = await approvalService.processLoanApplication(mockLoan, lowRiskUser);

      expect(result.recommendedTerms?.interestRate).toBeLessThan(7.0);
    });

    it('should recommend higher interest rate for high-risk applicant', async () => {
      const highRiskUser = {
        ...mockUser,
        creditScore: 620,
        annualIncome: 40000,
        monthlyDebtPayments: 1800,
        hasRecentDefaults: true,
      };

      const result = await approvalService.processLoanApplication(mockLoan, highRiskUser);

      if (result.decision === 'approved') {
        expect(result.recommendedTerms?.interestRate).toBeGreaterThan(8.0);
      }
    });

    it('should recommend loan amount reduction for excessive requests', async () => {
      const largeLoan = {
        ...mockLoan,
        principal: { toString: () => '80000' }, // Exceeds 50% of income
      };

      const result = await approvalService.processLoanApplication(largeLoan, mockUser);

      expect(result.recommendedTerms?.amount).toBeLessThan(80000);
      expect(result.conditions).toContain(
        expect.stringContaining('Loan amount reduced')
      );
    });

    it('should add conditions for risky applicants', async () => {
      const riskyUser = {
        ...mockUser,
        creditScore: 620,
        monthlyDebtPayments: 2200, // High DTI
      };

      const result = await approvalService.processLoanApplication(mockLoan, riskyUser);

      if (result.conditions) {
        expect(result.conditions.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration correctly', () => {
      const newConfig = {
        autoApprovalThreshold: 85,
        maxLoanAmount: 150000,
      };

      approvalService.updateConfig(newConfig);
      const config = approvalService.getConfig();

      expect(config.autoApprovalThreshold).toBe(85);
      expect(config.maxLoanAmount).toBe(150000);
      expect(config.autoRejectionThreshold).toBe(40); // Should retain old value
    });

    it('should add new approval rules', () => {
      const newRule: ApprovalRule = {
        id: 'test-rule',
        name: 'Test Rule',
        condition: () => true,
        weight: 10,
        description: 'Test rule for unit testing',
        category: 'risk',
      };

      approvalService.addRule(newRule);
      const rules = approvalService.getRules();

      expect(rules.find(r => r.id === 'test-rule')).toBeDefined();
    });

    it('should remove approval rules', () => {
      const initialRuleCount = approvalService.getRules().length;
      
      approvalService.removeRule('credit-score-excellent');
      const rules = approvalService.getRules();

      expect(rules.length).toBe(initialRuleCount - 1);
      expect(rules.find(r => r.id === 'credit-score-excellent')).toBeUndefined();
    });

    it('should update existing rules', () => {
      const updatedRule: ApprovalRule = {
        id: 'credit-score-excellent',
        name: 'Updated Excellent Credit Score',
        condition: (loan, user) => (user as any).creditScore >= 800, // Changed threshold
        weight: 30, // Changed weight
        description: 'Updated rule',
        category: 'credit',
      };

      approvalService.addRule(updatedRule);
      const rules = approvalService.getRules();
      const rule = rules.find(r => r.id === 'credit-score-excellent');

      expect(rule?.weight).toBe(30);
      expect(rule?.name).toBe('Updated Excellent Credit Score');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing user data gracefully', async () => {
      const incompleteUser = {
        _id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'BORROWER',
      } as any;

      const result = await approvalService.processLoanApplication(mockLoan, incompleteUser);

      expect(result.decision).toBe('manual_review');
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle zero loan amounts', async () => {
      const zeroLoan = {
        ...mockLoan,
        principal: { toString: () => '0' },
      };

      const result = await approvalService.processLoanApplication(zeroLoan, mockUser);

      expect(result.decision).toBe('rejected');
    });

    it('should handle extremely high loan amounts', async () => {
      const hugeLoan = {
        ...mockLoan,
        principal: { toString: () => '1000000' },
      };

      const result = await approvalService.processLoanApplication(hugeLoan, mockUser);

      expect(result.decision).not.toBe('approved');
      expect(result.recommendedTerms?.amount).toBeLessThan(1000000);
    });
  });

  describe('Compliance Rules', () => {
    it('should require identity verification', () => {
      const unverifiedUser = {
        ...mockUser,
        identityVerified: false,
      };

      const rules = approvalService.getRules();
      const identityRule = rules.find(r => r.id === 'identity-verified');

      expect(identityRule?.condition(mockLoan, unverifiedUser)).toBe(false);
    });

    it('should require KYC completion', () => {
      const nonKYCUser = {
        ...mockUser,
        kycComplete: false,
      };

      const rules = approvalService.getRules();
      const kycRule = rules.find(r => r.id === 'kyc-complete');

      expect(kycRule?.condition(mockLoan, nonKYCUser)).toBe(false);
    });

    it('should require AML clearance', () => {
      const amlFlaggedUser = {
        ...mockUser,
        amlClear: false,
      };

      const rules = approvalService.getRules();
      const amlRule = rules.find(r => r.id === 'aml-clear');

      expect(amlRule?.condition(mockLoan, amlFlaggedUser)).toBe(false);
    });
  });
});