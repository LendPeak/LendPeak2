import { useState } from 'react';
import { format } from 'date-fns';
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  BanknotesIcon,
  ClockIcon,
  DocumentTextIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  TrashIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { demoLoanStorage } from '../../services/demoLoanStorage';

interface Modification {
  id: string;
  type: 'RATE_CHANGE' | 'PAYMENT_DATE_CHANGE' | 'TERM_EXTENSION' | 'FORBEARANCE' | 'DEFERMENT' | 'PRINCIPAL_REDUCTION' | 'RESTRUCTURE' | 'REVERSAL' | 'OTHER';
  date: Date;
  description?: string;
  previousValue?: string;
  newValue?: string;
  reason: string;
  approvedBy: string;
  effectiveDate?: Date;
  endDate?: Date;
  changes?: any;
  status?: 'ACTIVE' | 'REVERSED' | 'SUPERSEDED';
  reversedBy?: string;
  reversedDate?: Date;
  reversalReason?: string;
}

interface ModificationHistoryProps {
  modifications: Modification[];
  loanId: string;
  onModificationUpdate?: () => void;
}

const modificationIcons = {
  RATE_CHANGE: BanknotesIcon,
  PAYMENT_DATE_CHANGE: CalendarDaysIcon,
  TERM_EXTENSION: ClockIcon,
  FORBEARANCE: ArrowPathIcon,
  DEFERMENT: ArrowPathIcon,
  PRINCIPAL_REDUCTION: BanknotesIcon,
  RESTRUCTURE: ArrowPathIcon,
  REVERSAL: XMarkIcon,
  OTHER: DocumentTextIcon,
};

const modificationColors = {
  RATE_CHANGE: 'bg-blue-100 text-blue-800',
  PAYMENT_DATE_CHANGE: 'bg-purple-100 text-purple-800',
  TERM_EXTENSION: 'bg-green-100 text-green-800',
  FORBEARANCE: 'bg-yellow-100 text-yellow-800',
  DEFERMENT: 'bg-orange-100 text-orange-800',
  PRINCIPAL_REDUCTION: 'bg-red-100 text-red-800',
  RESTRUCTURE: 'bg-indigo-100 text-indigo-800',
  REVERSAL: 'bg-red-100 text-red-800',
  OTHER: 'bg-gray-100 text-gray-800',
};

export const ModificationHistory = ({ modifications, loanId, onModificationUpdate }: ModificationHistoryProps) => {
  const [showReverseModal, setShowReverseModal] = useState(false);
  const [selectedModification, setSelectedModification] = useState<Modification | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [isReversing, setIsReversing] = useState(false);

  const handleReverseModification = async () => {
    if (!selectedModification || !reversalReason.trim()) {
      toast.error('Please provide a reason for the reversal');
      return;
    }

    setIsReversing(true);
    try {
      // Create a reversal record with proper change data
      const reversalRecord = {
        loanId,
        type: 'REVERSAL',
        date: new Date(),
        changes: {
          originalModificationId: selectedModification.id,
          originalModificationType: selectedModification.type,
          originalChanges: selectedModification.changes, // Include original change data for reversal calculation
          reversalReason,
        },
        reason: `Reversal of ${selectedModification.type.replace(/_/g, ' ').toLowerCase()}: ${reversalReason}`,
        approvedBy: 'Demo User',
      };

      // Add the reversal record
      await demoLoanStorage.addModification(reversalRecord);

      // Update the original modification status (this would be done in a real backend)
      // For demo purposes, we'll just add the reversal and let the UI handle display

      toast.success('Modification reversed successfully');
      setShowReverseModal(false);
      setSelectedModification(null);
      setReversalReason('');
      
      if (onModificationUpdate) {
        onModificationUpdate();
      }
    } catch (error) {
      toast.error('Failed to reverse modification');
    } finally {
      setIsReversing(false);
    }
  };

  const openReverseModal = (modification: Modification) => {
    setSelectedModification(modification);
    setShowReverseModal(true);
  };

  if (modifications.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-center py-12">
          <ArrowPathIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No modifications</h3>
          <p className="mt-1 text-sm text-gray-500">This loan has not been modified.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Modification History</h3>
        <p className="mt-1 text-sm text-gray-500">
          All changes made to the original loan terms
        </p>
      </div>

      <div className="flow-root">
        <ul className="-mb-8">
          {modifications.map((modification, modificationIdx) => {
            const Icon = modificationIcons[modification.type];
            const colorClasses = modificationColors[modification.type];

            return (
              <li key={modification.id}>
                <div className="relative pb-8">
                  {modificationIdx !== modifications.length - 1 ? (
                    <span
                      className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                      aria-hidden="true"
                    />
                  ) : null}
                  <div className="relative flex space-x-3">
                    <div>
                      <span
                        className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                          modification.status === 'REVERSED' 
                            ? 'bg-red-100 text-red-600 opacity-60' 
                            : colorClasses
                        }`}
                      >
                        {modification.status === 'REVERSED' ? (
                          <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                        ) : (
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        )}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                      <div className={modification.status === 'REVERSED' ? 'opacity-60' : ''}>
                        <div className="flex items-center space-x-2">
                          <p className={`text-sm ${modification.status === 'REVERSED' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                            {modification.type === 'RESTRUCTURE' 
                              ? 'Loan Restructuring' 
                              : modification.type === 'REVERSAL'
                              ? `Reversal of ${modification.changes?.originalModificationType?.replace(/_/g, ' ')}`
                              : (modification.description || modification.type.replace(/_/g, ' '))}
                          </p>
                          {modification.status === 'REVERSED' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                              REVERSED
                            </span>
                          )}
                          {modification.type === 'REVERSAL' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                              REVERSAL
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-sm text-gray-500">
                          {modification.type === 'RESTRUCTURE' && modification.changes?.modifications ? (
                            <>
                              <p className="font-medium">Modifications included:</p>
                              <ul className="list-disc list-inside mt-1">
                                {modification.changes.modifications.map((mod: any, idx: number) => (
                                  <li key={idx}>{mod.type.replace(/_/g, ' ').toLowerCase()}</li>
                                ))}
                              </ul>
                            </>
                          ) : (
                            <>
                              {modification.previousValue && (
                                <p>Previous: <span className="font-medium text-gray-700">{modification.previousValue}</span></p>
                              )}
                              {modification.newValue && (
                                <p>New: <span className="font-medium text-gray-700">{modification.newValue}</span></p>
                              )}
                            </>
                          )}
                          <p className="mt-1">Reason: {modification.reason}</p>
                          {modification.effectiveDate && (
                            <p>Effective: {format(new Date(modification.effectiveDate), 'MMM d, yyyy')}</p>
                          )}
                          {modification.endDate && (
                            <p>Ends: {format(new Date(modification.endDate), 'MMM d, yyyy')}</p>
                          )}
                          {modification.status === 'REVERSED' && modification.reversedDate && (
                            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                              <p className="text-xs text-red-700">
                                <strong>Reversed:</strong> {format(new Date(modification.reversedDate), 'MMM d, yyyy')} by {modification.reversedBy}
                              </p>
                              {modification.reversalReason && (
                                <p className="text-xs text-red-600 mt-1">Reason: {modification.reversalReason}</p>
                              )}
                            </div>
                          )}
                          {modification.type === 'REVERSAL' && modification.changes && (
                            <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded">
                              <p className="text-xs text-orange-700">
                                <strong>Original modification reversed:</strong> {modification.changes.originalModificationType?.replace(/_/g, ' ')}
                              </p>
                              <p className="text-xs text-orange-600 mt-1">Reason: {modification.changes.reversalReason}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="whitespace-nowrap text-right text-sm text-gray-500">
                        <div className="flex flex-col items-end space-y-2">
                          <div>
                            <time dateTime={new Date(modification.date).toISOString()}>
                              {format(new Date(modification.date), 'MMM d, yyyy')}
                            </time>
                            <p className="mt-1">by {modification.approvedBy}</p>
                          </div>
                          {modification.type !== 'REVERSAL' && modification.status !== 'REVERSED' && (
                            <button
                              onClick={() => openReverseModal(modification)}
                              className="inline-flex items-center px-2 py-1 border border-red-300 text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50 transition-colors"
                              title="Reverse this modification"
                            >
                              <TrashIcon className="h-3 w-3 mr-1" />
                              Reverse
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Reversal Modal */}
      {showReverseModal && selectedModification && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Reverse Modification</h3>
              <button
                onClick={() => setShowReverseModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
                <span className="text-sm font-medium text-gray-900">
                  You are about to reverse:
                </span>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-900">
                  {selectedModification.type === 'RESTRUCTURE' 
                    ? 'Loan Restructuring' 
                    : selectedModification.description || selectedModification.type.replace(/_/g, ' ')}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Applied on {format(new Date(selectedModification.date), 'MMM d, yyyy')} by {selectedModification.approvedBy}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="reversalReason" className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Reversal <span className="text-red-500">*</span>
              </label>
              <textarea
                id="reversalReason"
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                rows={3}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                placeholder="Explain why this modification needs to be reversed..."
              />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4">
              <div className="flex">
                <ExclamationTriangleIcon className="h-5 w-5 text-amber-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-amber-800">Important Notice</h3>
                  <div className="mt-2 text-sm text-amber-700">
                    <p>
                      This action will reverse the modification but maintain a complete audit trail. 
                      The original modification will be marked as reversed and a new reversal record will be created.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowReverseModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReverseModification}
                disabled={!reversalReason.trim() || isReversing}
                className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isReversing ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Reversing...
                  </div>
                ) : (
                  'Reverse Modification'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};