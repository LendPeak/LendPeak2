import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { CalculatorIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';

const schema = yup.object({
  prepaymentAmount: yup
    .number()
    .positive('Prepayment amount must be positive')
    .required('Prepayment amount is required'),
  prepaymentDate: yup.date().required('Prepayment date is required'),
  prepaymentType: yup.string().oneOf(['reduceTerm', 'reducePayment']).required(),
});

type FormData = yup.InferType<typeof schema>;

interface PrepaymentCalculatorProps {
  loanData: {
    principal: number;
    remainingBalance: number;
    monthlyPayment: number;
    interestRate: number;
    remainingTermMonths: number;
    nextPaymentDate: Date;
  };
  onCalculate?: (result: PrepaymentResult) => void;
}

interface PrepaymentResult {
  prepaymentAmount: number;
  prepaymentDate: Date;
  prepaymentType: 'reduceTerm' | 'reducePayment';
  originalTerm: number;
  newTerm: number;
  termReduction: number;
  originalPayment: number;
  newPayment: number;
  paymentReduction: number;
  interestSavings: number;
  originalTotalInterest: number;
  newTotalInterest: number;
}

export const PrepaymentCalculator: React.FC<PrepaymentCalculatorProps> = ({
  loanData,
  onCalculate,
}) => {
  const [result, setResult] = useState<PrepaymentResult | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<FormData>({
    resolver: yupResolver(schema),
    defaultValues: {
      prepaymentAmount: 5000,
      prepaymentDate: loanData.nextPaymentDate,
      prepaymentType: 'reduceTerm',
    },
  });


  const calculatePrepayment = (data: FormData) => {
    const monthlyRate = loanData.interestRate / 100 / 12;
    const currentBalance = loanData.remainingBalance;
    const newBalance = currentBalance - data.prepaymentAmount;
    
    // Calculate original total interest
    const originalTotalInterest = (loanData.monthlyPayment * loanData.remainingTermMonths) - currentBalance;
    
    let newTerm = loanData.remainingTermMonths;
    let newPayment = loanData.monthlyPayment;
    let newTotalInterest = originalTotalInterest;

    if (data.prepaymentType === 'reduceTerm') {
      // Keep payment the same, reduce term
      newPayment = loanData.monthlyPayment;
      
      // Calculate new term using logarithm
      if (monthlyRate > 0) {
        newTerm = Math.ceil(
          -Math.log(1 - (monthlyRate * newBalance) / newPayment) / Math.log(1 + monthlyRate)
        );
      } else {
        newTerm = Math.ceil(newBalance / newPayment);
      }
      
      newTotalInterest = (newPayment * newTerm) - newBalance;
    } else {
      // Keep term the same, reduce payment
      newTerm = loanData.remainingTermMonths;
      
      // Calculate new payment
      if (monthlyRate > 0) {
        newPayment = (newBalance * monthlyRate * Math.pow(1 + monthlyRate, newTerm)) /
          (Math.pow(1 + monthlyRate, newTerm) - 1);
      } else {
        newPayment = newBalance / newTerm;
      }
      
      newTotalInterest = (newPayment * newTerm) - newBalance;
    }

    const prepaymentResult: PrepaymentResult = {
      prepaymentAmount: data.prepaymentAmount,
      prepaymentDate: data.prepaymentDate,
      prepaymentType: data.prepaymentType,
      originalTerm: loanData.remainingTermMonths,
      newTerm,
      termReduction: loanData.remainingTermMonths - newTerm,
      originalPayment: loanData.monthlyPayment,
      newPayment,
      paymentReduction: loanData.monthlyPayment - newPayment,
      interestSavings: originalTotalInterest - newTotalInterest,
      originalTotalInterest,
      newTotalInterest,
    };

    setResult(prepaymentResult);
    onCalculate?.(prepaymentResult);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatMonths = (months: number) => {
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    
    if (years > 0 && remainingMonths > 0) {
      return `${years} year${years > 1 ? 's' : ''}, ${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`;
    } else if (years > 0) {
      return `${years} year${years > 1 ? 's' : ''}`;
    } else {
      return `${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`;
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-900">Prepayment Calculator</h3>
        <button
          type="button"
          onClick={() => setShowInfo(!showInfo)}
          className="text-gray-400 hover:text-gray-600"
        >
          <InformationCircleIcon className="h-5 w-5" />
        </button>
      </div>

      {showInfo && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-md p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">About Prepayments</h4>
          <p className="text-sm text-blue-700 mb-2">
            Making extra payments toward your loan principal can save you money on interest and help you pay off your loan faster.
          </p>
          <ul className="text-sm text-blue-700 space-y-1">
            <li><strong>Reduce Term:</strong> Keep your monthly payment the same but pay off the loan sooner</li>
            <li><strong>Reduce Payment:</strong> Keep the same payoff date but lower your monthly payment</li>
          </ul>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Current Balance:</span>
          <p className="font-semibold">{formatCurrency(loanData.remainingBalance)}</p>
        </div>
        <div>
          <span className="text-gray-500">Monthly Payment:</span>
          <p className="font-semibold">{formatCurrency(loanData.monthlyPayment)}</p>
        </div>
        <div>
          <span className="text-gray-500">Interest Rate:</span>
          <p className="font-semibold">{loanData.interestRate}%</p>
        </div>
        <div>
          <span className="text-gray-500">Remaining Term:</span>
          <p className="font-semibold">{formatMonths(loanData.remainingTermMonths)}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(calculatePrepayment)} className="space-y-4">
        <div>
          <label htmlFor="prepaymentAmount" className="block text-sm font-medium text-gray-700">
            Prepayment Amount
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">$</span>
            </div>
            <input
              type="number"
              {...register('prepaymentAmount', { valueAsNumber: true })}
              className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
              placeholder="5,000"
            />
          </div>
          {errors.prepaymentAmount && (
            <p className="mt-1 text-sm text-red-600">{errors.prepaymentAmount.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="prepaymentDate" className="block text-sm font-medium text-gray-700">
            Prepayment Date
          </label>
          <input
            type="date"
            {...register('prepaymentDate', { valueAsDate: true })}
            className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
          />
          {errors.prepaymentDate && (
            <p className="mt-1 text-sm text-red-600">{errors.prepaymentDate.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Prepayment Application
          </label>
          <div className="space-y-2">
            <label className="flex items-start">
              <input
                type="radio"
                {...register('prepaymentType')}
                value="reduceTerm"
                className="mt-0.5 focus:ring-primary-500 h-4 w-4 text-primary-600 border-gray-300"
              />
              <div className="ml-3">
                <span className="block text-sm font-medium text-gray-700">Reduce Term</span>
                <span className="block text-sm text-gray-500">Pay off loan faster, same monthly payment</span>
              </div>
            </label>
            <label className="flex items-start">
              <input
                type="radio"
                {...register('prepaymentType')}
                value="reducePayment"
                className="mt-0.5 focus:ring-primary-500 h-4 w-4 text-primary-600 border-gray-300"
              />
              <div className="ml-3">
                <span className="block text-sm font-medium text-gray-700">Reduce Payment</span>
                <span className="block text-sm text-gray-500">Lower monthly payment, same payoff date</span>
              </div>
            </label>
          </div>
        </div>

        <button
          type="submit"
          className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <CalculatorIcon className="h-5 w-5 mr-2" />
          Calculate Prepayment Impact
        </button>
      </form>

      {result && (
        <div className="mt-6 space-y-4">
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Prepayment Results</h4>
            
            <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900">Total Interest Savings</p>
                  <p className="text-2xl font-bold text-green-900">{formatCurrency(result.interestSavings)}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {result.prepaymentType === 'reduceTerm' ? (
                <>
                  <div className="bg-gray-50 rounded-md p-3">
                    <p className="text-xs text-gray-500">Original Term</p>
                    <p className="text-sm font-semibold">{formatMonths(result.originalTerm)}</p>
                  </div>
                  <div className="bg-primary-50 rounded-md p-3">
                    <p className="text-xs text-primary-700">New Term</p>
                    <p className="text-sm font-semibold text-primary-900">{formatMonths(result.newTerm)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-md p-3">
                    <p className="text-xs text-gray-500">Monthly Payment</p>
                    <p className="text-sm font-semibold">{formatCurrency(result.originalPayment)}</p>
                  </div>
                  <div className="bg-green-50 rounded-md p-3">
                    <p className="text-xs text-green-700">Time Saved</p>
                    <p className="text-sm font-semibold text-green-900">{formatMonths(result.termReduction)}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-gray-50 rounded-md p-3">
                    <p className="text-xs text-gray-500">Original Payment</p>
                    <p className="text-sm font-semibold">{formatCurrency(result.originalPayment)}</p>
                  </div>
                  <div className="bg-primary-50 rounded-md p-3">
                    <p className="text-xs text-primary-700">New Payment</p>
                    <p className="text-sm font-semibold text-primary-900">{formatCurrency(result.newPayment)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-md p-3">
                    <p className="text-xs text-gray-500">Term Length</p>
                    <p className="text-sm font-semibold">{formatMonths(result.originalTerm)}</p>
                  </div>
                  <div className="bg-green-50 rounded-md p-3">
                    <p className="text-xs text-green-700">Payment Reduction</p>
                    <p className="text-sm font-semibold text-green-900">{formatCurrency(result.paymentReduction)}/mo</p>
                  </div>
                </>
              )}
            </div>

            <div className="mt-4 text-sm text-gray-600">
              <p>Total Interest Comparison:</p>
              <div className="mt-1 space-y-1">
                <div className="flex justify-between">
                  <span>Without prepayment:</span>
                  <span className="font-medium">{formatCurrency(result.originalTotalInterest)}</span>
                </div>
                <div className="flex justify-between">
                  <span>With prepayment:</span>
                  <span className="font-medium">{formatCurrency(result.newTotalInterest)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};