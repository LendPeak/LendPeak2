import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoanEngine } from '@lendpeak/engine';
import apiClient from '../../services/api';
import { PaymentAllocationVisualizer } from './PaymentAllocationVisualizer';
import { 
  InformationCircleIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  CalculatorIcon,
} from '@heroicons/react/24/outline';

interface PaymentPreviewProps {
  loanId: string;
  paymentAmount: number;
  paymentDate?: Date;
  onAllocationChange?: (allocation: any) => void;
  showSchedulePreview?: boolean;
}

interface PaymentAllocation {
  totalAmount: string;
  allocations: {
    interest: string;
    principal: string;
    fees: string;
    penalties: string;
    escrow: string;
    lateFees: string;
    otherFees: string;
  };
  newBalance: string;
  overpayment: string;
  effectiveDate: string;
}

interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

interface SchedulePreview {
  remainingPayments: number;
  newBalance: string;
  isPaidOff: boolean;
  monthlyPayment?: string;
  totalInterest?: string;
  scheduledPayments: Array<{
    paymentNumber: number;
    dueDate: string;
    principalPayment: string;
    interestPayment: string;
    remainingBalance: string;
  }>;
}

interface OutstandingAmounts {
  currentBalance: string;
  accruedInterest: string;
  fees: string;
  penalties: string;
  lateFees: string;
  escrow: string;
}

export const PaymentPreview: React.FC<PaymentPreviewProps> = ({
  loanId,
  paymentAmount,
  paymentDate = new Date(),
  onAllocationChange,
  showSchedulePreview = true,
}) => {
  const [allocation, setAllocation] = useState<PaymentAllocation | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [schedule, setSchedule] = useState<SchedulePreview | null>(null);
  const [outstandingAmounts, setOutstandingAmounts] = useState<OutstandingAmounts | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Debounced payment preview calculation
  const { data: previewData, isLoading, error } = useQuery({
    queryKey: ['payment-preview', loanId, paymentAmount, paymentDate?.toISOString()],
    queryFn: async () => {
      if (paymentAmount <= 0) return null;
      
      setIsCalculating(true);
      try {
        return await apiClient.previewPayment(loanId, {
          amount: paymentAmount.toString(),
          paymentDate: paymentDate.toISOString(),
        });
      } finally {
        setIsCalculating(false);
      }
    },
    enabled: paymentAmount > 0 && !!loanId,
    staleTime: 5000, // Cache for 5 seconds
  });

  useEffect(() => {
    if (previewData) {
      setAllocation(previewData.allocation);
      setValidation(previewData.validation);
      setSchedule(previewData.schedule);
      setOutstandingAmounts(previewData.outstandingAmounts);
      
      // Notify parent component of allocation change
      onAllocationChange?.(previewData.allocation);
    }
  }, [previewData, onAllocationChange]);

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return LoanEngine.formatCurrency(num);
  };

  const formatPercentage = (part: string, total: string) => {
    const partNum = parseFloat(part);
    const totalNum = parseFloat(total);
    if (totalNum === 0) return '0%';
    return `${((partNum / totalNum) * 100).toFixed(1)}%`;
  };

  if (paymentAmount <= 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center text-gray-500">
          <CalculatorIcon className="h-5 w-5 mr-2" />
          <span className="text-sm">Enter a payment amount to see allocation preview</span>
        </div>
      </div>
    );
  }

  if (isLoading || isCalculating) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="flex items-center mb-4">
            <div className="h-5 w-5 bg-gray-200 rounded mr-2"></div>
            <div className="h-4 bg-gray-200 rounded w-32"></div>
          </div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center text-red-700">
          <XCircleIcon className="h-5 w-5 mr-2" />
          <span className="text-sm">Error calculating payment preview</span>
        </div>
      </div>
    );
  }

  if (!allocation) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Validation Messages */}
      {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="space-y-2">
          {validation.errors.map((error, index) => (
            <div key={index} className="bg-red-50 border border-red-200 rounded-md p-3">
              <div className="flex items-center">
                <XCircleIcon className="h-5 w-5 text-red-400 mr-2" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            </div>
          ))}
          {validation.warnings.map((warning, index) => (
            <div key={index} className="bg-amber-50 border border-amber-200 rounded-md p-3">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="h-5 w-5 text-amber-400 mr-2" />
                <span className="text-sm text-amber-700">{warning}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Outstanding Amounts Summary */}
      {outstandingAmounts && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Outstanding Amounts</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Current Balance:</span>
              <span className="ml-2 font-medium">{formatCurrency(outstandingAmounts.currentBalance)}</span>
            </div>
            <div>
              <span className="text-gray-500">Accrued Interest:</span>
              <span className="ml-2 font-medium">{formatCurrency(outstandingAmounts.accruedInterest)}</span>
            </div>
            {parseFloat(outstandingAmounts.fees) > 0 && (
              <div>
                <span className="text-gray-500">Fees:</span>
                <span className="ml-2 font-medium">{formatCurrency(outstandingAmounts.fees)}</span>
              </div>
            )}
            {parseFloat(outstandingAmounts.lateFees) > 0 && (
              <div>
                <span className="text-gray-500">Late Fees:</span>
                <span className="ml-2 font-medium">{formatCurrency(outstandingAmounts.lateFees)}</span>
              </div>
            )}
            {parseFloat(outstandingAmounts.penalties) > 0 && (
              <div>
                <span className="text-gray-500">Penalties:</span>
                <span className="ml-2 font-medium">{formatCurrency(outstandingAmounts.penalties)}</span>
              </div>
            )}
            {parseFloat(outstandingAmounts.escrow) > 0 && (
              <div>
                <span className="text-gray-500">Escrow:</span>
                <span className="ml-2 font-medium">{formatCurrency(outstandingAmounts.escrow)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Allocation Visualization */}
      <PaymentAllocationVisualizer
        allocation={{
          principal: parseFloat(allocation.allocations.principal),
          interest: parseFloat(allocation.allocations.interest),
          fees: parseFloat(allocation.allocations.fees) + parseFloat(allocation.allocations.otherFees),
          penalties: parseFloat(allocation.allocations.penalties),
          escrow: parseFloat(allocation.allocations.escrow),
          total: parseFloat(allocation.totalAmount),
        }}
        paymentDate={new Date(allocation.effectiveDate)}
      />

      {/* Allocation Details */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Payment Allocation Breakdown</h4>
        <div className="space-y-2">
          {Object.entries(allocation.allocations).map(([category, amount]) => {
            const amountNum = parseFloat(amount);
            if (amountNum <= 0) return null;
            
            return (
              <div key={category} className="flex justify-between items-center py-1">
                <span className="text-sm text-gray-600 capitalize">
                  {category === 'lateFees' ? 'Late Fees' : 
                   category === 'otherFees' ? 'Other Fees' : category}
                </span>
                <div className="text-right">
                  <span className="text-sm font-medium text-gray-900">
                    {formatCurrency(amount)}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    ({formatPercentage(amount, allocation.totalAmount)})
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="border-t border-gray-200 mt-3 pt-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-900">Total Payment</span>
            <span className="text-sm font-bold text-gray-900">
              {formatCurrency(allocation.totalAmount)}
            </span>
          </div>
        </div>
      </div>

      {/* New Balance and Overpayment */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-3">After Payment</h4>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">New Loan Balance</span>
            <span className="text-sm font-medium text-gray-900">
              {formatCurrency(allocation.newBalance)}
            </span>
          </div>
          
          {parseFloat(allocation.overpayment) > 0 && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Overpayment</span>
                <span className="text-sm font-medium text-green-600">
                  {formatCurrency(allocation.overpayment)}
                </span>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mt-2">
                <div className="flex items-center">
                  <InformationCircleIcon className="h-5 w-5 text-blue-400 mr-2" />
                  <span className="text-sm text-blue-700">
                    This overpayment will be refunded or applied to future payments as configured.
                  </span>
                </div>
              </div>
            </>
          )}
          
          {parseFloat(allocation.newBalance) === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3 mt-2">
              <div className="flex items-center">
                <CheckCircleIcon className="h-5 w-5 text-green-400 mr-2" />
                <span className="text-sm text-green-700 font-medium">
                  🎉 This payment will fully pay off the loan!
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Schedule Preview */}
      {showSchedulePreview && schedule && !schedule.isPaidOff && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Updated Payment Schedule Preview</h4>
          <div className="space-y-2 mb-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Remaining Payments</span>
              <span className="text-sm font-medium">{schedule.remainingPayments}</span>
            </div>
            {schedule.monthlyPayment && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Monthly Payment</span>
                <span className="text-sm font-medium">{formatCurrency(schedule.monthlyPayment)}</span>
              </div>
            )}
            {schedule.totalInterest && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Remaining Interest</span>
                <span className="text-sm font-medium">{formatCurrency(schedule.totalInterest)}</span>
              </div>
            )}
          </div>
          
          {schedule.scheduledPayments.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-gray-700 mb-2">Next Few Payments</h5>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="text-gray-500">
                      <th className="text-left py-1">#</th>
                      <th className="text-left py-1">Due Date</th>
                      <th className="text-right py-1">Principal</th>
                      <th className="text-right py-1">Interest</th>
                      <th className="text-right py-1">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.scheduledPayments.slice(0, 5).map((payment) => (
                      <tr key={payment.paymentNumber} className="border-t border-gray-100">
                        <td className="py-1">{payment.paymentNumber}</td>
                        <td className="py-1">
                          {new Date(payment.dueDate).toLocaleDateString()}
                        </td>
                        <td className="text-right py-1">
                          {formatCurrency(payment.principalPayment)}
                        </td>
                        <td className="text-right py-1">
                          {formatCurrency(payment.interestPayment)}
                        </td>
                        <td className="text-right py-1">
                          {formatCurrency(payment.remainingBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};