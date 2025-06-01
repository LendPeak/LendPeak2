import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { XMarkIcon, CheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import apiClient from '../../services/api';

const schema = yup.object({
  status: yup.string().required('Status is required'),
  reason: yup.string().required('Reason is required').min(10, 'Please provide at least 10 characters'),
  effectiveDate: yup.date().required('Effective date is required'),
  notes: yup.string(),
});

type FormData = yup.InferType<typeof schema>;

interface LoanStatusManagerProps {
  loanId: string;
  loanNumber: string;
  currentStatus: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const LOAN_STATUSES = [
  { value: 'ACTIVE', label: 'Active', description: 'Loan is current and in good standing' },
  { value: 'DELINQUENT', label: 'Delinquent', description: 'Payment is past due' },
  { value: 'DEFAULT', label: 'Default', description: 'Loan is in default status' },
  { value: 'FORBEARANCE', label: 'Forbearance', description: 'Temporary payment relief granted' },
  { value: 'DEFERMENT', label: 'Deferment', description: 'Payments temporarily postponed' },
  { value: 'BANKRUPTCY', label: 'Bankruptcy', description: 'Borrower has filed for bankruptcy' },
  { value: 'CHARGED_OFF', label: 'Charged Off', description: 'Loan written off as loss' },
  { value: 'PAID_OFF', label: 'Paid Off', description: 'Loan fully paid' },
  { value: 'REFINANCED', label: 'Refinanced', description: 'Loan has been refinanced' },
  { value: 'FORECLOSURE', label: 'Foreclosure', description: 'Property foreclosure initiated' },
];

const STATUS_WARNINGS: Record<string, string> = {
  DEFAULT: 'This will trigger default procedures and may affect credit reporting.',
  CHARGED_OFF: 'This action cannot be easily reversed. Ensure all collection efforts have been exhausted.',
  FORECLOSURE: 'This will initiate legal proceedings. Ensure all requirements are met.',
  BANKRUPTCY: 'Ensure you have received proper bankruptcy documentation.',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'text-green-700 bg-green-50',
  DELINQUENT: 'text-yellow-700 bg-yellow-50',
  DEFAULT: 'text-red-700 bg-red-50',
  FORBEARANCE: 'text-purple-700 bg-purple-50',
  DEFERMENT: 'text-blue-700 bg-blue-50',
  BANKRUPTCY: 'text-orange-700 bg-orange-50',
  CHARGED_OFF: 'text-red-700 bg-red-50',
  PAID_OFF: 'text-gray-700 bg-gray-50',
  REFINANCED: 'text-indigo-700 bg-indigo-50',
  FORECLOSURE: 'text-red-700 bg-red-50',
};

export const LoanStatusManager: React.FC<LoanStatusManagerProps> = ({
  loanId,
  loanNumber,
  currentStatus,
  onClose,
  onSuccess,
}) => {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationStep, setConfirmationStep] = useState<'confirm' | 'success'>('confirm');
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    getValues,
  } = useForm<FormData>({
    resolver: yupResolver(schema),
    defaultValues: {
      status: currentStatus,
      reason: '',
      effectiveDate: new Date(),
      notes: '',
    },
  });

  const selectedStatus = watch('status');
  const hasWarning = STATUS_WARNINGS[selectedStatus];

  const updateStatusMutation = useMutation({
    mutationFn: (data: FormData) =>
      apiClient.updateLoanStatus(loanId, data.status, data.reason),
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['loan', loanId] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['loan-audit', loanId] });
      
      setConfirmationStep('success');
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2000);
    },
  });

  const onSubmit = (data: FormData) => {
    if (hasWarning) {
      setShowConfirmation(true);
    } else {
      updateStatusMutation.mutate(data);
    }
  };

  const handleConfirm = () => {
    const data = getValues();
    updateStatusMutation.mutate(data);
  };

  if (showConfirmation && confirmationStep === 'success') {
    return (
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-[70]">
        <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
              <CheckIcon className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900">Status Updated</h3>
            <p className="mt-2 text-sm text-gray-500">
              Loan status has been successfully updated to {selectedStatus}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (showConfirmation && confirmationStep === 'confirm') {
    return (
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-[70]">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-6 w-6 text-yellow-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">Confirm Status Change</h3>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-500">{STATUS_WARNINGS[selectedStatus]}</p>
              <div className="mt-4 p-4 bg-gray-50 rounded-md">
                <dl className="text-sm">
                  <div className="flex justify-between py-1">
                    <dt className="text-gray-500">Loan:</dt>
                    <dd className="font-medium text-gray-900">#{loanNumber}</dd>
                  </div>
                  <div className="flex justify-between py-1">
                    <dt className="text-gray-500">Current Status:</dt>
                    <dd className="font-medium text-gray-900">{currentStatus}</dd>
                  </div>
                  <div className="flex justify-between py-1">
                    <dt className="text-gray-500">New Status:</dt>
                    <dd className="font-medium text-gray-900">{selectedStatus}</dd>
                  </div>
                </dl>
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowConfirmation(false)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={updateStatusMutation.isPending}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                {updateStatusMutation.isPending ? 'Updating...' : 'Confirm Change'}
              </button>
            </div>
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
              Update Loan Status - #{loanNumber}
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
          {/* Current Status Display */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Current Status</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[currentStatus] || 'text-gray-700 bg-gray-100'}`}>
                {currentStatus}
              </span>
            </div>
          </div>

          {/* New Status Selection */}
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700">
              New Status
            </label>
            <select
              {...register('status')}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
            >
              {LOAN_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
            {selectedStatus && (
              <p className="mt-2 text-sm text-gray-500">
                {LOAN_STATUSES.find(s => s.value === selectedStatus)?.description}
              </p>
            )}
            {errors.status && (
              <p className="mt-1 text-sm text-red-600">{errors.status.message}</p>
            )}
          </div>

          {/* Warning Message */}
          {hasWarning && (
            <div className="rounded-md bg-yellow-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">Important</h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>{STATUS_WARNINGS[selectedStatus]}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
              Reason for Change
            </label>
            <textarea
              {...register('reason')}
              rows={3}
              className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
              placeholder="Provide a detailed reason for this status change..."
            />
            {errors.reason && (
              <p className="mt-1 text-sm text-red-600">{errors.reason.message}</p>
            )}
          </div>

          {/* Effective Date */}
          <div>
            <label htmlFor="effectiveDate" className="block text-sm font-medium text-gray-700">
              Effective Date
            </label>
            <input
              type="date"
              {...register('effectiveDate', { valueAsDate: true })}
              className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
            />
            {errors.effectiveDate && (
              <p className="mt-1 text-sm text-red-600">{errors.effectiveDate.message}</p>
            )}
          </div>

          {/* Additional Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
              Additional Notes (Optional)
            </label>
            <textarea
              {...register('notes')}
              rows={3}
              className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
              placeholder="Any additional information..."
            />
          </div>

          {/* Compliance Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">Compliance Notice</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>This status change will be recorded in the audit trail. Ensure all regulatory requirements are met before proceeding.</p>
                </div>
              </div>
            </div>
          </div>

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
              disabled={updateStatusMutation.isPending}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
            >
              {updateStatusMutation.isPending ? 'Updating...' : 'Update Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};