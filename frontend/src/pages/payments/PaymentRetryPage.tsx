import React, { useState, useEffect } from 'react';
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  CreditCardIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  CalendarIcon,
  BellIcon,
  CogIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  DocumentTextIcon,
  ChartBarIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { format, addDays, differenceInDays, subDays } from 'date-fns';

interface FailedPayment {
  id: string;
  loanId: string;
  borrowerName: string;
  amount: number;
  paymentMethod: 'ACH' | 'CARD' | 'CHECK' | 'WIRE';
  failureReason: string;
  failureDate: Date;
  retryAttempts: number;
  maxRetries: number;
  nextRetryDate?: Date;
  status: 'PENDING_RETRY' | 'RETRYING' | 'EXHAUSTED' | 'RESOLVED' | 'SUSPENDED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  retryConfiguration: string;
}

interface RetryConfiguration {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  maxRetries: number;
  retryIntervals: number[];
  paymentMethods: string[];
  failureReasons: string[];
}

export const PaymentRetryPage: React.FC = () => {
  const [failedPayments, setFailedPayments] = useState<FailedPayment[]>([]);
  const [retryConfigurations, setRetryConfigurations] = useState<RetryConfiguration[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'payments' | 'configurations' | 'analytics'>('dashboard');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Demo data
  useEffect(() => {
    const demoFailedPayments: FailedPayment[] = [
      {
        id: '1',
        loanId: 'L001',
        borrowerName: 'John Smith',
        amount: 2500,
        paymentMethod: 'ACH',
        failureReason: 'Insufficient Funds',
        failureDate: subDays(new Date(), 2),
        retryAttempts: 1,
        maxRetries: 3,
        nextRetryDate: addDays(new Date(), 1),
        status: 'PENDING_RETRY',
        priority: 'HIGH',
        retryConfiguration: 'Standard ACH Retry'
      },
      {
        id: '2',
        loanId: 'L002',
        borrowerName: 'Sarah Davis',
        amount: 1800,
        paymentMethod: 'CARD',
        failureReason: 'Card Expired',
        failureDate: subDays(new Date(), 5),
        retryAttempts: 3,
        maxRetries: 3,
        status: 'EXHAUSTED',
        priority: 'CRITICAL',
        retryConfiguration: 'Card Retry Strategy'
      },
      {
        id: '3',
        loanId: 'L003',
        borrowerName: 'Mike Johnson',
        amount: 3200,
        paymentMethod: 'ACH',
        failureReason: 'Account Closed',
        failureDate: subDays(new Date(), 1),
        retryAttempts: 0,
        maxRetries: 2,
        nextRetryDate: addDays(new Date(), 3),
        status: 'SUSPENDED',
        priority: 'CRITICAL',
        retryConfiguration: 'Conservative Retry'
      }
    ];

    const demoConfigurations: RetryConfiguration[] = [
      {
        id: '1',
        name: 'Standard ACH Retry',
        description: 'Default retry strategy for ACH payment failures',
        enabled: true,
        maxRetries: 3,
        retryIntervals: [1, 3, 7],
        paymentMethods: ['ACH'],
        failureReasons: ['Insufficient Funds', 'Temporary Hold']
      },
      {
        id: '2',
        name: 'Card Retry Strategy',
        description: 'Retry strategy for credit/debit card failures',
        enabled: true,
        maxRetries: 2,
        retryIntervals: [1, 2],
        paymentMethods: ['CARD'],
        failureReasons: ['Temporary Authorization Failure', 'Network Error']
      },
      {
        id: '3',
        name: 'Conservative Retry',
        description: 'Conservative approach for serious failures',
        enabled: true,
        maxRetries: 1,
        retryIntervals: [7],
        paymentMethods: ['ACH', 'CARD'],
        failureReasons: ['Account Closed', 'Card Expired']
      }
    ];

    setFailedPayments(demoFailedPayments);
    setRetryConfigurations(demoConfigurations);
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING_RETRY': return 'text-yellow-600 bg-yellow-50';
      case 'RETRYING': return 'text-blue-600 bg-blue-50';
      case 'EXHAUSTED': return 'text-red-600 bg-red-50';
      case 'RESOLVED': return 'text-green-600 bg-green-50';
      case 'SUSPENDED': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'text-red-700 bg-red-100';
      case 'HIGH': return 'text-orange-600 bg-orange-50';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50';
      case 'LOW': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'ACH': return BuildingLibraryIcon;
      case 'CARD': return CreditCardIcon;
      case 'CHECK': return DocumentTextIcon;
      case 'WIRE': return BanknotesIcon;
      default: return CreditCardIcon;
    }
  };

  const filteredPayments = selectedStatus === 'all' 
    ? failedPayments 
    : failedPayments.filter(payment => payment.status === selectedStatus);

  const handleRetryPayment = (paymentId: string) => {
    toast.success('Payment retry initiated successfully');
    // Update payment status
    setFailedPayments(prev => prev.map(payment => 
      payment.id === paymentId 
        ? { ...payment, status: 'RETRYING' as const, retryAttempts: payment.retryAttempts + 1 }
        : payment
    ));
  };

  const handleSuspendRetry = (paymentId: string) => {
    toast.info('Payment retry suspended');
    setFailedPayments(prev => prev.map(payment => 
      payment.id === paymentId 
        ? { ...payment, status: 'SUSPENDED' as const }
        : payment
    ));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Payment Retry Management</h1>
        <p className="mt-2 text-sm text-gray-700">
          Manage failed payments, retry strategies, and automated recovery workflows.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {[
            { key: 'dashboard', name: 'Dashboard', icon: ChartBarIcon },
            { key: 'payments', name: 'Failed Payments', icon: ExclamationTriangleIcon },
            { key: 'configurations', name: 'Retry Configs', icon: CogIcon },
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
                        Failed Amount
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {formatCurrency(failedPayments.reduce((sum, payment) => sum + payment.amount, 0))}
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
                        Pending Retries
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {failedPayments.filter(p => p.status === 'PENDING_RETRY').length}
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
                    <XCircleIcon className="h-6 w-6 text-red-500" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Exhausted Retries
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {failedPayments.filter(p => p.status === 'EXHAUSTED').length}
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
                        68.4%
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Priority Actions */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Priority Retry Actions
              </h3>
              <div className="space-y-4">
                {failedPayments
                  .filter(payment => payment.status === 'PENDING_RETRY' && payment.nextRetryDate && payment.nextRetryDate <= new Date())
                  .map((payment) => {
                    const PaymentIcon = getPaymentMethodIcon(payment.paymentMethod);
                    return (
                      <div key={payment.id} className="border-l-4 border-yellow-400 bg-yellow-50 p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <PaymentIcon className="h-6 w-6 text-gray-400" />
                            <div>
                              <h4 className="text-sm font-medium text-gray-900">{payment.borrowerName}</h4>
                              <p className="text-sm text-gray-500">
                                Loan #{payment.loanId} • {payment.failureReason}
                              </p>
                            </div>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(payment.priority)}`}>
                              {payment.priority}
                            </span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="text-right">
                              <p className="text-sm font-medium text-gray-900">{formatCurrency(payment.amount)}</p>
                              <p className="text-sm text-gray-500">Attempt {payment.retryAttempts + 1}/{payment.maxRetries}</p>
                            </div>
                            <button
                              onClick={() => handleRetryPayment(payment.id)}
                              className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                            >
                              <ArrowPathIcon className="h-4 w-4 mr-1" />
                              Retry Now
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Retry Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Failure Reasons</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Insufficient Funds</span>
                  <span className="text-sm font-medium text-gray-900">45%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Account Closed</span>
                  <span className="text-sm font-medium text-gray-900">25%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Card Expired</span>
                  <span className="text-sm font-medium text-gray-900">20%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Other</span>
                  <span className="text-sm font-medium text-gray-900">10%</span>
                </div>
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Recovery by Method</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">ACH Retry</span>
                  <span className="text-sm font-medium text-green-600">72%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Card Retry</span>
                  <span className="text-sm font-medium text-green-600">65%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Manual Contact</span>
                  <span className="text-sm font-medium text-green-600">58%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Alternative Method</span>
                  <span className="text-sm font-medium text-green-600">43%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Failed Payments Tab */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          {/* Status Filter */}
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">Filter by Status:</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="block w-48 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="PENDING_RETRY">Pending Retry</option>
                <option value="RETRYING">Retrying</option>
                <option value="EXHAUSTED">Exhausted</option>
                <option value="RESOLVED">Resolved</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Failed Payments ({filteredPayments.length})
              </h3>
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Borrower
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Method
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Failure Reason
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Retry Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Priority
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Next Retry
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPayments.map((payment) => {
                      const PaymentIcon = getPaymentMethodIcon(payment.paymentMethod);
                      return (
                        <tr key={payment.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{payment.borrowerName}</div>
                              <div className="text-sm text-gray-500">Loan #{payment.loanId}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(payment.amount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <PaymentIcon className="h-4 w-4 text-gray-400" />
                              <span className="text-sm text-gray-900">{payment.paymentMethod}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {payment.failureReason}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col space-y-1">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                                {payment.status.replace('_', ' ')}
                              </span>
                              <span className="text-xs text-gray-500">
                                {payment.retryAttempts}/{payment.maxRetries} attempts
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(payment.priority)}`}>
                              {payment.priority}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {payment.nextRetryDate ? format(payment.nextRetryDate, 'MMM dd, yyyy') : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                            {payment.status === 'PENDING_RETRY' && (
                              <>
                                <button
                                  onClick={() => handleRetryPayment(payment.id)}
                                  className="text-indigo-600 hover:text-indigo-900"
                                >
                                  <ArrowPathIcon className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleSuspendRetry(payment.id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  <PauseIcon className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Configurations Tab */}
      {activeTab === 'configurations' && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Retry Configurations
            </h3>
            <div className="space-y-6">
              {retryConfigurations.map((config) => (
                <div key={config.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-lg font-medium text-gray-900">{config.name}</h4>
                      <p className="text-sm text-gray-600">{config.description}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {config.enabled ? (
                        <>
                          <span className="text-sm text-green-600 font-medium">Active</span>
                          <PlayIcon className="h-5 w-5 text-green-600" />
                        </>
                      ) : (
                        <>
                          <span className="text-sm text-gray-600 font-medium">Inactive</span>
                          <PauseIcon className="h-5 w-5 text-gray-600" />
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Settings</h5>
                      <ul className="text-sm text-gray-600">
                        <li>Max Retries: {config.maxRetries}</li>
                        <li>Intervals: {config.retryIntervals.join(', ')} days</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Payment Methods</h5>
                      <ul className="text-sm text-gray-600">
                        {config.paymentMethods.map(method => (
                          <li key={method}>• {method}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Failure Reasons</h5>
                      <ul className="text-sm text-gray-600">
                        {config.failureReasons.map(reason => (
                          <li key={reason}>• {reason}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex items-center justify-end">
                      <button className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                        <CogIcon className="h-4 w-4 mr-1" />
                        Configure
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Retry Success Rates</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">First Retry</span>
                  <span className="text-sm font-medium text-green-600">45.2%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Second Retry</span>
                  <span className="text-sm font-medium text-green-600">28.7%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Third Retry</span>
                  <span className="text-sm font-medium text-green-600">15.3%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Overall Recovery</span>
                  <span className="text-sm font-medium text-blue-600">68.4%</span>
                </div>
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Timing Analysis</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Avg Time to Resolution</span>
                  <span className="text-sm font-medium text-blue-600">4.2 days</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Same Day Recovery</span>
                  <span className="text-sm font-medium text-blue-600">18.5%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Within 7 Days</span>
                  <span className="text-sm font-medium text-blue-600">76.8%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Beyond 14 Days</span>
                  <span className="text-sm font-medium text-red-600">8.2%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Trends</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Best Performing</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• ACH insufficient funds: 78% recovery</li>
                  <li>• Card temporary auth: 72% recovery</li>
                  <li>• Processing delays: 85% recovery</li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Challenging Cases</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Account closed: 25% recovery</li>
                  <li>• Card expired: 35% recovery</li>
                  <li>• Stop payment: 15% recovery</li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Optimization Opportunities</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Reduce retry intervals for NSF</li>
                  <li>• Immediate customer contact for expired cards</li>
                  <li>• Alternative payment method prompts</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};