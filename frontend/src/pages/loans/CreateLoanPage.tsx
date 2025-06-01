import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useMutation } from '@tanstack/react-query';
import { ExclamationCircleIcon, CalculatorIcon } from '@heroicons/react/24/outline';
import apiClient from '../../services/api';
import { DateInput } from '../../components/ui/DateInput';
import { useIsDemoMode } from '../../contexts/DemoAuthContext';
import { demoLoanStorage } from '../../services/demoLoanStorage';

const schema = yup.object({
  // Borrower Information
  borrowerId: yup.string().required('Borrower ID is required'),
  coBorrowerIds: yup.string().optional(), // Will be transformed to array in onSubmit
  
  // Loan Details
  loanType: yup.string().oneOf(['MORTGAGE', 'PERSONAL', 'AUTO', 'STUDENT', 'BUSINESS', 'OTHER']).required('Loan type is required'),
  loanPurpose: yup.string().oneOf(['PURCHASE', 'REFINANCE', 'CASH_OUT', 'DEBT_CONSOLIDATION', 'HOME_IMPROVEMENT', 'OTHER']).required('Loan purpose is required'),
  
  // Financial Terms
  originalPrincipal: yup
    .number()
    .positive('Principal must be positive')
    .required('Principal amount is required')
    .min(1000, 'Minimum loan amount is $1,000')
    .max(10000000, 'Maximum loan amount is $10,000,000'),
  interestRate: yup
    .number()
    .positive('Interest rate must be positive')
    .required('Interest rate is required')
    .min(0.01, 'Minimum interest rate is 0.01%')
    .max(50, 'Maximum interest rate is 50%'),
  termMonths: yup
    .number()
    .positive('Term must be positive')
    .required('Term is required')
    .integer('Term must be a whole number')
    .min(1, 'Minimum term is 1 month')
    .max(480, 'Maximum term is 480 months'),
  
  // Dates
  originationDate: yup.date().required('Origination date is required'),
  firstPaymentDate: yup.date().required('First payment date is required').min(yup.ref('originationDate'), 'First payment date must be after origination date'),
  
  // Additional Information
  paymentFrequency: yup.string().oneOf(['monthly', 'bi-weekly', 'weekly']).default('monthly'),
  paymentDueDay: yup
    .number()
    .min(1, 'Payment due day must be between 1 and 31')
    .max(31, 'Payment due day must be between 1 and 31')
    .required('Payment due day is required'),
  loanCalendar: yup.string().oneOf(['ACTUAL_360', 'ACTUAL_365', 'THIRTY_360']).default('THIRTY_360'),
  accrualStartTiming: yup.string().oneOf(['SAME_DAY', 'NEXT_DAY']).default('SAME_DAY'),
  roundingMethod: yup.string().oneOf(['ROUND_HALF_UP', 'ROUND_HALF_DOWN', 'ROUND_UP', 'ROUND_DOWN', 'ROUND_HALF_EVEN']).default('ROUND_HALF_UP'),
});

type FormData = yup.InferType<typeof schema>;

const loanTypes = [
  { value: 'MORTGAGE', label: 'Mortgage' },
  { value: 'PERSONAL', label: 'Personal Loan' },
  { value: 'AUTO', label: 'Auto Loan' },
  { value: 'STUDENT', label: 'Student Loan' },
  { value: 'BUSINESS', label: 'Business Loan' },
  { value: 'OTHER', label: 'Other' },
];

const loanPurposes = [
  { value: 'PURCHASE', label: 'Purchase' },
  { value: 'REFINANCE', label: 'Refinance' },
  { value: 'CASH_OUT', label: 'Cash Out' },
  { value: 'DEBT_CONSOLIDATION', label: 'Debt Consolidation' },
  { value: 'HOME_IMPROVEMENT', label: 'Home Improvement' },
  { value: 'OTHER', label: 'Other' },
];

export const CreateLoanPage = () => {
  const [error, setError] = useState('');
  const [showCalculations, setShowCalculations] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isDemoMode = useIsDemoMode();

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    setValue,
    watch,
  } = useForm<FormData>({
    resolver: yupResolver(schema),
    defaultValues: {
      paymentFrequency: 'monthly',
      paymentDueDay: 1,
      loanCalendar: 'THIRTY_360',
      accrualStartTiming: 'SAME_DAY',
      roundingMethod: 'ROUND_HALF_UP',
      originationDate: new Date(),
      firstPaymentDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
    },
  });

  // Real-time loan calculations
  const loanCalculations = useMemo(() => {
    const principal = watch('originalPrincipal');
    const rate = watch('interestRate');
    const term = watch('termMonths');
    
    if (!principal || !rate || !term || principal <= 0 || rate <= 0 || term <= 0) {
      return null;
    }
    
    // Calculate monthly payment using amortization formula
    const monthlyRate = rate / 100 / 12;
    let monthlyPayment: number;
    
    if (monthlyRate === 0) {
      monthlyPayment = principal / term;
    } else {
      const factor = Math.pow(1 + monthlyRate, term);
      monthlyPayment = (principal * monthlyRate * factor) / (factor - 1);
    }
    
    const totalPayment = monthlyPayment * term;
    const totalInterest = totalPayment - principal;
    
    return {
      monthlyPayment: monthlyPayment,
      totalPayment: totalPayment,
      totalInterest: totalInterest,
      effectiveRate: rate
    };
  }, [watch('originalPrincipal'), watch('interestRate'), watch('termMonths')]);

  // Apply query parameters if they exist and set demo defaults
  useEffect(() => {
    const principal = searchParams.get('principal');
    const rate = searchParams.get('rate');
    const term = searchParams.get('term');
    const paymentDueDay = searchParams.get('paymentDueDay');
    const roundingMethod = searchParams.get('roundingMethod');
    const calendarType = searchParams.get('calendarType');
    const accrualTiming = searchParams.get('accrualTiming');

    // Set demo defaults
    if (isDemoMode) {
      setValue('borrowerId', 'customer_001'); // Default demo customer
      setValue('loanType', 'PERSONAL');
      setValue('loanPurpose', 'DEBT_CONSOLIDATION');
    }

    if (principal) setValue('originalPrincipal', parseFloat(principal));
    if (rate) setValue('interestRate', parseFloat(rate));
    if (term) setValue('termMonths', parseInt(term));
    if (paymentDueDay) setValue('paymentDueDay', parseInt(paymentDueDay));
    if (roundingMethod) setValue('roundingMethod', roundingMethod as any);
    if (calendarType) {
      // Map from calculator calendar types to loan calendar types
      const calendarMap: Record<string, string> = {
        '30/360': 'THIRTY_360',
        'ACTUAL/365': 'ACTUAL_365',
        'ACTUAL/360': 'ACTUAL_360',
      };
      setValue('loanCalendar', (calendarMap[calendarType] || calendarType) as any);
    }
    if (accrualTiming) {
      // Map from calculator accrual timing to loan accrual timing
      const accrualMap: Record<string, string> = {
        'DAY_0': 'SAME_DAY',
        'DAY_1': 'NEXT_DAY',
      };
      setValue('accrualStartTiming', (accrualMap[accrualTiming] || accrualTiming) as any);
    }
  }, [searchParams, setValue, isDemoMode]);

  const createLoanMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (isDemoMode) {
        // Use demo storage in demo mode
        return new Promise((resolve) => {
          setTimeout(() => {
            try {
              const loan = demoLoanStorage.createLoan(data);
              resolve(loan);
            } catch (error) {
              throw error;
            }
          }, 500); // Simulate network delay
        });
      } else {
        // Use backend API in production
        return apiClient.createLoan(data);
      }
    },
    onSuccess: (loan: any) => {
      navigate(`/loans/${loan.id}`);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error?.message || err.message || 'Failed to create loan');
    },
  });

  const onSubmit = (data: FormData) => {
    setError('');
    // Transform coBorrowerIds from string to array of strings
    const processedData = {
      ...data,
      coBorrowerIds: data.coBorrowerIds
        ? data.coBorrowerIds.split(',').map(id => id.trim()).filter(id => id !== '')
        : [],
    };
    createLoanMutation.mutate(processedData as any); // Cast as any because schema expects string but API expects array
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Create New Loan</h1>
        <p className="mt-1 text-sm text-gray-500">
          Enter the loan details to create a new loan record.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 divide-y divide-gray-200">
        <div className="space-y-8 divide-y divide-gray-200">
          <div>
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">Borrower Information</h3>
              <p className="mt-1 text-sm text-gray-500">
                Information about the primary borrower and any co-borrowers.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <label htmlFor="borrowerId" className="block text-sm font-medium text-gray-700">
                  Borrower ID
                </label>
                <input
                  type="text"
                  {...register('borrowerId')}
                  className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                />
                {errors.borrowerId && (
                  <p className="mt-1 text-sm text-red-600">{errors.borrowerId.message}</p>
                )}
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="coBorrowerIds" className="block text-sm font-medium text-gray-700">
                  Co-Borrower IDs (comma-separated)
                </label>
                <input
                  type="text"
                  {...register('coBorrowerIds')}
                  placeholder="Optional, e.g., user_002,user_003"
                  className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                />
                {errors.coBorrowerIds && (
                  <p className="mt-1 text-sm text-red-600">{errors.coBorrowerIds.message}</p>
                )}
              </div>
            </div>
          </div>

          <div className="pt-8">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">Loan Details</h3>
              <p className="mt-1 text-sm text-gray-500">
                Basic information about the loan type and purpose.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <label htmlFor="loanType" className="block text-sm font-medium text-gray-700">
                  Loan Type
                </label>
                <select
                  {...register('loanType')}
                  className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                >
                  <option value="">Select a type</option>
                  {loanTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                {errors.loanType && (
                  <p className="mt-1 text-sm text-red-600">{errors.loanType.message}</p>
                )}
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="loanPurpose" className="block text-sm font-medium text-gray-700">
                  Loan Purpose
                </label>
                <select
                  {...register('loanPurpose')}
                  className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                >
                  <option value="">Select a purpose</option>
                  {loanPurposes.map((purpose) => (
                    <option key={purpose.value} value={purpose.value}>
                      {purpose.label}
                    </option>
                  ))}
                </select>
                {errors.loanPurpose && (
                  <p className="mt-1 text-sm text-red-600">{errors.loanPurpose.message}</p>
                )}
              </div>
            </div>
          </div>

          <div className="pt-8">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">Financial Terms</h3>
              <p className="mt-1 text-sm text-gray-500">
                The principal amount, interest rate, and loan term.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-2">
                <label htmlFor="originalPrincipal" className="block text-sm font-medium text-gray-700">
                  Principal Amount
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    {...register('originalPrincipal', { valueAsNumber: true })}
                    className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                    placeholder="0.00"
                  />
                </div>
                {errors.originalPrincipal && (
                  <p className="mt-1 text-sm text-red-600">{errors.originalPrincipal.message}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="interestRate" className="block text-sm font-medium text-gray-700">
                  Interest Rate
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="number"
                    step="0.001"
                    {...register('interestRate', { valueAsNumber: true })}
                    className="focus:ring-primary-500 focus:border-primary-500 block w-full pr-10 sm:text-sm border-gray-300 rounded-md"
                    placeholder="0.000"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">%</span>
                  </div>
                </div>
                {errors.interestRate && (
                  <p className="mt-1 text-sm text-red-600">{errors.interestRate.message}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="termMonths" className="block text-sm font-medium text-gray-700">
                  Term (Months)
                </label>
                <input
                  type="number"
                  {...register('termMonths', { valueAsNumber: true })}
                  className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                  placeholder="360"
                />
                {errors.termMonths && (
                  <p className="mt-1 text-sm text-red-600">{errors.termMonths.message}</p>
                )}
              </div>
            </div>
          </div>

          <div className="pt-8">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">Important Dates</h3>
              <p className="mt-1 text-sm text-gray-500">
                When the loan originates and when payments begin.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <label htmlFor="originationDate" className="block text-sm font-medium text-gray-700">
                  Origination Date
                </label>
                <Controller
                  control={control}
                  name="originationDate"
                  render={({ field }) => (
                    <DateInput
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select origination date"
                      error={errors.originationDate?.message}
                    />
                  )}
                />
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="firstPaymentDate" className="block text-sm font-medium text-gray-700">
                  First Payment Date
                </label>
                <Controller
                  control={control}
                  name="firstPaymentDate"
                  render={({ field }) => (
                    <DateInput
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select first payment date"
                      minDate={watch('originationDate')}
                      error={errors.firstPaymentDate?.message}
                    />
                  )}
                />
              </div>
            </div>
          </div>

          <div className="pt-8">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">Advanced Settings</h3>
              <p className="mt-1 text-sm text-gray-500">
                Additional configuration for payment and interest calculation.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-2">
                <label htmlFor="paymentFrequency" className="block text-sm font-medium text-gray-700">
                  Payment Frequency
                </label>
                <select
                  {...register('paymentFrequency')}
                  className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                >
                  <option value="monthly">Monthly</option>
                  <option value="bi-weekly">Bi-Weekly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="paymentDueDay" className="block text-sm font-medium text-gray-700">
                  Payment Due Day
                </label>
                <input
                  type="number"
                  {...register('paymentDueDay', { valueAsNumber: true })}
                  min="1"
                  max="31"
                  className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                  placeholder="1"
                />
                {errors.paymentDueDay && (
                  <p className="mt-1 text-sm text-red-600">{errors.paymentDueDay.message}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="loanCalendar" className="block text-sm font-medium text-gray-700">
                  Day Count Convention
                </label>
                <select
                  {...register('loanCalendar')}
                  className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                >
                  <option value="THIRTY_360">30/360</option>
                  <option value="ACTUAL_360">Actual/360</option>
                  <option value="ACTUAL_365">Actual/365</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="accrualStartTiming" className="block text-sm font-medium text-gray-700">
                  Interest Accrual Start
                </label>
                <select
                  {...register('accrualStartTiming')}
                  className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                >
                  <option value="SAME_DAY">Same Day</option>
                  <option value="NEXT_DAY">Next Day</option>
                </select>
              </div>
              
              <div className="sm:col-span-2">
                <label htmlFor="roundingMethod" className="block text-sm font-medium text-gray-700">
                  Rounding Method
                </label>
                <select
                  {...register('roundingMethod')}
                  className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                >
                  <option value="ROUND_HALF_UP">Round Half Up (Standard)</option>
                  <option value="ROUND_HALF_DOWN">Round Half Down</option>
                  <option value="ROUND_UP">Round Up</option>
                  <option value="ROUND_DOWN">Round Down</option>
                  <option value="ROUND_HALF_EVEN">Round Half Even (Banker's)</option>
                </select>
                {errors.roundingMethod && (
                  <p className="mt-1 text-sm text-red-600">{errors.roundingMethod.message}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Real-time Calculations Section */}
        <div className="pt-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">Loan Calculations</h3>
              <p className="mt-1 text-sm text-gray-500">
                Real-time calculations based on your loan terms
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCalculations(!showCalculations)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <CalculatorIcon className="-ml-0.5 mr-2 h-4 w-4" aria-hidden="true" />
              {showCalculations ? 'Hide' : 'Show'} Calculations
            </button>
          </div>

          {showCalculations && (
            <div className="mt-6">
              {loanCalculations ? (
                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <dt className="text-sm font-medium text-gray-500 truncate">Monthly Payment</dt>
                      <dd className="mt-1 text-2xl font-semibold text-gray-900">
                        ${loanCalculations.monthlyPayment.toLocaleString('en-US', { 
                          minimumFractionDigits: 2, 
                          maximumFractionDigits: 2 
                        })}
                      </dd>
                    </div>

                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Interest</dt>
                      <dd className="mt-1 text-2xl font-semibold text-gray-900">
                        ${loanCalculations.totalInterest.toLocaleString('en-US', { 
                          minimumFractionDigits: 2, 
                          maximumFractionDigits: 2 
                        })}
                      </dd>
                    </div>

                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Payment</dt>
                      <dd className="mt-1 text-2xl font-semibold text-gray-900">
                        ${loanCalculations.totalPayment.toLocaleString('en-US', { 
                          minimumFractionDigits: 2, 
                          maximumFractionDigits: 2 
                        })}
                      </dd>
                    </div>

                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <dt className="text-sm font-medium text-gray-500 truncate">Effective Rate</dt>
                      <dd className="mt-1 text-2xl font-semibold text-gray-900">
                        {loanCalculations.effectiveRate.toFixed(3)}%
                      </dd>
                    </div>
                  </div>

                  <div className="mt-4 text-xs text-gray-600">
                    Calculations are estimates based on standard amortization formulas. 
                    Final terms may vary based on actual loan processing.
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <CalculatorIcon className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">
                        Enter loan details to see calculations
                      </h3>
                      <div className="mt-2 text-sm text-yellow-700">
                        <p>
                          Fill in the principal amount, interest rate, and term to see real-time calculations.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <ExclamationCircleIcon
                  className="h-5 w-5 text-red-400"
                  aria-hidden="true"
                />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">{error}</h3>
              </div>
            </div>
          </div>
        )}

        <div className="pt-5">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => navigate('/loans')}
              className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLoanMutation.isPending}
              className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createLoanMutation.isPending ? 'Creating...' : 'Create Loan'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};