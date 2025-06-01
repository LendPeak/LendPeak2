import React, { useState, useEffect } from 'react';
import {
  ExclamationTriangleIcon,
  PhoneIcon,
  EnvelopeIcon,
  DocumentTextIcon,
  CalendarIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  UserIcon,
  BellIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  FunnelIcon,
  PlayIcon,
  PauseIcon,
  CogIcon,
  ShieldCheckIcon,
  BuildingLibraryIcon,
  ScaleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { format, addDays, differenceInDays, subDays } from 'date-fns';

interface CollectionsAccount {
  id: string;
  loanId: string;
  borrowerName: string;
  borrowerEmail: string;
  borrowerPhone: string;
  principalBalance: number;
  pastDueAmount: number;
  daysPastDue: number;
  delinquencyBucket: '30-59' | '60-89' | '90-119' | '120-179' | '180+';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'NEW' | 'IN_PROGRESS' | 'CONTACTED' | 'ARRANGED' | 'ESCALATED' | 'LEGAL' | 'CLOSED';
  assignedAgent: string;
  lastContactDate?: Date;
  nextActionDate: Date;
  currentWorkflowStep: number;
  workflowId: string;
  collectionsScore: number;
}

export const CollectionsPage: React.FC = () => {
  const [accounts, setAccounts] = useState<CollectionsAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<CollectionsAccount | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'accounts' | 'workflows' | 'compliance'>('dashboard');

  // Demo data
  useEffect(() => {
    const demoAccounts: CollectionsAccount[] = [
      {
        id: '1',
        loanId: 'L001',
        borrowerName: 'John Smith',
        borrowerEmail: 'john.smith@email.com',
        borrowerPhone: '(555) 123-4567',
        principalBalance: 250000,
        pastDueAmount: 12500,
        daysPastDue: 45,
        delinquencyBucket: '30-59',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        assignedAgent: 'Agent Johnson',
        lastContactDate: subDays(new Date(), 3),
        nextActionDate: addDays(new Date(), 2),
        currentWorkflowStep: 2,
        workflowId: 'WF001',
        collectionsScore: 75
      },
      {
        id: '2',
        loanId: 'L002',
        borrowerName: 'Sarah Davis',
        borrowerEmail: 'sarah.davis@email.com',
        borrowerPhone: '(555) 987-6543',
        principalBalance: 180000,
        pastDueAmount: 18500,
        daysPastDue: 95,
        delinquencyBucket: '90-119',
        priority: 'CRITICAL',
        status: 'ESCALATED',
        assignedAgent: 'Agent Williams',
        lastContactDate: subDays(new Date(), 1),
        nextActionDate: new Date(),
        currentWorkflowStep: 4,
        workflowId: 'WF002',
        collectionsScore: 45
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'text-red-600 bg-red-50';
      case 'HIGH': return 'text-orange-600 bg-orange-50';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50';
      case 'LOW': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NEW': return 'text-blue-600 bg-blue-50';
      case 'IN_PROGRESS': return 'text-yellow-600 bg-yellow-50';
      case 'CONTACTED': return 'text-indigo-600 bg-indigo-50';
      case 'ARRANGED': return 'text-green-600 bg-green-50';
      case 'ESCALATED': return 'text-red-600 bg-red-50';
      case 'LEGAL': return 'text-purple-600 bg-purple-50';
      case 'CLOSED': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Collections Management</h1>
        <p className="mt-2 text-sm text-gray-700">
          Manage collections workflows, automated sequences, and compliance tracking.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {[
            { key: 'dashboard', name: 'Dashboard', icon: ChartBarIcon },
            { key: 'accounts', name: 'Accounts', icon: ExclamationTriangleIcon },
            { key: 'workflows', name: 'Workflows', icon: CogIcon },
            { key: 'compliance', name: 'Compliance', icon: ShieldCheckIcon },
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
                        Active Accounts
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {accounts.filter(acc => acc.status !== 'CLOSED').length}
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
                        67.5%
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Priority Accounts */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Priority Accounts
              </h3>
              <div className="space-y-4">
                {accounts.filter(acc => ['HIGH', 'CRITICAL'].includes(acc.priority)).map((account) => (
                  <div key={account.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">{account.borrowerName}</h4>
                          <p className="text-sm text-gray-500">Loan #{account.loanId}</p>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(account.priority)}`}>
                          {account.priority}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(account.status)}`}>
                          {account.status}
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
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Collections Accounts
            </h3>
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Borrower
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount Due
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Days Past Due
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Agent
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Next Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {accounts.map((account) => (
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
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(account.priority)}`}>
                          {account.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(account.status)}`}>
                          {account.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {account.assignedAgent}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(account.nextActionDate, 'MMM dd, yyyy')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Workflows Tab */}
      {activeTab === 'workflows' && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Collections Workflows
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Configure automated collections workflows for different delinquency buckets.
            </p>
            
            <div className="space-y-6">
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-medium text-gray-900">Early Stage Workflow (30-59 days)</h4>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-green-600 font-medium">Active</span>
                    <PlayIcon className="h-5 w-5 text-green-600" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border rounded p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <EnvelopeIcon className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">Step 1: Initial Email</span>
                    </div>
                    <p className="text-xs text-gray-500">Send within 24 hours</p>
                  </div>
                  <div className="border rounded p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <PhoneIcon className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium">Step 2: Phone Call</span>
                    </div>
                    <p className="text-xs text-gray-500">Follow-up after 3 days</p>
                  </div>
                  <div className="border rounded p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <DocumentTextIcon className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium">Step 3: Formal Notice</span>
                    </div>
                    <p className="text-xs text-gray-500">Send after 7 days</p>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-medium text-gray-900">Late Stage Workflow (90+ days)</h4>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-green-600 font-medium">Active</span>
                    <PlayIcon className="h-5 w-5 text-green-600" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="border rounded p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <ScaleIcon className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium">Step 1: Legal Notice</span>
                    </div>
                    <p className="text-xs text-gray-500">Immediate</p>
                  </div>
                  <div className="border rounded p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <UserIcon className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium">Step 2: Skip Trace</span>
                    </div>
                    <p className="text-xs text-gray-500">After 5 days</p>
                  </div>
                  <div className="border rounded p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <BuildingLibraryIcon className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium">Step 3: Legal Review</span>
                    </div>
                    <p className="text-xs text-gray-500">After 10 days</p>
                  </div>
                  <div className="border rounded p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <ExclamationCircleIcon className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium">Step 4: Legal Action</span>
                    </div>
                    <p className="text-xs text-gray-500">After 15 days</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compliance Tab */}
      {activeTab === 'compliance' && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Compliance Monitoring
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border rounded-lg p-4">
                <h4 className="text-lg font-medium text-gray-900 mb-4">FDCPA Compliance</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Contact Time Restrictions</span>
                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Cease & Desist Monitoring</span>
                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Validation Requirements</span>
                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="text-lg font-medium text-gray-900 mb-4">State Regulations</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Licensing Requirements</span>
                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Collection Limits</span>
                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Documentation Standards</span>
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Recent Compliance Events</h4>
              <div className="space-y-3">
                <div className="border-l-4 border-yellow-400 bg-yellow-50 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-700">
                        Contact attempted outside allowed hours for account L001
                      </p>
                      <p className="text-xs text-yellow-600 mt-1">2 hours ago</p>
                    </div>
                  </div>
                </div>
                <div className="border-l-4 border-green-400 bg-green-50 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <CheckCircleIcon className="h-5 w-5 text-green-400" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-green-700">
                        Validation notice sent to L002 within required timeframe
                      </p>
                      <p className="text-xs text-green-600 mt-1">1 day ago</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};