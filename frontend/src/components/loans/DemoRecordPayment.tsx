import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { XMarkIcon, BanknotesIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { demoLoanStorage } from '../../services/demoLoanStorage';
import { LoanEngine } from '@lendpeak/engine';
import DatePicker from 'react-datepicker';
import { allocatePayment, roundCurrency } from '../../utils/rounding';

interface DemoRecordPaymentProps {
  loan: any;
  onClose: () => void;
  onSuccess: () => void;
}

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

const PAYMENT_METHODS = [
  { value: 'ACH', label: 'ACH Transfer' },
  { value: 'CHECK', label: 'Check' },
  { value: 'WIRE', label: 'Wire Transfer' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'DEBIT_CARD', label: 'Debit Card' },
  { value: 'CASH', label: 'Cash' },
];

export const DemoRecordPayment = ({ loan, onClose, onSuccess }: DemoRecordPaymentProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate loan metrics using stateless LoanEngine
  const loanTerms = LoanEngine.createLoan(
    loan.loanParameters.principal,
    loan.loanParameters.interestRate,
    loan.loanParameters.termMonths,
    loan.loanParameters.startDate,
    {
      paymentFrequency: 'monthly',
      interestType: 'amortized',
    }
  );
  const paymentResult = LoanEngine.calculatePayment(loanTerms);
  const currentBalance = demoLoanStorage.calculateCurrentBalance(loan.id);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    control,
  } = useForm<FormData>({
    resolver: yupResolver(schema),
    defaultValues: {
      amount: roundCurrency(paymentResult.monthlyPayment.toNumber()),
      paymentDate: new Date(),
      paymentMethod: 'ACH',
      reference: '',
      notes: '',
    },
  });

  const paymentAmount = watch('amount');
  const isOverpayment = paymentAmount > currentBalance;
  const isPartialPayment = paymentAmount < paymentResult.monthlyPayment.toNumber();

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      // Calculate payment allocation with proper rounding
      const monthlyInterestRate = loan.loanParameters.interestRate / 100 / 12;
      const allocation = allocatePayment(
        data.amount,
        currentBalance,
        monthlyInterestRate
      );
      
      // Record payment in demo storage with rounded values
      demoLoanStorage.recordPayment({
        loanId: loan.id,
        paymentDate: data.paymentDate,
        amount: allocation.total,
        principal: allocation.principal,
        interest: allocation.interest,
        fees: allocation.fees,
        penalties: allocation.penalties,
        escrow: allocation.escrow,
        remainingBalance: roundCurrency(currentBalance - allocation.principal),
        status: 'COMPLETED',
        paymentMethod: data.paymentMethod,
        reference: data.reference,
        notes: data.notes,
        createdBy: 'demo-user',
      });

      toast.success('Payment recorded successfully');
      onSuccess();
    } catch (error) {
      console.error('Error recording payment:', error);
      toast.error('Failed to record payment: ' + (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
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
        setValue('amount', paymentResult.monthlyPayment.toNumber());
        break;
      case 'payoff':
        setValue('amount', currentBalance);
        break;
      case 'partial':
        setValue('amount', paymentResult.monthlyPayment.toNumber() / 2);
        break;
    }
  };

  return (
    <Transition.Root show={true} as={Fragment}>
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                <form onSubmit={handleSubmit(onSubmit)}>
                  <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                    <div className="flex items-center justify-between mb-5">
                      <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900">
                        Record Payment - Loan #{loan.id}
                      </Dialog.Title>
                      <button
                        type="button"
                        className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                        onClick={onClose}
                      >
                        <XMarkIcon className="h-6 w-6" />
                      </button>
                    </div>

                    {/* Loan Summary */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-6">
                      <dl className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <dt className="text-gray-500">Current Balance</dt>
                          <dd className="font-semibold text-gray-900">
                            {formatCurrency(currentBalance)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Monthly Payment</dt>
                          <dd className="font-semibold text-gray-900">
                            {formatCurrency(paymentResult.monthlyPayment.toNumber())}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div className="space-y-4">
                      {/* Payment Amount */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
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
                            className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
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
                            className="text-xs text-primary-600 hover:text-primary-500"
                          >
                            Scheduled ({formatCurrency(paymentResult.monthlyPayment.toNumber())})
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            type="button"
                            onClick={() => setQuickAmount('partial')}
                            className="text-xs text-primary-600 hover:text-primary-500"
                          >
                            Partial ({formatCurrency(paymentResult.monthlyPayment.toNumber() / 2)})
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            type="button"
                            onClick={() => setQuickAmount('payoff')}
                            className="text-xs text-primary-600 hover:text-primary-500"
                          >
                            Payoff ({formatCurrency(currentBalance)})
                          </button>
                        </div>
                      </div>

                      {/* Payment Date */}
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
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                              placeholderText="Select payment date"
                              showMonthDropdown
                              showYearDropdown
                              dropdownMode="select"
                              maxDate={new Date()}
                            />
                          )}
                        />
                        {errors.paymentDate && (
                          <p className="mt-1 text-sm text-red-600">{errors.paymentDate.message}</p>
                        )}
                      </div>

                      {/* Payment Method */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Payment Method
                        </label>
                        <select
                          {...register('paymentMethod')}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
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

                      {/* Reference */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Reference Number (Optional)
                        </label>
                        <input
                          type="text"
                          {...register('reference')}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        />
                      </div>

                      {/* Notes */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Notes (Optional)
                        </label>
                        <textarea
                          {...register('notes')}
                          rows={2}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        />
                      </div>

                      {/* Warnings */}
                      {isOverpayment && (
                        <div className="rounded-md bg-yellow-50 p-4">
                          <div className="flex">
                            <div className="ml-3">
                              <h3 className="text-sm font-medium text-yellow-800">Overpayment</h3>
                              <div className="mt-2 text-sm text-yellow-700">
                                <p>
                                  This payment exceeds the current balance. The excess will be applied to future payments.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {isPartialPayment && (
                        <div className="rounded-md bg-blue-50 p-4">
                          <div className="flex">
                            <div className="ml-3">
                              <h3 className="text-sm font-medium text-blue-800">Partial Payment</h3>
                              <div className="mt-2 text-sm text-blue-700">
                                <p>
                                  This payment is less than the scheduled amount. Late fees may apply.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex w-full justify-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 sm:ml-3 sm:w-auto disabled:opacity-50"
                    >
                      <BanknotesIcon className="h-4 w-4 mr-2" />
                      {isSubmitting ? 'Processing...' : 'Record Payment'}
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};