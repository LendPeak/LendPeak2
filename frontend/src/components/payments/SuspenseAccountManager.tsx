import { useState, useEffect } from 'react';
import {
  ClockIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
  BanknotesIcon,
  DocumentTextIcon,
  ArrowRightIcon,
  AdjustmentsHorizontalIcon,
  FunnelIcon,
  ArrowsRightLeftIcon,
  PlusIcon,
  EyeIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';
import { format, subDays, isWithinInterval } from 'date-fns';

interface SuspensePayment {
  id: string;
  paymentAmount: number;
  receivedDate: Date;
  paymentMethod: 'ACH' | 'WIRE' | 'CHECK' | 'CARD' | 'CASH';
  referenceNumber: string;
  bankAccount?: string;
  routingNumber?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  paymentSource: string;
  status: 'UNMATCHED' | 'RESEARCHING' | 'PENDING_APPROVAL' | 'MATCHED' | 'REJECTED' | 'REFUNDED';
  reason: 'UNKNOWN_CUSTOMER' | 'INSUFFICIENT_INFO' | 'DUPLICATE_PAYMENT' | 'OVERPAYMENT' | 'LOAN_CLOSED' | 'SYSTEM_ERROR' | 'OTHER';
  daysInSuspense: number;
  notes: string[];
  assignedTo?: string;
  matchingCandidates: LoanMatch[];
  appliedTo?: {
    loanNumber: string;
    appliedDate: Date;
    appliedBy: string;
    allocationDetails: {
      principal: number;
      interest: number;
      fees: number;
      escrow: number;
    };
  };
}

interface LoanMatch {
  loanNumber: string;
  borrowerName: string;
  currentBalance: number;
  paymentDueDate: Date;
  expectedPayment: number;
  confidence: number; // 0-100
  matchReasons: string[];
}

interface SuspenseAccountManagerProps {
  onPaymentApplied?: (payment: SuspensePayment, loanNumber: string) => void;
}

export const SuspenseAccountManager = ({ onPaymentApplied }: SuspenseAccountManagerProps) => {
  const [suspensePayments, setSuspensePayments] = useState<SuspensePayment[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<SuspensePayment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<SuspensePayment['status'] | 'ALL'>('ALL');
  const [reasonFilter, setReasonFilter] = useState<SuspensePayment['reason'] | 'ALL'>('ALL');
  const [ageFilter, setAgeFilter] = useState<'ALL' | '0-7' | '8-30' | '31-60' | '60+'>('ALL');
  const [sortBy, setSortBy] = useState<'amount' | 'date' | 'age' | 'confidence'>('age');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [showResearchModal, setShowResearchModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    generateSuspenseData();
  }, []);

  const generateSuspenseData = () => {
    setIsLoading(true);
    
    // Generate demo suspense payments
    const payments: SuspensePayment[] = [];
    const reasons: SuspensePayment['reason'][] = ['UNKNOWN_CUSTOMER', 'INSUFFICIENT_INFO', 'DUPLICATE_PAYMENT', 'OVERPAYMENT', 'LOAN_CLOSED', 'SYSTEM_ERROR'];
    const paymentMethods: SuspensePayment['paymentMethod'][] = ['ACH', 'WIRE', 'CHECK', 'CARD', 'CASH'];
    const statuses: SuspensePayment['status'][] = ['UNMATCHED', 'RESEARCHING', 'PENDING_APPROVAL', 'MATCHED', 'REJECTED'];

    for (let i = 0; i < 50; i++) {
      const receivedDate = subDays(new Date(), Math.floor(Math.random() * 90));
      const daysInSuspense = Math.floor((new Date().getTime() - receivedDate.getTime()) / (1000 * 60 * 60 * 24));
      
      const payment: SuspensePayment = {
        id: `SUSP-${String(i + 1).padStart(4, '0')}`,
        paymentAmount: Math.floor(Math.random() * 5000) + 100,
        receivedDate,
        paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
        referenceNumber: `REF${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        bankAccount: Math.random() > 0.3 ? `****${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}` : undefined,
        routingNumber: Math.random() > 0.3 ? `${Math.floor(Math.random() * 900000000) + 100000000}` : undefined,
        customerName: Math.random() > 0.2 ? `Customer ${i + 1}` : undefined,
        customerPhone: Math.random() > 0.4 ? `555-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}` : undefined,
        customerEmail: Math.random() > 0.5 ? `customer${i + 1}@email.com` : undefined,
        paymentSource: `Payment Gateway ${Math.floor(Math.random() * 3) + 1}`,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        reason: reasons[Math.floor(Math.random() * reasons.length)],
        daysInSuspense,
        notes: [],
        assignedTo: Math.random() > 0.5 ? `Agent ${Math.floor(Math.random() * 5) + 1}` : undefined,
        matchingCandidates: generateMatchingCandidates(),
      };

      // Add some notes for older payments
      if (daysInSuspense > 7) {
        payment.notes.push(`Customer contacted on ${format(subDays(new Date(), daysInSuspense - 3), 'MMM dd, yyyy')}`);
      }
      if (daysInSuspense > 30) {
        payment.notes.push('Awaiting additional documentation');
      }

      payments.push(payment);
    }

    setSuspensePayments(payments);
    setIsLoading(false);
  };

  const generateMatchingCandidates = (): LoanMatch[] => {
    const candidates: LoanMatch[] = [];
    const numCandidates = Math.floor(Math.random() * 5) + 1;

    for (let i = 0; i < numCandidates; i++) {
      const confidence = Math.floor(Math.random() * 60) + 40; // 40-100%
      const matchReasons = [];
      
      if (confidence > 80) {
        matchReasons.push('Exact payment amount match');
        matchReasons.push('Customer name partial match');
      } else if (confidence > 60) {
        matchReasons.push('Payment amount within expected range');
        matchReasons.push('Account number partial match');
      } else {
        matchReasons.push('Customer phone number match');
      }

      candidates.push({
        loanNumber: `LN${Math.floor(Math.random() * 900000) + 100000}`,
        borrowerName: `Borrower ${i + 1}`,
        currentBalance: Math.floor(Math.random() * 300000) + 50000,
        paymentDueDate: subDays(new Date(), Math.floor(Math.random() * 30)),
        expectedPayment: Math.floor(Math.random() * 3000) + 500,
        confidence,
        matchReasons,
      });
    }

    return candidates.sort((a, b) => b.confidence - a.confidence);
  };

  const getFilteredPayments = () => {
    let filtered = suspensePayments;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(payment => 
        payment.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.customerEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.customerPhone?.includes(searchTerm)
      );
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(payment => payment.status === statusFilter);
    }

    // Reason filter
    if (reasonFilter !== 'ALL') {
      filtered = filtered.filter(payment => payment.reason === reasonFilter);
    }

    // Age filter
    if (ageFilter !== 'ALL') {
      filtered = filtered.filter(payment => {
        const days = payment.daysInSuspense;
        switch (ageFilter) {
          case '0-7': return days <= 7;
          case '8-30': return days > 7 && days <= 30;
          case '31-60': return days > 30 && days <= 60;
          case '60+': return days > 60;
          default: return true;
        }
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'amount':
          aValue = a.paymentAmount;
          bValue = b.paymentAmount;
          break;
        case 'date':
          aValue = a.receivedDate.getTime();
          bValue = b.receivedDate.getTime();
          break;
        case 'age':
          aValue = a.daysInSuspense;
          bValue = b.daysInSuspense;
          break;
        case 'confidence':
          aValue = a.matchingCandidates.length > 0 ? a.matchingCandidates[0].confidence : 0;
          bValue = b.matchingCandidates.length > 0 ? b.matchingCandidates[0].confidence : 0;
          break;
        default:
          return 0;
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  };

  const applyPaymentToLoan = (payment: SuspensePayment, loanNumber: string) => {
    // Simulate payment application
    const updatedPayment = {
      ...payment,
      status: 'MATCHED' as const,
      appliedTo: {
        loanNumber,
        appliedDate: new Date(),
        appliedBy: 'Current User',
        allocationDetails: {
          principal: payment.paymentAmount * 0.7,
          interest: payment.paymentAmount * 0.25,
          fees: payment.paymentAmount * 0.05,
          escrow: 0,
        },
      },
    };

    setSuspensePayments(prev => 
      prev.map(p => p.id === payment.id ? updatedPayment : p)
    );

    if (onPaymentApplied) {
      onPaymentApplied(updatedPayment, loanNumber);
    }

    setShowMatchModal(false);
    setSelectedPayment(null);
  };

  const rejectPayment = (payment: SuspensePayment, reason: string) => {
    const updatedPayment = {
      ...payment,
      status: 'REJECTED' as const,
      notes: [...payment.notes, `Rejected: ${reason} on ${format(new Date(), 'MMM dd, yyyy')}`],
    };

    setSuspensePayments(prev => 
      prev.map(p => p.id === payment.id ? updatedPayment : p)
    );

    setSelectedPayment(null);
  };

  const addNote = (payment: SuspensePayment, note: string) => {
    const updatedPayment = {
      ...payment,
      notes: [...payment.notes, `${format(new Date(), 'MMM dd, yyyy')}: ${note}`],
    };

    setSuspensePayments(prev => 
      prev.map(p => p.id === payment.id ? updatedPayment : p)
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const getStatusIcon = (status: SuspensePayment['status']) => {
    switch (status) {
      case 'MATCHED':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'REJECTED':
      case 'REFUNDED':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'RESEARCHING':
      case 'PENDING_APPROVAL':
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
      default:
        return <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />;
    }
  };

  const getStatusColor = (status: SuspensePayment['status']) => {
    switch (status) {
      case 'MATCHED':
        return 'text-green-600 bg-green-50';
      case 'REJECTED':
      case 'REFUNDED':
        return 'text-red-600 bg-red-50';
      case 'RESEARCHING':
      case 'PENDING_APPROVAL':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-orange-600 bg-orange-50';
    }
  };

  const getAgeColor = (days: number) => {
    if (days <= 7) return 'text-green-600';
    if (days <= 30) return 'text-yellow-600';
    if (days <= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <ClockIcon className="animate-pulse h-12 w-12 text-gray-400 mx-auto" />
        <p className="mt-2 text-sm text-gray-500">Loading suspense account data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CurrencyDollarIcon className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Suspense</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {formatCurrency(suspensePayments.reduce((sum, p) => sum + p.paymentAmount, 0))}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <span className="text-gray-600">{suspensePayments.length} payments</span>
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
                  <dt className="text-sm font-medium text-gray-500 truncate">Aged 60+ Days</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {suspensePayments.filter(p => p.daysInSuspense > 60).length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <span className="text-red-600">Requires attention</span>
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
                  <dt className="text-sm font-medium text-gray-500 truncate">Avg Amount</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {formatCurrency(suspensePayments.reduce((sum, p) => sum + p.paymentAmount, 0) / suspensePayments.length)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <span className="text-gray-600">Per payment</span>
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
                  <dt className="text-sm font-medium text-gray-500 truncate">Matched This Week</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {suspensePayments.filter(p => p.status === 'MATCHED' && p.daysInSuspense <= 7).length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <span className="text-green-600">Resolution rate</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="ID, reference, customer..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="ALL">All Status</option>
              <option value="UNMATCHED">Unmatched</option>
              <option value="RESEARCHING">Researching</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="MATCHED">Matched</option>
              <option value="REJECTED">Rejected</option>
              <option value="REFUNDED">Refunded</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
            <select
              value={ageFilter}
              onChange={(e) => setAgeFilter(e.target.value as any)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="ALL">All Ages</option>
              <option value="0-7">0-7 days</option>
              <option value="8-30">8-30 days</option>
              <option value="31-60">31-60 days</option>
              <option value="60+">60+ days</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="age">Age</option>
              <option value="amount">Amount</option>
              <option value="date">Date</option>
              <option value="confidence">Match Confidence</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Direction</label>
            <select
              value={sortDirection}
              onChange={(e) => setSortDirection(e.target.value as any)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Suspense Payments ({getFilteredPayments().length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Received
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Age
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Best Match
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {getFilteredPayments().map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{payment.id}</div>
                    <div className="text-xs text-gray-500">{payment.referenceNumber}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatCurrency(payment.paymentAmount)}
                    </div>
                    <div className="text-xs text-gray-500">{payment.paymentMethod}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(payment.receivedDate, 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-medium ${getAgeColor(payment.daysInSuspense)}`}>
                      {payment.daysInSuspense} days
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{payment.customerName || 'Unknown'}</div>
                    <div className="text-xs text-gray-500">{payment.customerPhone || payment.customerEmail || 'No contact info'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(payment.status)}
                      <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(payment.status)}`}>
                        {payment.status.replace('_', ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {payment.matchingCandidates.length > 0 ? (
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {payment.matchingCandidates[0].loanNumber}
                        </div>
                        <div className="text-xs text-gray-500">
                          {payment.matchingCandidates[0].confidence}% confidence
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">No matches</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setSelectedPayment(payment);
                          setShowMatchModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-900"
                        title="Match to Loan"
                      >
                        <ArrowRightIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedPayment(payment);
                          setShowResearchModal(true);
                        }}
                        className="text-green-600 hover:text-green-900"
                        title="Research"
                      >
                        <MagnifyingGlassIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setSelectedPayment(payment)}
                        className="text-gray-600 hover:text-gray-900"
                        title="View Details"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Match Modal */}
      {showMatchModal && selectedPayment && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white max-w-2xl">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Match Payment {selectedPayment.id}
                </h3>
                <button
                  onClick={() => setShowMatchModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Amount:</span> {formatCurrency(selectedPayment.paymentAmount)}
                  </div>
                  <div>
                    <span className="font-medium">Method:</span> {selectedPayment.paymentMethod}
                  </div>
                  <div>
                    <span className="font-medium">Customer:</span> {selectedPayment.customerName || 'Unknown'}
                  </div>
                  <div>
                    <span className="font-medium">Reference:</span> {selectedPayment.referenceNumber}
                  </div>
                </div>
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto">
                <h4 className="font-medium text-gray-900">Matching Candidates:</h4>
                {selectedPayment.matchingCandidates.map((candidate, index) => (
                  <div key={index} className="border rounded-lg p-3 hover:bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-gray-900">{candidate.loanNumber}</div>
                      <div className="flex items-center space-x-2">
                        <span className={`text-sm font-medium ${
                          candidate.confidence >= 80 ? 'text-green-600' :
                          candidate.confidence >= 60 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {candidate.confidence}%
                        </span>
                        <button
                          onClick={() => applyPaymentToLoan(selectedPayment, candidate.loanNumber)}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 mb-1">
                      {candidate.borrowerName} • Balance: {formatCurrency(candidate.currentBalance)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {candidate.matchReasons.join(', ')}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowMatchModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => rejectPayment(selectedPayment, 'Unable to match')}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                >
                  Reject Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Research Modal */}
      {showResearchModal && selectedPayment && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white max-w-lg">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Research Payment {selectedPayment.id}
                </h3>
                <button
                  onClick={() => setShowResearchModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Add Research Note
                  </label>
                  <textarea
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    rows={3}
                    placeholder="Enter research findings, customer contact notes, etc."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assign To
                  </label>
                  <select className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                    <option value="">Select agent...</option>
                    <option value="agent1">Agent 1</option>
                    <option value="agent2">Agent 2</option>
                    <option value="agent3">Agent 3</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                    <option value="RESEARCHING">Researching</option>
                    <option value="PENDING_APPROVAL">Pending Approval</option>
                    <option value="UNMATCHED">Unmatched</option>
                  </select>
                </div>

                {selectedPayment.notes.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Previous Notes:</h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {selectedPayment.notes.map((note, index) => (
                        <div key={index} className="text-xs text-gray-600 p-2 bg-gray-50 rounded">
                          {note}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowResearchModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    addNote(selectedPayment, 'Research updated');
                    setShowResearchModal(false);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Save Research
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};