import { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  XMarkIcon,
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
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { format, addDays, differenceInDays } from 'date-fns';

interface PaymentRetrySystemProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface RetryConfiguration {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  maxRetries: number;
  retryIntervals: number[]; // Days between retries
  backoffMultiplier: number;
  stopOnSuccess: boolean;
  notifyOnFailure: boolean;
  escalateAfterMaxRetries: boolean;
  applicablePaymentMethods: PaymentMethod[];
  failureReasons: string[];
}

interface PaymentAttempt {
  id: string;
  loanId: string;
  originalPaymentId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  attemptNumber: number;
  maxRetries: number;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'ESCALATED';
  scheduledDate: Date;
  processedDate?: Date;
  failureReason?: string;
  failureCode?: string;
  nextRetryDate?: Date;
  retryConfigId: string;
  borrowerNotified: boolean;
  escalated: boolean;
  metadata: Record<string, any>;
}

interface PaymentFailure {
  id: string;
  loanId: string;
  borrowerName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  failureReason: string;
  failureCode: string;
  failureDate: Date;
  retryAttempts: number;
  nextRetryDate?: Date;
  status: 'ACTIVE_RETRY' | 'EXHAUSTED' | 'RESOLVED' | 'CANCELLED';
  escalated: boolean;
  lastContactDate?: Date;
}

type PaymentMethod = 'ACH' | 'CARD' | 'BANK_TRANSFER' | 'CHECK';

const DEFAULT_RETRY_CONFIGS: RetryConfiguration[] = [
  {
    id: 'ach_nsf',
    name: 'ACH NSF Retry',
    description: 'Retry failed ACH payments due to insufficient funds',
    enabled: true,
    maxRetries: 3,
    retryIntervals: [3, 7, 14], // 3 days, 7 days, 14 days
    backoffMultiplier: 1.0,
    stopOnSuccess: true,
    notifyOnFailure: true,
    escalateAfterMaxRetries: true,
    applicablePaymentMethods: ['ACH'],
    failureReasons: ['NSF', 'INSUFFICIENT_FUNDS', 'ACCOUNT_CLOSED'],
  },
  {
    id: 'card_decline',
    name: 'Card Decline Retry',
    description: 'Retry declined card payments',
    enabled: true,
    maxRetries: 2,
    retryIntervals: [1, 3], // 1 day, 3 days
    backoffMultiplier: 1.0,
    stopOnSuccess: true,
    notifyOnFailure: true,
    escalateAfterMaxRetries: true,
    applicablePaymentMethods: ['CARD'],
    failureReasons: ['CARD_DECLINED', 'EXPIRED_CARD', 'INVALID_CARD'],
  },
  {
    id: 'network_error',
    name: 'Network Error Retry',
    description: 'Retry payments that failed due to network issues',
    enabled: true,
    maxRetries: 5,
    retryIntervals: [0.1, 0.2, 0.5, 1, 2], // Hours converted to days
    backoffMultiplier: 2.0,
    stopOnSuccess: true,
    notifyOnFailure: false,
    escalateAfterMaxRetries: false,
    applicablePaymentMethods: ['ACH', 'CARD', 'BANK_TRANSFER'],
    failureReasons: ['NETWORK_ERROR', 'TIMEOUT', 'CONNECTION_FAILED'],
  },
];

export const PaymentRetrySystem = ({ isOpen, onClose, onSuccess }: PaymentRetrySystemProps) => {
  const [retryConfigs, setRetryConfigs] = useState<RetryConfiguration[]>(DEFAULT_RETRY_CONFIGS);
  const [activeRetries, setActiveRetries] = useState<PaymentAttempt[]>([]);
  const [failureQueue, setFailureQueue] = useState<PaymentFailure[]>([]);
  const [selectedTab, setSelectedTab] = useState<'CONFIGS' | 'ACTIVE' | 'FAILURES' | 'ANALYTICS'>('ACTIVE');
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingConfig, setEditingConfig] = useState<RetryConfiguration | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);

  useEffect(() => {
    loadRetryData();
    // Set up polling for active retries
    const interval = setInterval(loadRetryData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadRetryData = async () => {
    // Load active retry attempts (demo data)
    setActiveRetries([
      {
        id: 'retry_1',
        loanId: 'loan_123',
        originalPaymentId: 'pay_456',
        amount: 1250.00,
        paymentMethod: 'ACH',
        attemptNumber: 2,
        maxRetries: 3,
        status: 'PENDING',
        scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        retryConfigId: 'ach_nsf',
        borrowerNotified: true,
        escalated: false,
        metadata: {
          originalFailureReason: 'NSF',
          accountLastFour: '1234',
          borrowerEmail: 'john@example.com',
        },
      },
      {
        id: 'retry_2',
        loanId: 'loan_789',
        originalPaymentId: 'pay_101',
        amount: 2100.50,
        paymentMethod: 'CARD',
        attemptNumber: 1,
        maxRetries: 2,
        status: 'PROCESSING',
        scheduledDate: new Date(),
        processedDate: new Date(),
        retryConfigId: 'card_decline',
        borrowerNotified: false,
        escalated: false,
        metadata: {
          originalFailureReason: 'CARD_DECLINED',
          cardLastFour: '5678',
        },
      },
    ]);

    // Load failure queue (demo data)
    setFailureQueue([
      {
        id: 'fail_1',
        loanId: 'loan_555',
        borrowerName: 'Alice Johnson',
        amount: 1800.00,
        paymentMethod: 'ACH',
        failureReason: 'Account Closed',
        failureCode: 'R02',
        failureDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        retryAttempts: 3,
        status: 'EXHAUSTED',
        escalated: true,
        lastContactDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'fail_2',
        loanId: 'loan_666',
        borrowerName: 'Bob Smith',
        amount: 950.75,
        paymentMethod: 'CARD',
        failureReason: 'Expired Card',
        failureCode: 'EXPIRED',
        failureDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        retryAttempts: 1,
        nextRetryDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        status: 'ACTIVE_RETRY',
        escalated: false,
      },
    ]);
  };

  const processRetryAttempt = async (attempt: PaymentAttempt) => {
    setIsProcessing(true);
    try {
      // Simulate payment processing
      const success = Math.random() > 0.3; // 70% success rate for demo
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (success) {
        // Payment succeeded
        setActiveRetries(prev => prev.map(a => 
          a.id === attempt.id 
            ? { ...a, status: 'SUCCESS', processedDate: new Date() }
            : a
        ));
        
        toast.success(`Payment retry succeeded for loan ${attempt.loanId}`);
      } else {
        // Payment failed, schedule next retry or escalate
        const config = retryConfigs.find(c => c.id === attempt.retryConfigId);
        
        if (attempt.attemptNumber >= attempt.maxRetries) {
          // Max retries reached
          setActiveRetries(prev => prev.map(a => 
            a.id === attempt.id 
              ? { ...a, status: 'ESCALATED', processedDate: new Date(), escalated: true }
              : a
          ));
          
          if (config?.escalateAfterMaxRetries) {
            // Add to failure queue for manual intervention
            const failure: PaymentFailure = {
              id: 'fail_' + Date.now(),
              loanId: attempt.loanId,
              borrowerName: 'Demo Borrower',
              amount: attempt.amount,
              paymentMethod: attempt.paymentMethod,
              failureReason: 'Max retries exhausted',
              failureCode: 'MAX_RETRIES',
              failureDate: new Date(),
              retryAttempts: attempt.attemptNumber,
              status: 'EXHAUSTED',
              escalated: true,
            };
            
            setFailureQueue(prev => [failure, ...prev]);
          }
          
          toast.error(`Payment retry exhausted for loan ${attempt.loanId}`);
        } else {
          // Schedule next retry
          const nextRetryDays = config?.retryIntervals[attempt.attemptNumber] || 7;
          const nextRetryDate = addDays(new Date(), nextRetryDays);
          
          setActiveRetries(prev => prev.map(a => 
            a.id === attempt.id 
              ? { 
                  ...a, 
                  status: 'PENDING', 
                  attemptNumber: a.attemptNumber + 1,
                  nextRetryDate,
                  failureReason: 'Payment failed, retry scheduled'
                }
              : a
          ));
          
          toast.info(`Payment retry scheduled for ${format(nextRetryDate, 'MMM d, yyyy')}`);
        }
      }
    } catch (error) {
      toast.error('Error processing payment retry');
    } finally {
      setIsProcessing(false);
    }
  };

  const cancelRetry = async (attemptId: string) => {
    setActiveRetries(prev => prev.map(a => 
      a.id === attemptId 
        ? { ...a, status: 'CANCELLED' }
        : a
    ));
    
    toast.success('Payment retry cancelled');
  };

  const updateRetryConfig = (config: RetryConfiguration) => {
    setRetryConfigs(prev => prev.map(c => 
      c.id === config.id ? config : c
    ));
    
    setEditingConfig(null);
    setShowConfigModal(false);
    toast.success('Retry configuration updated');
  };

  const getStatusColor = (status: PaymentAttempt['status']) => {
    switch (status) {
      case 'SUCCESS': return 'text-green-600 bg-green-100';
      case 'FAILED': return 'text-red-600 bg-red-100';
      case 'PROCESSING': return 'text-blue-600 bg-blue-100';
      case 'PENDING': return 'text-yellow-600 bg-yellow-100';
      case 'CANCELLED': return 'text-gray-600 bg-gray-100';
      case 'ESCALATED': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getFailureStatusColor = (status: PaymentFailure['status']) => {
    switch (status) {
      case 'RESOLVED': return 'text-green-600 bg-green-100';
      case 'EXHAUSTED': return 'text-red-600 bg-red-100';
      case 'ACTIVE_RETRY': return 'text-blue-600 bg-blue-100';
      case 'CANCELLED': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const getPaymentMethodIcon = (method: PaymentMethod) => {
    switch (method) {
      case 'ACH': return BuildingLibraryIcon;
      case 'CARD': return CreditCardIcon;
      case 'BANK_TRANSFER': return BanknotesIcon;
      case 'CHECK': return DocumentTextIcon;
      default: return BanknotesIcon;
    }
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[70]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-2xl transition-all sm:my-8 w-full max-w-7xl">
                <div className="bg-white">
                  <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-red-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-orange-100 border border-orange-200">
                          <ArrowPathIcon className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                          <Dialog.Title as="h3" className="text-xl font-bold leading-6 text-gray-900">
                            Payment Retry System
                          </Dialog.Title>
                          <p className="mt-1 text-sm text-gray-600 flex items-center space-x-2">
                            <span>{activeRetries.length} active retries</span>
                            <span>•</span>
                            <span>{failureQueue.length} failures</span>
                            <span>•</span>
                            <span>{retryConfigs.filter(c => c.enabled).length} configurations enabled</span>
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
                        onClick={onClose}
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  <div className="px-6 py-6">
                    {/* Tab Navigation */}
                    <div className="border-b border-gray-200 mb-6">
                      <nav className="-mb-px flex space-x-8">
                        {[
                          { key: 'ACTIVE', label: 'Active Retries', icon: ArrowPathIcon, count: activeRetries.filter(a => ['PENDING', 'PROCESSING'].includes(a.status)).length },
                          { key: 'FAILURES', label: 'Failure Queue', icon: ExclamationTriangleIcon, count: failureQueue.filter(f => f.status === 'EXHAUSTED').length },
                          { key: 'CONFIGS', label: 'Configurations', icon: CogIcon, count: retryConfigs.length },
                          { key: 'ANALYTICS', label: 'Analytics', icon: DocumentTextIcon },
                        ].map((tab) => {
                          const IconComponent = tab.icon;
                          return (
                            <button
                              key={tab.key}
                              onClick={() => setSelectedTab(tab.key as any)}
                              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                                selectedTab === tab.key
                                  ? 'border-orange-500 text-orange-600'
                                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                              }`}
                            >
                              <IconComponent className="h-4 w-4" />
                              <span>{tab.label}</span>
                              {tab.count !== undefined && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  {tab.count}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </nav>
                    </div>

                    {/* Active Retries Tab */}
                    {selectedTab === 'ACTIVE' && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="text-lg font-semibold text-gray-900">Active Payment Retries</h4>
                          <button
                            onClick={loadRetryData}
                            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                          >
                            <ArrowPathIcon className="h-4 w-4 mr-2" />
                            Refresh
                          </button>
                        </div>

                        <div className="grid gap-4">
                          {activeRetries.map((attempt) => {
                            const PaymentIcon = getPaymentMethodIcon(attempt.paymentMethod);
                            const config = retryConfigs.find(c => c.id === attempt.retryConfigId);
                            
                            return (
                              <div key={attempt.id} className="bg-white border border-gray-200 rounded-lg p-6">
                                <div className="flex items-start justify-between">
                                  <div className="flex items-start space-x-4">
                                    <PaymentIcon className="h-6 w-6 text-gray-400 mt-1" />
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-3 mb-2">
                                        <h5 className="text-lg font-medium text-gray-900">
                                          Loan {attempt.loanId}
                                        </h5>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(attempt.status)}`}>
                                          {attempt.status}
                                        </span>
                                        <span className="text-sm text-gray-500">
                                          Attempt {attempt.attemptNumber} of {attempt.maxRetries}
                                        </span>
                                      </div>
                                      
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                        <div>
                                          <span className="font-medium text-gray-700">Amount:</span>
                                          <span className="ml-2">{formatCurrency(attempt.amount)}</span>
                                        </div>
                                        <div>
                                          <span className="font-medium text-gray-700">Method:</span>
                                          <span className="ml-2">{attempt.paymentMethod}</span>
                                        </div>
                                        <div>
                                          <span className="font-medium text-gray-700">Config:</span>
                                          <span className="ml-2">{config?.name || 'Unknown'}</span>
                                        </div>
                                        <div>
                                          <span className="font-medium text-gray-700">Scheduled:</span>
                                          <span className="ml-2">{format(attempt.scheduledDate, 'MMM d, yyyy h:mm a')}</span>
                                        </div>
                                        {attempt.nextRetryDate && (
                                          <div>
                                            <span className="font-medium text-gray-700">Next Retry:</span>
                                            <span className="ml-2">{format(attempt.nextRetryDate, 'MMM d, yyyy h:mm a')}</span>
                                          </div>
                                        )}
                                        {attempt.failureReason && (
                                          <div>
                                            <span className="font-medium text-gray-700">Last Failure:</span>
                                            <span className="ml-2">{attempt.failureReason}</span>
                                          </div>
                                        )}
                                      </div>

                                      {attempt.metadata && Object.keys(attempt.metadata).length > 0 && (
                                        <div className="mt-3 p-3 bg-gray-50 rounded-md">
                                          <h6 className="text-xs font-medium text-gray-700 mb-2">Additional Information:</h6>
                                          {Object.entries(attempt.metadata).map(([key, value]) => (
                                            <div key={key} className="text-xs text-gray-600">
                                              <span className="font-medium">{key}:</span> {String(value)}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center space-x-2">
                                    {attempt.status === 'PENDING' && (
                                      <>
                                        <button
                                          onClick={() => processRetryAttempt(attempt)}
                                          disabled={isProcessing}
                                          className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                                        >
                                          <PlayIcon className="h-4 w-4 mr-1" />
                                          Process Now
                                        </button>
                                        <button
                                          onClick={() => cancelRetry(attempt.id)}
                                          className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                                        >
                                          <StopIcon className="h-4 w-4 mr-1" />
                                          Cancel
                                        </button>
                                      </>
                                    )}
                                    
                                    {attempt.status === 'PROCESSING' && (
                                      <span className="inline-flex items-center text-sm text-blue-600">
                                        <ArrowPathIcon className="animate-spin h-4 w-4 mr-1" />
                                        Processing...
                                      </span>
                                    )}
                                    
                                    {attempt.status === 'SUCCESS' && (
                                      <span className="inline-flex items-center text-sm text-green-600">
                                        <CheckCircleIcon className="h-4 w-4 mr-1" />
                                        Completed
                                      </span>
                                    )}
                                    
                                    {attempt.status === 'ESCALATED' && (
                                      <span className="inline-flex items-center text-sm text-purple-600">
                                        <BellIcon className="h-4 w-4 mr-1" />
                                        Escalated
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          
                          {activeRetries.length === 0 && (
                            <div className="text-center py-12">
                              <ArrowPathIcon className="mx-auto h-12 w-12 text-gray-400" />
                              <h3 className="mt-2 text-sm font-medium text-gray-900">No active retries</h3>
                              <p className="mt-1 text-sm text-gray-500">
                                Payment retries will appear here when scheduled.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Failure Queue Tab */}
                    {selectedTab === 'FAILURES' && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="text-lg font-semibold text-gray-900">Payment Failure Queue</h4>
                          <div className="flex space-x-2">
                            <button className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                              Export Report
                            </button>
                            <button className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700">
                              Bulk Action
                            </button>
                          </div>
                        </div>

                        <div className="bg-white shadow overflow-hidden sm:rounded-md">
                          <ul className="divide-y divide-gray-200">
                            {failureQueue.map((failure) => {
                              const PaymentIcon = getPaymentMethodIcon(failure.paymentMethod);
                              
                              return (
                                <li key={failure.id} className="px-6 py-4">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-4">
                                      <PaymentIcon className="h-6 w-6 text-gray-400" />
                                      <div>
                                        <div className="flex items-center space-x-3">
                                          <h5 className="text-sm font-medium text-gray-900">
                                            {failure.borrowerName} - Loan {failure.loanId}
                                          </h5>
                                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getFailureStatusColor(failure.status)}`}>
                                            {failure.status.replace('_', ' ')}
                                          </span>
                                        </div>
                                        <div className="mt-1 text-sm text-gray-600">
                                          <span>{formatCurrency(failure.amount)} • </span>
                                          <span>{failure.failureReason} ({failure.failureCode}) • </span>
                                          <span>{failure.retryAttempts} attempts • </span>
                                          <span>Failed {format(failure.failureDate, 'MMM d, yyyy')}</span>
                                        </div>
                                        {failure.nextRetryDate && (
                                          <div className="mt-1 text-sm text-blue-600">
                                            Next retry: {format(failure.nextRetryDate, 'MMM d, yyyy h:mm a')}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center space-x-2">
                                      {failure.escalated && (
                                        <span className="inline-flex items-center text-sm text-orange-600">
                                          <BellIcon className="h-4 w-4 mr-1" />
                                          Escalated
                                        </span>
                                      )}
                                      
                                      <button className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                                        Contact
                                      </button>
                                      
                                      {failure.status === 'ACTIVE_RETRY' && (
                                        <button className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                                          Retry Now
                                        </button>
                                      )}
                                      
                                      {failure.status === 'EXHAUSTED' && (
                                        <button className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700">
                                          Escalate
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                          
                          {failureQueue.length === 0 && (
                            <div className="text-center py-12">
                              <CheckCircleIcon className="mx-auto h-12 w-12 text-gray-400" />
                              <h3 className="mt-2 text-sm font-medium text-gray-900">No payment failures</h3>
                              <p className="mt-1 text-sm text-gray-500">
                                Failed payments requiring attention will appear here.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Configurations Tab */}
                    {selectedTab === 'CONFIGS' && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="text-lg font-semibold text-gray-900">Retry Configurations</h4>
                          <button
                            onClick={() => {
                              setEditingConfig(null);
                              setShowConfigModal(true);
                            }}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-orange-600 hover:bg-orange-700"
                          >
                            <CogIcon className="h-4 w-4 mr-2" />
                            Add Configuration
                          </button>
                        </div>

                        <div className="grid gap-4">
                          {retryConfigs.map((config) => (
                            <div key={config.id} className="bg-white border border-gray-200 rounded-lg p-6">
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center space-x-3 mb-2">
                                    <h5 className="text-lg font-medium text-gray-900">{config.name}</h5>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                      config.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                    }`}>
                                      {config.enabled ? 'Enabled' : 'Disabled'}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-600 mb-3">{config.description}</p>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                    <div>
                                      <span className="font-medium text-gray-700">Max Retries:</span>
                                      <span className="ml-2">{config.maxRetries}</span>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-700">Intervals:</span>
                                      <span className="ml-2">{config.retryIntervals.join(', ')} days</span>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-700">Payment Methods:</span>
                                      <span className="ml-2">{config.applicablePaymentMethods.join(', ')}</span>
                                    </div>
                                  </div>
                                  
                                  <div className="mt-3 flex flex-wrap gap-1">
                                    {config.failureReasons.map(reason => (
                                      <span key={reason} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                        {reason}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => {
                                      setEditingConfig(config);
                                      setShowConfigModal(true);
                                    }}
                                    className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => {
                                      const updatedConfig = { ...config, enabled: !config.enabled };
                                      updateRetryConfig(updatedConfig);
                                    }}
                                    className={`inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md ${
                                      config.enabled 
                                        ? 'text-white bg-red-600 hover:bg-red-700'
                                        : 'text-white bg-green-600 hover:bg-green-700'
                                    }`}
                                  >
                                    {config.enabled ? 'Disable' : 'Enable'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Analytics Tab */}
                    {selectedTab === 'ANALYTICS' && (
                      <div className="space-y-6">
                        <h4 className="text-lg font-semibold text-gray-900">Retry Analytics</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                          <div className="bg-white overflow-hidden shadow rounded-lg">
                            <div className="p-5">
                              <div className="flex items-center">
                                <div className="flex-shrink-0">
                                  <ArrowPathIcon className="h-6 w-6 text-blue-600" />
                                </div>
                                <div className="ml-5 w-0 flex-1">
                                  <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Total Retries</dt>
                                    <dd className="text-lg font-semibold text-gray-900">47</dd>
                                  </dl>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="bg-white overflow-hidden shadow rounded-lg">
                            <div className="p-5">
                              <div className="flex items-center">
                                <div className="flex-shrink-0">
                                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                                </div>
                                <div className="ml-5 w-0 flex-1">
                                  <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Success Rate</dt>
                                    <dd className="text-lg font-semibold text-gray-900">73%</dd>
                                  </dl>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="bg-white overflow-hidden shadow rounded-lg">
                            <div className="p-5">
                              <div className="flex items-center">
                                <div className="flex-shrink-0">
                                  <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                                </div>
                                <div className="ml-5 w-0 flex-1">
                                  <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Failures</dt>
                                    <dd className="text-lg font-semibold text-gray-900">13</dd>
                                  </dl>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="bg-white overflow-hidden shadow rounded-lg">
                            <div className="p-5">
                              <div className="flex items-center">
                                <div className="flex-shrink-0">
                                  <CurrencyDollarIcon className="h-6 w-6 text-orange-600" />
                                </div>
                                <div className="ml-5 w-0 flex-1">
                                  <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Recovered</dt>
                                    <dd className="text-lg font-semibold text-gray-900">{formatCurrency(156750)}</dd>
                                  </dl>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white shadow rounded-lg p-6">
                          <h5 className="text-lg font-medium text-gray-900 mb-4">Failure Reasons</h5>
                          <div className="space-y-3">
                            {[
                              { reason: 'Insufficient Funds', count: 23, percentage: 48 },
                              { reason: 'Card Declined', count: 12, percentage: 25 },
                              { reason: 'Account Closed', count: 8, percentage: 17 },
                              { reason: 'Network Error', count: 5, percentage: 10 },
                            ].map((item, index) => (
                              <div key={index} className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="text-sm font-medium text-gray-900">{item.reason}</div>
                                  <div className="text-sm text-gray-500">({item.count} failures)</div>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <div className="w-32 bg-gray-200 rounded-full h-2">
                                    <div 
                                      className="bg-orange-600 h-2 rounded-full" 
                                      style={{ width: `${item.percentage}%` }}
                                    />
                                  </div>
                                  <div className="text-sm font-medium text-gray-900">{item.percentage}%</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-50 px-6 py-4 flex justify-between">
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSuccess();
                        toast.success('Payment retry system updated');
                      }}
                      className="inline-flex justify-center rounded-md bg-orange-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500"
                    >
                      <CheckCircleIcon className="h-5 w-5 mr-2" />
                      Save Changes
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};