import { useState, useEffect, Fragment } from 'react';
import { PencilIcon, TrashIcon, ClockIcon, EyeIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { Dialog, Transition } from '@headlessui/react';
import { Payment, demoLoanStorage } from '../../services/demoLoanStorage';
import { PaymentEditModal } from './PaymentEditModal';
import { toast } from 'react-toastify';
import { formatCurrency as formatCurrencyUtil } from '../../utils/rounding';

interface PaymentHistoryProps {
  loanId: string;
  onPaymentUpdate?: () => void;
  refreshTrigger?: number; // Add this to force refresh from parent
}

export const PaymentHistory = ({ loanId, onPaymentUpdate, refreshTrigger }: PaymentHistoryProps) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showDeletedPayments, setShowDeletedPayments] = useState(false);
  const [viewingPayment, setViewingPayment] = useState<Payment | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Ensure date is valid for display
  const ensureValidDate = (date: any): Date => {
    if (!date) return new Date();
    const parsedDate = date instanceof Date ? date : new Date(date);
    if (isNaN(parsedDate.getTime())) {
      console.warn('Invalid date value in payment:', date);
      return new Date();
    }
    return parsedDate;
  };

  useEffect(() => {
    loadPayments();
  }, [loanId, showDeletedPayments, refreshTrigger]);

  const loadPayments = () => {
    const allPayments = demoLoanStorage.getPayments(loanId, showDeletedPayments);
    // Sort by payment number descending (newest first)
    const sortedPayments = allPayments.sort((a, b) => b.paymentNumber - a.paymentNumber);
    setPayments(sortedPayments);
  };

  const handleEditPayment = (payment: Payment) => {
    setEditingPayment(payment);
    setIsEditModalOpen(true);
  };

  const handleViewPayment = (payment: Payment) => {
    setViewingPayment(payment);
    setIsViewModalOpen(true);
  };

  const handlePaymentSaved = (updatedPayment: Payment) => {
    loadPayments();
    if (onPaymentUpdate) {
      onPaymentUpdate();
    }
    toast.success('Payment updated successfully');
  };

  const handlePaymentDeleted = (paymentId: string) => {
    loadPayments();
    if (onPaymentUpdate) {
      onPaymentUpdate();
    }
    toast.success('Payment deleted successfully');
  };

  const handleRestorePayment = (paymentId: string) => {
    try {
      demoLoanStorage.restorePayment(paymentId, 'demo-user', 'COMPLETED', 'Payment restored via UI');
      loadPayments();
      if (onPaymentUpdate) {
        onPaymentUpdate();
      }
      toast.success('Payment restored successfully');
    } catch (error) {
      console.error('Error restoring payment:', error);
      toast.error('Failed to restore payment');
    }
  };

  const formatCurrency = (amount: number) => {
    return formatCurrencyUtil(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'FAILED': return 'bg-red-100 text-red-800';
      case 'REVERSED': return 'bg-gray-100 text-gray-800';
      case 'PARTIAL': return 'bg-blue-100 text-blue-800';
      case 'DELETED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'ACH': return '🏦';
      case 'WIRE': return '💸';
      case 'CHECK': return '📝';
      case 'CREDIT_CARD': return '💳';
      case 'CASH': return '💵';
      default: return '💰';
    }
  };

  const deletedPayments = payments.filter(p => p.isDeleted);
  const activePayments = payments.filter(p => !p.isDeleted);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Payment History</h3>
        <div className="flex items-center space-x-4">
          {deletedPayments.length > 0 && (
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={showDeletedPayments}
                onChange={(e) => setShowDeletedPayments(e.target.checked)}
                className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="ml-2 text-sm text-gray-700">
                Show deleted payments ({deletedPayments.length})
              </span>
            </label>
          )}
        </div>
      </div>

      {/* Active Payments */}
      {activePayments.length === 0 && !showDeletedPayments ? (
        <div className="text-center py-8 text-gray-500">
          <p>No payments recorded for this loan.</p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Principal
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Interest
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Remaining Balance
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(showDeletedPayments ? payments : activePayments).map((payment) => (
                  <tr 
                    key={payment.id} 
                    className={`hover:bg-gray-50 ${payment.isDeleted ? 'opacity-60 bg-red-50' : ''}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {payment.paymentNumber}
                      {payment.isDeleted && (
                        <span className="ml-2 text-xs text-red-600">(DELETED)</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(ensureValidDate(payment.paymentDate), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(payment.principal)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(payment.interest)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <span className="mr-2">{getPaymentMethodIcon(payment.paymentMethod)}</span>
                        {payment.paymentMethod}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(payment.status)}`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(payment.remainingBalance)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        {payment.isDeleted ? (
                          <button
                            onClick={() => handleRestorePayment(payment.id)}
                            className="text-green-600 hover:text-green-900 p-1 rounded-md hover:bg-green-50"
                            title="Restore payment"
                          >
                            <ClockIcon className="h-4 w-4" />
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleEditPayment(payment)}
                              className="text-primary-600 hover:text-primary-900 p-1 rounded-md hover:bg-primary-50"
                              title="Edit payment"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        
                        <button
                          onClick={() => handleViewPayment(payment)}
                          className="text-gray-600 hover:text-gray-900 p-1 rounded-md hover:bg-gray-50"
                          title="View payment details"
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
      )}

      {/* Payment Details Breakdown */}
      {activePayments.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h4 className="text-md font-medium text-gray-900 mb-4">Payment Summary</h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <dt className="text-sm font-medium text-gray-500">Total Payments</dt>
              <dd className="mt-1 text-lg font-semibold text-gray-900">
                {activePayments.length}
              </dd>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <dt className="text-sm font-medium text-gray-500">Total Amount Paid</dt>
              <dd className="mt-1 text-lg font-semibold text-gray-900">
                {formatCurrency(activePayments.reduce((sum, p) => sum + p.amount, 0))}
              </dd>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <dt className="text-sm font-medium text-gray-500">Total Principal Paid</dt>
              <dd className="mt-1 text-lg font-semibold text-gray-900">
                {formatCurrency(activePayments.reduce((sum, p) => sum + p.principal, 0))}
              </dd>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <dt className="text-sm font-medium text-gray-500">Total Interest Paid</dt>
              <dd className="mt-1 text-lg font-semibold text-gray-900">
                {formatCurrency(activePayments.reduce((sum, p) => sum + p.interest, 0))}
              </dd>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingPayment && (
        <PaymentEditModal
          payment={editingPayment}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingPayment(null);
          }}
          onSave={handlePaymentSaved}
          onDelete={handlePaymentDeleted}
        />
      )}

      {/* Payment Details Modal */}
      {viewingPayment && (
        <Transition.Root show={isViewModalOpen} as={Fragment}>
          <Dialog as="div" className="relative z-[70]" onClose={() => setIsViewModalOpen(false)}>
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
                        onClick={() => setIsViewModalOpen(false)}
                      >
                        <span className="sr-only">Close</span>
                        <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                      </button>
                    </div>

                    <div className="sm:flex sm:items-start">
                      <div className="w-full">
                        <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900 mb-4">
                          Payment Details - #{viewingPayment.paymentNumber}
                        </Dialog.Title>

                        <div className="space-y-6">
                          {/* Payment Summary */}
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h4 className="text-md font-medium text-gray-900 mb-3">Payment Summary</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="font-medium text-gray-500">Payment ID:</span>
                                <span className="ml-2 text-gray-900 font-mono">{viewingPayment.id}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-500">Status:</span>
                                <span className={`ml-2 inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(viewingPayment.status)}`}>
                                  {viewingPayment.status}
                                </span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-500">Payment Date:</span>
                                <span className="ml-2 text-gray-900">{format(ensureValidDate(viewingPayment.paymentDate), 'MMMM dd, yyyy')}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-500">Method:</span>
                                <span className="ml-2 text-gray-900">
                                  {getPaymentMethodIcon(viewingPayment.paymentMethod)} {viewingPayment.paymentMethod}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Payment Breakdown */}
                          <div className="border rounded-lg p-4">
                            <h4 className="text-md font-medium text-gray-900 mb-3">Payment Breakdown</h4>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div className="flex justify-between py-2 border-b border-gray-100">
                                <span className="text-sm font-medium text-gray-500">Total Amount:</span>
                                <span className="text-sm font-semibold text-gray-900">{formatCurrency(viewingPayment.amount)}</span>
                              </div>
                              <div className="flex justify-between py-2 border-b border-gray-100">
                                <span className="text-sm font-medium text-gray-500">Principal:</span>
                                <span className="text-sm text-gray-900">{formatCurrency(viewingPayment.principal)}</span>
                              </div>
                              <div className="flex justify-between py-2 border-b border-gray-100">
                                <span className="text-sm font-medium text-gray-500">Interest:</span>
                                <span className="text-sm text-gray-900">{formatCurrency(viewingPayment.interest)}</span>
                              </div>
                              <div className="flex justify-between py-2 border-b border-gray-100">
                                <span className="text-sm font-medium text-gray-500">Fees:</span>
                                <span className="text-sm text-gray-900">{formatCurrency(viewingPayment.fees || 0)}</span>
                              </div>
                              <div className="flex justify-between py-2 border-b border-gray-100">
                                <span className="text-sm font-medium text-gray-500">Penalties:</span>
                                <span className="text-sm text-gray-900">{formatCurrency(viewingPayment.penalties || 0)}</span>
                              </div>
                              <div className="flex justify-between py-2 border-b border-gray-100">
                                <span className="text-sm font-medium text-gray-500">Escrow:</span>
                                <span className="text-sm text-gray-900">{formatCurrency(viewingPayment.escrow || 0)}</span>
                              </div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <div className="flex justify-between">
                                <span className="text-sm font-medium text-gray-700">Remaining Balance:</span>
                                <span className="text-sm font-semibold text-gray-900">{formatCurrency(viewingPayment.remainingBalance)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Additional Information */}
                          {(viewingPayment.reference || viewingPayment.notes) && (
                            <div className="border rounded-lg p-4">
                              <h4 className="text-md font-medium text-gray-900 mb-3">Additional Information</h4>
                              {viewingPayment.reference && (
                                <div className="mb-2">
                                  <span className="text-sm font-medium text-gray-500">Reference:</span>
                                  <span className="ml-2 text-sm text-gray-900 font-mono">{viewingPayment.reference}</span>
                                </div>
                              )}
                              {viewingPayment.notes && (
                                <div>
                                  <span className="text-sm font-medium text-gray-500">Notes:</span>
                                  <p className="mt-1 text-sm text-gray-900">{viewingPayment.notes}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Audit Information */}
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h4 className="text-md font-medium text-gray-900 mb-3">Audit Information</h4>
                            <div className="grid grid-cols-1 gap-2 text-sm">
                              <div>
                                <span className="font-medium text-gray-500">Created:</span>
                                <span className="ml-2 text-gray-900">{format(ensureValidDate(viewingPayment.createdAt), 'MMM dd, yyyy HH:mm:ss')}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-500">Last Updated:</span>
                                <span className="ml-2 text-gray-900">{format(ensureValidDate(viewingPayment.updatedAt), 'MMM dd, yyyy HH:mm:ss')}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-500">Created By:</span>
                                <span className="ml-2 text-gray-900">{viewingPayment.createdBy || 'System'}</span>
                              </div>
                            </div>
                            <div className="mt-3">
                              <button
                                onClick={() => {
                                  const auditTrail = demoLoanStorage.getPaymentAuditTrail(viewingPayment.id);
                                  console.log('Payment Audit Trail:', auditTrail);
                                  toast.info('Audit trail logged to console');
                                }}
                                className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                              >
                                <ClockIcon className="h-4 w-4 mr-1" />
                                View Full Audit Trail
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-6 flex justify-between">
                          <button
                            onClick={() => {
                              setIsViewModalOpen(false);
                              setViewingPayment(null);
                              handleEditPayment(viewingPayment);
                            }}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                          >
                            <PencilIcon className="h-4 w-4 mr-2" />
                            Edit Payment
                          </button>
                          
                          <button
                            onClick={() => {
                              setIsViewModalOpen(false);
                              setViewingPayment(null);
                            }}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition.Root>
      )}
    </div>
  );
};