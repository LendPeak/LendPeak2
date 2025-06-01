import { useState } from 'react';
import { format } from 'date-fns';
import {
  DocumentTextIcon,
  ArrowDownTrayIcon,
  CalendarIcon,
  ChartBarIcon,
  BanknotesIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentCheckIcon,
  CurrencyDollarIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';
import { DEMO_LOANS, DEMO_CUSTOMERS } from '../../demo/demoData';
import { LoanEngine, toBig } from '@lendpeak/engine';
import DatePicker from 'react-datepicker';

interface ReportType {
  id: string;
  name: string;
  description: string;
  icon: any;
  category: 'financial' | 'compliance' | 'operational' | 'customer';
  available: boolean;
}

const reportTypes: ReportType[] = [
  {
    id: 'portfolio-summary',
    name: 'Portfolio Summary',
    description: 'Overview of all loans including balances, statuses, and performance metrics',
    icon: ChartBarIcon,
    category: 'financial',
    available: true,
  },
  {
    id: 'delinquency-report',
    name: 'Delinquency Report',
    description: 'Loans past due by 30, 60, 90+ days with aging analysis',
    icon: ExclamationTriangleIcon,
    category: 'operational',
    available: true,
  },
  {
    id: 'payment-history',
    name: 'Payment History Report',
    description: 'Detailed payment records for specified date range',
    icon: BanknotesIcon,
    category: 'financial',
    available: true,
  },
  {
    id: 'interest-income',
    name: 'Interest Income Report',
    description: 'Interest earned breakdown by loan and time period',
    icon: CurrencyDollarIcon,
    category: 'financial',
    available: true,
  },
  {
    id: 'compliance-summary',
    name: 'Compliance Summary',
    description: 'Regulatory compliance status and required disclosures',
    icon: ClipboardDocumentCheckIcon,
    category: 'compliance',
    available: true,
  },
  {
    id: 'customer-demographics',
    name: 'Customer Demographics',
    description: 'Borrower demographics and geographic distribution',
    icon: UserGroupIcon,
    category: 'customer',
    available: true,
  },
  {
    id: 'modification-report',
    name: 'Loan Modifications',
    description: 'Summary of all loan modifications and restructurings',
    icon: DocumentTextIcon,
    category: 'operational',
    available: true,
  },
  {
    id: 'regulatory-filing',
    name: 'Regulatory Filing Reports',
    description: 'HMDA, Call Report, and other regulatory submissions',
    icon: ClipboardDocumentCheckIcon,
    category: 'compliance',
    available: false,
  },
];

export const ReportsPage = () => {
  const [startDate, setStartDate] = useState(new Date(new Date().setMonth(new Date().getMonth() - 1)));
  const [endDate, setEndDate] = useState(new Date());
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<any>(null);

  const generateReport = async (reportId: string) => {
    setIsGenerating(true);
    
    // Simulate report generation
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Generate mock report data based on type
    const reportData: any = {
      id: reportId,
      generatedAt: new Date(),
      dateRange: {
        start: format(startDate, 'yyyy-MM-dd'),
        end: format(endDate, 'yyyy-MM-dd'),
      },
      data: {},
    };

    switch (reportId) {
      case 'portfolio-summary':
        const totalLoans = DEMO_LOANS.length;
        const activeLoans = DEMO_LOANS.filter(l => l.status === 'ACTIVE').length;
        const totalPrincipal = DEMO_LOANS.reduce((sum, loan) => sum + loan.loanParameters.principal, 0);
        const avgRate = DEMO_LOANS.reduce((sum, loan) => sum + loan.loanParameters.interestRate, 0) / totalLoans;
        
        reportData.data = {
          totalLoans,
          activeLoans,
          totalPrincipal,
          averageRate: avgRate,
          byStatus: {
            active: DEMO_LOANS.filter(l => l.status === 'ACTIVE').length,
            pending: DEMO_LOANS.filter(l => l.status === 'PENDING').length,
            paidOff: DEMO_LOANS.filter(l => l.status === 'PAID_OFF').length,
            defaulted: DEMO_LOANS.filter(l => l.status === 'DEFAULTED').length,
          },
          byPurpose: DEMO_LOANS.reduce((acc, loan) => {
            acc[loan.purpose] = (acc[loan.purpose] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
        };
        break;

      case 'delinquency-report':
        reportData.data = {
          current: DEMO_LOANS.filter(l => l.status === 'ACTIVE').length,
          days30: Math.floor(Math.random() * 5),
          days60: Math.floor(Math.random() * 3),
          days90Plus: Math.floor(Math.random() * 2),
          totalDelinquent: Math.floor(Math.random() * 10),
          delinquencyRate: (Math.random() * 5).toFixed(2),
        };
        break;

      case 'payment-history':
        reportData.data = {
          totalPayments: 156,
          totalAmount: 234567.89,
          onTimePayments: 145,
          latePayments: 11,
          averagePayment: 1503.65,
          paymentMethods: {
            ACH: 98,
            CHECK: 45,
            WIRE: 13,
          },
        };
        break;

      case 'interest-income':
        reportData.data = {
          totalInterest: 45678.90,
          byMonth: [
            { month: 'Jan', amount: 3456.78 },
            { month: 'Feb', amount: 3678.90 },
            { month: 'Mar', amount: 3890.12 },
            { month: 'Apr', amount: 4012.34 },
          ],
          projectedAnnual: 45678.90 * 12,
          averageYield: 5.25,
        };
        break;

      case 'compliance-summary':
        reportData.data = {
          disclosuresSent: 42,
          complianceChecks: 156,
          violations: 0,
          pendingActions: 3,
          lastAudit: '2024-01-15',
          nextAudit: '2024-04-15',
        };
        break;

      case 'customer-demographics':
        const customers = DEMO_CUSTOMERS;
        reportData.data = {
          totalCustomers: customers.length,
          averageAge: 35,
          stateDistribution: {
            'CA': 12,
            'TX': 8,
            'NY': 6,
            'FL': 5,
            'Other': 9,
          },
          creditScoreRanges: {
            'Excellent (750+)': 8,
            'Good (700-749)': 12,
            'Fair (650-699)': 15,
            'Poor (<650)': 5,
          },
        };
        break;

      case 'modification-report':
        reportData.data = {
          totalModifications: 15,
          byType: {
            'Rate Change': 6,
            'Term Extension': 4,
            'Payment Date Change': 3,
            'Forbearance': 2,
          },
          averageSavings: 125.50,
          successRate: 92.5,
        };
        break;
    }

    setGeneratedReport(reportData);
    setIsGenerating(false);
  };

  const exportReport = (format: 'csv' | 'pdf' | 'excel') => {
    // In a real app, this would generate the actual file
    alert(`Exporting report as ${format.toUpperCase()}`);
  };

  const categoryColors = {
    financial: 'bg-blue-100 text-blue-800',
    compliance: 'bg-purple-100 text-purple-800',
    operational: 'bg-green-100 text-green-800',
    customer: 'bg-orange-100 text-orange-800',
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
        <p className="mt-1 text-sm text-gray-500">
          Generate and export various reports for analysis and compliance
        </p>
      </div>

      {/* Date Range Selector */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <CalendarIcon className="h-5 w-5 text-gray-400" />
            <div>
              <label className="block text-sm font-medium text-gray-700">Date Range</label>
              <div className="mt-1 flex items-center space-x-2">
                <DatePicker
                  selected={startDate}
                  onChange={(date) => setStartDate(date || new Date())}
                  dateFormat="MM/dd/yyyy"
                  className="block rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  placeholderText="Start date"
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                  maxDate={endDate}
                />
                <span className="text-gray-500">to</span>
                <DatePicker
                  selected={endDate}
                  onChange={(date) => setEndDate(date || new Date())}
                  dateFormat="MM/dd/yyyy"
                  className="block rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  placeholderText="End date"
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                  minDate={startDate}
                  maxDate={new Date()}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => {
                const start = new Date();
                start.setDate(start.getDate() - 30);
                setStartDate(start);
                setEndDate(new Date());
              }}
              className="text-sm text-primary-600 hover:text-primary-500"
            >
              Last 30 days
            </button>
            <span className="text-gray-300">|</span>
            <button 
              onClick={() => {
                const now = new Date();
                const start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
                setStartDate(start);
                setEndDate(new Date());
              }}
              className="text-sm text-primary-600 hover:text-primary-500"
            >
              Last quarter
            </button>
            <span className="text-gray-300">|</span>
            <button 
              onClick={() => {
                setStartDate(new Date(new Date().getFullYear(), 0, 1));
                setEndDate(new Date());
              }}
              className="text-sm text-primary-600 hover:text-primary-500"
            >
              Year to date
            </button>
          </div>
        </div>
      </div>

      {/* Report Types Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {reportTypes.map((report) => {
          const Icon = report.icon;
          return (
            <div
              key={report.id}
              className={`bg-white shadow rounded-lg p-6 ${
                report.available ? 'hover:shadow-lg cursor-pointer' : 'opacity-60'
              }`}
              onClick={() => report.available && generateReport(report.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className={`p-2 rounded-lg ${categoryColors[report.category]}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{report.name}</h3>
                    <p className="mt-1 text-sm text-gray-500">{report.description}</p>
                    <span className={`mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${categoryColors[report.category]}`}>
                      {report.category}
                    </span>
                  </div>
                </div>
                {report.available ? (
                  <button className="text-primary-600 hover:text-primary-500">
                    <ArrowDownTrayIcon className="h-5 w-5" />
                  </button>
                ) : (
                  <span className="text-xs text-gray-500">Coming Soon</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Generated Report Preview */}
      {isGenerating && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-[70]">
          <div className="bg-white rounded-lg p-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-sm text-gray-600">Generating report...</p>
          </div>
        </div>
      )}

      {generatedReport && !isGenerating && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    {reportTypes.find(r => r.id === generatedReport.id)?.name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Generated on {format(generatedReport.generatedAt, 'MMM d, yyyy HH:mm')}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => exportReport('csv')}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                    CSV
                  </button>
                  <button
                    onClick={() => exportReport('excel')}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                    Excel
                  </button>
                  <button
                    onClick={() => exportReport('pdf')}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <PrinterIcon className="h-4 w-4 mr-2" />
                    PDF
                  </button>
                  <button
                    onClick={() => setGeneratedReport(null)}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6">
              {/* Report Content Based on Type */}
              {generatedReport.id === 'portfolio-summary' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <dt className="text-sm font-medium text-gray-500">Total Loans</dt>
                      <dd className="mt-1 text-2xl font-semibold text-gray-900">
                        {generatedReport.data.totalLoans}
                      </dd>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <dt className="text-sm font-medium text-gray-500">Active Loans</dt>
                      <dd className="mt-1 text-2xl font-semibold text-gray-900">
                        {generatedReport.data.activeLoans}
                      </dd>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <dt className="text-sm font-medium text-gray-500">Total Principal</dt>
                      <dd className="mt-1 text-2xl font-semibold text-gray-900">
                        {LoanEngine.formatCurrency(toBig(generatedReport.data.totalPrincipal))}
                      </dd>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <dt className="text-sm font-medium text-gray-500">Average Rate</dt>
                      <dd className="mt-1 text-2xl font-semibold text-gray-900">
                        {generatedReport.data.averageRate.toFixed(2)}%
                      </dd>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Loans by Status</h4>
                    <div className="space-y-2">
                      {Object.entries(generatedReport.data.byStatus).map(([status, count]: [string, any]) => (
                        <div key={status} className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 capitalize">{status}</span>
                          <span className="text-sm font-medium text-gray-900">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Loans by Purpose</h4>
                    <div className="space-y-2">
                      {Object.entries(generatedReport.data.byPurpose).map(([purpose, count]: [string, any]) => (
                        <div key={purpose} className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">{purpose}</span>
                          <span className="text-sm font-medium text-gray-900">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {generatedReport.id === 'delinquency-report' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="bg-green-50 rounded-lg p-4">
                      <dt className="text-sm font-medium text-green-700">Current</dt>
                      <dd className="mt-1 text-2xl font-semibold text-green-900">
                        {generatedReport.data.current}
                      </dd>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4">
                      <dt className="text-sm font-medium text-yellow-700">30 Days</dt>
                      <dd className="mt-1 text-2xl font-semibold text-yellow-900">
                        {generatedReport.data.days30}
                      </dd>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4">
                      <dt className="text-sm font-medium text-orange-700">60 Days</dt>
                      <dd className="mt-1 text-2xl font-semibold text-orange-900">
                        {generatedReport.data.days60}
                      </dd>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4">
                      <dt className="text-sm font-medium text-red-700">90+ Days</dt>
                      <dd className="mt-1 text-2xl font-semibold text-red-900">
                        {generatedReport.data.days90Plus}
                      </dd>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <dt className="text-sm font-medium text-gray-500">Total Delinquent</dt>
                      <dd className="mt-1 text-2xl font-semibold text-gray-900">
                        {generatedReport.data.totalDelinquent}
                      </dd>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <dt className="text-sm font-medium text-gray-500">Delinquency Rate</dt>
                      <dd className="mt-1 text-2xl font-semibold text-gray-900">
                        {generatedReport.data.delinquencyRate}%
                      </dd>
                    </div>
                  </div>
                </div>
              )}

              {/* Add more report type displays as needed */}
            </div>
          </div>
        </div>
      )}

      {/* Demo Notice */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Demo Reports</h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                These reports use simulated data for demonstration purposes. In production,
                reports would be generated from actual loan data with full export capabilities.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};