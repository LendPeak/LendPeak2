import React, { useState, useEffect } from 'react';
import { 
  CurrencyDollarIcon, 
  CalculatorIcon, 
  UserGroupIcon, 
  DocumentTextIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { portfolioCache, PortfolioMetrics } from '../../services/portfolioCache';
import { demoLoanStorage } from '../../services/demoLoanStorage';
import { DEMO_CUSTOMERS } from '../../demo/demoData';

interface QuickTemplate {
  name: string;
  description: string;
  template: {
    principal: number;
    interestRate: number;
    termMonths: number;
  };
}

const LOAN_TEMPLATES: QuickTemplate[] = [
  {
    name: 'Auto Loan',
    description: '5-year vehicle financing',
    template: { principal: 28500, interestRate: 5.9, termMonths: 60 }
  },
  {
    name: 'Mortgage',
    description: '30-year home loan',
    template: { principal: 350000, interestRate: 5.75, termMonths: 360 }
  },
  {
    name: 'Personal Loan',
    description: '3-year personal financing',
    template: { principal: 15000, interestRate: 8.5, termMonths: 36 }
  }
];

export const DemoDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [recentLoans, setRecentLoans] = useState<any[]>([]);
  const [isLoadingLoans, setIsLoadingLoans] = useState(true);

  useEffect(() => {
    // Get portfolio metrics (returns cached data first)
    loadPortfolioMetrics();
    
    // Subscribe to metrics updates
    const unsubscribe = portfolioCache.onMetricsUpdate((updatedMetrics) => {
      setMetrics(updatedMetrics);
    });

    // Load recent loans asynchronously
    loadRecentLoans();

    return unsubscribe;
  }, []);

  const loadPortfolioMetrics = async () => {
    try {
      const portfolioMetrics = await portfolioCache.getPortfolioMetrics();
      setMetrics(portfolioMetrics);
    } catch (error) {
      console.error('Error loading portfolio metrics:', error);
    }
  };

  const loadRecentLoans = async () => {
    try {
      setIsLoadingLoans(true);
      const loans = demoLoanStorage.getLoans();
      
      // If no loans exist, show empty state
      if (loans.length === 0) {
        setRecentLoans([]);
        return;
      }
      
      // Get first 5 loans with minimal data for fast display
      const recentLoanData = loans.slice(0, 5).map(loan => {
        const customer = DEMO_CUSTOMERS.find(c => c.id === loan.customerId);
        return {
          id: loan.id,
          borrowerName: customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown',
          borrowerEmail: customer?.email || '',
          principal: loan.loanParameters.principal,
          monthlyPayment: Math.round(loan.loanParameters.principal / loan.loanParameters.termMonths * 1.2), // Simplified calculation
          status: loan.status,
          apr: loan.loanParameters.interestRate,
          purpose: loan.purpose
        };
      });
      
      setRecentLoans(recentLoanData);
    } catch (error) {
      console.error('Error loading recent loans:', error);
    } finally {
      setIsLoadingLoans(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (rate: number): string => {
    return `${rate.toFixed(2)}%`;
  };

  const handleRefreshMetrics = async () => {
    try {
      await portfolioCache.forceRefresh();
    } catch (error) {
      console.error('Error refreshing metrics:', error);
    }
  };

  if (!metrics) {
    return (
      <div className="space-y-6">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="animate-pulse flex space-x-4">
            <div className="rounded-full bg-gray-200 h-10 w-10"></div>
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white shadow rounded-lg p-5">
              <div className="animate-pulse">
                <div className="h-16 bg-gray-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const stats = [
    {
      name: 'Total Loans',
      value: metrics.totalLoans.toString(),
      icon: DocumentTextIcon,
      color: 'bg-blue-500',
      change: '+2 this month',
    },
    {
      name: 'Active Loans',
      value: metrics.activeLoans.toString(),
      icon: ArrowTrendingUpIcon,
      color: 'bg-green-500',
      change: `${Math.round((metrics.activeLoans / metrics.totalLoans) * 100)}% of portfolio`,
    },
    {
      name: 'Total Principal',
      value: formatCurrency(metrics.totalPrincipal),
      icon: CurrencyDollarIcon,
      color: 'bg-purple-500',
      change: 'Across all loans',
    },
    {
      name: 'Monthly Collections',
      value: formatCurrency(metrics.totalMonthlyPayments),
      icon: ClockIcon,
      color: 'bg-yellow-500',
      change: 'Expected this month',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="md:flex md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Demo Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">
              Experience LendPeak's loan management system with intelligent caching
            </p>
            {metrics.lastUpdated && (
              <p className="mt-1 text-xs text-gray-400">
                Last updated: {metrics.lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
          <div className="mt-4 md:mt-0 flex space-x-3">
            <button
              onClick={handleRefreshMetrics}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              disabled={metrics.isCalculating}
            >
              <ArrowPathIcon className={`h-4 w-4 mr-2 ${metrics.isCalculating ? 'animate-spin' : ''}`} />
              {metrics.isCalculating ? 'Updating...' : 'Refresh'}
            </button>
            <button
              onClick={() => navigate('/calculator')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <CalculatorIcon className="h-5 w-5 mr-2" />
              New Calculation
            </button>
          </div>
        </div>

        {/* Calculation Status Banner */}
        {metrics.isCalculating && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-3">
            <div className="flex">
              <div className="flex-shrink-0">
                <ArrowPathIcon className="h-5 w-5 text-blue-400 animate-spin" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  <strong>Crunching numbers...</strong> Results will be updated shortly with the latest calculations.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className={`flex-shrink-0 ${stat.color} rounded-md p-3`}>
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {stat.name}
                    </dt>
                    <dd className={`text-lg font-semibold ${metrics.isCalculating ? 'text-gray-500' : 'text-gray-900'}`}>
                      {stat.value}
                      {metrics.isCalculating && (
                        <span className="ml-2 text-xs text-blue-600">updating...</span>
                      )}
                    </dd>
                  </dl>
                </div>
              </div>
              <div className="mt-2">
                <p className="text-sm text-gray-500">{stat.change}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Loans */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Recent Loans
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Sample loans with cached calculations for fast performance
          </p>
        </div>
        <div className="overflow-x-auto">
          {isLoadingLoans ? (
            <div className="p-6">
              <div className="animate-pulse space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          ) : recentLoans.length === 0 ? (
            <div className="p-6 text-center">
              <div className="text-gray-500">
                <DocumentTextIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium mb-2">No recent loans</h3>
                <p className="text-sm">Get started by creating your first loan calculation.</p>
                <button
                  onClick={() => navigate('/calculator')}
                  className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  <CalculatorIcon className="h-4 w-4 mr-2" />
                  Create Loan
                </button>
              </div>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Purpose
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Principal
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Monthly Payment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    APR
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentLoans.map((loan) => (
                  <tr 
                    key={loan.id} 
                    className="hover:bg-blue-50 hover:shadow-sm cursor-pointer transition-all duration-150 group"
                    onClick={() => navigate(`/loans/${loan.id}`)}
                    title={`View details for loan ${loan.id}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 group-hover:text-blue-700 transition-colors duration-150">
                            {loan.borrowerName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {loan.borrowerEmail}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {loan.purpose}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(loan.principal)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(loan.monthlyPayment)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        loan.status === 'ACTIVE' 
                          ? 'bg-green-100 text-green-800' 
                          : loan.status === 'PENDING'
                          ? 'bg-yellow-100 text-yellow-800'
                          : loan.status === 'PAID_OFF'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {loan.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatPercentage(loan.apr)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Quick Templates */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Quick Calculation Templates
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Try these pre-configured loan scenarios
          </p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LOAN_TEMPLATES.map((template) => (
              <div 
                key={template.name}
                onClick={() => navigate('/calculator', { state: { template: template.template } })}
                className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm hover:shadow-md cursor-pointer transition-shadow"
              >
                <div>
                  <h4 className="text-lg font-medium text-gray-900">
                    {template.name}
                  </h4>
                  <p className="mt-1 text-sm text-gray-500">
                    {template.description}
                  </p>
                  <div className="mt-3 text-sm text-gray-600">
                    <p>Principal: {formatCurrency(template.template.principal)}</p>
                    <p>Rate: {formatPercentage(template.template.interestRate)}</p>
                    <p>Term: {template.template.termMonths} months</p>
                  </div>
                </div>
                <div className="absolute top-6 right-6">
                  <CalculatorIcon className="h-6 w-6 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performance Notice */}
      <div className="bg-green-50 border border-green-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-green-800">
              Intelligent Caching Active
            </h3>
            <div className="mt-2 text-sm text-green-700">
              <p>
                Dashboard loads instantly using cached calculations. Complex loan calculations 
                happen in the background and update automatically when ready.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};