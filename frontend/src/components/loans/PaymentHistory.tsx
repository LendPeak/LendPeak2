import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import apiClient from '../../services/api';
import { PaymentAllocationVisualizer } from './PaymentAllocationVisualizer';
import { 
  ChevronDownIcon, 
  ChevronUpIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';

interface Payment {
  _id: string;
  paymentNumber: number;
  paymentDate: string;
  scheduledDate: string;
  amount: string;
  principalPaid: string;
  interestPaid: string;
  feesPaid: string;
  penaltiesPaid: string;
  escrowPaid: string;
  remainingBalance: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED' | 'REVERSED' | 'PARTIAL';
  paymentMethod: string;
  reference?: string;
  notes?: string;
  reversedDate?: string;
  reversalReason?: string;
}

interface PaymentHistoryProps {
  loanId: string;
  currentBalance?: number;
  monthlyPayment?: number;
  payments?: Payment[];
  onPaymentRecorded?: () => void;
}

const PAYMENT_STATUS_CONFIG = {
  COMPLETED: {
    icon: CheckCircleIcon,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Completed',
  },
  PENDING: {
    icon: ClockIcon,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    label: 'Pending',
  },
  FAILED: {
    icon: XCircleIcon,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Failed',
  },
  REVERSED: {
    icon: ExclamationTriangleIcon,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    label: 'Reversed',
  },
  PARTIAL: {
    icon: ExclamationTriangleIcon,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    label: 'Partial',
  },
};

export const PaymentHistory: React.FC<PaymentHistoryProps> = ({
  loanId,
  currentBalance = 0,
  monthlyPayment = 0,
  payments: propPayments,
  onPaymentRecorded,
}) => {
  const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  });

  const { data: fetchedPayments, isLoading } = useQuery({
    queryKey: ['loan-payments', loanId],
    queryFn: () => apiClient.getLoanPayments(loanId),
    enabled: !propPayments,
  });

  const payments = propPayments || fetchedPayments;

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  const filteredPayments = payments?.filter((payment: Payment) => {
    // Status filter
    if (statusFilter !== 'all' && payment.status !== statusFilter) {
      return false;
    }

    // Date range filter
    if (dateRange.start && new Date(payment.paymentDate) < new Date(dateRange.start)) {
      return false;
    }
    if (dateRange.end && new Date(payment.paymentDate) > new Date(dateRange.end)) {
      return false;
    }

    return true;
  }) || [];

  const totalPaid = payments?.reduce((sum: number, payment: Payment) => {
    if (payment.status === 'COMPLETED') {
      return sum + parseFloat(payment.amount);
    }
    return sum;
  }, 0) || 0;

  const exportToCSV = () => {
    const headers = ['Date', 'Amount', 'Principal', 'Interest', 'Fees', 'Penalties', 'Escrow', 'Balance', 'Status', 'Method', 'Reference'];
    const rows = filteredPayments.map((payment: Payment) => [
      format(new Date(payment.paymentDate), 'yyyy-MM-dd'),
      payment.amount,
      payment.principalPaid,
      payment.interestPaid,
      payment.feesPaid,
      payment.penaltiesPaid,
      payment.escrowPaid,
      payment.remainingBalance,
      payment.status,
      payment.paymentMethod,
      payment.reference || '',
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loan-${loanId}-payments.csv`;
    a.click();
  };

  if (isLoading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Payment History</h3>
            <p className="mt-1 text-sm text-gray-500">
              Total Paid: {formatCurrency(totalPaid)} | Current Balance: {formatCurrency(currentBalance)}
            </p>
          </div>
          <button
            onClick={exportToCSV}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <FunnelIcon className="h-5 w-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm border-gray-300 rounded-md"
            >
              <option value="all">All Status</option>
              <option value="COMPLETED">Completed</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
              <option value="REVERSED">Reversed</option>
              <option value="PARTIAL">Partial</option>
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="text-sm border-gray-300 rounded-md"
              placeholder="Start date"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="text-sm border-gray-300 rounded-md"
              placeholder="End date"
            />
          </div>
        </div>
      </div>

      {/* Payment List */}
      <div className="divide-y divide-gray-200">
        {filteredPayments.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-gray-500">
            No payments found matching your criteria.
          </div>
        ) : (
          filteredPayments.map((payment: Payment) => {
            const isExpanded = expandedPaymentId === payment._id;
            const statusConfig = PAYMENT_STATUS_CONFIG[payment.status];
            const StatusIcon = statusConfig.icon;

            return (
              <div key={payment._id} className="hover:bg-gray-50">
                <div
                  className="px-6 py-4 cursor-pointer"
                  onClick={() => setExpandedPaymentId(isExpanded ? null : payment._id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`p-2 rounded-full ${statusConfig.bgColor}`}>
                        <StatusIcon className={`h-5 w-5 ${statusConfig.color}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {formatCurrency(payment.amount)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {format(new Date(payment.paymentDate), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Balance after</p>
                        <p className="text-sm font-medium text-gray-900">
                          {formatCurrency(payment.remainingBalance)}
                        </p>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                        {statusConfig.label}
                      </span>
                      {isExpanded ? (
                        <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-6 pb-4 bg-gray-50">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                      {/* Payment Details */}
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-3">Payment Details</h4>
                          <dl className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Payment Method</dt>
                              <dd className="text-gray-900">{payment.paymentMethod}</dd>
                            </div>
                            {payment.reference && (
                              <div className="flex justify-between">
                                <dt className="text-gray-500">Reference</dt>
                                <dd className="text-gray-900">{payment.reference}</dd>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Scheduled Date</dt>
                              <dd className="text-gray-900">
                                {format(new Date(payment.scheduledDate), 'MMM d, yyyy')}
                              </dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Actual Date</dt>
                              <dd className="text-gray-900">
                                {format(new Date(payment.paymentDate), 'MMM d, yyyy')}
                              </dd>
                            </div>
                          </dl>
                        </div>

                        {payment.status === 'REVERSED' && (
                          <div className="bg-red-50 border border-red-200 rounded-md p-3">
                            <h5 className="text-sm font-medium text-red-900">Reversal Information</h5>
                            <p className="text-sm text-red-700 mt-1">
                              Reversed on {payment.reversedDate && format(new Date(payment.reversedDate), 'MMM d, yyyy')}
                            </p>
                            {payment.reversalReason && (
                              <p className="text-sm text-red-700">Reason: {payment.reversalReason}</p>
                            )}
                          </div>
                        )}

                        {payment.notes && (
                          <div>
                            <h5 className="text-sm font-medium text-gray-900 mb-1">Notes</h5>
                            <p className="text-sm text-gray-600">{payment.notes}</p>
                          </div>
                        )}
                      </div>

                      {/* Allocation Breakdown */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Payment Allocation</h4>
                        <PaymentAllocationVisualizer
                          allocation={{
                            principal: parseFloat(payment.principalPaid),
                            interest: parseFloat(payment.interestPaid),
                            fees: parseFloat(payment.feesPaid),
                            penalties: parseFloat(payment.penaltiesPaid),
                            escrow: parseFloat(payment.escrowPaid),
                            total: parseFloat(payment.amount),
                          }}
                          paymentNumber={payment.paymentNumber}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Summary Statistics */}
      {payments && payments.length > 0 && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
            <div>
              <p className="text-gray-500">Total Payments</p>
              <p className="font-medium text-gray-900">{payments.length}</p>
            </div>
            <div>
              <p className="text-gray-500">Completed</p>
              <p className="font-medium text-green-600">
                {payments.filter((p: Payment) => p.status === 'COMPLETED').length}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Failed/Reversed</p>
              <p className="font-medium text-red-600">
                {payments.filter((p: Payment) => ['FAILED', 'REVERSED'].includes(p.status)).length}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Average Payment</p>
              <p className="font-medium text-gray-900">
                {formatCurrency(totalPaid / payments.filter((p: Payment) => p.status === 'COMPLETED').length || 0)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};