import { AnalyticsService } from '../analytics.service';
import { LoanRepository } from '../../repositories/loan.repository';
import { UserRepository } from '../../repositories/user.repository';
import Big from 'big.js';

// Mock repositories
jest.mock('../../repositories/loan.repository');
jest.mock('../../repositories/user.repository');

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;
  let mockLoanRepository: jest.Mocked<LoanRepository>;
  let mockUserRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockLoanRepository = new LoanRepository() as jest.Mocked<LoanRepository>;
    mockUserRepository = new UserRepository() as jest.Mocked<UserRepository>;
    analyticsService = new AnalyticsService(mockLoanRepository, mockUserRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDashboardMetrics', () => {
    it('should return comprehensive dashboard metrics', async () => {
      // Mock data
      const mockLoans = [
        {
          _id: '1',
          status: 'ACTIVE',
          principal: new Big('10000'),
          currentBalance: new Big('8000'),
          interestRate: new Big('0.05'),
          disbursedAt: new Date('2024-01-01'),
        },
        {
          _id: '2',
          status: 'ACTIVE',
          principal: new Big('15000'),
          currentBalance: new Big('12000'),
          interestRate: new Big('0.06'),
          disbursedAt: new Date('2024-01-15'),
        },
        {
          _id: '3',
          status: 'CLOSED',
          principal: new Big('5000'),
          currentBalance: new Big('0'),
          interestRate: new Big('0.04'),
          disbursedAt: new Date('2023-12-01'),
        },
      ];

      mockLoanRepository.findAll = jest.fn().mockResolvedValue(mockLoans);
      mockUserRepository.count = jest.fn().mockResolvedValue(150);

      const metrics = await analyticsService.getDashboardMetrics();

      expect(metrics).toHaveProperty('totalLoans', 3);
      expect(metrics).toHaveProperty('activeLoans', 2);
      expect(metrics).toHaveProperty('totalDisbursed', '30000');
      expect(metrics).toHaveProperty('outstandingBalance', '20000');
      expect(metrics).toHaveProperty('averageInterestRate', '5');
      expect(metrics).toHaveProperty('totalUsers', 150);
      expect(metrics).toHaveProperty('closedLoans', 1);
      expect(metrics).toHaveProperty('defaultRate', '0');
    });

    it('should handle empty data gracefully', async () => {
      mockLoanRepository.findAll = jest.fn().mockResolvedValue([]);
      mockUserRepository.count = jest.fn().mockResolvedValue(0);

      const metrics = await analyticsService.getDashboardMetrics();

      expect(metrics.totalLoans).toBe(0);
      expect(metrics.activeLoans).toBe(0);
      expect(metrics.totalDisbursed).toBe('0');
      expect(metrics.outstandingBalance).toBe('0');
      expect(metrics.averageInterestRate).toBe('0');
    });
  });

  describe('getLoanPortfolioAnalysis', () => {
    it('should analyze loan portfolio by status', async () => {
      const mockLoans = [
        { status: 'ACTIVE', principal: new Big('10000') },
        { status: 'ACTIVE', principal: new Big('15000') },
        { status: 'DELINQUENT', principal: new Big('5000') },
        { status: 'CLOSED', principal: new Big('8000') },
      ];

      mockLoanRepository.findAll = jest.fn().mockResolvedValue(mockLoans);

      const analysis = await analyticsService.getLoanPortfolioAnalysis();

      expect(analysis.byStatus).toHaveProperty('ACTIVE', 2);
      expect(analysis.byStatus).toHaveProperty('DELINQUENT', 1);
      expect(analysis.byStatus).toHaveProperty('CLOSED', 1);
      expect(analysis.totalValue).toBe('38000');
      expect(analysis.atRiskValue).toBe('5000');
      expect(analysis.atRiskPercentage).toBe('13.16');
    });
  });

  describe('getRevenueAnalysis', () => {
    it('should calculate revenue metrics', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockPayments = [
        {
          paymentDate: new Date('2024-01-10'),
          principalPaid: new Big('1000'),
          interestPaid: new Big('50'),
          feesPaid: new Big('10'),
        },
        {
          paymentDate: new Date('2024-01-20'),
          principalPaid: new Big('1500'),
          interestPaid: new Big('75'),
          feesPaid: new Big('15'),
        },
      ];

      mockLoanRepository.getPaymentsInDateRange = jest.fn().mockResolvedValue(mockPayments);

      const revenue = await analyticsService.getRevenueAnalysis(startDate, endDate);

      expect(revenue.totalRevenue).toBe('150');
      expect(revenue.interestRevenue).toBe('125');
      expect(revenue.feeRevenue).toBe('25');
      expect(revenue.principalCollected).toBe('2500');
      expect(revenue.paymentCount).toBe(2);
    });
  });

  describe('getUserGrowthAnalytics', () => {
    it('should analyze user growth over time', async () => {
      const mockUsers = [
        { createdAt: new Date('2024-01-01'), role: 'borrower' },
        { createdAt: new Date('2024-01-15'), role: 'borrower' },
        { createdAt: new Date('2024-01-20'), role: 'admin' },
        { createdAt: new Date('2024-02-01'), role: 'borrower' },
      ];

      mockUserRepository.findAll = jest.fn().mockResolvedValue(mockUsers);

      const growth = await analyticsService.getUserGrowthAnalytics('2024');

      expect(growth.totalNewUsers).toBe(4);
      expect(growth.monthlyGrowth).toHaveProperty('January', 3);
      expect(growth.monthlyGrowth).toHaveProperty('February', 1);
      expect(growth.roleDistribution).toHaveProperty('borrower', 3);
      expect(growth.roleDistribution).toHaveProperty('admin', 1);
    });
  });

  describe('getLoanPerformanceMetrics', () => {
    it('should calculate loan performance indicators', async () => {
      const mockLoans = [
        {
          status: 'ACTIVE',
          disbursedAt: new Date('2024-01-01'),
          firstPaymentDate: new Date('2024-02-01'),
          schedule: [
            { status: 'paid', dueDate: new Date('2024-02-01') },
            { status: 'paid', dueDate: new Date('2024-03-01') },
            { status: 'pending', dueDate: new Date('2024-04-01') },
          ],
        },
        {
          status: 'DELINQUENT',
          disbursedAt: new Date('2024-01-15'),
          firstPaymentDate: new Date('2024-02-15'),
          schedule: [
            { status: 'paid', dueDate: new Date('2024-02-15') },
            { status: 'overdue', dueDate: new Date('2024-03-15') },
          ],
        },
      ];

      mockLoanRepository.findAll = jest.fn().mockResolvedValue(mockLoans);

      const performance = await analyticsService.getLoanPerformanceMetrics();

      expect(performance.onTimePaymentRate).toBe('66.67');
      expect(performance.averageDaysToFirstPayment).toBe(31);
      expect(performance.delinquencyRate).toBe('50');
      expect(performance.totalPaymentsDue).toBe(3);
      expect(performance.totalPaymentsMade).toBe(2);
    });
  });

  describe('getCollectionEfficiency', () => {
    it('should measure collection efficiency', async () => {
      const mockOverduePayments = [
        {
          amount: new Big('1000'),
          daysOverdue: 5,
          collected: true,
          collectionDate: new Date('2024-01-20'),
        },
        {
          amount: new Big('1500'),
          daysOverdue: 10,
          collected: true,
          collectionDate: new Date('2024-01-25'),
        },
        {
          amount: new Big('500'),
          daysOverdue: 15,
          collected: false,
        },
      ];

      mockLoanRepository.getOverduePayments = jest.fn().mockResolvedValue(mockOverduePayments);

      const efficiency = await analyticsService.getCollectionEfficiency();

      expect(efficiency.totalOverdueAmount).toBe('3000');
      expect(efficiency.collectedAmount).toBe('2500');
      expect(efficiency.collectionRate).toBe('83.33');
      expect(efficiency.averageDaysToCollect).toBe(7.5);
      expect(efficiency.outstandingOverdue).toBe('500');
    });
  });

  describe('getRiskAnalytics', () => {
    it('should provide risk assessment metrics', async () => {
      const mockLoans = [
        {
          status: 'ACTIVE',
          riskScore: 650,
          currentBalance: new Big('10000'),
          daysDelinquent: 0,
        },
        {
          status: 'DELINQUENT',
          riskScore: 550,
          currentBalance: new Big('15000'),
          daysDelinquent: 30,
        },
        {
          status: 'DEFAULT',
          riskScore: 400,
          currentBalance: new Big('5000'),
          daysDelinquent: 90,
        },
      ];

      mockLoanRepository.findAll = jest.fn().mockResolvedValue(mockLoans);

      const risk = await analyticsService.getRiskAnalytics();

      expect(risk.highRiskLoans).toBe(1);
      expect(risk.mediumRiskLoans).toBe(1);
      expect(risk.lowRiskLoans).toBe(1);
      expect(risk.totalAtRiskValue).toBe('20000');
      expect(risk.averageRiskScore).toBe(533.33);
      expect(risk.defaultRate).toBe('33.33');
    });
  });

  describe('generateCustomReport', () => {
    it('should generate custom report based on filters', async () => {
      const filters = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        loanStatus: ['ACTIVE'],
        includePayments: true,
      };

      const mockLoans = [
        {
          _id: '1',
          status: 'ACTIVE',
          principal: new Big('10000'),
          disbursedAt: new Date('2024-01-10'),
        },
      ];

      const mockPayments = [
        {
          loanId: '1',
          amount: new Big('1050'),
          paymentDate: new Date('2024-01-25'),
        },
      ];

      mockLoanRepository.search = jest.fn().mockResolvedValue(mockLoans);
      mockLoanRepository.getPaymentsInDateRange = jest.fn().mockResolvedValue(mockPayments);

      const report = await analyticsService.generateCustomReport(filters);

      expect(report.summary.totalLoans).toBe(1);
      expect(report.summary.totalDisbursed).toBe('10000');
      expect(report.summary.totalPayments).toBe(1);
      expect(report.summary.totalCollected).toBe('1050');
      expect(report.loans).toHaveLength(1);
      expect(report.payments).toHaveLength(1);
    });
  });

  describe('Real-time Analytics', () => {
    it('should stream real-time metrics', async () => {
      const callback = jest.fn();
      
      // Start streaming
      const stopStreaming = await analyticsService.streamRealTimeMetrics(callback, 100);

      // Wait for a few callbacks
      await new Promise(resolve => setTimeout(resolve, 250));

      // Stop streaming
      stopStreaming();

      // Verify callbacks were made
      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls.length).toBeGreaterThanOrEqual(2);
      
      // Verify callback data structure
      const callData = callback.mock.calls[0][0];
      expect(callData).toHaveProperty('timestamp');
      expect(callData).toHaveProperty('metrics');
    });
  });
});