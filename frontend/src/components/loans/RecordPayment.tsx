import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import apiClient from '../../services/api';
import { XMarkIcon, CheckIcon, InformationCircleIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { demoLoanStorage } from '../../services/demoLoanStorage';
import { LoanEngine } from '@lendpeak/engine';
import { PaymentPreview } from './PaymentPreview';

const schema = yup.object({
  amount: yup
    .number()
    .positive('Payment amount must be positive')
    .required('Payment amount is required'),
  paymentDate: yup.date().required('Payment date is required'),
  paymentMethod: yup.string().required('Payment method is required'),
  reference: yup.string().optional(),
  notes: yup.string().optional(),
});

type FormData = yup.InferType<typeof schema>;

interface RecordPaymentProps {
  loan?: any;
  loanId?: string;
  loanNumber?: string;
  scheduledPaymentAmount?: number;
  nextPaymentDate?: Date;
  currentBalance?: number;
  onClose: () => void;
  onSuccess?: () => void;
}

const PAYMENT_METHODS = [
  { value: 'ACH', label: 'ACH Transfer' },
  { value: 'CHECK', label: 'Check' },
  { value: 'WIRE', label: 'Wire Transfer' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'DEBIT_CARD', label: 'Debit Card' },
  { value: 'CASH', label: 'Cash' },
  { value: 'OTHER', label: 'Other' },
];

export const RecordPayment: React.FC<RecordPaymentProps> = ({
  loan,
  loanId: propLoanId,
  loanNumber: propLoanNumber,
  scheduledPaymentAmount: propScheduledPaymentAmount,
  nextPaymentDate: propNextPaymentDate,
  currentBalance: propCurrentBalance,
  onClose,
  onSuccess,
}) => {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [paymentAllocation, setPaymentAllocation] = useState<any>(null);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<FormData>({
    resolver: yupResolver(schema),
    defaultValues: {
      amount: scheduledPaymentAmount,
      paymentDate: new Date(),
      paymentMethod: 'ACH',
      reference: '',
      notes: '',
    },
  });

  const paymentAmount = watch('amount');
  const paymentDate = watch('paymentDate');
  const isOverpayment = paymentAmount > currentBalance;
  const isPartialPayment = paymentAmount < scheduledPaymentAmount;

  // Get the actual loan ID - prioritize prop, then loan object
  const loanId = propLoanId || loan?._id || loan?.id;

  const recordPaymentMutation = useMutation({
    mutationFn: (data: FormData) =>
      apiClient.recordPayment(loanId, {
        amount: data.amount.toString(),
        paymentDate: data.paymentDate.toISOString(),
        paymentMethod: data.paymentMethod,
        reference: data.reference,
        notes: data.notes,
      }),
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['loan', loanId] });
      queryClient.invalidateQueries({ queryKey: ['loan-payments', loanId] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      
      setShowConfirmation(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2000);
    },
  });

  const onSubmit = (data: FormData) => {
    recordPaymentMutation.mutate(data);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const setQuickAmount = (type: 'scheduled' | 'payoff' | 'partial') => {
    switch (type) {
      case 'scheduled':
        setValue('amount', scheduledPaymentAmount);
        break;
      case 'payoff':
        setValue('amount', currentBalance);
        break;
      case 'partial':
        setValue('amount', scheduledPaymentAmount / 2);
        break;
    }
  };

  if (showConfirmation) {
    return (
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-[70]">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
              <CheckIcon className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900">Payment Recorded Successfully</h3>
            <p className="mt-2 text-sm text-gray-500">
              Payment of {formatCurrency(paymentAmount)} has been successfully processed.
            </p>
            
            {paymentAllocation && (
              <div className="mt-4 p-3 bg-gray-50 rounded-md text-left">
                <h4 className="text-xs font-medium text-gray-700 mb-2">Payment Allocation:</h4>
                <div className="space-y-1 text-xs">
                  {parseFloat(paymentAllocation.allocations?.principal || '0') > 0 && (
                    <div className="flex justify-between">
                      <span>Principal:</span>
                      <span>{formatCurrency(paymentAllocation.allocations.principal)}</span>
                    </div>
                  )}
                  {parseFloat(paymentAllocation.allocations?.interest || '0') > 0 && (
                    <div className="flex justify-between">
                      <span>Interest:</span>
                      <span>{formatCurrency(paymentAllocation.allocations.interest)}</span>
                    </div>
                  )}
                  {(parseFloat(paymentAllocation.allocations?.fees || '0') + parseFloat(paymentAllocation.allocations?.lateFees || '0')) > 0 && (
                    <div className="flex justify-between">
                      <span>Fees:</span>
                      <span>{formatCurrency((parseFloat(paymentAllocation.allocations.fees) + parseFloat(paymentAllocation.allocations.lateFees)).toString())}</span>
                    </div>
                  )}
                </div>
                <div className="border-t border-gray-200 mt-2 pt-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span>New Balance:</span>
                    <span>{formatCurrency(paymentAllocation.newBalance)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-[70]">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">
              Record Payment - Loan #{loanNumber}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {/* Loan Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Loan Summary</h3>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Current Balance</dt>
                <dd className="font-medium text-gray-900">{formatCurrency(currentBalance)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Scheduled Payment</dt>
                <dd className="font-medium text-gray-900">{formatCurrency(scheduledPaymentAmount)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Next Payment Date</dt>
                <dd className="font-medium text-gray-900">
                  {format(nextPaymentDate, 'MMM d, yyyy')}
                </dd>
              </div>
            </dl>
          </div>

          {/* Payment Amount */}
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
              Payment Amount
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                type="number"
                step="0.01"
                {...register('amount', { valueAsNumber: true })}
                className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
              />
            </div>
            {errors.amount && (
              <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>
            )}
            
            {/* Quick Amount Buttons */}
            <div className="mt-2 flex space-x-2">
              <button
                type="button"
                onClick={() => setQuickAmount('scheduled')}
                className="text-xs px-2 py-1 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Scheduled ({formatCurrency(scheduledPaymentAmount)})
              </button>
              <button
                type="button"
                onClick={() => setQuickAmount('payoff')}
                className="text-xs px-2 py-1 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Payoff ({formatCurrency(currentBalance)})
              </button>
              <button
                type="button"
                onClick={() => setQuickAmount('partial')}
                className="text-xs px-2 py-1 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Partial ({formatCurrency(scheduledPaymentAmount / 2)})
              </button>
            </div>

            {/* Payment Type Alerts */}
            {isOverpayment && (
              <div className="mt-3 p-3 bg-blue-50 rounded-md">
                <div className="flex">
                  <InformationCircleIcon className="h-5 w-5 text-blue-400" />
                  <div className="ml-3">
                    <p className="text-sm text-blue-700">
                      This payment exceeds the current balance. The excess will be applied as a prepayment.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {isPartialPayment && (
              <div className="mt-3 p-3 bg-amber-50 rounded-md">
                <div className="flex">
                  <InformationCircleIcon className="h-5 w-5 text-amber-400" />
                  <div className="ml-3">
                    <p className="text-sm text-amber-700">
                      This is a partial payment. Late fees may apply if the full amount is not received by the due date.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Payment Date */}
          <div>
            <label htmlFor="paymentDate" className="block text-sm font-medium text-gray-700">
              Payment Date
            </label>
            <input
              type="date"
              {...register('paymentDate', { valueAsDate: true })}
              className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
            />
            {errors.paymentDate && (
              <p className="mt-1 text-sm text-red-600">{errors.paymentDate.message}</p>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700">
              Payment Method
            </label>
            <select
              {...register('paymentMethod')}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
            {errors.paymentMethod && (
              <p className="mt-1 text-sm text-red-600">{errors.paymentMethod.message}</p>
            )}
          </div>

          {/* Reference Number */}
          <div>
            <label htmlFor="reference" className="block text-sm font-medium text-gray-700">
              Reference Number (Optional)
            </label>
            <input
              type="text"
              {...register('reference')}
              className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
              placeholder="Check number, transaction ID, etc."
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
              Notes (Optional)
            </label>
            <textarea
              {...register('notes')}
              rows={3}
              className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
              placeholder="Additional information about this payment..."
            />
          </div>

          {/* Payment Preview Section */}
          {loanId && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-900">Payment Preview</h3>
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
                >
                  {showPreview ? (
                    <>
                      <EyeSlashIcon className="h-4 w-4 mr-1" />
                      Hide Preview
                    </>
                  ) : (
                    <>
                      <EyeIcon className="h-4 w-4 mr-1" />
                      Show Preview
                    </>
                  )}
                </button>
              </div>
              
              {showPreview && paymentAmount && paymentAmount > 0 && (
                <PaymentPreview
                  loanId={loanId}
                  paymentAmount={paymentAmount}
                  paymentDate={paymentDate}
                  onAllocationChange={setPaymentAllocation}
                  showSchedulePreview={false}
                />
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={recordPaymentMutation.isPending}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
            >
              {recordPaymentMutation.isPending ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};