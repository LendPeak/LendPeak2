import { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  XMarkIcon,
  BanknotesIcon,
  CreditCardIcon,
  BuildingLibraryIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CalculatorIcon,
  ArrowPathIcon,
  DocumentCheckIcon,
  ShieldCheckIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { LoanEngine } from '@lendpeak/engine';
import { format } from 'date-fns';
import DatePicker from 'react-datepicker';

interface AdvancedPaymentProcessorProps {
  loan: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface PaymentValidationResult {
  isValid: boolean;
  errors: PaymentValidationError[];
  warnings: PaymentValidationWarning[];
  suggestions: PaymentSuggestion[];
}

interface PaymentValidationError {
  field: string;
  code: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

interface PaymentValidationWarning {
  field: string;
  code: string;
  message: string;
  impact: string;
}

interface PaymentSuggestion {
  type: 'OVERPAYMENT_ALLOCATION' | 'PARTIAL_PAYMENT_HANDLING' | 'EARLY_PAYMENT_BENEFIT';
  message: string;
  action?: string;
}

interface PaymentAllocation {
  principal: number;
  interest: number;
  fees: number;
  escrow: number;
  overpayment: number;
}

interface PaymentMethod {
  type: 'ACH' | 'WIRE' | 'CHECK' | 'CARD' | 'CASH';
  accountNumber?: string;
  routingNumber?: string;
  cardNumber?: string;
  checkNumber?: string;
  confirmationNumber?: string;
}

export const AdvancedPaymentProcessor = ({ loan, isOpen, onClose, onSuccess }: AdvancedPaymentProcessorProps) => {
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>({ type: 'ACH' });
  const [description, setDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [validation, setValidation] = useState<PaymentValidationResult | null>(null);
  const [allocation, setAllocation] = useState<PaymentAllocation | null>(null);
  const [overpaymentHandling, setOverpaymentHandling] = useState<'PRINCIPAL' | 'NEXT_PAYMENT' | 'REFUND'>('PRINCIPAL');
  const [allowPartialPayment, setAllowPartialPayment] = useState(false);
  const [waiveFees, setWaiveFees] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Calculate expected payment amount
  const loanTerms = LoanEngine.createLoan(
    loan.loanParameters.principal,
    loan.loanParameters.interestRate,
    loan.loanParameters.termMonths,
    loan.loanParameters.startDate,
    { paymentFrequency: 'monthly', interestType: 'amortized' }
  );
  const expectedPayment = LoanEngine.calculatePayment(loanTerms);

  useEffect(() => {
    if (paymentAmount > 0) {
      validatePayment();
      calculateAllocation();
    } else {
      setValidation(null);
      setAllocation(null);
    }
  }, [paymentAmount, paymentDate, allowPartialPayment, waiveFees]);

  const validatePayment = async () => {
    const errors: PaymentValidationError[] = [];
    const warnings: PaymentValidationWarning[] = [];
    const suggestions: PaymentSuggestion[] = [];

    // Amount validation
    if (paymentAmount <= 0) {
      errors.push({
        field: 'paymentAmount',
        code: 'INVALID_AMOUNT',
        message: 'Payment amount must be greater than zero',
        severity: 'ERROR'
      });
    }

    // Check for overpayment
    const currentBalance = loan.loanParameters.principal * 0.85; // Demo current balance
    if (paymentAmount > currentBalance + 1000) { // Allow some cushion for interest
      warnings.push({
        field: 'paymentAmount',
        code: 'OVERPAYMENT',
        message: 'Payment exceeds current loan balance',
        impact: 'Excess will be applied according to overpayment handling rules'
      });
      
      suggestions.push({
        type: 'OVERPAYMENT_ALLOCATION',
        message: 'Consider applying overpayment to principal to reduce future interest',
        action: 'Set overpayment handling to "Apply to Principal"'
      });
    }

    // Check for partial payment
    const minPayment = expectedPayment.monthlyPayment.toNumber();
    if (paymentAmount < minPayment && !allowPartialPayment) {
      errors.push({
        field: 'paymentAmount',
        code: 'PARTIAL_PAYMENT_NOT_ALLOWED',
        message: `Payment amount is less than required payment of ${formatCurrency(minPayment)}`,
        severity: 'ERROR'
      });
    } else if (paymentAmount < minPayment && allowPartialPayment) {
      warnings.push({
        field: 'paymentAmount',
        code: 'PARTIAL_PAYMENT',
        message: 'Partial payment may result in additional fees or late charges',
        impact: 'Remaining balance will be carried forward'
      });
    }

    // Date validation
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(paymentDate);
    selectedDate.setHours(0, 0, 0, 0);

    if (selectedDate > today) {
      warnings.push({
        field: 'paymentDate',
        code: 'FUTURE_DATED',
        message: 'Payment is dated in the future',
        impact: 'Payment will be processed on the specified date'
      });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    if (selectedDate < thirtyDaysAgo) {
      warnings.push({
        field: 'paymentDate',
        code: 'OLD_PAYMENT_DATE',
        message: 'Payment date is more than 30 days old',
        impact: 'May affect interest calculations and reporting'
      });
    }

    // Early payment benefit
    const nextDueDate = new Date();
    nextDueDate.setMonth(nextDueDate.getMonth() + 1);
    nextDueDate.setDate(1);
    
    if (selectedDate < nextDueDate && paymentAmount >= minPayment) {
      suggestions.push({
        type: 'EARLY_PAYMENT_BENEFIT',
        message: 'Early payment reduces interest accrual',
        action: 'Continue with early payment to save on interest'
      });
    }

    setValidation({
      isValid: errors.filter(e => e.severity === 'ERROR').length === 0,
      errors,
      warnings,
      suggestions
    });
  };

  const calculateAllocation = async () => {
    try {
      // Demo allocation calculation
      const currentBalance = loan.loanParameters.principal * 0.85;
      const monthlyPayment = expectedPayment.monthlyPayment.toNumber();
      
      // Interest portion (demo calculation)
      const monthlyInterestRate = loan.loanParameters.interestRate / 100 / 12;
      const interestDue = currentBalance * monthlyInterestRate;
      
      // Calculate allocation
      let remainingPayment = paymentAmount;
      let interest = 0;
      let principal = 0;
      let fees = 0;
      let escrow = 0;
      let overpayment = 0;

      // Apply to interest first
      if (remainingPayment > 0) {
        interest = Math.min(remainingPayment, interestDue);
        remainingPayment -= interest;
      }

      // Apply to fees (demo: $25 late fee if exists)
      const lateFee = 25; // Demo late fee
      if (remainingPayment > 0 && !waiveFees) {
        fees = Math.min(remainingPayment, lateFee);
        remainingPayment -= fees;
      }

      // Apply to escrow (demo: $200 monthly escrow)
      const escrowDue = 200;
      if (remainingPayment > 0) {
        escrow = Math.min(remainingPayment, escrowDue);
        remainingPayment -= escrow;
      }

      // Apply remaining to principal
      if (remainingPayment > 0) {
        const principalDue = monthlyPayment - interest - fees - escrow;
        principal = Math.min(remainingPayment, Math.max(0, principalDue));
        remainingPayment -= principal;
      }

      // Handle overpayment
      if (remainingPayment > 0) {
        switch (overpaymentHandling) {
          case 'PRINCIPAL':
            principal += remainingPayment;
            break;
          case 'NEXT_PAYMENT':
            overpayment = remainingPayment;
            break;
          case 'REFUND':
            overpayment = remainingPayment;
            break;
        }
      }

      setAllocation({
        principal,
        interest,
        fees,
        escrow,
        overpayment
      });
    } catch (error) {
      console.error('Error calculating allocation:', error);
    }
  };

  const processPayment = async () => {
    if (!validation?.isValid) {
      toast.error('Please fix validation errors before processing payment');
      return;
    }

    setIsProcessing(true);
    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      const paymentRecord = {
        loanId: loan.id,
        amount: paymentAmount,
        date: paymentDate,
        method: paymentMethod,
        allocation,
        description: description || `Payment processed via ${paymentMethod.type}`,
        confirmationNumber: `PAY-${Date.now()}`,
        status: 'COMPLETED',
        processedBy: 'Demo User',
        overpaymentHandling,
        feesWaived: waiveFees,
        isPartialPayment: paymentAmount < expectedPayment.monthlyPayment.toNumber(),
      };

      // In a real app, this would be an API call
      console.log('Payment processed:', paymentRecord);
      
      toast.success(`Payment of ${formatCurrency(paymentAmount)} processed successfully`);
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Failed to process payment');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const renderPaymentMethodForm = () => {
    switch (paymentMethod.type) {
      case 'ACH':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Number
              </label>
              <input
                type="text"
                value={paymentMethod.accountNumber || ''}
                onChange={(e) => setPaymentMethod({ ...paymentMethod, accountNumber: e.target.value })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="Account number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Routing Number
              </label>
              <input
                type="text"
                value={paymentMethod.routingNumber || ''}
                onChange={(e) => setPaymentMethod({ ...paymentMethod, routingNumber: e.target.value })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="Routing number"
              />
            </div>
          </div>
        );
      case 'CHECK':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Check Number
            </label>
            <input
              type="text"
              value={paymentMethod.checkNumber || ''}
              onChange={(e) => setPaymentMethod({ ...paymentMethod, checkNumber: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Check number"
            />
          </div>
        );
      case 'WIRE':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Wire Confirmation Number
            </label>
            <input
              type="text"
              value={paymentMethod.confirmationNumber || ''}
              onChange={(e) => setPaymentMethod({ ...paymentMethod, confirmationNumber: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Wire confirmation number"
            />
          </div>
        );
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-2xl transition-all sm:my-8 w-full max-w-6xl">
                <div className="bg-white">
                  <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-green-100 border border-green-200">
                          <BanknotesIcon className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <Dialog.Title as="h3" className="text-xl font-bold leading-6 text-gray-900">
                            Advanced Payment Processor
                          </Dialog.Title>
                          <p className="mt-1 text-sm text-gray-600 flex items-center space-x-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              {loan.id}
                            </span>
                            <span>•</span>
                            <span>Process payment with advanced validation and allocation</span>
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
                      {/* Left Column - Payment Details */}
                      <div className="lg:col-span-2 space-y-6">
                        {/* Basic Payment Information */}
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Payment Amount
                              </label>
                              <div className="relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <span className="text-gray-500 sm:text-sm">$</span>
                                </div>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={paymentAmount || ''}
                                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                                  className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                                  placeholder="0.00"
                                />
                              </div>
                              <p className="mt-1 text-xs text-gray-500">
                                Expected: {formatCurrency(expectedPayment.monthlyPayment.toNumber())}
                              </p>
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Payment Date
                              </label>
                              <DatePicker
                                selected={paymentDate}
                                onChange={(date) => setPaymentDate(date || new Date())}
                                dateFormat="MM/dd/yyyy"
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                                showMonthDropdown
                                showYearDropdown
                                dropdownMode="select"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Payment Method */}
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900 mb-4">Payment Method</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
                            {[
                              { value: 'ACH', label: 'ACH Transfer', icon: BuildingLibraryIcon },
                              { value: 'WIRE', label: 'Wire Transfer', icon: ArrowPathIcon },
                              { value: 'CHECK', label: 'Check', icon: DocumentCheckIcon },
                              { value: 'CARD', label: 'Credit Card', icon: CreditCardIcon },
                              { value: 'CASH', label: 'Cash', icon: BanknotesIcon },
                            ].map((method) => {
                              const IconComponent = method.icon;
                              return (
                                <button
                                  key={method.value}
                                  onClick={() => setPaymentMethod({ type: method.value as any })}
                                  className={`p-3 border rounded-lg text-center transition-all duration-200 ${
                                    paymentMethod.type === method.value
                                      ? 'border-green-300 bg-green-50 text-green-900'
                                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                  }`}
                                >
                                  <IconComponent className="h-5 w-5 mx-auto mb-1" />
                                  <div className="text-xs font-medium">{method.label}</div>
                                </button>
                              );
                            })}
                          </div>
                          {renderPaymentMethodForm()}
                        </div>

                        {/* Advanced Options */}
                        <div>
                          <button
                            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                            className="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                          >
                            <span>Advanced Options</span>
                            <ArrowPathIcon className={`h-4 w-4 transition-transform ${showAdvancedOptions ? 'rotate-180' : ''}`} />
                          </button>
                          
                          {showAdvancedOptions && (
                            <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-lg">
                              {/* Overpayment Handling */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Overpayment Handling
                                </label>
                                <select
                                  value={overpaymentHandling}
                                  onChange={(e) => setOverpaymentHandling(e.target.value as any)}
                                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                                >
                                  <option value="PRINCIPAL">Apply to Principal</option>
                                  <option value="NEXT_PAYMENT">Apply to Next Payment</option>
                                  <option value="REFUND">Issue Refund</option>
                                </select>
                              </div>

                              {/* Payment Options */}
                              <div className="space-y-3">
                                <div className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={allowPartialPayment}
                                    onChange={(e) => setAllowPartialPayment(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                  />
                                  <label className="ml-2 text-sm text-gray-700">
                                    Allow partial payment
                                  </label>
                                </div>
                                
                                <div className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={waiveFees}
                                    onChange={(e) => setWaiveFees(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                  />
                                  <label className="ml-2 text-sm text-gray-700">
                                    Waive late fees
                                  </label>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Description */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Payment Description (Optional)
                          </label>
                          <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                            placeholder="Add notes about this payment..."
                          />
                        </div>
                      </div>

                      {/* Right Column - Validation & Allocation */}
                      <div className="lg:col-span-1">
                        <div className="sticky top-0 space-y-4">
                          <h4 className="text-lg font-semibold text-gray-900">Payment Analysis</h4>
                          
                          {/* Validation Results */}
                          {validation && (
                            <div className="space-y-3">
                              {/* Errors */}
                              {validation.errors.filter(e => e.severity === 'ERROR').length > 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                  <div className="flex items-center mb-2">
                                    <ExclamationTriangleIcon className="h-4 w-4 text-red-600 mr-2" />
                                    <span className="text-sm font-medium text-red-800">Errors</span>
                                  </div>
                                  {validation.errors.filter(e => e.severity === 'ERROR').map((error, idx) => (
                                    <div key={idx} className="text-xs text-red-700 mb-1">
                                      {error.message}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Warnings */}
                              {validation.warnings.length > 0 && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                  <div className="flex items-center mb-2">
                                    <ExclamationTriangleIcon className="h-4 w-4 text-yellow-600 mr-2" />
                                    <span className="text-sm font-medium text-yellow-800">Warnings</span>
                                  </div>
                                  {validation.warnings.map((warning, idx) => (
                                    <div key={idx} className="text-xs text-yellow-700 mb-1">
                                      <div>{warning.message}</div>
                                      <div className="italic">Impact: {warning.impact}</div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Suggestions */}
                              {validation.suggestions.length > 0 && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                  <div className="flex items-center mb-2">
                                    <InformationCircleIcon className="h-4 w-4 text-blue-600 mr-2" />
                                    <span className="text-sm font-medium text-blue-800">Suggestions</span>
                                  </div>
                                  {validation.suggestions.map((suggestion, idx) => (
                                    <div key={idx} className="text-xs text-blue-700 mb-1">
                                      {suggestion.message}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Payment Allocation */}
                          {allocation && (
                            <div className="bg-gray-50 rounded-lg p-4">
                              <h5 className="text-sm font-medium text-gray-900 mb-3">Payment Allocation</h5>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Interest:</span>
                                  <span className="font-medium">{formatCurrency(allocation.interest)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Principal:</span>
                                  <span className="font-medium">{formatCurrency(allocation.principal)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Fees:</span>
                                  <span className="font-medium">{formatCurrency(allocation.fees)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Escrow:</span>
                                  <span className="font-medium">{formatCurrency(allocation.escrow)}</span>
                                </div>
                                {allocation.overpayment > 0 && (
                                  <div className="flex justify-between pt-2 border-t">
                                    <span className="text-gray-600">Overpayment:</span>
                                    <span className="font-medium text-green-600">{formatCurrency(allocation.overpayment)}</span>
                                  </div>
                                )}
                                <div className="flex justify-between pt-2 border-t">
                                  <span className="font-semibold text-gray-900">Total:</span>
                                  <span className="font-bold text-lg">{formatCurrency(paymentAmount)}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {validation?.isValid && (
                            <div className="rounded-md bg-green-50 p-4">
                              <div className="flex">
                                <CheckCircleIcon className="h-5 w-5 text-green-400" />
                                <div className="ml-3">
                                  <h3 className="text-sm font-medium text-green-800">Ready to Process</h3>
                                  <div className="mt-2 text-sm text-green-700">
                                    <p>Payment validation passed. Ready for processing.</p>
                                  </div>
                                </div>
                              </div>
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
                      onClick={processPayment}
                      disabled={!validation?.isValid || isProcessing || paymentAmount <= 0}
                      className="inline-flex justify-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? (
                        <>
                          <ArrowPathIcon className="animate-spin h-5 w-5 mr-2" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon className="h-5 w-5 mr-2" />
                          Process Payment
                        </>
                      )}
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