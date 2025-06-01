import { useState, useEffect } from 'react';
import {
  ChartBarIcon,
  PresentationChartLineIcon,
  TableCellsIcon,
  CogIcon,
  DocumentArrowDownIcon,
  CalendarIcon,
  AdjustmentsHorizontalIcon,
  BeakerIcon,
  ShieldCheckIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  BanknotesIcon,
  UsersIcon,
  CalculatorIcon,
} from '@heroicons/react/24/outline';
import { format, subMonths, startOfMonth, endOfMonth, differenceInMonths } from 'date-fns';
import DatePicker from 'react-datepicker';

interface BusinessIntelligenceDashboardProps {
  loans?: any[];
  refreshTrigger?: number;
}

interface CohortData {
  cohortMonth: string;
  loansOriginated: number;
  month0: number;
  month1: number;
  month3: number;
  month6: number;
  month12: number;
  month24: number;
  month36: number;
  cumulativeChargeOffRate: number;
  currentBalance: number;
  originalBalance: number;
}

interface VintageCurveData {
  vintage: string;
  age: number;
  cumulativeChargeOffRate: number;
  cumulativePayoffRate: number;
  delinquencyRate: number;
  currentBalance: number;
}

interface StressTestScenario {
  name: string;
  description: string;
  parameters: {
    unemploymentRate: number;
    gdpGrowth: number;
    interestRateChange: number;
    housingPriceChange: number;
  };
  results: {
    projectedChargeOffRate: number;
    portfolioValueAtRisk: number;
    expectedLoss: number;
    liquidityImpact: number;
  };
}

interface CustomKPI {
  id: string;
  name: string;
  formula: string;
  category: 'PERFORMANCE' | 'RISK' | 'FINANCIAL' | 'OPERATIONAL';
  value: number;
  target?: number;
  trend: 'UP' | 'DOWN' | 'FLAT';
  trendPercent: number;
  description: string;
}

export const BusinessIntelligenceDashboard = ({ loans, refreshTrigger }: BusinessIntelligenceDashboardProps) => {
  const [activeView, setActiveView] = useState<'COHORT' | 'VINTAGE' | 'STRESS' | 'KPI' | 'FAIR_LENDING'>('COHORT');
  const [dateRange, setDateRange] = useState({
    startDate: startOfMonth(subMonths(new Date(), 24)),
    endDate: endOfMonth(new Date()),
  });
  const [cohortData, setCohortData] = useState<CohortData[]>([]);
  const [vintageData, setVintageData] = useState<VintageCurveData[]>([]);
  const [stressTestResults, setStressTestResults] = useState<StressTestScenario[]>([]);
  const [customKPIs, setCustomKPIs] = useState<CustomKPI[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStressTest, setSelectedStressTest] = useState<string | null>(null);

  useEffect(() => {
    generateAnalyticsData();
  }, [loans, refreshTrigger, dateRange]);

  const generateAnalyticsData = async () => {
    setIsLoading(true);
    try {
      // Generate demo data for comprehensive analytics
      const demoLoans = loans || generateDemoLoanPortfolio();
      
      // Generate cohort analysis
      generateCohortAnalysis(demoLoans);
      
      // Generate vintage curves
      generateVintageCurves(demoLoans);
      
      // Generate stress test scenarios
      generateStressTestScenarios();
      
      // Generate custom KPIs
      generateCustomKPIs(demoLoans);
      
    } catch (error) {
      console.error('Error generating analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateDemoLoanPortfolio = () => {
    const loans = [];
    const vintages = ['2020-01', '2020-07', '2021-01', '2021-07', '2022-01', '2022-07', '2023-01', '2023-07', '2024-01'];
    
    vintages.forEach((vintage, vintageIndex) => {
      const loansInVintage = Math.floor(Math.random() * 200) + 100;
      
      for (let i = 0; i < loansInVintage; i++) {
        const originationDate = new Date(vintage + '-15');
        const monthsSinceOrigination = differenceInMonths(new Date(), originationDate);
        
        // Simulate loan performance over time
        const baseChargeOffRate = 0.02 + (monthsSinceOrigination * 0.001);
        const isChargedOff = Math.random() < baseChargeOffRate;
        const isPaidOff = !isChargedOff && Math.random() < (monthsSinceOrigination * 0.008);
        const isDelinquent = !isChargedOff && !isPaidOff && Math.random() < 0.15;
        
        loans.push({
          id: `${vintage}-${i}`,
          originationDate,
          vintage,
          loanParameters: {
            principal: Math.floor(Math.random() * 400000) + 100000,
            interestRate: 3.5 + Math.random() * 4,
            termMonths: 360,
          },
          currentBalance: isChargedOff || isPaidOff ? 0 : Math.floor(Math.random() * 300000) + 50000,
          status: isChargedOff ? 'CHARGED_OFF' : isPaidOff ? 'PAID_OFF' : isDelinquent ? 'DELINQUENT' : 'CURRENT',
          delinquencyDays: isDelinquent ? Math.floor(Math.random() * 120) + 30 : 0,
          creditScore: Math.floor(Math.random() * 300) + 500,
          monthsSinceOrigination,
          borrowerProfile: {
            age: Math.floor(Math.random() * 40) + 25,
            income: Math.floor(Math.random() * 100000) + 40000,
            dti: Math.random() * 50 + 10,
            ltv: Math.random() * 30 + 60,
            race: ['White', 'Black', 'Hispanic', 'Asian', 'Other'][Math.floor(Math.random() * 5)],
            gender: ['Male', 'Female'][Math.floor(Math.random() * 2)],
          }
        });
      }
    });
    
    return loans;
  };

  const generateCohortAnalysis = (loans: any[]) => {
    const cohorts = new Map<string, any>();
    
    loans.forEach(loan => {
      const cohortKey = format(loan.originationDate, 'yyyy-MM');
      
      if (!cohorts.has(cohortKey)) {
        cohorts.set(cohortKey, {
          cohortMonth: cohortKey,
          loansOriginated: 0,
          originalBalance: 0,
          performance: new Map(),
        });
      }
      
      const cohort = cohorts.get(cohortKey);
      cohort.loansOriginated++;
      cohort.originalBalance += loan.loanParameters.principal;
      
      // Track performance by age
      const ageInMonths = loan.monthsSinceOrigination;
      if (!cohort.performance.has(ageInMonths)) {
        cohort.performance.set(ageInMonths, {
          currentLoans: 0,
          chargedOffLoans: 0,
          paidOffLoans: 0,
          currentBalance: 0,
        });
      }
      
      const perf = cohort.performance.get(ageInMonths);
      if (loan.status === 'CHARGED_OFF') {
        perf.chargedOffLoans++;
      } else if (loan.status === 'PAID_OFF') {
        perf.paidOffLoans++;
      } else {
        perf.currentLoans++;
        perf.currentBalance += loan.currentBalance;
      }
    });
    
    const cohortArray: CohortData[] = Array.from(cohorts.values()).map(cohort => {
      const getPerformanceAtMonth = (month: number) => {
        const perf = cohort.performance.get(month);
        return perf ? (perf.currentLoans / cohort.loansOriginated) * 100 : 100;
      };
      
      const chargedOffCount = Array.from(cohort.performance.values())
        .reduce((sum, perf) => sum + perf.chargedOffLoans, 0);
      
      return {
        cohortMonth: cohort.cohortMonth,
        loansOriginated: cohort.loansOriginated,
        month0: 100,
        month1: getPerformanceAtMonth(1),
        month3: getPerformanceAtMonth(3),
        month6: getPerformanceAtMonth(6),
        month12: getPerformanceAtMonth(12),
        month24: getPerformanceAtMonth(24),
        month36: getPerformanceAtMonth(36),
        cumulativeChargeOffRate: (chargedOffCount / cohort.loansOriginated) * 100,
        currentBalance: Array.from(cohort.performance.values())
          .reduce((sum, perf) => sum + perf.currentBalance, 0),
        originalBalance: cohort.originalBalance,
      };
    }).sort((a, b) => a.cohortMonth.localeCompare(b.cohortMonth));
    
    setCohortData(cohortArray);
  };

  const generateVintageCurves = (loans: any[]) => {
    const vintages = new Map<string, any[]>();
    
    loans.forEach(loan => {
      const vintageKey = format(loan.originationDate, 'yyyy-MM');
      if (!vintages.has(vintageKey)) {
        vintages.set(vintageKey, []);
      }
      vintages.get(vintageKey)!.push(loan);
    });
    
    const vintageArray: VintageCurveData[] = [];
    
    vintages.forEach((vintageLoans, vintage) => {
      for (let age = 0; age <= 36; age++) {
        const loansAtAge = vintageLoans.filter(loan => loan.monthsSinceOrigination >= age);
        const chargedOffLoans = loansAtAge.filter(loan => loan.status === 'CHARGED_OFF').length;
        const paidOffLoans = loansAtAge.filter(loan => loan.status === 'PAID_OFF').length;
        const delinquentLoans = loansAtAge.filter(loan => loan.status === 'DELINQUENT').length;
        const currentBalance = loansAtAge.reduce((sum, loan) => sum + loan.currentBalance, 0);
        
        vintageArray.push({
          vintage,
          age,
          cumulativeChargeOffRate: (chargedOffLoans / vintageLoans.length) * 100,
          cumulativePayoffRate: (paidOffLoans / vintageLoans.length) * 100,
          delinquencyRate: loansAtAge.length > 0 ? (delinquentLoans / loansAtAge.length) * 100 : 0,
          currentBalance,
        });
      }
    });
    
    setVintageData(vintageArray);
  };

  const generateStressTestScenarios = () => {
    const scenarios: StressTestScenario[] = [
      {
        name: 'Baseline Scenario',
        description: 'Current economic conditions continue',
        parameters: {
          unemploymentRate: 3.8,
          gdpGrowth: 2.1,
          interestRateChange: 0,
          housingPriceChange: 3.5,
        },
        results: {
          projectedChargeOffRate: 2.8,
          portfolioValueAtRisk: 125000000,
          expectedLoss: 8750000,
          liquidityImpact: 0.05,
        },
      },
      {
        name: 'Mild Recession',
        description: 'Economic slowdown with rising unemployment',
        parameters: {
          unemploymentRate: 6.5,
          gdpGrowth: -0.5,
          interestRateChange: -1.0,
          housingPriceChange: -2.0,
        },
        results: {
          projectedChargeOffRate: 4.2,
          portfolioValueAtRisk: 187500000,
          expectedLoss: 13125000,
          liquidityImpact: 0.08,
        },
      },
      {
        name: 'Severe Recession',
        description: 'Deep economic contraction similar to 2008',
        parameters: {
          unemploymentRate: 10.2,
          gdpGrowth: -3.8,
          interestRateChange: -2.5,
          housingPriceChange: -15.0,
        },
        results: {
          projectedChargeOffRate: 8.5,
          portfolioValueAtRisk: 318750000,
          expectedLoss: 26250000,
          liquidityImpact: 0.15,
        },
      },
      {
        name: 'Interest Rate Shock',
        description: 'Rapid interest rate increases',
        parameters: {
          unemploymentRate: 4.5,
          gdpGrowth: 1.2,
          interestRateChange: 3.5,
          housingPriceChange: -8.0,
        },
        results: {
          projectedChargeOffRate: 5.8,
          portfolioValueAtRisk: 218750000,
          expectedLoss: 17500000,
          liquidityImpact: 0.12,
        },
      },
    ];
    
    setStressTestResults(scenarios);
  };

  const generateCustomKPIs = (loans: any[]) => {
    const totalLoans = loans.length;
    const totalBalance = loans.reduce((sum, loan) => sum + loan.currentBalance, 0);
    const delinquentLoans = loans.filter(loan => loan.status === 'DELINQUENT').length;
    const chargedOffLoans = loans.filter(loan => loan.status === 'CHARGED_OFF').length;
    
    const kpis: CustomKPI[] = [
      {
        id: 'portfolio-yield',
        name: 'Portfolio Yield',
        formula: 'Weighted Average Interest Rate',
        category: 'FINANCIAL',
        value: 4.85,
        target: 5.2,
        trend: 'DOWN',
        trendPercent: -2.1,
        description: 'Weighted average interest rate across active loans',
      },
      {
        id: 'charge-off-rate',
        name: 'Annualized Charge-Off Rate',
        formula: '(Charge-offs / Average Balance) * 12',
        category: 'RISK',
        value: (chargedOffLoans / totalLoans) * 100,
        target: 2.5,
        trend: 'UP',
        trendPercent: 0.8,
        description: 'Annualized rate of loan charge-offs',
      },
      {
        id: 'collection-efficiency',
        name: 'Collection Efficiency',
        formula: 'Collections / Scheduled Payments',
        category: 'OPERATIONAL',
        value: 96.2,
        target: 95.0,
        trend: 'UP',
        trendPercent: 1.5,
        description: 'Percentage of scheduled payments collected',
      },
      {
        id: 'early-stage-delinquency',
        name: 'Early Stage Delinquency',
        formula: '30-59 Day Delinquent / Total Loans',
        category: 'RISK',
        value: (delinquentLoans / totalLoans) * 100,
        target: 8.0,
        trend: 'FLAT',
        trendPercent: 0.1,
        description: 'Percentage of loans in early stage delinquency',
      },
      {
        id: 'origination-yield',
        name: 'New Origination Yield',
        formula: 'Weighted Rate on New Loans',
        category: 'PERFORMANCE',
        value: 5.45,
        target: 5.8,
        trend: 'UP',
        trendPercent: 3.2,
        description: 'Weighted average rate on loans originated this month',
      },
      {
        id: 'cost-per-loan',
        name: 'Cost Per Loan Serviced',
        formula: 'Operating Expenses / Total Loans',
        category: 'OPERATIONAL',
        value: 125.80,
        target: 150.00,
        trend: 'DOWN',
        trendPercent: -8.5,
        description: 'Average monthly cost to service each loan',
      },
    ];
    
    setCustomKPIs(kpis);
  };

  const exportAnalytics = (format: 'PDF' | 'EXCEL' | 'CSV') => {
    console.log(`Exporting ${format} analytics report:`, {
      cohortData,
      vintageData,
      stressTestResults,
      customKPIs,
    });
    alert(`${format} analytics report would be generated and downloaded`);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number, decimals = 1) => {
    return `${value.toFixed(decimals)}%`;
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <PresentationChartLineIcon className="animate-pulse h-12 w-12 text-gray-400 mx-auto" />
        <p className="mt-2 text-sm text-gray-500">Loading business intelligence dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Business Intelligence Dashboard</h2>
          <p className="mt-1 text-sm text-gray-600">
            Advanced analytics, cohort analysis, and risk assessment
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => exportAnalytics('EXCEL')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* View Selector */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'COHORT', label: 'Cohort Analysis', icon: TableCellsIcon },
            { key: 'VINTAGE', label: 'Vintage Curves', icon: PresentationChartLineIcon },
            { key: 'STRESS', label: 'Stress Testing', icon: BeakerIcon },
            { key: 'KPI', label: 'Custom KPIs', icon: AdjustmentsHorizontalIcon },
            { key: 'FAIR_LENDING', label: 'Fair Lending', icon: ShieldCheckIcon },
          ].map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveView(tab.key as any)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                  activeView === tab.key
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

      {/* Cohort Analysis View */}
      {activeView === 'COHORT' && (
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Loan Cohort Performance</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cohort Month
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Loans Originated
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Month 0
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Month 1
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Month 6
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Month 12
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Month 24
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Charge-Off Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current Balance
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {cohortData.map((cohort, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {cohort.cohortMonth}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {cohort.loansOriginated.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatPercentage(cohort.month0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatPercentage(cohort.month1)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatPercentage(cohort.month6)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatPercentage(cohort.month12)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatPercentage(cohort.month24)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                        {formatPercentage(cohort.cumulativeChargeOffRate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(cohort.currentBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Cohort Insights</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-sm text-gray-600">Best Performing Cohort</span>
                  <span className="text-sm font-medium text-green-600">2023-01 (1.2% charge-off)</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-sm text-gray-600">Worst Performing Cohort</span>
                  <span className="text-sm font-medium text-red-600">2021-07 (4.8% charge-off)</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-sm text-gray-600">Average 12-Month Retention</span>
                  <span className="text-sm font-medium">87.3%</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600">Mature Cohort Avg Performance</span>
                  <span className="text-sm font-medium">3.2% charge-off rate</span>
                </div>
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Performance Trends</h4>
              <div className="text-center py-8 text-gray-500">
                <PresentationChartLineIcon className="h-12 w-12 mx-auto mb-2" />
                <p>Cohort performance visualization</p>
                <p className="text-xs">Interactive chart showing retention curves by cohort</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vintage Curves View */}
      {activeView === 'VINTAGE' && (
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Vintage Performance Curves</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="text-center py-12 text-gray-500">
                <PresentationChartLineIcon className="h-16 w-16 mx-auto mb-4" />
                <p className="text-lg font-medium">Charge-Off Rate by Vintage</p>
                <p className="text-sm">Cumulative charge-off rates over loan age</p>
              </div>
              <div className="text-center py-12 text-gray-500">
                <ChartBarIcon className="h-16 w-16 mx-auto mb-4" />
                <p className="text-lg font-medium">Payoff Rate by Vintage</p>
                <p className="text-sm">Early payoff trends by origination period</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Vintage Summary</h4>
              <div className="space-y-2">
                {['2024-01', '2023-07', '2023-01', '2022-07'].map((vintage, index) => (
                  <div key={vintage} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{vintage}</span>
                    <span className={`font-medium ${
                      index < 2 ? 'text-green-600' : 'text-yellow-600'
                    }`}>
                      {(1.2 + index * 0.8).toFixed(1)}% loss rate
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Risk Indicators</h4>
              <div className="space-y-3">
                <div className="flex items-center">
                  <ArrowTrendingUpIcon className="h-5 w-5 text-red-500 mr-2" />
                  <span className="text-sm text-gray-600">Late-stage vintage deterioration</span>
                </div>
                <div className="flex items-center">
                  <ClockIcon className="h-5 w-5 text-yellow-500 mr-2" />
                  <span className="text-sm text-gray-600">Seasonal performance patterns</span>
                </div>
                <div className="flex items-center">
                  <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                  <span className="text-sm text-gray-600">Recent vintages outperforming</span>
                </div>
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Vintage Metrics</h4>
              <div className="space-y-2">
                <div className="text-center p-3 bg-gray-50 rounded">
                  <div className="text-xl font-bold text-gray-900">24.8%</div>
                  <div className="text-xs text-gray-600">Avg Early Payoff Rate</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded">
                  <div className="text-xl font-bold text-gray-900">2.7%</div>
                  <div className="text-xs text-gray-600">Weighted Loss Rate</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stress Testing View */}
      {activeView === 'STRESS' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Stress Test Scenarios</h3>
              <div className="space-y-3">
                {stressTestResults.map((scenario, index) => (
                  <div
                    key={index}
                    onClick={() => setSelectedStressTest(scenario.name)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedStressTest === scenario.name
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">{scenario.name}</h4>
                        <p className="text-xs text-gray-500 mt-1">{scenario.description}</p>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${
                          index === 0 ? 'text-green-600' : 
                          index === 1 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {formatPercentage(scenario.results.projectedChargeOffRate)}
                        </div>
                        <div className="text-xs text-gray-500">Charge-off Rate</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {selectedStressTest || 'Select Scenario'}
              </h3>
              {selectedStressTest && (
                <div className="space-y-4">
                  {(() => {
                    const scenario = stressTestResults.find(s => s.name === selectedStressTest)!;
                    return (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center p-3 bg-gray-50 rounded">
                            <div className="text-sm text-gray-600">Unemployment Rate</div>
                            <div className="text-lg font-bold">{formatPercentage(scenario.parameters.unemploymentRate)}</div>
                          </div>
                          <div className="text-center p-3 bg-gray-50 rounded">
                            <div className="text-sm text-gray-600">GDP Growth</div>
                            <div className="text-lg font-bold">{formatPercentage(scenario.parameters.gdpGrowth)}</div>
                          </div>
                          <div className="text-center p-3 bg-gray-50 rounded">
                            <div className="text-sm text-gray-600">Interest Rate Δ</div>
                            <div className="text-lg font-bold">{formatPercentage(scenario.parameters.interestRateChange)}</div>
                          </div>
                          <div className="text-center p-3 bg-gray-50 rounded">
                            <div className="text-sm text-gray-600">Housing Price Δ</div>
                            <div className="text-lg font-bold">{formatPercentage(scenario.parameters.housingPriceChange)}</div>
                          </div>
                        </div>

                        <div className="border-t pt-4">
                          <h4 className="font-medium text-gray-900 mb-3">Impact Results</h4>
                          <div className="space-y-3">
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Portfolio Value at Risk</span>
                              <span className="font-medium">{formatCurrency(scenario.results.portfolioValueAtRisk)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Expected Loss</span>
                              <span className="font-medium text-red-600">{formatCurrency(scenario.results.expectedLoss)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Liquidity Impact</span>
                              <span className="font-medium">{formatPercentage(scenario.results.liquidityImpact * 100)}</span>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Stress Test Comparison</h3>
            <div className="text-center py-8 text-gray-500">
              <ChartBarIcon className="h-12 w-12 mx-auto mb-2" />
              <p>Comparative visualization of stress test results</p>
              <p className="text-xs">Expected loss and portfolio impact across scenarios</p>
            </div>
          </div>
        </div>
      )}

      {/* Custom KPIs View */}
      {activeView === 'KPI' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {customKPIs.map((kpi) => (
              <div key={kpi.id} className="bg-white shadow rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-900">{kpi.name}</h4>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    kpi.category === 'PERFORMANCE' ? 'bg-blue-100 text-blue-800' :
                    kpi.category === 'RISK' ? 'bg-red-100 text-red-800' :
                    kpi.category === 'FINANCIAL' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {kpi.category}
                  </span>
                </div>
                
                <div className="flex items-center justify-between mb-2">
                  <div className="text-2xl font-bold text-gray-900">
                    {kpi.category === 'FINANCIAL' ? formatPercentage(kpi.value) :
                     kpi.name.includes('Rate') ? formatPercentage(kpi.value) :
                     kpi.name.includes('Cost') ? formatCurrency(kpi.value) :
                     kpi.value.toFixed(1)}
                  </div>
                  <div className={`flex items-center text-sm ${
                    kpi.trend === 'UP' ? 
                      (kpi.name.includes('Cost') || kpi.name.includes('Charge') || kpi.name.includes('Delinquency') ? 'text-red-600' : 'text-green-600') :
                    kpi.trend === 'DOWN' ?
                      (kpi.name.includes('Cost') || kpi.name.includes('Charge') || kpi.name.includes('Delinquency') ? 'text-green-600' : 'text-red-600') :
                    'text-gray-500'
                  }`}>
                    {kpi.trend === 'UP' ? <ArrowTrendingUpIcon className="h-4 w-4 mr-1" /> :
                     kpi.trend === 'DOWN' ? <ArrowTrendingDownIcon className="h-4 w-4 mr-1" /> :
                     <ClockIcon className="h-4 w-4 mr-1" />}
                    {Math.abs(kpi.trendPercent).toFixed(1)}%
                  </div>
                </div>
                
                {kpi.target && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Target: {kpi.category === 'FINANCIAL' ? formatPercentage(kpi.target) :
                                   kpi.name.includes('Rate') ? formatPercentage(kpi.target) :
                                   kpi.name.includes('Cost') ? formatCurrency(kpi.target) :
                                   kpi.target.toFixed(1)}</span>
                      <span>{((kpi.value / kpi.target) * 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          kpi.value >= kpi.target ? 'bg-green-500' : 'bg-yellow-500'
                        }`}
                        style={{ width: `${Math.min((kpi.value / kpi.target) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
                
                <p className="text-xs text-gray-500 mb-2">{kpi.description}</p>
                <p className="text-xs text-gray-400 font-mono">{kpi.formula}</p>
              </div>
            ))}
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">KPI Builder</h3>
              <button className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                <CalculatorIcon className="h-4 w-4 mr-2" />
                Create Custom KPI
              </button>
            </div>
            <div className="text-center py-8 text-gray-500">
              <CogIcon className="h-12 w-12 mx-auto mb-2" />
              <p>Build custom KPIs with formula builder</p>
              <p className="text-xs">Drag and drop metrics to create custom calculations</p>
            </div>
          </div>
        </div>
      )}

      {/* Fair Lending View */}
      {activeView === 'FAIR_LENDING' && (
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Fair Lending Analytics</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">Approval Rates by Demographics</h4>
                <div className="space-y-3">
                  {[
                    { group: 'White', rate: 78.5, applications: 1250 },
                    { group: 'Black', rate: 72.1, applications: 340 },
                    { group: 'Hispanic', rate: 74.8, applications: 410 },
                    { group: 'Asian', rate: 81.2, applications: 285 },
                    { group: 'Other', rate: 76.3, applications: 125 },
                  ].map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className="text-sm text-gray-700 w-20">{item.group}</span>
                        <div className="w-32 bg-gray-200 rounded-full h-2 ml-3">
                          <div 
                            className="bg-blue-500 h-2 rounded-full" 
                            style={{ width: `${item.rate}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{item.rate.toFixed(1)}%</div>
                        <div className="text-xs text-gray-500">{item.applications} apps</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">Pricing Disparity Analysis</h4>
                <div className="space-y-3">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center">
                      <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                      <span className="text-sm font-medium text-green-800">No significant pricing disparities detected</span>
                    </div>
                    <p className="text-xs text-green-700 mt-1">Rate differences within acceptable variance</p>
                  </div>

                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center">
                      <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 mr-2" />
                      <span className="text-sm font-medium text-yellow-800">Monitor: DTI variance by demographics</span>
                    </div>
                    <p className="text-xs text-yellow-700 mt-1">Slight variance in debt-to-income ratios requires monitoring</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="text-center p-3 bg-gray-50 rounded">
                      <div className="text-lg font-bold text-gray-900">2.3bp</div>
                      <div className="text-xs text-gray-600">Max Rate Spread</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded">
                      <div className="text-lg font-bold text-gray-900">95.2%</div>
                      <div className="text-xs text-gray-600">Compliance Score</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">HMDA Readiness</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Data Completeness</span>
                  <span className="text-sm font-medium text-green-600">98.7%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Quality Score</span>
                  <span className="text-sm font-medium text-green-600">96.1%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Missing Fields</span>
                  <span className="text-sm font-medium text-red-600">23</span>
                </div>
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Risk Indicators</h4>
              <div className="space-y-2">
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-3" />
                  <span className="text-sm text-gray-600">Approval rate parity</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-yellow-500 mr-3" />
                  <span className="text-sm text-gray-600">Rate spread monitoring</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-3" />
                  <span className="text-sm text-gray-600">Geographic distribution</span>
                </div>
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Reporting Status</h4>
              <div className="space-y-2">
                <div className="text-center p-3 bg-green-50 rounded">
                  <div className="text-sm font-medium text-green-800">HMDA LAR Ready</div>
                  <div className="text-xs text-green-600">Next submission: Mar 1</div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded">
                  <div className="text-sm font-medium text-blue-800">CRA Assessment</div>
                  <div className="text-xs text-blue-600">Quarterly review due</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};