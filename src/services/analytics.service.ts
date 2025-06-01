import { LoanRepository } from '../repositories/loan.repository';
import { UserRepository } from '../repositories/user.repository';
import { getWebSocketService } from './websocket.service';
import { logger } from '../utils/logger';
import { LoanStatus } from '../models/loan.model';
import Big from 'big.js';

export interface DashboardMetrics {
  totalLoans: number;
  activeLoans: number;
  totalDisbursed: string;
  outstandingBalance: string;
  averageInterestRate: string;
  totalUsers: number;
  closedLoans: number;
  defaultRate: string;
}

export interface PortfolioAnalysis {
  byStatus: Record<string, number>;
  totalValue: string;
  atRiskValue: string;
  atRiskPercentage: string;
}

export interface RevenueAnalysis {
  totalRevenue: string;
  interestRevenue: string;
  feeRevenue: string;
  principalCollected: string;
  paymentCount: number;
  averagePaymentSize: string;
}

export interface UserGrowthAnalytics {
  totalNewUsers: number;
  monthlyGrowth: Record<string, number>;
  roleDistribution: Record<string, number>;
  growthRate: string;
}

export interface LoanPerformanceMetrics {
  onTimePaymentRate: string;
  averageDaysToFirstPayment: number;
  delinquencyRate: string;
  totalPaymentsDue: number;
  totalPaymentsMade: number;
}

export interface CollectionEfficiency {
  totalOverdueAmount: string;
  collectedAmount: string;
  collectionRate: string;
  averageDaysToCollect: number;
  outstandingOverdue: string;
}

export interface RiskAnalytics {
  highRiskLoans: number;
  mediumRiskLoans: number;
  lowRiskLoans: number;
  totalAtRiskValue: string;
  averageRiskScore: number;
  defaultRate: string;
}

export interface CustomReportFilters {
  startDate?: Date;
  endDate?: Date;
  loanStatus?: string[];
  userRole?: string;
  minAmount?: number;
  maxAmount?: number;
  includePayments?: boolean;
}

export interface CustomReport {
  summary: {
    totalLoans: number;
    totalDisbursed: string;
    totalPayments: number;
    totalCollected: string;
  };
  loans: any[];
  payments?: any[];
  generatedAt: Date;
}

export class AnalyticsService {
  constructor(
    private loanRepository: LoanRepository,
    private userRepository: UserRepository,
  ) {}

  /**
   * Get comprehensive dashboard metrics
   */
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    try {
      const loans = await this.loanRepository.findAll();
      const totalUsers = await this.userRepository.count();

      const activeLoans = loans.filter(l => l.status === 'ACTIVE');
      const closedLoans = loans.filter(l => l.status === 'CLOSED');
      const defaultedLoans = loans.filter(l => l.status === 'DEFAULT');

      const totalDisbursed = loans.reduce((sum, loan) => 
        sum.plus(loan.principal), new Big(0),
      );

      const outstandingBalance = activeLoans.reduce((sum, loan) => 
        sum.plus(loan.currentBalance), new Big(0),
      );

      const averageInterestRate = loans.length > 0
        ? loans.reduce((sum, loan) => sum.plus(loan.interestRate), new Big(0))
          .div(loans.length)
          .times(100)
        : new Big(0);

      const defaultRate = loans.length > 0
        ? new Big(defaultedLoans.length).div(loans.length).times(100)
        : new Big(0);

      return {
        totalLoans: loans.length,
        activeLoans: activeLoans.length,
        totalDisbursed: totalDisbursed.toFixed(2),
        outstandingBalance: outstandingBalance.toFixed(2),
        averageInterestRate: averageInterestRate.toFixed(2),
        totalUsers,
        closedLoans: closedLoans.length,
        defaultRate: defaultRate.toFixed(2),
      };
    } catch (error) {
      logger.error('Error calculating dashboard metrics:', error);
      throw error;
    }
  }

  /**
   * Analyze loan portfolio by various dimensions
   */
  async getLoanPortfolioAnalysis(): Promise<PortfolioAnalysis> {
    try {
      const loans = await this.loanRepository.findAll();

      const byStatus = loans.reduce((acc, loan) => {
        acc[loan.status] = (acc[loan.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const totalValue = loans.reduce((sum, loan) => 
        sum.plus(loan.principal), new Big(0),
      );

      const atRiskLoans = loans.filter(l => 
        ['DELINQUENT', 'DEFAULT', 'FORBEARANCE'].includes(l.status),
      );

      const atRiskValue = atRiskLoans.reduce((sum, loan) => 
        sum.plus(loan.currentBalance), new Big(0),
      );

      const atRiskPercentage = totalValue.gt(0)
        ? atRiskValue.div(totalValue).times(100)
        : new Big(0);

      return {
        byStatus,
        totalValue: totalValue.toFixed(2),
        atRiskValue: atRiskValue.toFixed(2),
        atRiskPercentage: atRiskPercentage.toFixed(2),
      };
    } catch (error) {
      logger.error('Error analyzing loan portfolio:', error);
      throw error;
    }
  }

  /**
   * Calculate revenue metrics for a date range
   */
  async getRevenueAnalysis(startDate: Date, endDate: Date): Promise<RevenueAnalysis> {
    try {
      const payments = await this.loanRepository.getPaymentsInDateRange(startDate, endDate);

      const totals = payments.reduce((acc, payment) => {
        acc.principal = acc.principal.plus(payment.principalPaid);
        acc.interest = acc.interest.plus(payment.interestPaid);
        acc.fees = acc.fees.plus(payment.feesPaid || 0);
        return acc;
      }, {
        principal: new Big(0),
        interest: new Big(0),
        fees: new Big(0),
      });

      const totalRevenue = totals.interest.plus(totals.fees);
      const averagePaymentSize = payments.length > 0
        ? totals.principal.plus(totalRevenue).div(payments.length)
        : new Big(0);

      return {
        totalRevenue: totalRevenue.toFixed(2),
        interestRevenue: totals.interest.toFixed(2),
        feeRevenue: totals.fees.toFixed(2),
        principalCollected: totals.principal.toFixed(2),
        paymentCount: payments.length,
        averagePaymentSize: averagePaymentSize.toFixed(2),
      };
    } catch (error) {
      logger.error('Error calculating revenue analysis:', error);
      throw error;
    }
  }

  /**
   * Analyze user growth patterns
   */
  async getUserGrowthAnalytics(year: string): Promise<UserGrowthAnalytics> {
    try {
      const startOfYear = new Date(`${year}-01-01`);
      const endOfYear = new Date(`${year}-12-31`);

      const users = await this.userRepository.findAll({
        createdAt: { $gte: startOfYear, $lte: endOfYear },
      });

      const monthlyGrowth = users.reduce((acc, user) => {
        const month = new Date(user.createdAt).toLocaleString('default', { month: 'long' });
        acc[month] = (acc[month] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const roleDistribution = users.reduce((acc, user) => {
        const role = user.roles?.[0] || 'unknown';
        acc[role] = (acc[role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Calculate month-over-month growth rate
      const monthCounts = Object.values(monthlyGrowth);
      let totalGrowthRate = new Big(0);
      
      for (let i = 1; i < monthCounts.length; i++) {
        if (monthCounts[i - 1] > 0) {
          const growthRate = new Big(monthCounts[i] - monthCounts[i - 1])
            .div(monthCounts[i - 1])
            .times(100);
          totalGrowthRate = totalGrowthRate.plus(growthRate);
        }
      }

      const averageGrowthRate = monthCounts.length > 1
        ? totalGrowthRate.div(monthCounts.length - 1)
        : new Big(0);

      return {
        totalNewUsers: users.length,
        monthlyGrowth,
        roleDistribution,
        growthRate: averageGrowthRate.toFixed(2),
      };
    } catch (error) {
      logger.error('Error analyzing user growth:', error);
      throw error;
    }
  }

  /**
   * Calculate loan performance indicators
   */
  async getLoanPerformanceMetrics(): Promise<LoanPerformanceMetrics> {
    try {
      const loans = await this.loanRepository.findAll();
      
      let totalPaymentsDue = 0;
      let totalPaymentsMade = 0;
      let totalDaysToFirstPayment = 0;
      let loansWithPayments = 0;

      loans.forEach(loan => {
        if (loan.schedule && loan.schedule.length > 0) {
          const duePayments = loan.schedule.filter(p => 
            new Date(p.dueDate) <= new Date(),
          );
          totalPaymentsDue += duePayments.length;
          
          const madePayments = duePayments.filter(p => p.status === 'paid');
          totalPaymentsMade += madePayments.length;

          // Calculate days to first payment
          if (loan.disbursedAt && loan.firstPaymentDate) {
            const daysDiff = Math.floor(
              (loan.firstPaymentDate.getTime() - loan.disbursedAt.getTime()) / 
              (1000 * 60 * 60 * 24),
            );
            totalDaysToFirstPayment += daysDiff;
            loansWithPayments++;
          }
        }
      });

      const onTimePaymentRate = totalPaymentsDue > 0
        ? new Big(totalPaymentsMade).div(totalPaymentsDue).times(100)
        : new Big(0);

      const averageDaysToFirstPayment = loansWithPayments > 0
        ? Math.round(totalDaysToFirstPayment / loansWithPayments)
        : 0;

      const delinquentLoans = loans.filter(l => 
        ['DELINQUENT', 'DEFAULT'].includes(l.status),
      );

      const delinquencyRate = loans.length > 0
        ? new Big(delinquentLoans.length).div(loans.length).times(100)
        : new Big(0);

      return {
        onTimePaymentRate: onTimePaymentRate.toFixed(2),
        averageDaysToFirstPayment,
        delinquencyRate: delinquencyRate.toFixed(2),
        totalPaymentsDue,
        totalPaymentsMade,
      };
    } catch (error) {
      logger.error('Error calculating loan performance metrics:', error);
      throw error;
    }
  }

  /**
   * Measure collection efficiency
   */
  async getCollectionEfficiency(): Promise<CollectionEfficiency> {
    try {
      const overduePayments = await this.loanRepository.getOverduePayments();

      const totals = overduePayments.reduce((acc, payment) => {
        acc.totalAmount = acc.totalAmount.plus(payment.amount);
        
        if (payment.collected) {
          acc.collectedAmount = acc.collectedAmount.plus(payment.amount);
          acc.totalDaysToCollect += payment.daysOverdue;
          acc.collectedCount++;
        }
        
        return acc;
      }, {
        totalAmount: new Big(0),
        collectedAmount: new Big(0),
        totalDaysToCollect: 0,
        collectedCount: 0,
      });

      const collectionRate = totals.totalAmount.gt(0)
        ? totals.collectedAmount.div(totals.totalAmount).times(100)
        : new Big(0);

      const averageDaysToCollect = totals.collectedCount > 0
        ? totals.totalDaysToCollect / totals.collectedCount
        : 0;

      const outstandingOverdue = totals.totalAmount.minus(totals.collectedAmount);

      return {
        totalOverdueAmount: totals.totalAmount.toFixed(2),
        collectedAmount: totals.collectedAmount.toFixed(2),
        collectionRate: collectionRate.toFixed(2),
        averageDaysToCollect,
        outstandingOverdue: outstandingOverdue.toFixed(2),
      };
    } catch (error) {
      logger.error('Error calculating collection efficiency:', error);
      throw error;
    }
  }

  /**
   * Provide risk assessment metrics
   */
  async getRiskAnalytics(): Promise<RiskAnalytics> {
    try {
      const loans = await this.loanRepository.findAll();

      const riskCategories = {
        high: 0,
        medium: 0,
        low: 0,
      };

      let totalAtRiskValue = new Big(0);
      let totalRiskScore = 0;
      let loansWithRiskScore = 0;

      loans.forEach(loan => {
        // Categorize by risk score
        if (loan.riskScore) {
          loansWithRiskScore++;
          totalRiskScore += loan.riskScore;

          if (loan.riskScore < 500) {
            riskCategories.high++;
            totalAtRiskValue = totalAtRiskValue.plus(loan.currentBalance);
          } else if (loan.riskScore < 650) {
            riskCategories.medium++;
            totalAtRiskValue = totalAtRiskValue.plus(loan.currentBalance);
          } else {
            riskCategories.low++;
          }
        }

        // Also consider delinquent loans as at-risk
        if (['DELINQUENT', 'DEFAULT'].includes(loan.status) && !loan.riskScore) {
          riskCategories.high++;
          totalAtRiskValue = totalAtRiskValue.plus(loan.currentBalance);
        }
      });

      const averageRiskScore = loansWithRiskScore > 0
        ? totalRiskScore / loansWithRiskScore
        : 0;

      const defaultedLoans = loans.filter(l => l.status === 'DEFAULT');
      const defaultRate = loans.length > 0
        ? new Big(defaultedLoans.length).div(loans.length).times(100)
        : new Big(0);

      return {
        highRiskLoans: riskCategories.high,
        mediumRiskLoans: riskCategories.medium,
        lowRiskLoans: riskCategories.low,
        totalAtRiskValue: totalAtRiskValue.toFixed(2),
        averageRiskScore: Number(averageRiskScore.toFixed(2)),
        defaultRate: defaultRate.toFixed(2),
      };
    } catch (error) {
      logger.error('Error calculating risk analytics:', error);
      throw error;
    }
  }

  /**
   * Generate custom report based on filters
   */
  async generateCustomReport(filters: CustomReportFilters): Promise<CustomReport> {
    try {
      const loanCriteria: any = {};

      if (filters.startDate && filters.endDate) {
        loanCriteria.disbursedAt = {
          $gte: filters.startDate,
          $lte: filters.endDate,
        };
      }

      if (filters.loanStatus && filters.loanStatus.length > 0) {
        loanCriteria.status = { $in: filters.loanStatus };
      }

      if (filters.minAmount) {
        loanCriteria.minBalance = new Big(filters.minAmount);
      }

      if (filters.maxAmount) {
        loanCriteria.maxBalance = new Big(filters.maxAmount);
      }

      const loans = await this.loanRepository.search(loanCriteria);

      let payments = [];
      if (filters.includePayments && filters.startDate && filters.endDate) {
        payments = await this.loanRepository.getPaymentsInDateRange(
          filters.startDate,
          filters.endDate,
        );
      }

      const totalDisbursed = loans.reduce((sum, loan) => 
        sum.plus(loan.principal), new Big(0),
      );

      const totalCollected = payments.reduce((sum, payment) => 
        sum.plus(payment.amount || 0), new Big(0),
      );

      return {
        summary: {
          totalLoans: loans.length,
          totalDisbursed: totalDisbursed.toFixed(2),
          totalPayments: payments.length,
          totalCollected: totalCollected.toFixed(2),
        },
        loans: loans.map(loan => ({
          id: loan._id,
          status: loan.status,
          principal: loan.principal.toFixed(2),
          currentBalance: loan.currentBalance.toFixed(2),
          interestRate: `${loan.interestRate.times(100).toFixed(2)  }%`,
          disbursedAt: loan.disbursedAt,
        })),
        payments: filters.includePayments ? payments : undefined,
        generatedAt: new Date(),
      };
    } catch (error) {
      logger.error('Error generating custom report:', error);
      throw error;
    }
  }

  /**
   * Stream real-time metrics via WebSocket
   */
  async streamRealTimeMetrics(
    callback: (data: any) => void,
    intervalMs = 5000,
  ): Promise<() => void> {
    const wsService = getWebSocketService();
    
    const sendMetrics = async () => {
      try {
        const metrics = await this.getDashboardMetrics();
        const data = {
          timestamp: new Date(),
          metrics,
        };

        // Send via WebSocket
        wsService.broadcastAnalytics(data);
        
        // Call callback if provided
        if (callback) {
          callback(data);
        }
      } catch (error) {
        logger.error('Error streaming real-time metrics:', error);
      }
    };

    // Send initial metrics
    await sendMetrics();

    // Set up interval
    const interval = setInterval(sendMetrics, intervalMs);

    // Return cleanup function
    return () => {
      clearInterval(interval);
    };
  }

  /**
   * Export analytics data to various formats
   */
  async exportAnalytics(format: 'csv' | 'json' | 'pdf', data: any): Promise<Buffer> {
    try {
      switch (format) {
      case 'json':
        return Buffer.from(JSON.stringify(data, null, 2));
        
      case 'csv':
        // Simple CSV implementation
        const headers = Object.keys(data.summary || data);
        const values = Object.values(data.summary || data);
        const csv = [
          headers.join(','),
          values.join(','),
        ].join('\n');
        return Buffer.from(csv);
        
      case 'pdf':
        // PDF generation would require a library like pdfkit
        throw new Error('PDF export not implemented');
        
      default:
        throw new Error(`Unsupported format: ${format}`);
      }
    } catch (error) {
      logger.error('Error exporting analytics:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService(
  new LoanRepository(),
  new UserRepository(),
);