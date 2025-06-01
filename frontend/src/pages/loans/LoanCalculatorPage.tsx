import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { CalculatorIcon, PlusIcon } from '@heroicons/react/24/outline';
import apiClient from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { PaymentWaterfallBuilder, WaterfallStep } from '../../components/loans/PaymentWaterfallBuilder';
import { PaymentWaterfallTester } from '../../components/loans/PaymentWaterfallTester';
import { PrepaymentCalculator } from '../../components/loans/PrepaymentCalculator';
import { PaymentAllocationVisualizer } from '../../components/loans/PaymentAllocationVisualizer';
import { BlendedLoanConfigurator, BlendedPeriod } from '../../components/loans/BlendedLoanConfigurator';
import { CreateLoanModal } from '../../components/loans/CreateLoanModal';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const schema = yup.object({
  principal: yup
    .number()
    .positive('Principal must be positive')
    .required('Principal is required')
    .min(1000, 'Minimum loan amount is $1,000')
    .max(10000000, 'Maximum loan amount is $10,000,000'),
  annualRate: yup
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
    .max(480, 'Maximum term is 480 months (40 years)'),
  startDate: yup.date().required('Start date is required'),
  calculationType: yup.string().required('Calculation type is required'),
  calendarType: yup.string().required('Calendar type is required'),
  accrualTiming: yup.string().required('Accrual timing is required'),
  waterfallSteps: yup.array().of(
    yup.object({
      id: yup.string().required(),
      category: yup.string().required(),
      percentage: yup.number().min(0).max(100).required(),
    })
  ),
  blendedPeriods: yup.array().of(
    yup.object({
      id: yup.string().required(),
      startDate: yup.date().required(),
      endDate: yup.date().nullable(),
      mode: yup.string().oneOf(['amortization', 'dsi']).required(),
      trigger: yup.string().required(),
      triggerValue: yup.string(),
    })
  ),
});

type FormData = yup.InferType<typeof schema>;

const COLORS = ['#3b82f6', '#10b981', '#f59e0b'];

// Define calculation types and options
const CALCULATION_TYPES = [
  { value: 'amortization', label: 'Amortization' },
  { value: 'dsi', label: 'Daily Simple Interest (DSI)' },
  { value: 'per-diem', label: 'Per Diem Interest' },
];

const CALENDAR_TYPES = [
  { value: '30/360', label: '30/360' },
  { value: 'ACTUAL/365', label: 'Actual/365' },
  { value: 'ACTUAL/360', label: 'Actual/360' },
];

const ACCRUAL_TIMINGS = [
  { value: 'DAY_0', label: 'Day 0 (Loan Origination)' },
  { value: 'DAY_1', label: 'Day 1 (First Day After)' },
];

export const LoanCalculatorPage = () => {
  const [calculationResult, setCalculationResult] = useState<any>(null);
  const [showWaterfall, setShowWaterfall] = useState(false);
  const [showBlended, setShowBlended] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [showCreateLoanModal, setShowCreateLoanModal] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    getValues,
  } = useForm<FormData>({
    resolver: yupResolver(schema),
    defaultValues: {
      principal: 100000,
      annualRate: 5.5,
      termMonths: 360,
      startDate: new Date(),
      calculationType: 'amortization',
      calendarType: 'ACTUAL/365',
      accrualTiming: 'DAY_1',
      waterfallSteps: [
        { id: '1', category: 'fees', percentage: 100 },
        { id: '2', category: 'penalties', percentage: 100 },
        { id: '3', category: 'interest', percentage: 100 },
        { id: '4', category: 'principal', percentage: 100 },
        { id: '5', category: 'escrow', percentage: 100 },
      ],
      blendedPeriods: [],
    },
  });

  const calendarType = watch('calendarType');

  const calculateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (data.calculationType === 'per-diem') {
        // Calculate per diem interest
        const days = 30; // Default to 30 days for display
        const perDiemResp = await apiClient.calculateDailyInterest({
          principal: data.principal.toString(),
          annualRate: data.annualRate.toString(),
          days,
          calendar: data.calendarType,
        });
        
        const daysInYear = data.calendarType === 'ACTUAL/365' ? 365 : 360;
        const dailyRate = data.annualRate / 100 / daysInYear;
        const dailyInterest = data.principal * dailyRate;
        
        // Create a simplified schedule showing daily interest accrual
        const schedule = [];
        const balance = data.principal;
        for (let i = 1; i <= 30; i++) {
          const interestForDay = balance * dailyRate;
          schedule.push({
            paymentNumber: i,
            date: new Date(data.startDate.getTime() + (i - 1) * 24 * 60 * 60 * 1000).toISOString(),
            principalPayment: '0',
            interestPayment: interestForDay.toFixed(2),
            remainingBalance: balance.toFixed(2),
          });
        }
        
        return {
          monthlyPayment: dailyInterest.toFixed(2),
          totalInterest: (dailyInterest * 30).toFixed(2),
          totalAmount: (data.principal + dailyInterest * 30).toFixed(2),
          principal: data.principal.toString(),
          firstPaymentDate: data.startDate.toISOString(),
          lastPaymentDate: new Date(data.startDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          calculationType: 'Per Diem Interest',
          calendarType: data.calendarType,
          accrualTiming: data.accrualTiming,
          dailyInterest: dailyInterest.toFixed(2),
          daysInYear,
          schedule,
        };
      } else if (data.calculationType === 'dsi') {
        // Calculate DSI - we'll use the interest endpoint and generate a schedule
        const dailyInterestResp = await apiClient.calculateDailyInterest({
          principal: data.principal.toString(),
          annualRate: data.annualRate.toString(),
          days: 30, // Calculate for first month
          calendar: data.calendarType,
        });
        
        // Generate DSI schedule
        const monthlyInterest = parseFloat(dailyInterestResp.interest);
        const monthlyPayment = data.principal / data.termMonths + monthlyInterest;
        const totalInterest = monthlyInterest * data.termMonths;
        
        return {
          monthlyPayment: monthlyPayment.toString(),
          totalInterest: totalInterest.toString(),
          totalAmount: (data.principal + totalInterest).toString(),
          principal: data.principal.toString(),
          firstPaymentDate: data.startDate.toISOString(),
          lastPaymentDate: new Date(data.startDate.getTime() + data.termMonths * 30 * 24 * 60 * 60 * 1000).toISOString(),
          calculationType: 'Daily Simple Interest',
          calendarType: data.calendarType,
          accrualTiming: data.accrualTiming,
          schedule: generateDSISchedule(data),
        };
      } else {
        const result = await apiClient.calculateAmortization({
          principal: data.principal.toString(),
          annualRate: data.annualRate.toString(),
          termMonths: data.termMonths,
          startDate: data.startDate.toISOString(),
        });
        return {
          ...result,
          calculationType: 'Amortization',
          calendarType: data.calendarType,
          accrualTiming: data.accrualTiming,
          blendedPeriods: data.blendedPeriods,
        };
      }
    },
    onSuccess: (data) => {
      setCalculationResult(data);
    },
  });

  // Helper function to generate DSI schedule
  const generateDSISchedule = (data: FormData) => {
    const schedule = [];
    let balance = data.principal;
    const daysInYear = data.calendarType === 'ACTUAL/365' ? 365 : 360;
    const dailyRate = data.annualRate / 100 / daysInYear;
    
    for (let i = 1; i <= data.termMonths; i++) {
      const daysInMonth = 30; // Simplified for demo
      const interestPayment = balance * dailyRate * daysInMonth;
      const principalPayment = data.principal / data.termMonths;
      balance -= principalPayment;
      
      schedule.push({
        paymentNumber: i,
        date: new Date(data.startDate.getTime() + (i - 1) * 30 * 24 * 60 * 60 * 1000).toISOString(),
        principalPayment: principalPayment.toFixed(2),
        interestPayment: interestPayment.toFixed(2),
        remainingBalance: Math.max(0, balance).toFixed(2),
      });
    }
    
    return schedule;
  };

  const onSubmit = (data: FormData) => {
    calculateMutation.mutate(data);
  };

  const pieData = calculationResult
    ? [
        { name: 'Principal', value: Number(calculationResult.principal) },
        { name: 'Interest', value: Number(calculationResult.totalInterest) },
      ]
    : [];

  const chartData = calculationResult?.schedule
    ?.slice(0, 60) // First 5 years
    .map((payment: any, index: number) => ({
      month: index + 1,
      principal: Number(payment.principalPayment),
      interest: Number(payment.interestPayment),
      balance: Number(payment.remainingBalance),
    }));

  return (
    <div>
      <div className="mb-8">
        <div className="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Loan Calculator</h1>
            <p className="mt-1 text-sm text-gray-500">
              Calculate monthly payments and view amortization schedules
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <button
              onClick={() => setShowCreateLoanModal(true)}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
              Create Loan
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-6">Loan Parameters</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label htmlFor="principal" className="block text-sm font-medium text-gray-700">
                  Loan Amount
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    id="principal" // Added id
                    {...register('principal', { valueAsNumber: true })}
                    className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                    placeholder="100,000"
                  />
                </div>
                {errors.principal && (
                  <p className="mt-1 text-sm text-red-600">{errors.principal.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="annualRate" className="block text-sm font-medium text-gray-700">
                  Annual Interest Rate
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="number"
                    id="annualRate" // Added id
                    step="0.01"
                    {...register('annualRate', { valueAsNumber: true })}
                    className="focus:ring-primary-500 focus:border-primary-500 block w-full pr-10 sm:text-sm border-gray-300 rounded-md"
                    placeholder="5.5"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">%</span>
                  </div>
                </div>
                {errors.annualRate && (
                  <p className="mt-1 text-sm text-red-600">{errors.annualRate.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="termMonths" className="block text-sm font-medium text-gray-700">
                  Loan Term (Months)
                </label>
                <input
                  type="number"
                  id="termMonths" // Added id
                  {...register('termMonths', { valueAsNumber: true })}
                  className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                  placeholder="360"
                />
                {errors.termMonths && (
                  <p className="mt-1 text-sm text-red-600">{errors.termMonths.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
                  Start Date
                </label>
                <input
                  type="date"
                  id="startDate" // Added id
                  {...register('startDate', { valueAsDate: true })}
                  className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                />
                {errors.startDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.startDate.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="paymentDueDay" className="block text-sm font-medium text-gray-700">
                  Payment Due Day
                </label>
                <input
                  type="number"
                  id="paymentDueDay" // Added id
                  {...register('paymentDueDay', { valueAsNumber: true })}
                  min="1"
                  max="31"
                  className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                  placeholder="1"
                />
                {errors.paymentDueDay && (
                  <p className="mt-1 text-sm text-red-600">{errors.paymentDueDay.message}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Day of month when payment is due (1-31)
                </p>
              </div>

              <div>
                <label htmlFor="calculationType" className="block text-sm font-medium text-gray-700">
                  Calculation Type
                </label>
                <select
                  id="calculationType" // Added id
                  {...register('calculationType')}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                >
                  {CALCULATION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                {errors.calculationType && (
                  <p className="mt-1 text-sm text-red-600">{errors.calculationType.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="calendarType" className="block text-sm font-medium text-gray-700">
                  Calendar Type
                </label>
                <select
                  id="calendarType" // Added id
                  {...register('calendarType')}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                >
                  {CALENDAR_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                {errors.calendarType && (
                  <p className="mt-1 text-sm text-red-600">{errors.calendarType.message}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  {calendarType === '30/360' && 'Assumes 30 days per month, 360 days per year'}
                  {calendarType === 'ACTUAL/365' && 'Uses actual days per month, 365 days per year'}
                  {calendarType === 'ACTUAL/360' && 'Uses actual days per month, 360 days per year'}
                </p>
              </div>

              <div>
                <label htmlFor="accrualTiming" className="block text-sm font-medium text-gray-700">
                  Interest Accrual Timing
                </label>
                <select
                  id="accrualTiming" // Added id
                  {...register('accrualTiming')}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                >
                  {ACCRUAL_TIMINGS.map((timing) => (
                    <option key={timing.value} value={timing.value}>
                      {timing.label}
                    </option>
                  ))}
                </select>
                {errors.accrualTiming && (
                  <p className="mt-1 text-sm text-red-600">{errors.accrualTiming.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="roundingMethod" className="block text-sm font-medium text-gray-700">
                  Rounding Method
                </label>
                <select
                  id="roundingMethod" // Added id
                  {...register('roundingMethod')}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
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
                <p className="mt-1 text-xs text-gray-500">
                  How to round monetary calculations
                </p>
              </div>

              <div className="border-t pt-4">
                <button
                  type="button"
                  onClick={() => setShowWaterfall(!showWaterfall)}
                  className="w-full text-left px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
                >
                  {showWaterfall ? '▼' : '▶'} Payment Waterfall Configuration
                </button>
                
                {showWaterfall && (
                  <div className="mt-4 space-y-4">
                    <PaymentWaterfallBuilder
                      value={getValues('waterfallSteps') || []}
                      onChange={(steps) => setValue('waterfallSteps', steps)}
                    />
                    <PaymentWaterfallTester
                      waterfallSteps={getValues('waterfallSteps') || []}
                    />
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <button
                  type="button"
                  onClick={() => setShowBlended(!showBlended)}
                  className="w-full text-left px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
                >
                  {showBlended ? '▼' : '▶'} Blended Loan Configuration
                </button>
                
                {showBlended && (
                  <div className="mt-4">
                    <BlendedLoanConfigurator
                      loanStartDate={watch('startDate') || new Date()}
                      loanEndDate={new Date(new Date(watch('startDate') || new Date()).getTime() + (watch('termMonths') || 360) * 30 * 24 * 60 * 60 * 1000)}
                      value={getValues('blendedPeriods') || []}
                      onChange={(periods) => setValue('blendedPeriods', periods)}
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={calculateMutation.isPending}
                className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                <CalculatorIcon className="h-5 w-5 mr-2" />
                {calculateMutation.isPending ? 'Calculating...' : 'Calculate'}
              </button>
            </form>
          </div>

          {calculationResult && (
            <div className="mt-6 bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Loan Summary</h3>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">
                    {calculationResult.calculationType === 'Per Diem Interest' ? 'Daily Interest' : 'Monthly Payment'}
                  </dt>
                  <dd className="text-sm font-semibold text-gray-900">
                    {formatCurrency(Number(calculationResult.calculationType === 'Per Diem Interest' ? calculationResult.dailyInterest : calculationResult.monthlyPayment))}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">Total Interest</dt>
                  <dd className="text-sm font-semibold text-gray-900">
                    {formatCurrency(Number(calculationResult.totalInterest))}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">Total Amount</dt>
                  <dd className="text-sm font-semibold text-gray-900">
                    {formatCurrency(Number(calculationResult.totalAmount))}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">First Payment</dt>
                  <dd className="text-sm text-gray-900">
                    {format(new Date(calculationResult.firstPaymentDate), 'MMM d, yyyy')}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">Last Payment</dt>
                  <dd className="text-sm text-gray-900">
                    {format(new Date(calculationResult.lastPaymentDate), 'MMM d, yyyy')}
                  </dd>
                </div>
              </dl>
              
              <div className="mt-4 pt-4 border-t border-gray-200">
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-xs font-medium text-gray-500">Calculation Type</dt>
                    <dd className="text-xs text-gray-900">{calculationResult.calculationType}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-xs font-medium text-gray-500">Calendar</dt>
                    <dd className="text-xs text-gray-900">{calculationResult.calendarType}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-xs font-medium text-gray-500">Accrual Timing</dt>
                    <dd className="text-xs text-gray-900">{calculationResult.accrualTiming}</dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
          
          {calculationResult && (
            <div className="mt-6">
              <PrepaymentCalculator
                loanData={{
                  principal: Number(calculationResult.principal),
                  remainingBalance: Number(calculationResult.principal),
                  monthlyPayment: Number(calculationResult.monthlyPayment),
                  interestRate: Number(watch('annualRate')),
                  remainingTermMonths: Number(watch('termMonths')),
                  nextPaymentDate: new Date(calculationResult.firstPaymentDate),
                }}
              />
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          {calculationResult && (
            <div className="space-y-6">
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Payment Breakdown</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  First 5 Years - Principal vs Interest
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="month"
                        label={{ value: 'Month', position: 'insideBottom', offset: -5 }}
                      />
                      <YAxis label={{ value: 'Amount ($)', angle: -90, position: 'insideLeft' }} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="principal"
                        stroke="#3b82f6"
                        name="Principal"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="interest"
                        stroke="#ef4444"
                        name="Interest"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {selectedPayment && (
                <PaymentAllocationVisualizer
                  allocation={{
                    principal: Number(selectedPayment.principalPayment),
                    interest: Number(selectedPayment.interestPayment),
                    fees: 0,
                    penalties: 0,
                    escrow: 0,
                    total: Number(selectedPayment.principalPayment) + Number(selectedPayment.interestPayment),
                  }}
                  waterfallSteps={getValues('waterfallSteps')}
                  paymentNumber={selectedPayment.paymentNumber}
                  paymentDate={new Date(selectedPayment.date)}
                />
              )}

              <div className="bg-white shadow rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Amortization Schedule</h3>
                  <p className="text-sm text-gray-500">Click any row to see payment allocation</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Payment #
                        </th>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Principal
                        </th>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Interest
                        </th>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Balance
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {calculationResult.schedule.slice(0, 12).map((payment: any, index: number) => (
                        <tr 
                          key={index}
                          onClick={() => setSelectedPayment(payment)}
                          className="hover:bg-gray-50 cursor-pointer"
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {payment.paymentNumber}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {format(new Date(payment.date), 'MMM d, yyyy')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(Number(payment.principalPayment))}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(Number(payment.interestPayment))}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(Number(payment.remainingBalance))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {calculationResult.schedule.length > 12 && (
                    <div className="px-6 py-3 bg-gray-50 text-sm text-gray-500">
                      Showing first 12 months of {calculationResult.schedule.length} total payments
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Create Loan Modal */}
      <CreateLoanModal
        isOpen={showCreateLoanModal}
        onClose={() => setShowCreateLoanModal(false)}
        initialData={calculationResult ? {
          principal: watch('principal'),
          annualRate: watch('annualRate'),
          termMonths: watch('termMonths'),
          startDate: watch('startDate'),
          paymentDueDay: watch('paymentDueDay'),
          roundingMethod: watch('roundingMethod'),
          calendarType: watch('calendarType'),
          accrualTiming: watch('accrualTiming'),
        } : undefined}
      />
    </div>
  );
};