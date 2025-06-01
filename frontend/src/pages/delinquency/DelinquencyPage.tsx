import React, { useState, useEffect } from 'react';
import {
  ExclamationTriangleIcon,
  ClockIcon,
  PhoneIcon,
  EnvelopeIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  UserIcon,
  BellIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  FunnelIcon,
  CogIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { format, differenceInDays, addDays, subDays } from 'date-fns';

interface DelinquencyAccount {
  id: string;
  loanId: string;
  borrowerName: string;
  currentBalance: number;
  pastDueAmount: number;
  daysPastDue: number;
  bucket: '0-30' | '31-60' | '61-90' | '91-120' | '120+';
  severity: 'CURRENT' | 'EARLY' | 'MODERATE' | 'SEVERE' | 'CRITICAL';
  lastPaymentDate?: Date;
  nextActionDate: Date;
  lastContactDate?: Date;
  contactAttempts: number;
  assignedAgent: string;
  workflowStage: string;
  riskScore: number;
}

interface BucketSummary {
  bucket: string;
  count: number;
  totalAmount: number;
  percentage: number;
}

export const DelinquencyPage: React.FC = () => {
  const [accounts, setAccounts] = useState<DelinquencyAccount[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'accounts' | 'workflows' | 'analytics'>('dashboard');

  // Demo data
  useEffect(() => {
    const demoAccounts: DelinquencyAccount[] = [
      {
        id: '1',
        loanId: 'L001',
        borrowerName: 'John Smith',
        currentBalance: 250000,
        pastDueAmount: 5250,
        daysPastDue: 45,
        bucket: '31-60',
        severity: 'MODERATE',
        lastPaymentDate: subDays(new Date(), 75),
        nextActionDate: addDays(new Date(), 1),
        lastContactDate: subDays(new Date(), 5),
        contactAttempts: 3,
        assignedAgent: 'Agent Johnson',
        workflowStage: 'Phone Contact',
        riskScore: 75
      },
      {
        id: '2',
        loanId: 'L002',
        borrowerName: 'Sarah Davis',
        currentBalance: 180000,
        pastDueAmount: 18500,
        daysPastDue: 95,
        bucket: '91-120',
        severity: 'SEVERE',
        lastPaymentDate: subDays(new Date(), 125),
        nextActionDate: new Date(),
        lastContactDate: subDays(new Date(), 2),
        contactAttempts: 8,
        assignedAgent: 'Agent Williams',
        workflowStage: 'Legal Review',
        riskScore: 45
      },
      {
        id: '3',
        loanId: 'L003',
        borrowerName: 'Mike Johnson',
        currentBalance: 320000,
        pastDueAmount: 7800,
        daysPastDue: 25,
        bucket: '0-30',
        severity: 'EARLY',
        lastPaymentDate: subDays(new Date(), 55),
        nextActionDate: addDays(new Date(), 3),
        lastContactDate: subDays(new Date(), 1),
        contactAttempts: 1,
        assignedAgent: 'Agent Brown',
        workflowStage: 'Initial Notice',
        riskScore: 85
      }
    ];
    setAccounts(demoAccounts);
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'text-red-700 bg-red-100';
      case 'SEVERE': return 'text-red-600 bg-red-50';
      case 'MODERATE': return 'text-yellow-600 bg-yellow-50';
      case 'EARLY': return 'text-orange-600 bg-orange-50';
      case 'CURRENT': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getBucketColor = (bucket: string) => {
    switch (bucket) {
      case '0-30': return 'text-yellow-600 bg-yellow-50';
      case '31-60': return 'text-orange-600 bg-orange-50';
      case '61-90': return 'text-red-600 bg-red-50';
      case '91-120': return 'text-red-700 bg-red-100';
      case '120+': return 'text-red-800 bg-red-200';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getBucketSummary = (): BucketSummary[] => {
    const buckets = ['0-30', '31-60', '61-90', '91-120', '120+'];
    const totalAmount = accounts.reduce((sum, acc) => sum + acc.pastDueAmount, 0);
    
    return buckets.map(bucket => {
      const bucketAccounts = accounts.filter(acc => acc.bucket === bucket);
      const amount = bucketAccounts.reduce((sum, acc) => sum + acc.pastDueAmount, 0);
      return {
        bucket,
        count: bucketAccounts.length,
        totalAmount: amount,
        percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0
      };
    });
  };

  const filteredAccounts = selectedBucket === 'all' 
    ? accounts 
    : accounts.filter(acc => acc.bucket === selectedBucket);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Delinquency Management</h1>
        <p className="mt-2 text-sm text-gray-700">
          Monitor and manage delinquent accounts, bucket progression, and automated workflows.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {[
            { key: 'dashboard', name: 'Dashboard', icon: ChartBarIcon },
            { key: 'accounts', name: 'Accounts', icon: ExclamationTriangleIcon },
            { key: 'workflows', name: 'Workflows', icon: CogIcon },
            { key: 'analytics', name: 'Analytics', icon: FunnelIcon },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`${
                activeTab === tab.key
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
            >
              <tab.icon className="h-5 w-5" />
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ExclamationTriangleIcon className="h-6 w-6 text-red-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Delinquent
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {formatCurrency(accounts.reduce((sum, acc) => sum + acc.pastDueAmount, 0))}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <UserIcon className="h-6 w-6 text-orange-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Delinquent Accounts
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {accounts.length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ClockIcon className="h-6 w-6 text-yellow-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Avg Days Past Due
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {Math.round(accounts.reduce((sum, acc) => sum + acc.daysPastDue, 0) / accounts.length)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <CheckCircleIcon className="h-6 w-6 text-green-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Recovery Rate
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        72.3%
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bucket Summary */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Delinquency Buckets
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {getBucketSummary().map((bucket) => (
                  <div key={bucket.bucket} className="border rounded-lg p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{bucket.count}</div>
                      <div className="text-sm text-gray-500">{bucket.bucket} days</div>
                      <div className="text-lg font-medium text-gray-900 mt-2">
                        {formatCurrency(bucket.totalAmount)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {bucket.percentage.toFixed(1)}% of total
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Priority Actions */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Priority Actions Required
              </h3>
              <div className="space-y-4">
                {accounts.filter(acc => acc.nextActionDate <= new Date()).map((account) => (
                  <div key={account.id} className="border-l-4 border-red-400 bg-red-50 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">{account.borrowerName}</h4>
                          <p className="text-sm text-gray-500">Loan #{account.loanId} • {account.workflowStage}</p>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(account.severity)}`}>
                          {account.severity}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">{formatCurrency(account.pastDueAmount)}</p>
                        <p className="text-sm text-gray-500">{account.daysPastDue} days overdue</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Accounts Tab */}
      {activeTab === 'accounts' && (
        <div className="space-y-6">
          {/* Bucket Filter */}
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">Filter by Bucket:</label>
              <select
                value={selectedBucket}
                onChange={(e) => setSelectedBucket(e.target.value)}
                className="block w-40 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="all">All Buckets</option>
                <option value="0-30">0-30 Days</option>
                <option value="31-60">31-60 Days</option>
                <option value="61-90">61-90 Days</option>
                <option value="91-120">91-120 Days</option>
                <option value="120+">120+ Days</option>
              </select>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Delinquent Accounts ({filteredAccounts.length})
              </h3>
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Borrower
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Past Due Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Days Past Due
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Bucket
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Severity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contact Attempts
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Next Action
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Risk Score
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredAccounts.map((account) => (
                      <tr key={account.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{account.borrowerName}</div>
                            <div className="text-sm text-gray-500">Loan #{account.loanId}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(account.pastDueAmount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {account.daysPastDue}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBucketColor(account.bucket)}`}>
                            {account.bucket}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(account.severity)}`}>
                            {account.severity}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {account.contactAttempts}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {format(account.nextActionDate, 'MMM dd, yyyy')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                              <div 
                                className={`h-2 rounded-full ${account.riskScore >= 80 ? 'bg-green-500' : account.riskScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                style={{ width: `${account.riskScore}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-600">{account.riskScore}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Workflows Tab */}
      {activeTab === 'workflows' && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Delinquency Workflows
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Automated workflows for different delinquency stages and bucket progression.
            </p>
            
            <div className="space-y-6">
              <div className="border rounded-lg p-4">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Early Stage (0-30 days)</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border rounded p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <BellIcon className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">Day 5: Initial Notice</span>
                    </div>
                    <p className="text-xs text-gray-500">Automated email notification</p>
                  </div>
                  <div className="border rounded p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <PhoneIcon className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium">Day 15: Phone Contact</span>
                    </div>
                    <p className="text-xs text-gray-500">Agent outreach call</p>
                  </div>
                  <div className="border rounded p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <DocumentTextIcon className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium">Day 25: Formal Notice</span>
                    </div>
                    <p className="text-xs text-gray-500">Written notice sent</p>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Escalated Stage (60+ days)</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="border rounded p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium">Immediate: Escalation</span>
                    </div>
                    <p className="text-xs text-gray-500">Move to collections queue</p>
                  </div>
                  <div className="border rounded p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <PhoneIcon className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium">Day 65: Intensive Contact</span>
                    </div>
                    <p className="text-xs text-gray-500">Multiple contact attempts</p>
                  </div>
                  <div className="border rounded p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <ShieldCheckIcon className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium">Day 75: Legal Review</span>
                    </div>
                    <p className="text-xs text-gray-500">Case evaluation</p>
                  </div>
                  <div className="border rounded p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <DocumentTextIcon className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium">Day 90: Legal Action</span>
                    </div>
                    <p className="text-xs text-gray-500">Initiate legal proceedings</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Bucket Progression Trends</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Roll Forward Rate (30-60 days)</span>
                  <span className="text-sm font-medium text-red-600">12.5%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Roll Forward Rate (60-90 days)</span>
                  <span className="text-sm font-medium text-red-600">18.3%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Roll Forward Rate (90+ days)</span>
                  <span className="text-sm font-medium text-red-600">25.1%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Cure Rate (Current Month)</span>
                  <span className="text-sm font-medium text-green-600">65.7%</span>
                </div>
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Contact Effectiveness</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Phone Contact Success Rate</span>
                  <span className="text-sm font-medium text-blue-600">42.3%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Email Response Rate</span>
                  <span className="text-sm font-medium text-blue-600">28.7%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Letter Response Rate</span>
                  <span className="text-sm font-medium text-blue-600">15.2%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Payment After Contact</span>
                  <span className="text-sm font-medium text-green-600">34.1%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Risk Factors Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">High Risk Indicators</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Multiple missed payments</li>
                  <li>• No contact response for 30+ days</li>
                  <li>• Payment amount reduction requests</li>
                  <li>• Employment status changes</li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Recovery Predictors</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Previous payment history</li>
                  <li>• Quick response to contact</li>
                  <li>• Proactive communication</li>
                  <li>• Payment arrangement setup</li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Early Warning Signs</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Partial payments</li>
                  <li>• Late payment patterns</li>
                  <li>• Contact preference changes</li>
                  <li>• Economic stress indicators</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};