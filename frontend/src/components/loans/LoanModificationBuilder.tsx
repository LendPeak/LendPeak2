import { useState, useEffect } from 'react';
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  XMarkIcon,
  PlusIcon,
  TrashIcon,
  CalculatorIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  ChartBarIcon,
  CalendarIcon,
  ClockIcon,
  BanknotesIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { LoanEngine } from '@lendpeak/engine';
import type {
  ModificationType,
  LoanModification,
  ModificationCalculationResult,
  ModificationCalculationParams,
  LoanTerms,
} from '@lendpeak/engine';
import { demoLoanStorage } from '../../services/demoLoanStorage';
import { format } from 'date-fns';
import DatePicker from 'react-datepicker';

interface ModificationItem {
  id: string;
  type: ModificationType;
  description: string;
  parameters: Record<string, any>;
  impact?: ModificationCalculationResult;
}

interface LoanModificationBuilderProps {
  loan: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const MODIFICATION_TYPES: Record<ModificationType, { label: string; description: string; icon: any; category: string; color: string }> = {
  'RATE_CHANGE': {
    label: 'Interest Rate Change',
    description: 'Modify the loan interest rate',
    icon: ChartBarIcon,
    category: 'Rate & Terms',
    color: 'bg-blue-50 text-blue-600 border-blue-200'
  },
  'TERM_EXTENSION': {
    label: 'Term Extension',
    description: 'Extend the loan term to reduce payments',
    icon: CalendarIcon,
    category: 'Rate & Terms',
    color: 'bg-blue-50 text-blue-600 border-blue-200'
  },
  'PAYMENT_REDUCTION_TEMPORARY': {
    label: 'Temporary Payment Reduction',
    description: 'Reduce payments for a specified period',
    icon: ClockIcon,
    category: 'Payment Relief',
    color: 'bg-green-50 text-green-600 border-green-200'
  },
  'PAYMENT_REDUCTION_PERMANENT': {
    label: 'Permanent Payment Reduction',
    description: 'Permanently reduce monthly payment amount',
    icon: BanknotesIcon,
    category: 'Payment Relief',
    color: 'bg-green-50 text-green-600 border-green-200'
  },
  'PRINCIPAL_REDUCTION': {
    label: 'Principal Reduction',
    description: 'Reduce the outstanding principal balance',
    icon: CurrencyDollarIcon,
    category: 'Principal Changes',
    color: 'bg-emerald-50 text-emerald-600 border-emerald-200'
  },
  'BALLOON_PAYMENT_ASSIGNMENT': {
    label: 'Balloon Payment Assignment',
    description: 'Add balloon payment with EMI reamortization',
    icon: ArrowPathIcon,
    category: 'Balloon Options',
    color: 'bg-purple-50 text-purple-600 border-purple-200'
  },
  'BALLOON_PAYMENT_REMOVAL': {
    label: 'Balloon Payment Removal',
    description: 'Remove existing balloon payment',
    icon: XMarkIcon,
    category: 'Balloon Options',
    color: 'bg-purple-50 text-purple-600 border-purple-200'
  },
  'FORBEARANCE': {
    label: 'Forbearance',
    description: 'Temporary payment pause or reduction',
    icon: ExclamationTriangleIcon,
    category: 'Hardship Options',
    color: 'bg-orange-50 text-orange-600 border-orange-200'
  },
  'DEFERMENT': {
    label: 'Deferment',
    description: 'Formal postponement of payments',
    icon: CheckCircleIcon,
    category: 'Hardship Options',
    color: 'bg-orange-50 text-orange-600 border-orange-200'
  },
  'REAMORTIZATION': {
    label: 'Loan Reamortization',
    description: 'Complete recalculation of payment schedule',
    icon: CalculatorIcon,
    category: 'Restructuring',
    color: 'bg-indigo-50 text-indigo-600 border-indigo-200'
  }
};

export const LoanModificationBuilder = ({ loan, isOpen, onClose, onSuccess }: LoanModificationBuilderProps) => {
  const [modifications, setModifications] = useState<ModificationItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedType, setSelectedType] = useState<ModificationType | null>(null);
  const [reason, setReason] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date());
  const [isCalculating, setIsCalculating] = useState(false);
  const [projectedLoan, setProjectedLoan] = useState<any>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Calculate the cumulative effect of all modifications
  useEffect(() => {
    if (modifications.length > 0) {
      calculateProjectedLoan();
    } else {
      setProjectedLoan(null);
    }
  }, [modifications]);

  const calculateProjectedLoan = async () => {
    setIsCalculating(true);
    try {
      // Start with current loan parameters
      let projectedParams = { ...loan.loanParameters };
      
      // Apply each modification in sequence
      modifications.forEach(mod => {
        switch (mod.type) {
          case 'RATE_CHANGE':
            projectedParams.interestRate = mod.parameters.newRate;
            break;
          case 'TERM_EXTENSION':
            projectedParams.termMonths += mod.parameters.additionalMonths;
            break;
          case 'PRINCIPAL_REDUCTION':
            projectedParams.principal -= mod.parameters.reductionAmount;
            break;
          case 'PAYMENT_DATE_CHANGE':
            // This doesn't affect calculations, just scheduling
            break;
          case 'SKIP_PAYMENT':
            // This would add the skipped payments to principal
            const loanTerms = LoanEngine.createLoan(
              projectedParams.principal,
              projectedParams.interestRate,
              projectedParams.termMonths,
              projectedParams.startDate,
              { paymentFrequency: 'monthly', interestType: 'amortized' }
            );
            const paymentResult = LoanEngine.calculatePayment(loanTerms);
            projectedParams.principal += paymentResult.monthlyPayment.toNumber() * mod.parameters.skipCount;
            break;
        }
      });

      // Calculate new metrics using stateless LoanEngine
      const currentLoanTerms = LoanEngine.createLoan(
        loan.loanParameters.principal,
        loan.loanParameters.interestRate,
        loan.loanParameters.termMonths,
        loan.loanParameters.startDate,
        { paymentFrequency: 'monthly', interestType: 'amortized' }
      );
      const projectedLoanTerms = LoanEngine.createLoan(
        projectedParams.principal,
        projectedParams.interestRate,
        projectedParams.termMonths,
        projectedParams.startDate,
        { paymentFrequency: 'monthly', interestType: 'amortized' }
      );
      
      const currentPayment = LoanEngine.calculatePayment(currentLoanTerms);
      const projectedPayment = LoanEngine.calculatePayment(projectedLoanTerms);

      // Create calculation objects for compatibility
      const currentCalc = {
        monthlyPayment: currentPayment.monthlyPayment.toNumber(),
        totalInterest: 0, // TODO: Calculate if needed
        totalPayment: currentPayment.monthlyPayment.toNumber() * loan.loanParameters.termMonths,
      };
      
      const projectedCalc = {
        monthlyPayment: projectedPayment.monthlyPayment.toNumber(),
        totalInterest: 0, // TODO: Calculate if needed  
        totalPayment: projectedPayment.monthlyPayment.toNumber() * projectedParams.termMonths,
      };

      setProjectedLoan({
        parameters: projectedParams,
        calculation: projectedCalc,
        changes: {
          monthlyPayment: projectedCalc.monthlyPayment - currentCalc.monthlyPayment,
          totalInterest: projectedCalc.totalInterest - currentCalc.totalInterest,
          totalPayment: projectedCalc.totalPayment - currentCalc.totalPayment,
        },
      });
    } catch (error) {
      console.error('Error calculating projected loan:', error);
      toast.error('Failed to calculate modification impact');
    } finally {
      setIsCalculating(false);
    }
  };

  const addModification = (type: string, parameters: Record<string, any>) => {
    const modification: ModificationItem = {
      id: `mod_${Date.now()}`,
      type: type as any,
      description: MODIFICATION_TYPES[type as keyof typeof MODIFICATION_TYPES].label,
      parameters,
    };

    setModifications([...modifications, modification]);
    setShowAddModal(false);
    setSelectedType(null);
  };

  const removeModification = (id: string) => {
    setModifications(modifications.filter(m => m.id !== id));
  };

  const commitModifications = async () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for the modifications');
      return;
    }

    try {
      // Create a single modification record with all changes
      const modificationRecord = {
        loanId: loan.id,
        type: 'RESTRUCTURE',
        date: new Date(),
        changes: {
          modifications: modifications.map(m => ({
            type: m.type,
            parameters: m.parameters,
          })),
          projectedParameters: projectedLoan.parameters,
          effectiveDate: effectiveDate,
        },
        reason,
        approvedBy: 'Demo User',
      };

      // Apply the modification
      await demoLoanStorage.addModification(modificationRecord);

      toast.success('Loan restructuring completed successfully');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Failed to apply modifications');
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

  const renderModificationForm = () => {
    switch (selectedType) {
      case 'RATE_CHANGE':
        return <RateChangeForm onAdd={addModification} currentRate={loan.loanParameters.interestRate} />;
      case 'TERM_EXTENSION':
        return <TermExtensionForm onAdd={addModification} currentTerm={loan.loanParameters.termMonths} />;
      case 'PAYMENT_REDUCTION_TEMPORARY':
        return <TemporaryPaymentReductionForm onAdd={addModification} loan={loan} />;
      case 'PAYMENT_REDUCTION_PERMANENT':
        return <PermanentPaymentReductionForm onAdd={addModification} loan={loan} />;
      case 'PRINCIPAL_REDUCTION':
        return <PrincipalReductionForm onAdd={addModification} currentPrincipal={loan.loanParameters.principal} />;
      case 'BALLOON_PAYMENT_ASSIGNMENT':
        return <BalloonPaymentAssignmentForm onAdd={addModification} loan={loan} />;
      case 'BALLOON_PAYMENT_REMOVAL':
        return <BalloonPaymentRemovalForm onAdd={addModification} loan={loan} />;
      case 'FORBEARANCE':
        return <ForbearanceForm onAdd={addModification} />;
      case 'DEFERMENT':
        return <DefermentForm onAdd={addModification} />;
      case 'REAMORTIZATION':
        return <ReamortizationForm onAdd={addModification} loan={loan} />;
      default:
        return null;
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
                  <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-primary-50 to-blue-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary-100 border border-primary-200">
                          <ArrowPathIcon className="h-5 w-5 text-primary-600" />
                        </div>
                        <div>
                          <Dialog.Title as="h3" className="text-xl font-bold leading-6 text-gray-900">
                            Loan Restructuring Builder
                          </Dialog.Title>
                          <p className="mt-1 text-sm text-gray-600 flex items-center space-x-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800">
                              {loan.id}
                            </span>
                            <span>•</span>
                            <span>Build a complete modification package before committing changes</span>
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

                  <div className="px-6 py-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Left Column - Modifications List */}
                      <div className="lg:col-span-2">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-lg font-semibold text-gray-900">Modification Package</h4>
                            <button
                              onClick={() => setShowAddModal(true)}
                              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 shadow-sm hover:shadow-md transition-all duration-200"
                            >
                              <PlusIcon className="h-4 w-4 mr-2" />
                              Add Modification
                            </button>
                          </div>

                          {modifications.length === 0 ? (
                            <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-300">
                              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 mb-4">
                                <DocumentTextIcon className="h-8 w-8 text-primary-600" />
                              </div>
                              <h3 className="text-lg font-semibold text-gray-900 mb-2">No modifications added</h3>
                              <p className="text-sm text-gray-600 mb-6 max-w-sm mx-auto">
                                Start by adding modifications to build your comprehensive restructuring package
                              </p>
                              <div>
                                <button
                                  onClick={() => setShowAddModal(true)}
                                  className="inline-flex items-center px-6 py-3 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 transition-all duration-200"
                                >
                                  <PlusIcon className="h-5 w-5 mr-2" />
                                  Add First Modification
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {modifications.map((mod) => {
                                const modType = MODIFICATION_TYPES[mod.type];
                                const IconComponent = modType.icon;
                                return (
                                  <div key={mod.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
                                    <div className="flex items-start justify-between">
                                      <div className="flex items-start space-x-4">
                                        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl border ${modType.color}`}>
                                          <IconComponent className="h-6 w-6" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center space-x-3 mb-2">
                                            <h5 className="text-base font-semibold text-gray-900">
                                              {mod.description}
                                            </h5>
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${modType.color}`}>
                                              {modType.category}
                                            </span>
                                          </div>
                                          <div className="text-sm text-gray-600 leading-relaxed">
                                            {renderModificationSummary(mod)}
                                          </div>
                                          <div className="mt-3 flex items-center space-x-4 text-xs text-gray-500">
                                            <span className="flex items-center">
                                              <ClockIcon className="h-3 w-3 mr-1" />
                                              Added just now
                                            </span>
                                            <span className="flex items-center">
                                              <CheckCircleIcon className="h-3 w-3 mr-1" />
                                              Ready to apply
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center space-x-2 ml-4">
                                        <button
                                          onClick={() => removeModification(mod.id)}
                                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors duration-200"
                                          title="Remove modification"
                                        >
                                          <TrashIcon className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Modification Details */}
                          {modifications.length > 0 && (
                            <div className="mt-6 space-y-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700">
                                  Reason for Restructuring
                                </label>
                                <textarea
                                  value={reason}
                                  onChange={(e) => setReason(e.target.value)}
                                  rows={3}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                                  placeholder="Explain why this restructuring is needed..."
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700">
                                  Effective Date
                                </label>
                                <DatePicker
                                  selected={effectiveDate}
                                  onChange={(date) => setEffectiveDate(date || new Date())}
                                  dateFormat="MM/dd/yyyy"
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                                  placeholderText="Select effective date"
                                  showMonthDropdown
                                  showYearDropdown
                                  dropdownMode="select"
                                  minDate={new Date()}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Column - Impact Analysis */}
                      <div className="lg:col-span-1">
                        <div className="sticky top-0 space-y-4">
                          <h4 className="text-sm font-medium text-gray-900">Impact Analysis</h4>
                          
                          {isCalculating ? (
                            <div className="text-center py-8">
                              <ArrowPathIcon className="animate-spin h-8 w-8 text-gray-400 mx-auto" />
                              <p className="mt-2 text-sm text-gray-500">Calculating impact...</p>
                            </div>
                          ) : projectedLoan ? (
                            <div className="space-y-4">
                              {/* Current vs Projected */}
                              <div className="bg-gray-50 rounded-lg p-4">
                                <h5 className="text-sm font-medium text-gray-900 mb-3">Payment Comparison</h5>
                                <dl className="space-y-2">
                                  <div className="flex justify-between">
                                    <dt className="text-sm text-gray-500">Current Payment</dt>
                                    <dd className="text-sm font-medium text-gray-900">
                                      {(() => {
                                        const terms = LoanEngine.createLoan(
                                          loan.loanParameters.principal,
                                          loan.loanParameters.interestRate,
                                          loan.loanParameters.termMonths,
                                          loan.loanParameters.startDate,
                                          { paymentFrequency: 'monthly', interestType: 'amortized' }
                                        );
                                        const payment = LoanEngine.calculatePayment(terms);
                                        return formatCurrency(payment.monthlyPayment.toNumber());
                                      })()}
                                    </dd>
                                  </div>
                                  <div className="flex justify-between">
                                    <dt className="text-sm text-gray-500">New Payment</dt>
                                    <dd className="text-sm font-medium text-gray-900">
                                      {formatCurrency(projectedLoan.calculation.monthlyPayment)}
                                    </dd>
                                  </div>
                                  <div className="flex justify-between pt-2 border-t">
                                    <dt className="text-sm font-medium text-gray-700">Change</dt>
                                    <dd className={`text-sm font-medium ${projectedLoan.changes.monthlyPayment < 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {projectedLoan.changes.monthlyPayment < 0 ? '' : '+'}
                                      {formatCurrency(projectedLoan.changes.monthlyPayment)}
                                    </dd>
                                  </div>
                                </dl>
                              </div>

                              {/* Total Cost Impact */}
                              <div className="bg-blue-50 rounded-lg p-4">
                                <h5 className="text-sm font-medium text-blue-900 mb-3">Total Cost Impact</h5>
                                <dl className="space-y-2">
                                  <div className="flex justify-between">
                                    <dt className="text-sm text-blue-700">Total Interest Change</dt>
                                    <dd className={`text-sm font-medium ${projectedLoan.changes.totalInterest < 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {projectedLoan.changes.totalInterest < 0 ? '' : '+'}
                                      {formatCurrency(projectedLoan.changes.totalInterest)}
                                    </dd>
                                  </div>
                                  <div className="flex justify-between">
                                    <dt className="text-sm text-blue-700">Total Payment Change</dt>
                                    <dd className={`text-sm font-medium ${projectedLoan.changes.totalPayment < 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {projectedLoan.changes.totalPayment < 0 ? '' : '+'}
                                      {formatCurrency(projectedLoan.changes.totalPayment)}
                                    </dd>
                                  </div>
                                </dl>
                              </div>

                              {/* New Terms Summary */}
                              <div className="bg-gray-50 rounded-lg p-4">
                                <h5 className="text-sm font-medium text-gray-900 mb-3">New Terms</h5>
                                <dl className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <dt className="text-gray-500">Interest Rate</dt>
                                    <dd className="font-medium text-gray-900">
                                      {formatPercentage(projectedLoan.parameters.interestRate)}
                                    </dd>
                                  </div>
                                  <div className="flex justify-between">
                                    <dt className="text-gray-500">Term</dt>
                                    <dd className="font-medium text-gray-900">
                                      {projectedLoan.parameters.termMonths} months
                                    </dd>
                                  </div>
                                  <div className="flex justify-between">
                                    <dt className="text-gray-500">Principal</dt>
                                    <dd className="font-medium text-gray-900">
                                      {formatCurrency(projectedLoan.parameters.principal)}
                                    </dd>
                                  </div>
                                </dl>
                              </div>

                              {/* Warning */}
                              <div className="rounded-md bg-yellow-50 p-4">
                                <div className="flex">
                                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
                                  <div className="ml-3">
                                    <h3 className="text-sm font-medium text-yellow-800">Important Notice</h3>
                                    <div className="mt-2 text-sm text-yellow-700">
                                      <p>
                                        This restructuring will create a permanent modification to the loan terms.
                                        Ensure all changes are reviewed before committing.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-8 bg-gray-50 rounded-lg">
                              <CalculatorIcon className="mx-auto h-12 w-12 text-gray-400" />
                              <p className="mt-2 text-sm text-gray-500">
                                Add modifications to see impact analysis
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 px-6 py-4 flex justify-between">
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowConfirmation(true)}
                      disabled={modifications.length === 0 || !reason.trim()}
                      className="inline-flex justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckCircleIcon className="h-5 w-5 mr-2" />
                      Commit Restructuring
                    </button>
                  </div>
                </div>

                {/* Add Modification Modal */}
                {showAddModal && (
                  <ModificationTypeSelector
                    onSelect={(type) => {
                      setSelectedType(type);
                      setShowAddModal(false);
                    }}
                    onClose={() => setShowAddModal(false)}
                  />
                )}

                {/* Modification Form Modal */}
                {selectedType && (
                  <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-[70]">
                    <div className="bg-white rounded-lg p-6 max-w-lg w-full">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">
                        {MODIFICATION_TYPES[selectedType as keyof typeof MODIFICATION_TYPES].label}
                      </h3>
                      {renderModificationForm()}
                      <div className="mt-4 flex justify-end space-x-3">
                        <button
                          onClick={() => setSelectedType(null)}
                          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Confirmation Modal */}
                {showConfirmation && (
                  <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-[70]">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full">
                      <div className="text-center">
                        <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-yellow-400" />
                        <h3 className="mt-2 text-lg font-medium text-gray-900">Confirm Restructuring</h3>
                        <p className="mt-2 text-sm text-gray-500">
                          You are about to commit {modifications.length} modification{modifications.length > 1 ? 's' : ''} to this loan.
                          This action cannot be undone.
                        </p>
                        <div className="mt-6 flex justify-center space-x-3">
                          <button
                            onClick={commitModifications}
                            className="inline-flex justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500"
                          >
                            Yes, Commit Changes
                          </button>
                          <button
                            onClick={() => setShowConfirmation(false)}
                            className="inline-flex justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};

// Helper Components
const ModificationTypeSelector = ({ onSelect, onClose }: { onSelect: (type: string) => void; onClose: () => void }) => {
  // Group modification types by category
  const groupedTypes = Object.entries(MODIFICATION_TYPES).reduce((acc, [key, value]) => {
    if (!acc[value.category]) {
      acc[value.category] = [];
    }
    acc[value.category].push({ key, ...value });
    return acc;
  }, {} as Record<string, Array<{ key: string; label: string; description: string; icon: any; color: string; category: string }>>);

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-[70]">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-4xl w-full max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">Select Modification Type</h3>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        
        <div className="space-y-6">
          {Object.entries(groupedTypes).map(([category, types]) => (
            <div key={category}>
              <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">{category}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {types.map((type) => {
                  const IconComponent = type.icon;
                  return (
                    <button
                      key={type.key}
                      onClick={() => onSelect(type.key)}
                      className="group p-4 border border-gray-200 rounded-xl hover:border-primary-300 hover:bg-primary-50 text-left transition-all duration-200 hover:shadow-md"
                    >
                      <div className="flex items-start space-x-4">
                        <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg border group-hover:scale-110 transition-transform duration-200 ${type.color}`}>
                          <IconComponent className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-gray-900 group-hover:text-primary-900 transition-colors">
                            {type.label}
                          </h4>
                          <p className="mt-1 text-xs text-gray-500 group-hover:text-primary-700 transition-colors leading-relaxed">
                            {type.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-8 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

const renderModificationSummary = (mod: ModificationItem) => {
  switch (mod.type) {
    case 'RATE_CHANGE':
      return (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">New Interest Rate:</span>
            <span className="font-medium text-gray-900">{mod.parameters.newRate}%</span>
          </div>
        </div>
      );
    case 'TERM_EXTENSION':
      return (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Extension Period:</span>
            <span className="font-medium text-gray-900">{mod.parameters.additionalMonths} months</span>
          </div>
          {mod.parameters.keepSamePayment && (
            <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
              Payment amount unchanged
            </div>
          )}
        </div>
      );
    case 'PAYMENT_REDUCTION_TEMPORARY':
      return (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">New Payment:</span>
            <span className="font-medium text-gray-900">{formatCurrency(mod.parameters.newPaymentAmount)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Duration:</span>
            <span className="font-medium text-gray-900">{mod.parameters.numberOfTerms} terms</span>
          </div>
          <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
            Auto-reverts after period ends
          </div>
        </div>
      );
    case 'PAYMENT_REDUCTION_PERMANENT':
      return (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">New Payment:</span>
            <span className="font-medium text-gray-900">{formatCurrency(mod.parameters.newPaymentAmount)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Strategy:</span>
            <span className="font-medium text-gray-900 capitalize">{mod.parameters.termAdjustment?.replace('_', ' ').toLowerCase()}</span>
          </div>
        </div>
      );
    case 'PRINCIPAL_REDUCTION':
      return (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Reduction Amount:</span>
            <span className="font-medium text-gray-900">{formatCurrency(mod.parameters.reductionAmount)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Recalculation:</span>
            <span className="font-medium text-gray-900 capitalize">{mod.parameters.paymentRecalculation?.replace('_', ' ').toLowerCase()}</span>
          </div>
        </div>
      );
    case 'BALLOON_PAYMENT_ASSIGNMENT':
      return (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Balloon Amount:</span>
            <span className="font-medium text-gray-900">{formatCurrency(mod.parameters.balloonAmount)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Start Type:</span>
            <span className="font-medium text-gray-900 capitalize">{mod.parameters.reamortizationStartType?.replace('_', ' ').toLowerCase()}</span>
          </div>
          <div className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded">
            EMI reamortization enabled
          </div>
        </div>
      );
    case 'BALLOON_PAYMENT_REMOVAL':
      return (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Strategy:</span>
            <span className="font-medium text-gray-900 capitalize">{mod.parameters.reamortizationType?.replace('_', ' ').toLowerCase()}</span>
          </div>
          <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
            Removes existing balloon payment
          </div>
        </div>
      );
    case 'FORBEARANCE':
      return (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Duration:</span>
            <span className="font-medium text-gray-900">{mod.parameters.durationMonths} months</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Type:</span>
            <span className="font-medium text-gray-900 capitalize">{mod.parameters.forbearanceType?.replace('_', ' ').toLowerCase()}</span>
          </div>
        </div>
      );
    case 'DEFERMENT':
      return (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Duration:</span>
            <span className="font-medium text-gray-900">{mod.parameters.durationMonths} months</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Reason:</span>
            <span className="font-medium text-gray-900">{mod.parameters.eligibilityReason}</span>
          </div>
          {mod.parameters.interestSubsidy && (
            <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
              Government interest subsidy applies
            </div>
          )}
        </div>
      );
    case 'REAMORTIZATION':
      return (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Type:</span>
            <span className="font-medium text-gray-900 capitalize">{mod.parameters.reamortizationType?.replace('_', ' ').toLowerCase()}</span>
          </div>
          {mod.parameters.newTermMonths && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500">New Term:</span>
              <span className="font-medium text-gray-900">{mod.parameters.newTermMonths} months</span>
            </div>
          )}
          {mod.parameters.newInterestRate && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500">New Rate:</span>
              <span className="font-medium text-gray-900">{mod.parameters.newInterestRate}%</span>
            </div>
          )}
        </div>
      );
    default:
      return <span className="text-gray-500">Configuration pending...</span>;
  }
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
};

// Individual Modification Forms
const RateChangeForm = ({ onAdd, currentRate }: { onAdd: Function; currentRate: number }) => {
  const [newRate, setNewRate] = useState(currentRate);
  
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Current Rate</label>
        <p className="mt-1 text-sm text-gray-900">{currentRate}%</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">New Rate (%)</label>
        <input
          type="number"
          step="0.01"
          value={newRate}
          onChange={(e) => setNewRate(parseFloat(e.target.value))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        />
      </div>
      <button
        onClick={() => onAdd('RATE_CHANGE', { newRate })}
        className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
      >
        Add Rate Change
      </button>
    </div>
  );
};

const TermExtensionForm = ({ onAdd, currentTerm }: { onAdd: Function; currentTerm: number }) => {
  const [additionalMonths, setAdditionalMonths] = useState(12);
  
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Current Term</label>
        <p className="mt-1 text-sm text-gray-900">{currentTerm} months</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Additional Months</label>
        <input
          type="number"
          value={additionalMonths}
          onChange={(e) => setAdditionalMonths(parseInt(e.target.value))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        />
        <p className="mt-1 text-sm text-gray-500">New term will be {currentTerm + additionalMonths} months</p>
      </div>
      <button
        onClick={() => onAdd('TERM_EXTENSION', { additionalMonths })}
        className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
      >
        Add Term Extension
      </button>
    </div>
  );
};

const PaymentReductionForm = ({ onAdd, loan }: { onAdd: Function; loan: any }) => {
  const loanTerms = LoanEngine.createLoan(
    loan.loanParameters.principal,
    loan.loanParameters.interestRate,
    loan.loanParameters.termMonths,
    loan.loanParameters.startDate,
    { paymentFrequency: 'monthly', interestType: 'amortized' }
  );
  const paymentResult = LoanEngine.calculatePayment(loanTerms);
  const currentPayment = paymentResult.monthlyPayment.toNumber();
  const [targetPayment, setTargetPayment] = useState(Math.round(currentPayment * 0.8));
  
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Current Payment</label>
        <p className="mt-1 text-sm text-gray-900">{formatCurrency(currentPayment)}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Target Payment</label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-500 sm:text-sm">$</span>
          </div>
          <input
            type="number"
            value={targetPayment}
            onChange={(e) => setTargetPayment(parseFloat(e.target.value))}
            className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Reduction of {formatCurrency(currentPayment - targetPayment)} ({((1 - targetPayment/currentPayment) * 100).toFixed(1)}%)
        </p>
      </div>
      <button
        onClick={() => onAdd('PAYMENT_REDUCTION', { targetPayment })}
        className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
      >
        Add Payment Reduction
      </button>
    </div>
  );
};

const SkipPaymentForm = ({ onAdd }: { onAdd: Function }) => {
  const [skipCount, setSkipCount] = useState(1);
  
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Number of Payments to Skip</label>
        <select
          value={skipCount}
          onChange={(e) => setSkipCount(parseInt(e.target.value))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        >
          {[1, 2, 3, 4, 5, 6].map(num => (
            <option key={num} value={num}>{num} payment{num > 1 ? 's' : ''}</option>
          ))}
        </select>
        <p className="mt-1 text-sm text-gray-500">
          Skipped payments will be added to the principal balance
        </p>
      </div>
      <button
        onClick={() => onAdd('SKIP_PAYMENT', { skipCount })}
        className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
      >
        Add Skip Payment
      </button>
    </div>
  );
};

const PrincipalReductionForm = ({ onAdd, currentPrincipal }: { onAdd: Function; currentPrincipal: number }) => {
  const [reductionAmount, setReductionAmount] = useState(5000);
  
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Current Principal</label>
        <p className="mt-1 text-sm text-gray-900">{formatCurrency(currentPrincipal)}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Reduction Amount</label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-500 sm:text-sm">$</span>
          </div>
          <input
            type="number"
            value={reductionAmount}
            onChange={(e) => setReductionAmount(parseFloat(e.target.value))}
            className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          New principal will be {formatCurrency(currentPrincipal - reductionAmount)}
        </p>
      </div>
      <button
        onClick={() => onAdd('PRINCIPAL_REDUCTION', { reductionAmount })}
        className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
      >
        Add Principal Reduction
      </button>
    </div>
  );
};

const PaymentDateChangeForm = ({ onAdd }: { onAdd: Function }) => {
  const [newDate, setNewDate] = useState(15);
  
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">New Payment Day</label>
        <select
          value={newDate}
          onChange={(e) => setNewDate(parseInt(e.target.value))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        >
          {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
            <option key={day} value={day}>
              {day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'} of each month
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={() => onAdd('PAYMENT_DATE_CHANGE', { newDate })}
        className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
      >
        Add Payment Date Change
      </button>
    </div>
  );
};

const ForbearanceForm = ({ onAdd }: { onAdd: Function }) => {
  const [months, setMonths] = useState(3);
  const [type, setType] = useState('REDUCED');
  
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Forbearance Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        >
          <option value="REDUCED">Reduced Payments</option>
          <option value="SUSPENDED">Suspended Payments</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Duration (Months)</label>
        <input
          type="number"
          value={months}
          onChange={(e) => setMonths(parseInt(e.target.value))}
          min="1"
          max="12"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        />
      </div>
      <button
        onClick={() => onAdd('FORBEARANCE', { months, type })}
        className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
      >
        Add Forbearance
      </button>
    </div>
  );
};

const BalloonPaymentForm = ({ onAdd, loan }: { onAdd: Function; loan: any }) => {
  const currentBalance = loan.loanParameters.principal * 0.85; // Demo estimate
  const [amount, setAmount] = useState(Math.round(currentBalance * 0.3));
  
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Balloon Payment Amount</label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-500 sm:text-sm">$</span>
          </div>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value))}
            className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          This amount will be due at the end of the loan term
        </p>
      </div>
      <button
        onClick={() => onAdd('BALLOON_PAYMENT', { amount })}
        className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
      >
        Add Balloon Payment
      </button>
    </div>
  );
};

// Enhanced Form Components for New Modification Types

const TemporaryPaymentReductionForm = ({ onAdd, loan }: { onAdd: Function; loan: any }) => {
  const loanTerms = LoanEngine.createLoan(
    loan.loanParameters.principal,
    loan.loanParameters.interestRate,
    loan.loanParameters.termMonths,
    loan.loanParameters.startDate,
    { paymentFrequency: 'monthly', interestType: 'amortized' }
  );
  const paymentResult = LoanEngine.calculatePayment(loanTerms);
  const currentPayment = paymentResult.monthlyPayment.toNumber();
  
  const [newPaymentAmount, setNewPaymentAmount] = useState(Math.round(currentPayment * 0.7));
  const [numberOfTerms, setNumberOfTerms] = useState(6);
  const [interestHandling, setInterestHandling] = useState('CAPITALIZE');
  
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">New Payment Amount</label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-500 sm:text-sm">$</span>
          </div>
          <input
            type="number"
            value={newPaymentAmount}
            onChange={(e) => setNewPaymentAmount(parseFloat(e.target.value))}
            className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Number of Terms</label>
        <input
          type="number"
          value={numberOfTerms}
          onChange={(e) => setNumberOfTerms(parseInt(e.target.value))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        />
        <p className="mt-1 text-sm text-gray-500">Payments will revert automatically after this period</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Interest Handling</label>
        <select
          value={interestHandling}
          onChange={(e) => setInterestHandling(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        >
          <option value="CAPITALIZE">Capitalize unpaid interest</option>
          <option value="DEFER">Defer unpaid interest</option>
          <option value="WAIVE">Waive unpaid interest</option>
        </select>
      </div>
      <button
        onClick={() => onAdd('PAYMENT_REDUCTION_TEMPORARY', { newPaymentAmount, numberOfTerms, interestHandling })}
        className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
      >
        Add Temporary Payment Reduction
      </button>
    </div>
  );
};

const PermanentPaymentReductionForm = ({ onAdd, loan }: { onAdd: Function; loan: any }) => {
  const loanTerms = LoanEngine.createLoan(
    loan.loanParameters.principal,
    loan.loanParameters.interestRate,
    loan.loanParameters.termMonths,
    loan.loanParameters.startDate,
    { paymentFrequency: 'monthly', interestType: 'amortized' }
  );
  const paymentResult = LoanEngine.calculatePayment(loanTerms);
  const currentPayment = paymentResult.monthlyPayment.toNumber();
  
  const [newPaymentAmount, setNewPaymentAmount] = useState(Math.round(currentPayment * 0.8));
  const [termAdjustment, setTermAdjustment] = useState('EXTEND_TERM');
  const [newTermMonths, setNewTermMonths] = useState(loan.loanParameters.termMonths + 60);
  const [principalReduction, setPrincipalReduction] = useState(10000);
  
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">New Payment Amount</label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-500 sm:text-sm">$</span>
          </div>
          <input
            type="number"
            value={newPaymentAmount}
            onChange={(e) => setNewPaymentAmount(parseFloat(e.target.value))}
            className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Term Adjustment Strategy</label>
        <select
          value={termAdjustment}
          onChange={(e) => setTermAdjustment(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        >
          <option value="EXTEND_TERM">Extend loan term</option>
          <option value="REDUCE_PRINCIPAL">Reduce principal balance</option>
          <option value="COMBINATION">Combination of both</option>
        </select>
      </div>
      {(termAdjustment === 'EXTEND_TERM' || termAdjustment === 'COMBINATION') && (
        <div>
          <label className="block text-sm font-medium text-gray-700">New Term (Months)</label>
          <input
            type="number"
            value={newTermMonths}
            onChange={(e) => setNewTermMonths(parseInt(e.target.value))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          />
        </div>
      )}
      {(termAdjustment === 'REDUCE_PRINCIPAL' || termAdjustment === 'COMBINATION') && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Principal Reduction Amount</label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">$</span>
            </div>
            <input
              type="number"
              value={principalReduction}
              onChange={(e) => setPrincipalReduction(parseFloat(e.target.value))}
              className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            />
          </div>
        </div>
      )}
      <button
        onClick={() => onAdd('PAYMENT_REDUCTION_PERMANENT', { 
          newPaymentAmount, 
          termAdjustment, 
          newTermMonths: termAdjustment !== 'REDUCE_PRINCIPAL' ? newTermMonths : undefined,
          principalReduction: termAdjustment !== 'EXTEND_TERM' ? principalReduction : undefined
        })}
        className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
      >
        Add Permanent Payment Reduction
      </button>
    </div>
  );
};

const BalloonPaymentAssignmentForm = ({ onAdd, loan }: { onAdd: Function; loan: any }) => {
  const currentBalance = loan.loanParameters.principal * 0.85; // Demo estimate
  const [balloonAmount, setBalloonAmount] = useState(Math.round(currentBalance * 0.3));
  const [balloonDueDate, setBalloonDueDate] = useState(new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000)); // 5 years from now
  const [reamortizationStartType, setReamortizationStartType] = useState('CURRENT_TERM');
  const [customStartTerm, setCustomStartTerm] = useState(1);
  
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Balloon Payment Amount</label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-500 sm:text-sm">$</span>
          </div>
          <input
            type="number"
            value={balloonAmount}
            onChange={(e) => setBalloonAmount(parseFloat(e.target.value))}
            className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Balloon Due Date</label>
        <DatePicker
          selected={balloonDueDate}
          onChange={(date) => setBalloonDueDate(date || new Date())}
          dateFormat="MM/dd/yyyy"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">EMI Reamortization Start Point</label>
        <select
          value={reamortizationStartType}
          onChange={(e) => setReamortizationStartType(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        >
          <option value="CURRENT_TERM">Current payment term (default)</option>
          <option value="NEXT_TERM">Next payment term</option>
          <option value="BEGINNING">From loan beginning</option>
          <option value="CUSTOM">Custom term number</option>
        </select>
      </div>
      {reamortizationStartType === 'CUSTOM' && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Custom Start Term Number</label>
          <input
            type="number"
            value={customStartTerm}
            onChange={(e) => setCustomStartTerm(parseInt(e.target.value))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          />
        </div>
      )}
      <button
        onClick={() => onAdd('BALLOON_PAYMENT_ASSIGNMENT', { 
          balloonAmount, 
          balloonDueDate, 
          reamortizationStartType,
          customStartTerm: reamortizationStartType === 'CUSTOM' ? customStartTerm : undefined
        })}
        className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
      >
        Add Balloon Payment Assignment
      </button>
    </div>
  );
};

const BalloonPaymentRemovalForm = ({ onAdd, loan }: { onAdd: Function; loan: any }) => {
  const [reamortizationType, setReamortizationType] = useState('EXTEND_TERM');
  const [newTermMonths, setNewTermMonths] = useState(loan.loanParameters.termMonths + 60);
  const [newPaymentAmount, setNewPaymentAmount] = useState(2000);
  
  return (
    <div className="space-y-4">
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
        <p className="text-sm text-yellow-800">
          <strong>Current Balloon:</strong> {formatCurrency(loan.balloonPayment || 0)}
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Reamortization Strategy</label>
        <select
          value={reamortizationType}
          onChange={(e) => setReamortizationType(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        >
          <option value="EXTEND_TERM">Extend term to reduce payment</option>
          <option value="INCREASE_PAYMENT">Increase payment, keep term</option>
          <option value="CUSTOM">Custom payment and term</option>
        </select>
      </div>
      {reamortizationType === 'EXTEND_TERM' && (
        <div>
          <label className="block text-sm font-medium text-gray-700">New Term (Months)</label>
          <input
            type="number"
            value={newTermMonths}
            onChange={(e) => setNewTermMonths(parseInt(e.target.value))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          />
        </div>
      )}
      {(reamortizationType === 'INCREASE_PAYMENT' || reamortizationType === 'CUSTOM') && (
        <div>
          <label className="block text-sm font-medium text-gray-700">New Payment Amount</label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">$</span>
            </div>
            <input
              type="number"
              value={newPaymentAmount}
              onChange={(e) => setNewPaymentAmount(parseFloat(e.target.value))}
              className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            />
          </div>
        </div>
      )}
      <button
        onClick={() => onAdd('BALLOON_PAYMENT_REMOVAL', { 
          reamortizationType,
          newTermMonths: reamortizationType === 'EXTEND_TERM' ? newTermMonths : undefined,
          newPaymentAmount: reamortizationType !== 'EXTEND_TERM' ? newPaymentAmount : undefined
        })}
        className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
      >
        Remove Balloon Payment
      </button>
    </div>
  );
};

const DefermentForm = ({ onAdd }: { onAdd: Function }) => {
  const [durationMonths, setDurationMonths] = useState(6);
  const [interestSubsidy, setInterestSubsidy] = useState(false);
  const [eligibilityReason, setEligibilityReason] = useState('Military deployment');
  
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Duration (Months)</label>
        <input
          type="number"
          value={durationMonths}
          onChange={(e) => setDurationMonths(parseInt(e.target.value))}
          min="1"
          max="24"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Eligibility Reason</label>
        <input
          type="text"
          value={eligibilityReason}
          onChange={(e) => setEligibilityReason(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        />
      </div>
      <div className="flex items-start">
        <input
          type="checkbox"
          checked={interestSubsidy}
          onChange={(e) => setInterestSubsidy(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        <label className="ml-3 text-sm text-gray-700">
          Government interest subsidy applies
        </label>
      </div>
      <button
        onClick={() => onAdd('DEFERMENT', { durationMonths, interestSubsidy, eligibilityReason })}
        className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
      >
        Add Deferment
      </button>
    </div>
  );
};

const ReamortizationForm = ({ onAdd, loan }: { onAdd: Function; loan: any }) => {
  const [newTermMonths, setNewTermMonths] = useState(loan.loanParameters.termMonths);
  const [newInterestRate, setNewInterestRate] = useState(loan.loanParameters.interestRate);
  const [reamortizationType, setReamortizationType] = useState('FULL_RECALC');
  
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Reamortization Type</label>
        <select
          value={reamortizationType}
          onChange={(e) => setReamortizationType(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        >
          <option value="FULL_RECALC">Full recalculation</option>
          <option value="ADJUST_REMAINING">Adjust remaining only</option>
          <option value="RESET_SCHEDULE">Reset schedule</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">New Term (Months)</label>
        <input
          type="number"
          value={newTermMonths}
          onChange={(e) => setNewTermMonths(parseInt(e.target.value))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">New Interest Rate (%)</label>
        <input
          type="number"
          step="0.01"
          value={newInterestRate}
          onChange={(e) => setNewInterestRate(parseFloat(e.target.value))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        />
      </div>
      <button
        onClick={() => onAdd('REAMORTIZATION', { newTermMonths, newInterestRate, reamortizationType })}
        className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
      >
        Add Reamortization
      </button>
    </div>
  );
};