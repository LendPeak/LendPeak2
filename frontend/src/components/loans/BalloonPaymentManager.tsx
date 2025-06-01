import { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  XMarkIcon,
  CalculatorIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  ArrowPathIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { LoanEngine } from '@lendpeak/engine';
import { format } from 'date-fns';
import DatePicker from 'react-datepicker';

interface BalloonPaymentManagerProps {
  loan: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const BalloonPaymentManager = ({ loan, isOpen, onClose, onSuccess }: BalloonPaymentManagerProps) => {
  const [mode, setMode] = useState<'ASSIGN' | 'REMOVE' | 'MODIFY'>('ASSIGN');
  const [balloonAmount, setBalloonAmount] = useState(50000);
  const [balloonDueDate, setBalloonDueDate] = useState(new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000)); // 5 years from now
  const [reamortizationStartType, setReamortizationStartType] = useState<'CURRENT_TERM' | 'NEXT_TERM' | 'BEGINNING' | 'CUSTOM'>('CURRENT_TERM');
  const [customStartTerm, setCustomStartTerm] = useState(1);
  const [removalType, setRemovalType] = useState<'EXTEND_TERM' | 'INCREASE_PAYMENT' | 'CUSTOM'>('EXTEND_TERM');
  const [newTermMonths, setNewTermMonths] = useState(loan.loanParameters.termMonths + 60);
  const [newPaymentAmount, setNewPaymentAmount] = useState(0);
  const [reason, setReason] = useState('');
  const [isCalculating, setIsCalculating] = useState(false);
  const [projectedImpact, setProjectedImpact] = useState<any>(null);

  const currentBalloonPayment = loan.balloonPayment || 0;
  const hasBalloonPayment = currentBalloonPayment > 0;

  const calculateImpact = async () => {
    setIsCalculating(true);
    try {
      // Create current loan terms
      const currentTerms = LoanEngine.createLoan(
        loan.loanParameters.principal,
        loan.loanParameters.interestRate,
        loan.loanParameters.termMonths,
        loan.loanParameters.startDate,
        { paymentFrequency: 'monthly', interestType: 'amortized' }
      );
      
      const currentPayment = LoanEngine.calculatePayment(currentTerms);
      
      let projectedTerms;
      let projectedPayment;
      
      if (mode === 'ASSIGN') {
        // Add balloon payment
        projectedTerms = {
          ...currentTerms,
          balloonPayment: balloonAmount,
          balloonPaymentDate: balloonDueDate,
        };
        projectedPayment = LoanEngine.calculatePayment(projectedTerms);
      } else if (mode === 'REMOVE') {
        // Remove balloon payment
        projectedTerms = {
          ...currentTerms,
          balloonPayment: undefined,
          balloonPaymentDate: undefined,
        };
        
        if (removalType === 'EXTEND_TERM') {
          projectedTerms.termMonths = newTermMonths;
        } else if (removalType === 'INCREASE_PAYMENT' || removalType === 'CUSTOM') {
          projectedTerms.fixedPaymentAmount = LoanEngine.toBig(newPaymentAmount);
        }
        
        projectedPayment = LoanEngine.calculatePayment(projectedTerms);
      } else {
        // Modify existing balloon
        projectedTerms = {
          ...currentTerms,
          balloonPayment: balloonAmount,
          balloonPaymentDate: balloonDueDate,
        };
        projectedPayment = LoanEngine.calculatePayment(projectedTerms);
      }

      setProjectedImpact({
        current: {
          monthlyPayment: currentPayment.monthlyPayment.toNumber(),
          balloonAmount: currentBalloonPayment,
          termMonths: loan.loanParameters.termMonths,
        },
        projected: {
          monthlyPayment: projectedPayment.monthlyPayment.toNumber(),
          balloonAmount: mode === 'REMOVE' ? 0 : balloonAmount,
          termMonths: projectedTerms.termMonths,
        }
      });
    } catch (error) {
      toast.error('Failed to calculate balloon payment impact');
      console.error('Balloon calculation error:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for the balloon payment change');
      return;
    }

    try {
      const modificationRecord = {
        loanId: loan.id,
        type: mode === 'ASSIGN' ? 'BALLOON_PAYMENT_ASSIGNMENT' : 'BALLOON_PAYMENT_REMOVAL',
        date: new Date(),
        changes: mode === 'ASSIGN' ? {
          balloonAmount,
          balloonDueDate,
          reamortizationStartType,
          customStartTerm: reamortizationStartType === 'CUSTOM' ? customStartTerm : undefined,
        } : {
          removedBalloonAmount: currentBalloonPayment,
          removalType,
          newTermMonths: removalType === 'EXTEND_TERM' ? newTermMonths : undefined,
          newPaymentAmount: removalType !== 'EXTEND_TERM' ? newPaymentAmount : undefined,
        },
        reason,
        approvedBy: 'Demo User',
        description: mode === 'ASSIGN' ? 'Balloon Payment Assignment' : 'Balloon Payment Removal',
        impactSummary: projectedImpact ? {
          paymentChange: projectedImpact.projected.monthlyPayment - projectedImpact.current.monthlyPayment,
          balloonChange: projectedImpact.projected.balloonAmount - projectedImpact.current.balloonAmount,
          termChange: projectedImpact.projected.termMonths - projectedImpact.current.termMonths,
        } : undefined,
      };

      // In a real app, this would be an API call
      console.log('Balloon payment modification:', modificationRecord);
      
      toast.success(`Balloon payment ${mode.toLowerCase()} completed successfully`);
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Failed to apply balloon payment changes');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-2xl transition-all sm:my-8 w-full max-w-4xl">
                <div className="bg-white">
                  <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-purple-100 border border-purple-200">
                          <ArrowPathIcon className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <Dialog.Title as="h3" className="text-xl font-bold leading-6 text-gray-900">
                            Balloon Payment Manager
                          </Dialog.Title>
                          <p className="mt-1 text-sm text-gray-600 flex items-center space-x-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                              {loan.id}
                            </span>
                            <span>•</span>
                            <span>
                              {hasBalloonPayment 
                                ? `Current balloon: ${formatCurrency(currentBalloonPayment)}`
                                : 'No balloon payment currently assigned'
                              }
                            </span>
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

                  <div className="px-6 py-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Left Column - Configuration */}
                      <div className="lg:col-span-2 space-y-6">
                        {/* Mode Selection */}
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900 mb-4">Operation Type</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <button
                              onClick={() => setMode('ASSIGN')}
                              className={`p-4 border rounded-xl text-left transition-all duration-200 ${
                                mode === 'ASSIGN'
                                  ? 'border-purple-300 bg-purple-50 text-purple-900'
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center space-x-3">
                                <CurrencyDollarIcon className="h-5 w-5" />
                                <div>
                                  <div className="font-medium">Assign</div>
                                  <div className="text-xs text-gray-500">Add balloon payment</div>
                                </div>
                              </div>
                            </button>
                            
                            <button
                              onClick={() => setMode('REMOVE')}
                              disabled={!hasBalloonPayment}
                              className={`p-4 border rounded-xl text-left transition-all duration-200 ${
                                mode === 'REMOVE'
                                  ? 'border-purple-300 bg-purple-50 text-purple-900'
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
                              }`}
                            >
                              <div className="flex items-center space-x-3">
                                <XMarkIcon className="h-5 w-5" />
                                <div>
                                  <div className="font-medium">Remove</div>
                                  <div className="text-xs text-gray-500">Remove balloon payment</div>
                                </div>
                              </div>
                            </button>
                            
                            <button
                              onClick={() => setMode('MODIFY')}
                              disabled={!hasBalloonPayment}
                              className={`p-4 border rounded-xl text-left transition-all duration-200 ${
                                mode === 'MODIFY'
                                  ? 'border-purple-300 bg-purple-50 text-purple-900'
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
                              }`}
                            >
                              <div className="flex items-center space-x-3">
                                <ArrowPathIcon className="h-5 w-5" />
                                <div>
                                  <div className="font-medium">Modify</div>
                                  <div className="text-xs text-gray-500">Change balloon amount/date</div>
                                </div>
                              </div>
                            </button>
                          </div>
                        </div>

                        {/* Configuration based on mode */}
                        {(mode === 'ASSIGN' || mode === 'MODIFY') && (
                          <div className="space-y-4">
                            <h4 className="text-lg font-semibold text-gray-900">Balloon Payment Configuration</h4>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Balloon Amount
                                </label>
                                <div className="relative rounded-md shadow-sm">
                                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="text-gray-500 sm:text-sm">$</span>
                                  </div>
                                  <input
                                    type="number"
                                    value={balloonAmount}
                                    onChange={(e) => setBalloonAmount(parseFloat(e.target.value))}
                                    className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                                    placeholder="50,000"
                                  />
                                </div>
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Due Date
                                </label>
                                <DatePicker
                                  selected={balloonDueDate}
                                  onChange={(date) => setBalloonDueDate(date || new Date())}
                                  dateFormat="MM/dd/yyyy"
                                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                                  showMonthDropdown
                                  showYearDropdown
                                  dropdownMode="select"
                                  minDate={new Date()}
                                />
                              </div>
                            </div>

                            {/* Reamortization Configuration */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                EMI Reamortization Start Point
                              </label>
                              <select
                                value={reamortizationStartType}
                                onChange={(e) => setReamortizationStartType(e.target.value as any)}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                              >
                                <option value="CURRENT_TERM">Current payment term (default)</option>
                                <option value="NEXT_TERM">Next payment term</option>
                                <option value="BEGINNING">From loan beginning</option>
                                <option value="CUSTOM">Custom term number</option>
                              </select>
                              
                              {reamortizationStartType === 'CUSTOM' && (
                                <div className="mt-2">
                                  <input
                                    type="number"
                                    value={customStartTerm}
                                    onChange={(e) => setCustomStartTerm(parseInt(e.target.value))}
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                                    placeholder="Term number"
                                    min="1"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {mode === 'REMOVE' && (
                          <div className="space-y-4">
                            <h4 className="text-lg font-semibold text-gray-900">Removal Configuration</h4>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Reamortization Strategy
                              </label>
                              <select
                                value={removalType}
                                onChange={(e) => setRemovalType(e.target.value as any)}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                              >
                                <option value="EXTEND_TERM">Extend term to reduce payment</option>
                                <option value="INCREASE_PAYMENT">Increase payment, keep term</option>
                                <option value="CUSTOM">Custom payment and term</option>
                              </select>
                            </div>

                            {removalType === 'EXTEND_TERM' && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  New Term (Months)
                                </label>
                                <input
                                  type="number"
                                  value={newTermMonths}
                                  onChange={(e) => setNewTermMonths(parseInt(e.target.value))}
                                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                                />
                              </div>
                            )}

                            {(removalType === 'INCREASE_PAYMENT' || removalType === 'CUSTOM') && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  New Payment Amount
                                </label>
                                <div className="relative rounded-md shadow-sm">
                                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="text-gray-500 sm:text-sm">$</span>
                                  </div>
                                  <input
                                    type="number"
                                    value={newPaymentAmount}
                                    onChange={(e) => setNewPaymentAmount(parseFloat(e.target.value))}
                                    className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Reason */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Reason for Change
                          </label>
                          <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                            placeholder="Explain why this balloon payment change is needed..."
                          />
                        </div>

                        {/* Calculate Impact Button */}
                        <div>
                          <button
                            onClick={calculateImpact}
                            disabled={isCalculating}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                          >
                            <CalculatorIcon className="h-4 w-4 mr-2" />
                            {isCalculating ? 'Calculating...' : 'Calculate Impact'}
                          </button>
                        </div>
                      </div>

                      {/* Right Column - Impact Analysis */}
                      <div className="lg:col-span-1">
                        <div className="sticky top-0 space-y-4">
                          <h4 className="text-lg font-semibold text-gray-900">Impact Analysis</h4>
                          
                          {isCalculating ? (
                            <div className="text-center py-8">
                              <ArrowPathIcon className="animate-spin h-8 w-8 text-gray-400 mx-auto" />
                              <p className="mt-2 text-sm text-gray-500">Calculating impact...</p>
                            </div>
                          ) : projectedImpact ? (
                            <div className="space-y-4">
                              {/* Payment Impact */}
                              <div className="bg-gray-50 rounded-lg p-4">
                                <h5 className="text-sm font-medium text-gray-900 mb-3">Payment Impact</h5>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Current Payment:</span>
                                    <span className="font-medium">{formatCurrency(projectedImpact.current.monthlyPayment)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">New Payment:</span>
                                    <span className="font-medium">{formatCurrency(projectedImpact.projected.monthlyPayment)}</span>
                                  </div>
                                  <div className="flex justify-between pt-2 border-t">
                                    <span className="font-medium text-gray-700">Change:</span>
                                    <span className={`font-medium ${
                                      (projectedImpact.projected.monthlyPayment - projectedImpact.current.monthlyPayment) < 0 
                                        ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                      {(projectedImpact.projected.monthlyPayment - projectedImpact.current.monthlyPayment) < 0 ? '' : '+'}
                                      {formatCurrency(projectedImpact.projected.monthlyPayment - projectedImpact.current.monthlyPayment)}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Balloon Impact */}
                              <div className="bg-purple-50 rounded-lg p-4">
                                <h5 className="text-sm font-medium text-purple-900 mb-3">Balloon Payment</h5>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-purple-700">Current Balloon:</span>
                                    <span className="font-medium text-purple-900">{formatCurrency(projectedImpact.current.balloonAmount)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-purple-700">New Balloon:</span>
                                    <span className="font-medium text-purple-900">{formatCurrency(projectedImpact.projected.balloonAmount)}</span>
                                  </div>
                                  <div className="flex justify-between pt-2 border-t border-purple-200">
                                    <span className="font-medium text-purple-800">Change:</span>
                                    <span className="font-medium text-purple-900">
                                      {(projectedImpact.projected.balloonAmount - projectedImpact.current.balloonAmount) < 0 ? '' : '+'}
                                      {formatCurrency(projectedImpact.projected.balloonAmount - projectedImpact.current.balloonAmount)}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Term Impact */}
                              {projectedImpact.projected.termMonths !== projectedImpact.current.termMonths && (
                                <div className="bg-blue-50 rounded-lg p-4">
                                  <h5 className="text-sm font-medium text-blue-900 mb-3">Term Impact</h5>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-blue-700">Current Term:</span>
                                      <span className="font-medium text-blue-900">{projectedImpact.current.termMonths} months</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-blue-700">New Term:</span>
                                      <span className="font-medium text-blue-900">{projectedImpact.projected.termMonths} months</span>
                                    </div>
                                    <div className="flex justify-between pt-2 border-t border-blue-200">
                                      <span className="font-medium text-blue-800">Change:</span>
                                      <span className="font-medium text-blue-900">
                                        {(projectedImpact.projected.termMonths - projectedImpact.current.termMonths) > 0 ? '+' : ''}
                                        {projectedImpact.projected.termMonths - projectedImpact.current.termMonths} months
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Information Notice */}
                              <div className="rounded-md bg-blue-50 p-4">
                                <div className="flex">
                                  <InformationCircleIcon className="h-5 w-5 text-blue-400" />
                                  <div className="ml-3">
                                    <h3 className="text-sm font-medium text-blue-800">Payment Schedule</h3>
                                    <div className="mt-2 text-sm text-blue-700">
                                      <p>
                                        The loan will be reamortized from the specified start point to accommodate the balloon payment structure.
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
                                Configure options and click Calculate Impact
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
                      onClick={handleSubmit}
                      disabled={!reason.trim() || !projectedImpact}
                      className="inline-flex justify-center rounded-md bg-purple-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckCircleIcon className="h-5 w-5 mr-2" />
                      Apply Changes
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};