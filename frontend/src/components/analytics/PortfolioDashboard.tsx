import { useState, useEffect } from 'react';
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CurrencyDollarIcon,
  BanknotesIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentChartBarIcon,
  FunnelIcon,
  CalendarIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
// Removed LoanEngine import to avoid dependency issues
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import DatePicker from 'react-datepicker';

interface PortfolioDashboardProps {
  loans?: any[];
  refreshTrigger?: number;
}

interface PortfolioMetrics {
  totalPortfolioValue: number;
  totalOutstandingBalance: number;
  totalMonthlyPayments: number;
  averageInterestRate: number;
  totalLoans: number;
  performanceMetrics: {
    currentLoans: number;
    delinquentLoans: number;
    defaultedLoans: number;
    paidOffLoans: number;
    delinquencyRate: number;
    defaultRate: number;
  };
  financialMetrics: {
    monthlyCollections: number;
    yearToDateCollections: number;
    interestIncome: number;
    principalReductions: number;
    chargeOffs: number;
    recoveries: number;
  };
  riskMetrics: {
    averageLTV: number;
    averageDTI: number;
    averageCreditScore: number;
    riskDistribution: Array<{ bucket: string; count: number; percentage: number }>;
  };
}

interface TimeSeriesData {
  date: string;
  originations: number;
  collections: number;
  delinquencies: number;
  payoffs: number;
}

// Demo data generator function
const generateDemoLoans = () => {
  return [
    {
      id: '1',
      loanParameters: {
        principal: 250000,
        interestRate: 4.5,
        termMonths: 360,
        paymentFrequency: 'MONTHLY'
      },
      status: 'CURRENT',
      delinquencyDays: 0,
      creditScore: 750
    },
    {
      id: '2', 
      loanParameters: {
        principal: 180000,
        interestRate: 5.2,
        termMonths: 240,
        paymentFrequency: 'MONTHLY'
      },
      status: 'DELINQUENT',
      delinquencyDays: 45,
      creditScore: 680
    },
    {
      id: '3',
      loanParameters: {
        principal: 320000,
        interestRate: 3.8,
        termMonths: 360,
        paymentFrequency: 'MONTHLY'
      },
      status: 'CURRENT',
      delinquencyDays: 0,
      creditScore: 780
    }
  ];
};

export const PortfolioDashboard = ({ loans, refreshTrigger }: PortfolioDashboardProps) => {
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'1M' | '3M' | '6M' | '1Y'>('3M');
  const [dateRange, setDateRange] = useState({
    startDate: startOfMonth(subMonths(new Date(), 3)),
    endDate: endOfMonth(new Date()),
  });
  const [selectedMetricView, setSelectedMetricView] = useState<'OVERVIEW' | 'PERFORMANCE' | 'FINANCIAL' | 'RISK'>('OVERVIEW');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    calculateMetrics();
    generateTimeSeriesData();
  }, [loans, refreshTrigger, selectedPeriod]);

  const calculateMetrics = async () => {
    setIsLoading(true);
    try {
      // Handle case when no loans are provided - use demo data
      const loansData = loans || generateDemoLoans();
      
      // Calculate total portfolio value and outstanding balances
      let totalPortfolioValue = 0;
      let totalOutstandingBalance = 0;
      let totalMonthlyPayments = 0;
      let totalInterestRate = 0;
      let currentLoans = 0;
      let delinquentLoans = 0;
      let defaultedLoans = 0;
      let paidOffLoans = 0;

      loansData.forEach(loan => {
        totalPortfolioValue += loan.loanParameters.principal;
        
        // Demo: calculate current balance (85% remaining)
        const currentBalance = loan.loanParameters.principal * 0.85;
        totalOutstandingBalance += currentBalance;
        
        // Calculate monthly payment using basic formula
        const principal = loan.loanParameters.principal;
        const monthlyRate = loan.loanParameters.interestRate / 100 / 12;
        const termMonths = loan.loanParameters.termMonths;
        
        let monthlyPayment = 0;
        if (monthlyRate > 0) {
          monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
                          (Math.pow(1 + monthlyRate, termMonths) - 1);
        } else {
          monthlyPayment = principal / termMonths;
        }
        
        totalMonthlyPayments += monthlyPayment || 0;
        
        totalInterestRate += loan.loanParameters.interestRate;
        
        // Categorize loan status
        switch (loan.status) {
          case 'CURRENT':
            currentLoans++;
            break;
          case 'DELINQUENT':
            delinquentLoans++;
            break;
          case 'DEFAULTED':
            defaultedLoans++;
            break;
          case 'PAID_OFF':
            paidOffLoans++;
            break;
          default:
            currentLoans++;
        }
      });

      const averageInterestRate = loansData.length > 0 ? totalInterestRate / loansData.length : 0;
      const delinquencyRate = loansData.length > 0 ? (delinquentLoans / loansData.length) * 100 : 0;
      const defaultRate = loansData.length > 0 ? (defaultedLoans / loansData.length) * 100 : 0;

      // Generate demo financial metrics
      const monthlyCollections = totalMonthlyPayments * 0.95; // 95% collection rate
      const yearToDateCollections = monthlyCollections * 12; // Demo YTD
      const interestIncome = monthlyCollections * 0.3; // Demo: 30% interest
      const principalReductions = monthlyCollections * 0.7; // Demo: 70% principal

      // Generate demo risk metrics
      const riskDistribution = [
        { bucket: 'Low Risk (750+)', count: Math.floor(loansData.length * 0.4), percentage: 40 },
        { bucket: 'Medium Risk (650-749)', count: Math.floor(loansData.length * 0.35), percentage: 35 },
        { bucket: 'High Risk (550-649)', count: Math.floor(loansData.length * 0.2), percentage: 20 },
        { bucket: 'Very High Risk (<550)', count: Math.floor(loansData.length * 0.05), percentage: 5 },
      ];

      setMetrics({
        totalPortfolioValue,
        totalOutstandingBalance,
        totalMonthlyPayments,
        averageInterestRate,
        totalLoans: loansData.length,
        performanceMetrics: {
          currentLoans,
          delinquentLoans,
          defaultedLoans,
          paidOffLoans,
          delinquencyRate,
          defaultRate,
        },
        financialMetrics: {
          monthlyCollections,
          yearToDateCollections,
          interestIncome,
          principalReductions,
          chargeOffs: defaultedLoans * 50000, // Demo charge-off amount
          recoveries: defaultedLoans * 15000, // Demo recovery amount
        },
        riskMetrics: {
          averageLTV: 75.5, // Demo average LTV
          averageDTI: 32.8, // Demo average DTI
          averageCreditScore: 720, // Demo average credit score
          riskDistribution,
        },
      });
    } catch (error) {
      console.error('Error calculating metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateTimeSeriesData = () => {
    const data: TimeSeriesData[] = [];
    const monthsToShow = selectedPeriod === '1M' ? 1 : selectedPeriod === '3M' ? 3 : selectedPeriod === '6M' ? 6 : 12;
    
    for (let i = monthsToShow - 1; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      data.push({
        date: format(date, 'MMM yyyy'),
        originations: Math.floor(Math.random() * 50) + 20, // Demo data
        collections: Math.floor(Math.random() * 200) + 800, // Demo data
        delinquencies: Math.floor(Math.random() * 20) + 5, // Demo data
        payoffs: Math.floor(Math.random() * 30) + 10, // Demo data
      });
    }
    
    setTimeSeriesData(data);
  };

  const exportReport = (format: 'PDF' | 'EXCEL' | 'CSV') => {
    // In a real app, this would generate and download the report
    console.log(`Exporting ${format} report with data:`, { metrics, timeSeriesData });
    alert(`${format} report would be generated and downloaded`);
  };

  const formatCurrency = (value: number) => {
    const safeValue = isNaN(value) || !isFinite(value) ? 0 : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(safeValue);
  };

  const formatPercentage = (value: number) => {
    const safeValue = isNaN(value) || !isFinite(value) ? 0 : value;
    return `${safeValue.toFixed(1)}%`;
  };

  if (isLoading || !metrics) {
    return (
      <div className="text-center py-12">
        <ChartBarIcon className="animate-pulse h-12 w-12 text-gray-400 mx-auto" />
        <p className="mt-2 text-sm text-gray-500">Loading portfolio analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Portfolio Dashboard</h2>
          <p className="mt-1 text-sm text-gray-600">
            Comprehensive analytics for {metrics.totalLoans} loans
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex rounded-md shadow-sm">
            {['1M', '3M', '6M', '1Y'].map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period as any)}
                className={`px-3 py-2 text-sm font-medium border ${
                  selectedPeriod === period
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                } ${period === '1M' ? 'rounded-l-md' : period === '1Y' ? 'rounded-r-md' : ''}`}
              >
                {period}
              </button>
            ))}
          </div>
          <button
            onClick={() => exportReport('PDF')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CurrencyDollarIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Portfolio Value</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {formatCurrency(metrics.totalPortfolioValue)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <span className="text-gray-600">Outstanding: </span>
              <span className="font-medium text-gray-900">
                {formatCurrency(metrics.totalOutstandingBalance)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BanknotesIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Monthly Collections</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {formatCurrency(metrics.financialMetrics.monthlyCollections)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <span className="text-green-600 flex items-center">
                <ArrowTrendingUpIcon className="h-4 w-4 mr-1" />
                +5.2% from last month
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Delinquency Rate</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {formatPercentage(metrics.performanceMetrics.delinquencyRate)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <span className="text-gray-600">{metrics.performanceMetrics.delinquentLoans} loans</span>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ArrowTrendingUpIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Avg Interest Rate</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {formatPercentage(metrics.averageInterestRate)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <span className="text-gray-600">Across {metrics.totalLoans} loans</span>
            </div>
          </div>
        </div>
      </div>

      {/* Metric View Selector */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'OVERVIEW', label: 'Overview', icon: ChartBarIcon },
            { key: 'PERFORMANCE', label: 'Performance', icon: ArrowTrendingUpIcon },
            { key: 'FINANCIAL', label: 'Financial', icon: CurrencyDollarIcon },
            { key: 'RISK', label: 'Risk Analysis', icon: ExclamationTriangleIcon },
          ].map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setSelectedMetricView(tab.key as any)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                  selectedMetricView === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <IconComponent className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content based on selected view */}
      {selectedMetricView === 'OVERVIEW' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Loan Status Distribution */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Loan Status Distribution</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                  <span className="text-sm text-gray-700">Current</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">{metrics.performanceMetrics.currentLoans}</span>
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ width: `${(metrics.performanceMetrics.currentLoans / metrics.totalLoans) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <ClockIcon className="h-5 w-5 text-yellow-500 mr-2" />
                  <span className="text-sm text-gray-700">Delinquent</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">{metrics.performanceMetrics.delinquentLoans}</span>
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-yellow-500 h-2 rounded-full" 
                      style={{ width: `${(metrics.performanceMetrics.delinquentLoans / metrics.totalLoans) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-2" />
                  <span className="text-sm text-gray-700">Defaulted</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">{metrics.performanceMetrics.defaultedLoans}</span>
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-red-500 h-2 rounded-full" 
                      style={{ width: `${(metrics.performanceMetrics.defaultedLoans / metrics.totalLoans) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <CheckCircleIcon className="h-5 w-5 text-blue-500 mr-2" />
                  <span className="text-sm text-gray-700">Paid Off</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">{metrics.performanceMetrics.paidOffLoans}</span>
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ width: `${(metrics.performanceMetrics.paidOffLoans / metrics.totalLoans) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Trends */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Trends</h3>
            <div className="space-y-4">
              {timeSeriesData.slice(-3).map((data, index) => (
                <div key={index} className="border-l-4 border-blue-500 pl-4">
                  <div className="text-sm font-medium text-gray-900">{data.date}</div>
                  <div className="text-xs text-gray-600 space-y-1">
                    <div>Originations: {data.originations}</div>
                    <div>Collections: {formatCurrency(data.collections * 1000)}</div>
                    <div>Payoffs: {data.payoffs}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedMetricView === 'PERFORMANCE' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Trends</h3>
            <div className="space-y-4">
              <div className="text-center py-8 text-gray-500">
                <ChartBarIcon className="h-12 w-12 mx-auto mb-2" />
                <p>Interactive chart would be displayed here</p>
                <p className="text-xs">Showing collections, delinquencies, and payoffs over time</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="bg-white shadow rounded-lg p-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Collection Efficiency</h4>
              <div className="text-2xl font-bold text-green-600">95.2%</div>
              <p className="text-xs text-gray-500">Monthly collection rate</p>
            </div>
            
            <div className="bg-white shadow rounded-lg p-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Early Payoff Rate</h4>
              <div className="text-2xl font-bold text-blue-600">8.5%</div>
              <p className="text-xs text-gray-500">Loans paid off early</p>
            </div>
          </div>
        </div>
      )}

      {selectedMetricView === 'FINANCIAL' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Revenue Breakdown</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-gray-600">Interest Income</span>
                <span className="text-sm font-medium">{formatCurrency(metrics.financialMetrics.interestIncome)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-gray-600">Principal Collections</span>
                <span className="text-sm font-medium">{formatCurrency(metrics.financialMetrics.principalReductions)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-gray-600">Late Fees</span>
                <span className="text-sm font-medium">{formatCurrency(25000)}</span>
              </div>
              <div className="flex justify-between items-center py-2 font-medium">
                <span className="text-gray-900">Total Monthly</span>
                <span className="text-lg">{formatCurrency(metrics.financialMetrics.monthlyCollections)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Year to Date</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-gray-600">Total Collections</span>
                <span className="text-sm font-medium">{formatCurrency(metrics.financialMetrics.yearToDateCollections)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-gray-600">Charge-offs</span>
                <span className="text-sm font-medium text-red-600">{formatCurrency(metrics.financialMetrics.chargeOffs)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-gray-600">Recoveries</span>
                <span className="text-sm font-medium text-green-600">{formatCurrency(metrics.financialMetrics.recoveries)}</span>
              </div>
              <div className="flex justify-between items-center py-2 font-medium">
                <span className="text-gray-900">Net Income</span>
                <span className="text-lg">{formatCurrency(metrics.financialMetrics.yearToDateCollections - metrics.financialMetrics.chargeOffs + metrics.financialMetrics.recoveries)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedMetricView === 'RISK' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Risk Distribution</h3>
            <div className="space-y-3">
              {metrics.riskMetrics.riskDistribution.map((bucket, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded mr-3 ${
                      index === 0 ? 'bg-green-500' : 
                      index === 1 ? 'bg-yellow-500' : 
                      index === 2 ? 'bg-orange-500' : 'bg-red-500'
                    }`} />
                    <span className="text-sm text-gray-700">{bucket.bucket}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">{bucket.count}</span>
                    <span className="text-xs text-gray-500">({bucket.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Risk Metrics</h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{metrics.riskMetrics.averageLTV}%</div>
                <div className="text-sm text-gray-600">Average LTV</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{metrics.riskMetrics.averageDTI}%</div>
                <div className="text-sm text-gray-600">Average DTI</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{metrics.riskMetrics.averageCreditScore}</div>
                <div className="text-sm text-gray-600">Average Credit Score</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};