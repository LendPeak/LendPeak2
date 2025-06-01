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
  EyeIcon,
  PencilSquareIcon,
  ClipboardDocumentIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ArrowUturnLeftIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { demoLoanStorage } from '../../services/demoLoanStorage';

interface ModificationTransaction {
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
  reversalId?: string; // ID of the reversal transaction
  originalModificationId?: string; // For reversal transactions
  canBeReversed?: boolean;
  impactSummary?: {
    paymentChange: number;
    termChange: number;
    interestChange: number;
    principalChange: number;
  };
}

interface EnhancedModificationHistoryProps {
  modifications: ModificationTransaction[];
  loanId: string;
  onModificationUpdate?: () => void;
  onEditModification?: (modification: ModificationTransaction) => void;
  onCreateFromTemplate?: (modification: ModificationTransaction) => void;
}

const modificationIcons = {
  RATE_CHANGE: BanknotesIcon,
  PAYMENT_DATE_CHANGE: CalendarDaysIcon,
  TERM_EXTENSION: ClockIcon,
  FORBEARANCE: ArrowPathIcon,
  DEFERMENT: ArrowPathIcon,
  PRINCIPAL_REDUCTION: BanknotesIcon,
  RESTRUCTURE: ArrowPathIcon,
  REVERSAL: ArrowUturnLeftIcon,
  OTHER: DocumentTextIcon,
};

const modificationColors = {
  RATE_CHANGE: 'bg-blue-100 text-blue-800 border-blue-200',
  PAYMENT_DATE_CHANGE: 'bg-purple-100 text-purple-800 border-purple-200',
  TERM_EXTENSION: 'bg-green-100 text-green-800 border-green-200',
  FORBEARANCE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  DEFERMENT: 'bg-orange-100 text-orange-800 border-orange-200',
  PRINCIPAL_REDUCTION: 'bg-red-100 text-red-800 border-red-200',
  RESTRUCTURE: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  REVERSAL: 'bg-gray-100 text-gray-800 border-gray-200',
  OTHER: 'bg-gray-100 text-gray-800 border-gray-200',
};

export const EnhancedModificationHistory = ({ 
  modifications, 
  loanId, 
  onModificationUpdate, 
  onEditModification,
  onCreateFromTemplate 
}: EnhancedModificationHistoryProps) => {
  const [showReverseModal, setShowReverseModal] = useState(false);
  const [selectedModification, setSelectedModification] = useState<ModificationTransaction | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [isReversing, setIsReversing] = useState(false);
  const [expandedModifications, setExpandedModifications] = useState<Set<string>>(new Set());
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedForDetails, setSelectedForDetails] = useState<ModificationTransaction | null>(null);

  const toggleExpanded = (modificationId: string) => {
    const newExpanded = new Set(expandedModifications);
    if (newExpanded.has(modificationId)) {
      newExpanded.delete(modificationId);
    } else {
      newExpanded.add(modificationId);
    }
    setExpandedModifications(newExpanded);
  };

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
          originalChanges: selectedModification.changes,
          reversalReason,
        },
        reason: `Reversal of ${selectedModification.type.replace(/_/g, ' ').toLowerCase()}: ${reversalReason}`,
        approvedBy: 'Demo User',
      };

      // Add the reversal record
      await demoLoanStorage.addModification(reversalRecord);

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

  const openReverseModal = (modification: ModificationTransaction) => {
    setSelectedModification(modification);
    setShowReverseModal(true);
  };

  const openDetailModal = (modification: ModificationTransaction) => {
    setSelectedForDetails(modification);
    setShowDetailModal(true);
  };

  const handleEditModification = (modification: ModificationTransaction) => {
    if (onEditModification) {
      onEditModification(modification);
    }
  };

  const handleCreateFromTemplate = (modification: ModificationTransaction) => {
    if (onCreateFromTemplate) {
      onCreateFromTemplate(modification);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(3)}%`;
  };

  const getModificationStatusColor = (modification: ModificationTransaction) => {
    if (modification.status === 'REVERSED') {
      return 'bg-red-100 text-red-800 border-red-200';
    }
    if (modification.status === 'SUPERSEDED') {
      return 'bg-gray-100 text-gray-600 border-gray-200';
    }
    if (modification.type === 'REVERSAL') {
      return 'bg-orange-100 text-orange-800 border-orange-200';
    }
    return modificationColors[modification.type] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const canReverse = (modification: ModificationTransaction) => {
    return modification.type !== 'REVERSAL' && 
           modification.status !== 'REVERSED' && 
           !modifications.some(m => m.type === 'REVERSAL' && m.changes?.originalModificationId === modification.id);
  };

  if (modifications.length === 0) {
    return (
      <div className="bg-white shadow-sm rounded-xl border border-gray-200 p-6">
        <div className="text-center py-12">
          <ArrowPathIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No modifications</h3>
          <p className="mt-1 text-sm text-gray-500">This loan has not been modified.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-sm rounded-xl border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Modification History</h3>
            <p className="mt-1 text-sm text-gray-500">
              Complete audit trail of all loan modifications and their impacts
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="text-sm text-gray-500">
              <span className="font-medium text-gray-900">{modifications.length}</span> total transactions
            </div>
          </div>
        </div>
      </div>

      <div className="flow-root p-6">
        <ul className="-mb-8 space-y-6">
          {modifications.map((modification, modificationIdx) => {
            const Icon = modificationIcons[modification.type] || DocumentTextIcon;
            const isExpanded = expandedModifications.has(modification.id);
            const hasDetails = modification.changes && Object.keys(modification.changes).length > 0;
            const isReversed = modification.status === 'REVERSED';
            const isReversal = modification.type === 'REVERSAL';

            return (
              <li key={modification.id}>
                <div className="relative">
                  {modificationIdx !== modifications.length - 1 && (
                    <span
                      className="absolute top-12 left-6 -ml-px h-full w-0.5 bg-gray-200"
                      aria-hidden="true"
                    />
                  )}
                  
                  <div className={`relative bg-white border rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200 ${
                    isReversed ? 'border-red-200 bg-red-50/30' : 
                    isReversal ? 'border-orange-200 bg-orange-50/30' : 
                    'border-gray-200 hover:border-gray-300'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        <div>
                          <span className={`h-12 w-12 rounded-xl flex items-center justify-center border-2 ${getModificationStatusColor(modification)}`}>
                            {isReversed ? (
                              <XMarkIcon className="h-6 w-6" />
                            ) : (
                              <Icon className="h-6 w-6" />
                            )}
                          </span>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className={`text-lg font-semibold ${isReversed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                              {modification.type === 'RESTRUCTURE' 
                                ? 'Loan Restructuring Package' 
                                : modification.type === 'REVERSAL'
                                ? `Reversal of ${modification.changes?.originalModificationType?.replace(/_/g, ' ')}`
                                : (modification.description || modification.type.replace(/_/g, ' '))}
                            </h4>
                            
                            {/* Status Badges */}
                            <div className="flex items-center space-x-2">
                              {isReversed && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  REVERSED
                                </span>
                              )}
                              {isReversal && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                  REVERSAL
                                </span>
                              )}
                              {modification.status === 'SUPERSEDED' && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                  SUPERSEDED
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Quick Impact Summary */}
                          {modification.impactSummary && !isReversed && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                              <div className="text-center">
                                <div className="text-sm font-medium text-gray-900">
                                  {modification.impactSummary.paymentChange > 0 ? '+' : ''}
                                  {formatCurrency(modification.impactSummary.paymentChange)}
                                </div>
                                <div className="text-xs text-gray-500">Payment Change</div>
                              </div>
                              <div className="text-center">
                                <div className="text-sm font-medium text-gray-900">
                                  {modification.impactSummary.termChange > 0 ? '+' : ''}
                                  {modification.impactSummary.termChange} mo
                                </div>
                                <div className="text-xs text-gray-500">Term Change</div>
                              </div>
                              <div className="text-center">
                                <div className="text-sm font-medium text-gray-900">
                                  {modification.impactSummary.interestChange > 0 ? '+' : ''}
                                  {formatCurrency(modification.impactSummary.interestChange)}
                                </div>
                                <div className="text-xs text-gray-500">Interest Impact</div>
                              </div>
                              <div className="text-center">
                                <div className="text-sm font-medium text-gray-900">
                                  {modification.impactSummary.principalChange > 0 ? '+' : ''}
                                  {formatCurrency(modification.impactSummary.principalChange)}
                                </div>
                                <div className="text-xs text-gray-500">Principal Change</div>
                              </div>
                            </div>
                          )}

                          {/* Basic Details */}
                          <div className="text-sm text-gray-600 space-y-2">
                            {modification.previousValue && modification.newValue && (
                              <div className="flex items-center space-x-4">
                                <span>Previous: <span className="font-medium text-gray-700">{modification.previousValue}</span></span>
                                <span>→</span>
                                <span>New: <span className="font-medium text-gray-700">{modification.newValue}</span></span>
                              </div>
                            )}
                            
                            <div>
                              <span className="font-medium">Reason:</span> {modification.reason}
                            </div>
                            
                            {modification.effectiveDate && (
                              <div>
                                <span className="font-medium">Effective:</span> {format(new Date(modification.effectiveDate), 'MMM d, yyyy')}
                              </div>
                            )}
                            
                            {modification.endDate && (
                              <div>
                                <span className="font-medium">Ends:</span> {format(new Date(modification.endDate), 'MMM d, yyyy')}
                              </div>
                            )}
                          </div>

                          {/* Reversal Information */}
                          {isReversed && modification.reversedDate && (
                            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                              <div className="flex items-start space-x-2">
                                <ArrowUturnLeftIcon className="h-4 w-4 text-red-600 mt-0.5" />
                                <div className="text-sm">
                                  <p className="text-red-800 font-medium">
                                    Reversed on {format(new Date(modification.reversedDate), 'MMM d, yyyy')} by {modification.reversedBy}
                                  </p>
                                  {modification.reversalReason && (
                                    <p className="text-red-700 mt-1">Reason: {modification.reversalReason}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Reversal Target Information */}
                          {isReversal && modification.changes && (
                            <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                              <div className="flex items-start space-x-2">
                                <InformationCircleIcon className="h-4 w-4 text-orange-600 mt-0.5" />
                                <div className="text-sm">
                                  <p className="text-orange-800 font-medium">
                                    Reversed: {modification.changes.originalModificationType?.replace(/_/g, ' ')}
                                  </p>
                                  <p className="text-orange-700 mt-1">Reason: {modification.changes.reversalReason}</p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Expandable Details */}
                          {hasDetails && (
                            <div className="mt-4">
                              <button
                                onClick={() => toggleExpanded(modification.id)}
                                className="flex items-center space-x-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
                              >
                                {isExpanded ? (
                                  <ChevronDownIcon className="h-4 w-4" />
                                ) : (
                                  <ChevronRightIcon className="h-4 w-4" />
                                )}
                                <span>{isExpanded ? 'Hide' : 'Show'} detailed changes</span>
                              </button>
                              
                              {isExpanded && (
                                <div className="mt-3 p-4 bg-gray-50 rounded-lg">
                                  <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                                    {JSON.stringify(modification.changes, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-start space-x-2 ml-4">
                        <div className="text-right text-sm text-gray-500 mb-3">
                          <time dateTime={new Date(modification.date).toISOString()}>
                            {format(new Date(modification.date), 'MMM d, yyyy')}
                          </time>
                          <p className="mt-1">by {modification.approvedBy}</p>
                        </div>
                        
                        <div className="flex flex-col space-y-2">
                          {/* View Details Button */}
                          <button
                            onClick={() => openDetailModal(modification)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                            title="View full details"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>

                          {/* Edit/Recreate Button - only for non-reversal, non-reversed modifications */}
                          {!isReversal && !isReversed && (
                            <button
                              onClick={() => handleEditModification(modification)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Edit/Recreate modification"
                            >
                              <PencilSquareIcon className="h-4 w-4" />
                            </button>
                          )}

                          {/* Template Button */}
                          <button
                            onClick={() => handleCreateFromTemplate(modification)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                            title="Use as template"
                          >
                            <ClipboardDocumentIcon className="h-4 w-4" />
                          </button>

                          {/* Reverse Button */}
                          {canReverse(modification) && (
                            <button
                              onClick={() => openReverseModal(modification)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Reverse this modification"
                            >
                              <ArrowUturnLeftIcon className="h-4 w-4" />
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

      {/* Detail Modal */}
      {showDetailModal && selectedForDetails && (
        <ModificationDetailModal
          modification={selectedForDetails}
          onClose={() => setShowDetailModal(false)}
        />
      )}

      {/* Reversal Modal */}
      {showReverseModal && selectedModification && (
        <ReversalModal
          modification={selectedModification}
          reversalReason={reversalReason}
          setReversalReason={setReversalReason}
          isReversing={isReversing}
          onConfirm={handleReverseModification}
          onClose={() => setShowReverseModal(false)}
        />
      )}
    </div>
  );
};

// Separate Modal Components
const ModificationDetailModal = ({ 
  modification, 
  onClose 
}: { 
  modification: ModificationTransaction; 
  onClose: () => void; 
}) => {
  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto mx-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">Modification Details</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Type</label>
                <p className="mt-1 text-sm text-gray-900">{modification.type.replace(/_/g, ' ')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <p className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    modification.status === 'REVERSED' ? 'bg-red-100 text-red-800' :
                    modification.status === 'SUPERSEDED' ? 'bg-gray-100 text-gray-600' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {modification.status || 'ACTIVE'}
                  </span>
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Applied Date</label>
                <p className="mt-1 text-sm text-gray-900">
                  {format(new Date(modification.date), 'PPP p')}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Approved By</label>
                <p className="mt-1 text-sm text-gray-900">{modification.approvedBy}</p>
              </div>
            </div>
            
            <div className="space-y-4">
              {modification.effectiveDate && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Effective Date</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {format(new Date(modification.effectiveDate), 'PPP')}
                  </p>
                </div>
              )}
              {modification.endDate && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">End Date</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {format(new Date(modification.endDate), 'PPP')}
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">Reason</label>
                <p className="mt-1 text-sm text-gray-900">{modification.reason}</p>
              </div>
            </div>
          </div>

          {/* Changes Details */}
          {modification.changes && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Detailed Changes</label>
              <div className="bg-gray-50 rounded-lg p-4">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                  {JSON.stringify(modification.changes, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Impact Summary */}
          {modification.impactSummary && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Impact Summary</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-lg font-semibold text-blue-900">
                    {modification.impactSummary.paymentChange > 0 ? '+' : ''}
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    }).format(modification.impactSummary.paymentChange)}
                  </div>
                  <div className="text-sm text-blue-700">Payment Change</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-lg font-semibold text-green-900">
                    {modification.impactSummary.termChange > 0 ? '+' : ''}
                    {modification.impactSummary.termChange} mo
                  </div>
                  <div className="text-sm text-green-700">Term Change</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <div className="text-lg font-semibold text-purple-900">
                    {modification.impactSummary.interestChange > 0 ? '+' : ''}
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    }).format(modification.impactSummary.interestChange)}
                  </div>
                  <div className="text-sm text-purple-700">Interest Impact</div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4 text-center">
                  <div className="text-lg font-semibold text-orange-900">
                    {modification.impactSummary.principalChange > 0 ? '+' : ''}
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    }).format(modification.impactSummary.principalChange)}
                  </div>
                  <div className="text-sm text-orange-700">Principal Change</div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-8 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const ReversalModal = ({
  modification,
  reversalReason,
  setReversalReason,
  isReversing,
  onConfirm,
  onClose
}: {
  modification: ModificationTransaction;
  reversalReason: string;
  setReversalReason: (reason: string) => void;
  isReversing: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) => {
  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Reverse Modification</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        
        <div className="mb-4">
          <div className="flex items-center space-x-2 mb-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
            <span className="text-sm font-medium text-gray-900">
              You are about to reverse:
            </span>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-sm font-medium text-gray-900">
              {modification.type === 'RESTRUCTURE' 
                ? 'Loan Restructuring Package' 
                : modification.description || modification.type.replace(/_/g, ' ')}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Applied on {format(new Date(modification.date), 'MMM d, yyyy')} by {modification.approvedBy}
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
            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
            placeholder="Explain why this modification needs to be reversed..."
          />
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
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
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!reversalReason.trim() || isReversing}
            className="px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
  );
};