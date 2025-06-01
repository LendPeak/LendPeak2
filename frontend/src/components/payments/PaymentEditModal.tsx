import { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { XMarkIcon, ExclamationTriangleIcon, ClockIcon } from '@heroicons/react/24/outline';
import DatePicker from 'react-datepicker';
import { Payment, demoLoanStorage } from '../../services/demoLoanStorage';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { preparePaymentForDisplay, roundCurrency } from '../../utils/rounding';

interface PaymentEditModalProps {
  payment: Payment;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedPayment: Payment) => void;
  onDelete?: (paymentId: string) => void;
}

const editSchema = yup.object({
  amount: yup
    .number()
    .positive('Amount must be positive')
    .required('Amount is required'),
  principal: yup
    .number()
    .min(0, 'Principal cannot be negative')
    .required('Principal is required'),
  interest: yup
    .number()
    .min(0, 'Interest cannot be negative')
    .required('Interest is required'),
  fees: yup
    .number()
    .min(0, 'Fees cannot be negative')
    .required('Fees is required'),
  penalties: yup
    .number()
    .min(0, 'Penalties cannot be negative')
    .required('Penalties is required'),
  escrow: yup
    .number()
    .min(0, 'Escrow cannot be negative')
    .required('Escrow is required'),
  paymentDate: yup
    .date()
    .required('Payment date is required'),
  status: yup
    .string()
    .oneOf(['COMPLETED', 'PENDING', 'FAILED', 'REVERSED', 'PARTIAL'], 'Invalid status')
    .required('Status is required'),
  paymentMethod: yup
    .string()
    .required('Payment method is required'),
  reference: yup.string(),
  notes: yup.string(),
  reason: yup
    .string()
    .required('Please provide a reason for this change'),
});

type EditFormData = yup.InferType<typeof editSchema>;

export const PaymentEditModal = ({ payment, isOpen, onClose, onSave, onDelete }: PaymentEditModalProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [auditTrail, setAuditTrail] = useState<any[]>([]);
  const [showAuditTrail, setShowAuditTrail] = useState(false);

  // Ensure payment date is valid
  const ensureValidDate = (date: any): Date => {
    if (!date) return new Date();
    const parsedDate = date instanceof Date ? date : new Date(date);
    if (isNaN(parsedDate.getTime())) {
      console.warn('Invalid payment date, using current date');
      return new Date();
    }
    return parsedDate;
  };

  // Prepare payment data with proper rounding
  const displayPayment = preparePaymentForDisplay(payment);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm<EditFormData>({
    resolver: yupResolver(editSchema),
    defaultValues: {
      amount: displayPayment.amount,
      principal: displayPayment.principal,
      interest: displayPayment.interest,
      fees: displayPayment.fees,
      penalties: displayPayment.penalties,
      escrow: displayPayment.escrow,
      paymentDate: ensureValidDate(payment.paymentDate),
      status: payment.status === 'DELETED' ? 'COMPLETED' : payment.status,
      paymentMethod: payment.paymentMethod,
      reference: payment.reference || '',
      notes: payment.notes || '',
      reason: '',
    },
  });

  const loadAuditTrail = () => {
    const trail = demoLoanStorage.getPaymentAuditTrail(payment.id);
    setAuditTrail(trail);
    setShowAuditTrail(true);
  };

  const onSubmit = async (data: EditFormData) => {
    setIsSubmitting(true);
    try {
      // Calculate remaining balance based on principal payment
      const currentBalance = payment.remainingBalance + payment.principal - data.principal;
      
      // Apply proper rounding to all monetary values
      const updates: Partial<Payment> = {
        amount: roundCurrency(data.amount),
        principal: roundCurrency(data.principal),
        interest: roundCurrency(data.interest),
        fees: roundCurrency(data.fees),
        penalties: roundCurrency(data.penalties),
        escrow: roundCurrency(data.escrow),
        paymentDate: data.paymentDate,
        status: data.status,
        paymentMethod: data.paymentMethod,
        reference: data.reference || undefined,
        notes: data.notes || undefined,
        remainingBalance: roundCurrency(currentBalance),
      };

      const updatedPayment = demoLoanStorage.updatePayment(payment.id, updates, data.reason);
      onSave(updatedPayment);
      toast.success('Payment updated successfully');
      onClose();
    } catch (error) {
      console.error('Error updating payment:', error);
      toast.error('Failed to update payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    setIsDeleting(true);
    try {
      demoLoanStorage.softDeletePayment(payment.id, 'Payment deleted via UI');
      if (onDelete) {
        onDelete(payment.id);
      }
      toast.success('Payment deleted successfully');
      onClose();
    } catch (error) {
      console.error('Error deleting payment:', error);
      toast.error('Failed to delete payment');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'FAILED': return 'bg-red-100 text-red-800';
      case 'REVERSED': return 'bg-gray-100 text-gray-800';
      case 'PARTIAL': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <>
      <Transition.Root show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[70]" onClose={() => !isSubmitting && onClose()}>
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
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
                  <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                    <button
                      type="button"
                      className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                      onClick={onClose}
                      disabled={isSubmitting}
                    >
                      <span className="sr-only">Close</span>
                      <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="sm:flex sm:items-start">
                    <div className="w-full">
                      <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900 mb-4">
                        Edit Payment #{payment.paymentNumber}
                      </Dialog.Title>

                      {/* Payment Info Header */}
                      <div className="bg-gray-50 rounded-lg p-4 mb-6">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-500">Payment ID:</span>
                            <span className="ml-2 text-gray-900 font-mono">{payment.id}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-500">Current Status:</span>
                            <span className={`ml-2 inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(payment.status)}`}>
                              {payment.status}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-500">Created:</span>
                            <span className="ml-2 text-gray-900">{format(ensureValidDate(payment.createdAt), 'MMM dd, yyyy HH:mm')}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-500">Last Updated:</span>
                            <span className="ml-2 text-gray-900">{format(ensureValidDate(payment.updatedAt), 'MMM dd, yyyy HH:mm')}</span>
                          </div>
                        </div>
                        
                        <div className="mt-4 flex justify-between items-center">
                          <button
                            type="button"
                            onClick={loadAuditTrail}
                            className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                          >
                            <ClockIcon className="h-4 w-4 mr-1" />
                            View Audit Trail
                          </button>
                        </div>
                      </div>

                      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        {/* Payment Details */}
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Payment Date
                            </label>
                            <Controller
                              control={control}
                              name="paymentDate"
                              render={({ field }) => (
                                <DatePicker
                                  selected={field.value}
                                  onChange={field.onChange}
                                  dateFormat="MM/dd/yyyy"
                                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                                  showMonthDropdown
                                  showYearDropdown
                                  dropdownMode="select"
                                />
                              )}
                            />
                            {errors.paymentDate && (
                              <p className="mt-1 text-sm text-red-600">{errors.paymentDate.message}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Status
                            </label>
                            <select
                              {...register('status')}
                              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                            >
                              <option value="COMPLETED">Completed</option>
                              <option value="PENDING">Pending</option>
                              <option value="FAILED">Failed</option>
                              <option value="REVERSED">Reversed</option>
                              <option value="PARTIAL">Partial</option>
                            </select>
                            {errors.status && (
                              <p className="mt-1 text-sm text-red-600">{errors.status.message}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Total Amount
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
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Payment Method
                            </label>
                            <select
                              {...register('paymentMethod')}
                              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                            >
                              <option value="ACH">ACH Transfer</option>
                              <option value="WIRE">Wire Transfer</option>
                              <option value="CHECK">Check</option>
                              <option value="CREDIT_CARD">Credit Card</option>
                              <option value="CASH">Cash</option>
                              <option value="OTHER">Other</option>
                            </select>
                            {errors.paymentMethod && (
                              <p className="mt-1 text-sm text-red-600">{errors.paymentMethod.message}</p>
                            )}
                          </div>
                        </div>

                        {/* Payment Breakdown */}
                        <div className="border-t pt-6">
                          <h4 className="text-md font-medium text-gray-900 mb-4">Payment Breakdown</h4>
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                Principal
                              </label>
                              <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <span className="text-gray-500 sm:text-sm">$</span>
                                </div>
                                <input
                                  type="number"
                                  step="0.01"
                                  {...register('principal', { valueAsNumber: true })}
                                  className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                                />
                              </div>
                              {errors.principal && (
                                <p className="mt-1 text-sm text-red-600">{errors.principal.message}</p>
                              )}
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                Interest
                              </label>
                              <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <span className="text-gray-500 sm:text-sm">$</span>
                                </div>
                                <input
                                  type="number"
                                  step="0.01"
                                  {...register('interest', { valueAsNumber: true })}
                                  className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                                />
                              </div>
                              {errors.interest && (
                                <p className="mt-1 text-sm text-red-600">{errors.interest.message}</p>
                              )}
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                Fees
                              </label>
                              <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <span className="text-gray-500 sm:text-sm">$</span>
                                </div>
                                <input
                                  type="number"
                                  step="0.01"
                                  {...register('fees', { valueAsNumber: true })}
                                  className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                                />
                              </div>
                              {errors.fees && (
                                <p className="mt-1 text-sm text-red-600">{errors.fees.message}</p>
                              )}
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                Penalties
                              </label>
                              <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <span className="text-gray-500 sm:text-sm">$</span>
                                </div>
                                <input
                                  type="number"
                                  step="0.01"
                                  {...register('penalties', { valueAsNumber: true })}
                                  className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                                />
                              </div>
                              {errors.penalties && (
                                <p className="mt-1 text-sm text-red-600">{errors.penalties.message}</p>
                              )}
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                Escrow
                              </label>
                              <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <span className="text-gray-500 sm:text-sm">$</span>
                                </div>
                                <input
                                  type="number"
                                  step="0.01"
                                  {...register('escrow', { valueAsNumber: true })}
                                  className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                                />
                              </div>
                              {errors.escrow && (
                                <p className="mt-1 text-sm text-red-600">{errors.escrow.message}</p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Additional Information */}
                        <div className="border-t pt-6">
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                Reference Number
                              </label>
                              <input
                                type="text"
                                {...register('reference')}
                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                                placeholder="e.g., CHECK123, TXN456"
                              />
                              {errors.reference && (
                                <p className="mt-1 text-sm text-red-600">{errors.reference.message}</p>
                              )}
                            </div>
                          </div>

                          <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700">
                              Notes
                            </label>
                            <textarea
                              {...register('notes')}
                              rows={3}
                              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                              placeholder="Additional notes about this payment..."
                            />
                            {errors.notes && (
                              <p className="mt-1 text-sm text-red-600">{errors.notes.message}</p>
                            )}
                          </div>

                          <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700">
                              Reason for Change *
                            </label>
                            <textarea
                              {...register('reason')}
                              rows={2}
                              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                              placeholder="Please explain why this payment is being modified..."
                            />
                            {errors.reason && (
                              <p className="mt-1 text-sm text-red-600">{errors.reason.message}</p>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-between pt-6 border-t">
                          <div>
                            {onDelete && (
                              <button
                                type="button"
                                onClick={handleDelete}
                                disabled={isDeleting || isSubmitting}
                                className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                              >
                                <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
                                {showDeleteConfirm ? (isDeleting ? 'Deleting...' : 'Confirm Delete') : 'Delete Payment'}
                              </button>
                            )}
                          </div>
                          
                          <div className="flex space-x-3">
                            <button
                              type="button"
                              onClick={onClose}
                              disabled={isSubmitting}
                              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={isSubmitting}
                              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                            >
                              {isSubmitting ? 'Saving...' : 'Save Changes'}
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Audit Trail Modal */}
      <Transition.Root show={showAuditTrail} as={Fragment}>
        <Dialog as="div" className="relative z-[80]" onClose={() => setShowAuditTrail(false)}>
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
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:p-6">
                  <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                    <button
                      type="button"
                      className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                      onClick={() => setShowAuditTrail(false)}
                    >
                      <span className="sr-only">Close</span>
                      <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                    </button>
                  </div>

                  <div>
                    <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900 mb-4">
                      Payment Audit Trail - #{payment.paymentNumber}
                    </Dialog.Title>

                    <div className="max-h-96 overflow-y-auto">
                      {auditTrail.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">No audit trail entries found.</p>
                      ) : (
                        <div className="space-y-4">
                          {auditTrail.map((entry) => (
                            <div key={entry.id} className="border border-gray-200 rounded-lg p-4">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                    {entry.action}
                                  </span>
                                  <span className="ml-2 text-sm text-gray-600">
                                    by {entry.performedBy}
                                  </span>
                                </div>
                                <span className="text-sm text-gray-500">
                                  {format(ensureValidDate(entry.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                                </span>
                              </div>
                              
                              {entry.reason && (
                                <p className="text-sm text-gray-700 mb-2">
                                  <strong>Reason:</strong> {entry.reason}
                                </p>
                              )}
                              
                              {entry.fieldChanges && entry.fieldChanges.length > 0 && (
                                <div className="mt-2">
                                  <p className="text-sm font-medium text-gray-700 mb-1">Changes:</p>
                                  <div className="space-y-1">
                                    {entry.fieldChanges.map((change, index) => (
                                      <div key={index} className="text-sm text-gray-600 bg-gray-50 rounded px-2 py-1">
                                        <strong>{change.field}:</strong> {String(change.oldValue)} → {String(change.newValue)}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    </>
  );
};