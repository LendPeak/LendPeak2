import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { format } from 'date-fns';
import { Tab } from '@headlessui/react';
import { LoanEngine, formatCurrency, formatPercentage, toBig } from '@lendpeak/engine';
import {
  ArrowDownTrayIcon,
  CalculatorIcon,
  ChartBarIcon,
  PrinterIcon,
  TableCellsIcon,
  CogIcon,
  InformationCircleIcon,
  PlayIcon,
  DocumentTextIcon,
  CalendarIcon,
  BanknotesIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const schema = yup.object({
  principal: yup
    .number()
    .positive('Principal must be positive')
    .required('Principal is required'),
  interestRate: yup
    .number()
    .positive('Interest rate must be positive')
    .max(100, 'Interest rate cannot exceed 100%')
    .required('Interest rate is required'),
  termMonths: yup
    .number()
    .positive('Term must be positive')
    .integer()
    .required('Term is required'),
  startDate: yup.date().required('Start date is required'),
  
  // Calculation method
  interestType: yup.string().oneOf(['amortized', 'dsi']).required('Interest type is required'),
  
  // Calendar and timing options
  calendarType: yup.string().oneOf(['30/360', 'ACTUAL/365', 'ACTUAL/360']).required('Calendar type is required'),
  paymentFrequency: yup.string().oneOf(['monthly', 'biweekly', 'weekly']).required('Payment frequency is required'),
  accrualTiming: yup.string().oneOf(['daily', 'monthly']).required('Accrual timing is required'),
  
  // Advanced options
  compoundingFrequency: yup.string().oneOf(['daily', 'monthly', 'annually']),
  roundingMethod: yup.string().oneOf(['round', 'floor', 'ceil']),
  
  // Extra payments
  extraPaymentEnabled: yup.boolean(),
  extraPaymentAmount: yup.number().min(0),
  extraPaymentFrequency: yup.string().oneOf(['monthly', 'quarterly', 'annually']),
  extraPaymentStartMonth: yup.number().min(1),
  
  // Prepayment scenarios
  prepaymentScenario: yup.boolean(),
  prepaymentAmount: yup.number().min(0),
  prepaymentMonth: yup.number().min(1),
});

type FormData = yup.InferType<typeof schema>;

interface SchedulePayment {
  paymentNumber: number;
  paymentDate: Date;
  scheduledPayment: number;
  principal: number;
  interest: number;
  balance: number;
  cumulativeInterest: number;
  cumulativePrincipal: number;
  extraPayment?: number;
}

interface LoanSummary {
  monthlyPayment: number;
  totalPayments: number;
  totalInterest: number;
  totalPrincipal: number;
  effectiveAPR: number;
  payoffDate: Date;
  interestSavings?: number; // If comparing scenarios
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export const AmortizationSchedulePage = () => {
  const [schedule, setSchedule] = useState<SchedulePayment[] | null>(null);
  const [summary, setSummary] = useState<LoanSummary | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'charts' | 'comparison'>('table');
  const [showFullSchedule, setShowFullSchedule] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [comparisonSchedule, setComparisonSchedule] = useState<SchedulePayment[] | null>(null);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

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
      principal: 300000,
      interestRate: 6.75,
      termMonths: 360,
      startDate: new Date(),
      interestType: 'amortized',
      calendarType: '30/360',
      paymentFrequency: 'monthly',
      accrualTiming: 'monthly',
      compoundingFrequency: 'monthly',
      roundingMethod: 'round',
      extraPaymentEnabled: false,
      extraPaymentAmount: 0,
      extraPaymentFrequency: 'monthly',
      extraPaymentStartMonth: 1,
      prepaymentScenario: false,
      prepaymentAmount: 0,
      prepaymentMonth: 60,
    },
  });

  const watchedValues = watch();
  
  const generateSchedule = async (data: FormData) => {
    setIsCalculating(true);
    
    try {
      // Map rounding method to engine format
      let roundingMethod: 'HALF_UP' | 'HALF_DOWN' | 'UP' | 'DOWN' | 'BANKERS' = 'HALF_UP';
      if (data.roundingMethod === 'floor') {
        roundingMethod = 'DOWN';
      } else if (data.roundingMethod === 'ceil') {
        roundingMethod = 'UP';
      }
      
      // Create loan terms using the LoanEngine
      const loanTerms = LoanEngine.createLoan(
        data.principal,
        data.interestRate,
        data.termMonths,
        data.startDate,
        {
          paymentFrequency: data.paymentFrequency,
          interestType: data.interestType,
          calendarType: data.calendarType,
          accrualTiming: data.accrualTiming,
          roundingConfig: {
            method: roundingMethod,
            decimalPlaces: 2
          }
        }
      );

      // Generate the amortization schedule
      const scheduleResult = LoanEngine.generateSchedule(loanTerms);
      const paymentResult = LoanEngine.calculatePayment(loanTerms);

      // Check if results are valid
      if (!scheduleResult || !scheduleResult.payments || !paymentResult) {
        throw new Error('Failed to generate loan schedule');
      }

      // Process the schedule data
      let cumulativeInterest = 0;
      let cumulativePrincipal = 0;
      
      const processedSchedule: SchedulePayment[] = scheduleResult.payments.map((payment, index) => {
        // Ensure payment properties exist and are valid
        if (!payment || typeof payment.interest === 'undefined' || typeof payment.principal === 'undefined' || 
            typeof payment.dueDate === 'undefined' || typeof payment.remainingBalance === 'undefined') {
          console.error('Invalid payment data at index', index, ':', payment);
          console.error('Payment object keys:', payment ? Object.keys(payment) : 'payment is null/undefined');
          console.error('Expected: dueDate, principal, interest, remainingBalance');
          throw new Error(`Invalid payment data in schedule at index ${index}`);
        }

        cumulativeInterest += payment.interest.toNumber();
        cumulativePrincipal += payment.principal.toNumber();
        
        // Calculate the total payment amount (principal + interest + fees)
        const principalAmount = payment.principal.toNumber();
        const interestAmount = payment.interest.toNumber();
        const feesAmount = payment.fees ? payment.fees.toNumber() : 0;
        const totalPayment = principalAmount + interestAmount + feesAmount;
        
        // Calculate extra payment if enabled
        let extraPayment = 0;
        if (data.extraPaymentEnabled && data.extraPaymentAmount) {
          const shouldApplyExtra = 
            (data.extraPaymentFrequency === 'monthly') ||
            (data.extraPaymentFrequency === 'quarterly' && (index + 1) % 3 === 0) ||
            (data.extraPaymentFrequency === 'annually' && (index + 1) % 12 === 0);
          
          if (shouldApplyExtra && index >= (data.extraPaymentStartMonth || 1) - 1) {
            extraPayment = data.extraPaymentAmount;
          }
        }

        // Apply prepayment scenario
        if (data.prepaymentScenario && index === (data.prepaymentMonth || 60) - 1) {
          extraPayment += data.prepaymentAmount || 0;
        }

        return {
          paymentNumber: payment.paymentNumber || index + 1,
          paymentDate: payment.dueDate,
          scheduledPayment: totalPayment,
          principal: payment.principal.toNumber(),
          interest: payment.interest.toNumber(),
          balance: payment.remainingBalance.toNumber(),
          cumulativeInterest,
          cumulativePrincipal,
          extraPayment: extraPayment > 0 ? extraPayment : undefined,
        };
      });

      setSchedule(processedSchedule);

      // Calculate summary
      const totalInterest = cumulativeInterest;
      const totalPayments = processedSchedule.reduce(
        (sum, payment) => sum + payment.scheduledPayment + (payment.extraPayment || 0),
        0
      );

      const loanSummary: LoanSummary = {
        monthlyPayment: paymentResult.monthlyPayment ? paymentResult.monthlyPayment.toNumber() : 0,
        totalPayments,
        totalInterest,
        totalPrincipal: data.principal,
        effectiveAPR: paymentResult.apr ? paymentResult.apr.toNumber() : 0,
        payoffDate: processedSchedule[processedSchedule.length - 1]?.paymentDate || new Date(),
      };

      setSummary(loanSummary);

    } catch (error) {
      console.error('Error generating schedule:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  const onSubmit = (data: FormData) => {
    generateSchedule(data);
  };

  const generateComparison = async () => {
    if (!schedule) return;
    
    // Generate a comparison scenario (e.g., with extra payments)
    const comparisonData = {
      ...getValues(),
      extraPaymentEnabled: true,
      extraPaymentAmount: 200,
      extraPaymentFrequency: 'monthly' as const,
    };
    
    await generateSchedule(comparisonData);
    // In a real implementation, you'd store both schedules for comparison
  };

  const exportToCSV = () => {
    if (!schedule) return;

    const headers = ['Payment #', 'Date', 'Payment', 'Principal', 'Interest', 'Extra Payment', 'Balance'];
    const rows = schedule.map((payment) => [
      payment.paymentNumber,
      format(payment.paymentDate, 'yyyy-MM-dd'),
      payment.scheduledPayment.toFixed(2),
      payment.principal.toFixed(2),
      payment.interest.toFixed(2),
      (payment.extraPayment || 0).toFixed(2),
      payment.balance.toFixed(2),
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'amortization-schedule.csv';
    a.click();
  };

  const printSchedule = () => {
    window.print();
  };

  const displayedSchedule = showFullSchedule ? schedule : schedule?.slice(0, 24);

  // Prepare chart data
  const chartData = schedule?.map((payment, index) => ({
    month: index + 1,
    principal: payment.principal,
    interest: payment.interest,
    balance: payment.balance,
    cumulativeInterest: payment.cumulativeInterest,
    cumulativePrincipal: payment.cumulativePrincipal,
    totalPayment: payment.scheduledPayment + (payment.extraPayment || 0),
  }));

  const yearlyData = schedule?.filter((_, index) => index % 12 === 11).map((payment, yearIndex) => ({
    year: yearIndex + 1,
    principal: payment.cumulativePrincipal,
    interest: payment.cumulativeInterest,
    balance: payment.balance,
  }));

  const pieChartData = summary ? [
    { name: 'Principal', value: summary.totalPrincipal, color: '#3b82f6' },
    { name: 'Interest', value: summary.totalInterest, color: '#ef4444' },
  ] : [];

  return (
    <div className="print:p-4 space-y-8">
      {/* Header */}
      <div className="print:mb-4">
        <h1 className="text-3xl font-bold text-gray-900">Loan Calculator & Amortization Schedule</h1>
        <p className="mt-2 text-lg text-gray-600 print:hidden">
          Compare amortization vs. DSI calculations and analyze loan impact scenarios
        </p>
      </div>

      {/* Loan Calculator Form */}
      <div className="bg-white shadow-lg rounded-lg print:shadow-none print:border">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <CalculatorIcon className="h-6 w-6 mr-3 text-primary-600" />
              Loan Parameters & Settings
            </h2>
            <button
              type="button"
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 print:hidden"
            >
              <CogIcon className="h-4 w-4 mr-2" />
              {showAdvancedOptions ? 'Hide' : 'Show'} Advanced Options
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} className="p-6">
          {/* Main Loan Parameters */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
            {/* Principal */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <BanknotesIcon className="h-4 w-4 inline mr-1" />
                Loan Amount
              </label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  step="1"
                  {...register('principal', { valueAsNumber: true })}
                  className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-7 pr-3 py-3 sm:text-sm border-gray-300 rounded-md"
                  placeholder="300,000"
                />
              </div>
              {errors.principal && (
                <p className="mt-1 text-sm text-red-600">{errors.principal.message}</p>
              )}
            </div>

            {/* Interest Rate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Interest Rate (Annual)
              </label>
              <div className="relative rounded-md shadow-sm">
                <input
                  type="number"
                  step="0.001"
                  {...register('interestRate', { valueAsNumber: true })}
                  className="focus:ring-primary-500 focus:border-primary-500 block w-full pr-8 py-3 sm:text-sm border-gray-300 rounded-md"
                  placeholder="6.75"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">%</span>
                </div>
              </div>
              {errors.interestRate && (
                <p className="mt-1 text-sm text-red-600">{errors.interestRate.message}</p>
              )}
            </div>

            {/* Term */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <CalendarIcon className="h-4 w-4 inline mr-1" />
                Loan Term
              </label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  {...register('termMonths', { valueAsNumber: true })}
                  className="focus:ring-primary-500 focus:border-primary-500 block w-full py-3 sm:text-sm border-gray-300 rounded-md"
                  placeholder="360"
                />
                <span className="flex items-center px-3 text-sm text-gray-500 bg-gray-50 border border-gray-300 rounded-md">
                  months
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {watchedValues.termMonths ? `${Math.round(watchedValues.termMonths / 12)} years` : ''}
              </p>
              {errors.termMonths && (
                <p className="mt-1 text-sm text-red-600">{errors.termMonths.message}</p>
              )}
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                {...register('startDate', { valueAsDate: true })}
                className="focus:ring-primary-500 focus:border-primary-500 block w-full py-3 sm:text-sm border-gray-300 rounded-md"
              />
              {errors.startDate && (
                <p className="mt-1 text-sm text-red-600">{errors.startDate.message}</p>
              )}
            </div>
          </div>

          {/* Calculation Method Selection */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-sm font-medium text-blue-900 mb-3">Calculation Method</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="relative flex cursor-pointer rounded-lg border border-gray-300 bg-white p-4 shadow-sm focus:outline-none">
                <input
                  type="radio"
                  value="amortized"
                  {...register('interestType')}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="ml-3 flex flex-col">
                  <span className="block text-sm font-medium text-gray-900">Traditional Amortization</span>
                  <span className="block text-sm text-gray-500">Fixed monthly payments, declining interest over time</span>
                </span>
              </label>
              
              <label className="relative flex cursor-pointer rounded-lg border border-gray-300 bg-white p-4 shadow-sm focus:outline-none">
                <input
                  type="radio"
                  value="dsi"
                  {...register('interestType')}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="ml-3 flex flex-col">
                  <span className="block text-sm font-medium text-gray-900">Daily Simple Interest (DSI)</span>
                  <span className="block text-sm text-gray-500">Interest calculated daily on outstanding balance</span>
                </span>
              </label>
            </div>
          </div>

          {/* Basic Settings */}
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Frequency
              </label>
              <select
                {...register('paymentFrequency')}
                className="block w-full py-3 pl-3 pr-10 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
              >
                <option value="monthly">Monthly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Calendar Type
              </label>
              <select
                {...register('calendarType')}
                className="block w-full py-3 pl-3 pr-10 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
              >
                <option value="30/360">30/360</option>
                <option value="ACTUAL/365">Actual/365</option>
                <option value="ACTUAL/360">Actual/360</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Interest Accrual
              </label>
              <select
                {...register('accrualTiming')}
                className="block w-full py-3 pl-3 pr-10 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
              >
                <option value="daily">Daily</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>

          {/* Advanced Options */}
          {showAdvancedOptions && (
            <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Advanced Settings</h3>
              
              {/* Extra Payments */}
              <div className="space-y-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('extraPaymentEnabled')}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-700">Enable Extra Payments</span>
                </label>
                
                {watchedValues.extraPaymentEnabled && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pl-7">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Extra Payment Amount
                      </label>
                      <div className="relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">$</span>
                        </div>
                        <input
                          type="number"
                          {...register('extraPaymentAmount', { valueAsNumber: true })}
                          className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-7 pr-3 py-2 sm:text-sm border-gray-300 rounded-md"
                          placeholder="200"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Frequency
                      </label>
                      <select
                        {...register('extraPaymentFrequency')}
                        className="block w-full py-2 pl-3 pr-10 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                      >
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="annually">Annually</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start Month
                      </label>
                      <input
                        type="number"
                        min="1"
                        {...register('extraPaymentStartMonth', { valueAsNumber: true })}
                        className="focus:ring-primary-500 focus:border-primary-500 block w-full py-2 sm:text-sm border-gray-300 rounded-md"
                        placeholder="1"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Prepayment Scenario */}
              <div className="space-y-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('prepaymentScenario')}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-700">Add Prepayment Scenario</span>
                </label>
                
                {watchedValues.prepaymentScenario && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pl-7">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Prepayment Amount
                      </label>
                      <div className="relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">$</span>
                        </div>
                        <input
                          type="number"
                          {...register('prepaymentAmount', { valueAsNumber: true })}
                          className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-7 pr-3 py-2 sm:text-sm border-gray-300 rounded-md"
                          placeholder="10000"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Prepayment Month
                      </label>
                      <input
                        type="number"
                        min="1"
                        {...register('prepaymentMonth', { valueAsNumber: true })}
                        className="focus:ring-primary-500 focus:border-primary-500 block w-full py-2 sm:text-sm border-gray-300 rounded-md"
                        placeholder="60"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Additional Options */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Compounding Frequency
                  </label>
                  <select
                    {...register('compoundingFrequency')}
                    className="block w-full py-2 pl-3 pr-10 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                  >
                    <option value="daily">Daily</option>
                    <option value="monthly">Monthly</option>
                    <option value="annually">Annually</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rounding Method
                  </label>
                  <select
                    {...register('roundingMethod')}
                    className="block w-full py-2 pl-3 pr-10 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                  >
                    <option value="round">Round to nearest cent</option>
                    <option value="floor">Round down</option>
                    <option value="ceil">Round up</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="mt-8 flex justify-center">
            <button
              type="submit"
              disabled={isCalculating}
              className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PlayIcon className="h-5 w-5 mr-2" />
              {isCalculating ? 'Calculating...' : 'Generate Schedule & Analysis'}
            </button>
          </div>
        </form>
      </div>

      {/* Results Section */}
      {schedule && summary && (
        <div className="space-y-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <BanknotesIcon className="h-6 w-6 text-green-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Monthly Payment</dt>
                      <dd className="text-2xl font-semibold text-gray-900">
                        {formatCurrency(toBig(summary.monthlyPayment))}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <CalculatorIcon className="h-6 w-6 text-red-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Interest</dt>
                      <dd className="text-2xl font-semibold text-gray-900">
                        {formatCurrency(toBig(summary.totalInterest))}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ChartBarIcon className="h-6 w-6 text-blue-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Effective APR</dt>
                      <dd className="text-2xl font-semibold text-gray-900">
                        {formatPercentage(toBig(summary.effectiveAPR))}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <CalendarIcon className="h-6 w-6 text-purple-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Payoff Date</dt>
                      <dd className="text-lg font-semibold text-gray-900">
                        {format(summary.payoffDate, 'MMM yyyy')}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modern Tab Navigation */}
          <div className="bg-white shadow-lg rounded-xl overflow-hidden print:shadow-none print:border">
            <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center justify-between">
                {/* Modern Tab Buttons */}
                <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('table')}
                    className={classNames(
                      'inline-flex items-center px-4 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ease-in-out',
                      viewMode === 'table'
                        ? 'bg-white text-primary-700 shadow-sm ring-1 ring-primary-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                    )}
                  >
                    <TableCellsIcon className="h-4 w-4 mr-2" />
                    Schedule Table
                  </button>
                  <button
                    onClick={() => setViewMode('charts')}
                    className={classNames(
                      'inline-flex items-center px-4 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ease-in-out',
                      viewMode === 'charts'
                        ? 'bg-white text-primary-700 shadow-sm ring-1 ring-primary-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                    )}
                  >
                    <ChartBarIcon className="h-4 w-4 mr-2" />
                    Visual Analysis
                  </button>
                  <button
                    onClick={() => setViewMode('comparison')}
                    className={classNames(
                      'inline-flex items-center px-4 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ease-in-out',
                      viewMode === 'comparison'
                        ? 'bg-white text-primary-700 shadow-sm ring-1 ring-primary-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                    )}
                  >
                    <DocumentTextIcon className="h-4 w-4 mr-2" />
                    Compare Scenarios
                  </button>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-3 print:hidden">
                  <button
                    onClick={exportToCSV}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
                  >
                    <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                    Export CSV
                  </button>
                  <button
                    onClick={printSchedule}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
                  >
                    <PrinterIcon className="h-4 w-4 mr-2" />
                    Print
                  </button>
                  <button
                    onClick={generateComparison}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 transition-all duration-200"
                  >
                    <DocumentTextIcon className="h-4 w-4 mr-2" />
                    Compare
                  </button>
                </div>
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-0">
              {/* Schedule Table */}
              {viewMode === 'table' && (
                <div className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-300">
                      <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                        <tr>
                          <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            <div className="flex items-center space-x-1">
                              <span>#</span>
                            </div>
                          </th>
                          <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            <div className="flex items-center space-x-1">
                              <CalendarIcon className="h-3 w-3" />
                              <span>Date</span>
                            </div>
                          </th>
                          <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            <div className="flex items-center space-x-1">
                              <BanknotesIcon className="h-3 w-3" />
                              <span>Payment</span>
                            </div>
                          </th>
                          <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            <div className="flex items-center space-x-1">
                              <span>Principal</span>
                            </div>
                          </th>
                          <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            <div className="flex items-center space-x-1">
                              <span>Interest</span>
                            </div>
                          </th>
                          {watchedValues.extraPaymentEnabled && (
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              <div className="flex items-center space-x-1">
                                <PlusIcon className="h-3 w-3" />
                                <span>Extra</span>
                              </div>
                            </th>
                          )}
                          <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            <div className="flex items-center space-x-1">
                              <span>Balance</span>
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {displayedSchedule?.map((payment, index) => (
                          <tr key={payment.paymentNumber} className="hover:bg-blue-50/50 transition-colors duration-150">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              #{payment.paymentNumber}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {format(payment.paymentDate, 'MMM yyyy')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm font-semibold text-gray-900">
                                {formatCurrency(toBig(payment.scheduledPayment))}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-blue-600">
                                    {formatCurrency(toBig(payment.principal))}
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                                    <div 
                                      className="bg-blue-500 h-1.5 rounded-full" 
                                      style={{ 
                                        width: `${Math.min(100, (payment.principal / (payment.principal + payment.interest)) * 100)}%` 
                                      }}
                                    ></div>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-red-600">
                                    {formatCurrency(toBig(payment.interest))}
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                                    <div 
                                      className="bg-red-500 h-1.5 rounded-full" 
                                      style={{ 
                                        width: `${Math.min(100, (payment.interest / (payment.principal + payment.interest)) * 100)}%` 
                                      }}
                                    ></div>
                                  </div>
                                </div>
                              </div>
                            </td>
                            {watchedValues.extraPaymentEnabled && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {payment.extraPayment ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    {formatCurrency(toBig(payment.extraPayment))}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                            )}
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {formatCurrency(toBig(payment.balance))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {!showFullSchedule && schedule.length > 24 && (
                    <div className="px-6 py-6 bg-gradient-to-r from-gray-50 to-white border-t border-gray-200 text-center print:hidden">
                      <button
                        onClick={() => setShowFullSchedule(true)}
                        className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        <TableCellsIcon className="h-4 w-4 mr-2" />
                        Show all {schedule.length} payments
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Visual Analysis */}
              {viewMode === 'charts' && (
                <div className="p-6 space-y-8">
                  {/* Chart Navigation */}
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">Visual Analysis Dashboard</h2>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <ChartBarIcon className="h-4 w-4" />
                      <span>Interactive Charts & Analytics</span>
                    </div>
                  </div>

                  {/* Key Metrics Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Total Interest</p>
                          <p className="text-lg font-bold text-blue-900">{formatCurrency(toBig(summary?.totalInterest || 0))}</p>
                        </div>
                        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                          <BanknotesIcon className="h-4 w-4 text-white" />
                        </div>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-green-600 uppercase tracking-wide">Interest Rate</p>
                          <p className="text-lg font-bold text-green-900">{formatPercentage(toBig(watchedValues.interestRate || 0))}</p>
                        </div>
                        <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                          <ChartBarIcon className="h-4 w-4 text-white" />
                        </div>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-purple-600 uppercase tracking-wide">Term</p>
                          <p className="text-lg font-bold text-purple-900">{watchedValues.termMonths} months</p>
                        </div>
                        <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                          <CalendarIcon className="h-4 w-4 text-white" />
                        </div>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-orange-600 uppercase tracking-wide">Total Payments</p>
                          <p className="text-lg font-bold text-orange-900">{schedule?.length || 0}</p>
                        </div>
                        <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                          <CalculatorIcon className="h-4 w-4 text-white" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Principal vs Interest Breakdown */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-gray-900">Payment Breakdown</h3>
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                          <span>Principal</span>
                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                          <span>Interest</span>
                        </div>
                      </div>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieChartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={120}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {pieChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => formatCurrency(toBig(value))} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-gray-900">Monthly Payment Composition</h3>
                        <span className="text-sm text-gray-500">First 24 months</span>
                      </div>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData?.slice(0, 24)}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="month" fontSize={12} />
                            <YAxis fontSize={12} />
                            <Tooltip 
                              formatter={(value: number) => formatCurrency(toBig(value))}
                              contentStyle={{
                                backgroundColor: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                              }}
                            />
                            <Legend />
                            <Bar dataKey="principal" stackId="a" fill="#3b82f6" name="Principal" radius={[0, 0, 4, 4]} />
                            <Bar dataKey="interest" stackId="a" fill="#ef4444" name="Interest" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Balance Over Time */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-gray-900">Loan Balance Over Time</h3>
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                        <span>Remaining Balance</span>
                      </div>
                    </div>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="month" fontSize={12} />
                          <YAxis fontSize={12} />
                          <Tooltip 
                            formatter={(value: number) => formatCurrency(toBig(value))}
                            contentStyle={{
                              backgroundColor: 'white',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="balance"
                            stroke="#10b981"
                            fill="url(#balanceGradient)"
                            fillOpacity={0.8}
                          />
                          <defs>
                            <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                            </linearGradient>
                          </defs>
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Cumulative Analysis */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-gray-900">Cumulative Principal & Interest by Year</h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                          <span>Principal</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                          <span>Interest</span>
                        </div>
                      </div>
                    </div>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={yearlyData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="year" fontSize={12} />
                          <YAxis fontSize={12} />
                          <Tooltip 
                            formatter={(value: number) => formatCurrency(toBig(value))}
                            contentStyle={{
                              backgroundColor: 'white',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                          />
                          <Legend />
                          <Area
                            type="monotone"
                            dataKey="principal"
                            stackId="1"
                            stroke="#3b82f6"
                            fill="#3b82f6"
                            name="Cumulative Principal"
                            fillOpacity={0.8}
                          />
                          <Area
                            type="monotone"
                            dataKey="interest"
                            stackId="1"
                            stroke="#ef4444"
                            fill="#ef4444"
                            name="Cumulative Interest"
                            fillOpacity={0.8}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* Scenario Comparison */}
              {viewMode === 'comparison' && (
                <div className="p-6 space-y-8">
                  {/* Comparison Header */}
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">Scenario Comparison Dashboard</h2>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <DocumentTextIcon className="h-4 w-4" />
                      <span>Side-by-Side Analysis</span>
                    </div>
                  </div>

                  {/* Quick Comparison Scenarios */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Current Scenario */}
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
                      <div className="text-center">
                        <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                          <DocumentTextIcon className="h-6 w-6 text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-blue-900 mb-2">Current Scenario</h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-blue-600">Monthly Payment:</span>
                            <span className="font-medium text-blue-900">
                              {summary ? formatCurrency(toBig(summary.monthlyPayment)) : '-'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-600">Total Interest:</span>
                            <span className="font-medium text-blue-900">
                              {summary ? formatCurrency(toBig(summary.totalInterest)) : '-'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-600">Payoff Date:</span>
                            <span className="font-medium text-blue-900">
                              {summary ? format(summary.payoffDate, 'MMM yyyy') : '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Extra Payment Scenario */}
                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
                      <div className="text-center">
                        <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                          <PlusIcon className="h-6 w-6 text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-green-900 mb-2">Extra Payment Scenario</h3>
                        <p className="text-xs text-green-600 mb-4">+$200/month extra</p>
                        <button
                          onClick={() => {
                            const extraPaymentData = {
                              ...getValues(),
                              extraPaymentEnabled: true,
                              extraPaymentAmount: 200,
                              extraPaymentFrequency: 'monthly' as const,
                            };
                            generateSchedule(extraPaymentData);
                          }}
                          className="w-full px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors duration-200"
                        >
                          Calculate Scenario
                        </button>
                      </div>
                    </div>

                    {/* 15-Year Term Scenario */}
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
                      <div className="text-center">
                        <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                          <CalendarIcon className="h-6 w-6 text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-purple-900 mb-2">15-Year Term</h3>
                        <p className="text-xs text-purple-600 mb-4">180 months vs 360</p>
                        <button
                          onClick={() => {
                            const shorterTermData = {
                              ...getValues(),
                              termMonths: 180,
                            };
                            generateSchedule(shorterTermData);
                          }}
                          className="w-full px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors duration-200"
                        >
                          Calculate Scenario
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Comparison Table */}
                  {schedule && summary && (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900">Scenario Comparison Details</h3>
                        <p className="text-sm text-gray-600 mt-1">Compare different loan scenarios side by side</p>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Metric
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Current Scenario
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                With $200 Extra/Month
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                15-Year Term
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Bi-weekly Payments
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            <tr>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                Monthly Payment
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatCurrency(toBig(summary.monthlyPayment))}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                                {formatCurrency(toBig(summary.monthlyPayment + 200))}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600 font-medium">
                                Calculate to see
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">
                                Calculate to see
                              </td>
                            </tr>
                            
                            <tr>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                Total Interest
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatCurrency(toBig(summary.totalInterest))}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                                <div className="flex items-center">
                                  <span className="mr-2">Estimated 30% less</span>
                                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600">
                                <div className="flex items-center">
                                  <span className="mr-2">Estimated 50% less</span>
                                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                                <div className="flex items-center">
                                  <span className="mr-2">Estimated 25% less</span>
                                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                </div>
                              </td>
                            </tr>
                            
                            <tr>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                Payoff Time
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {Math.round(watchedValues.termMonths / 12)} years
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                                ~22 years
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600">
                                15 years
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                                ~25 years
                              </td>
                            </tr>

                            <tr>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                Interest Savings
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                Baseline
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                                ~{formatCurrency(toBig(summary.totalInterest * 0.3))}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600 font-medium">
                                ~{formatCurrency(toBig(summary.totalInterest * 0.5))}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">
                                ~{formatCurrency(toBig(summary.totalInterest * 0.25))}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Interactive Comparison Builder */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-gray-900">Custom Scenario Builder</h3>
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <CogIcon className="h-4 w-4" />
                        <span>Build Your Own Comparison</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {/* Interest Rate Comparison */}
                      <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700">
                          Interest Rate Scenario
                        </label>
                        <div className="flex space-x-2">
                          <input
                            type="number"
                            step="0.125"
                            defaultValue={watchedValues.interestRate - 0.5}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                            placeholder="4.25"
                          />
                          <span className="flex items-center text-sm text-gray-500">%</span>
                        </div>
                        <button className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
                          Compare Rate
                        </button>
                      </div>

                      {/* Down Payment Comparison */}
                      <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700">
                          Down Payment Scenario
                        </label>
                        <div className="flex space-x-2">
                          <span className="flex items-center text-sm text-gray-500">$</span>
                          <input
                            type="number"
                            step="5000"
                            defaultValue={50000}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                            placeholder="50000"
                          />
                        </div>
                        <button className="w-full px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors">
                          Compare Down Payment
                        </button>
                      </div>

                      {/* Points Comparison */}
                      <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700">
                          Points Scenario
                        </label>
                        <div className="flex space-x-2">
                          <input
                            type="number"
                            step="0.25"
                            defaultValue={1}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                            placeholder="1"
                          />
                          <span className="flex items-center text-sm text-gray-500">pts</span>
                        </div>
                        <button className="w-full px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors">
                          Compare Points
                        </button>
                      </div>

                      {/* PMI Removal Scenario */}
                      <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700">
                          PMI Removal Scenario
                        </label>
                        <div className="flex space-x-2">
                          <input
                            type="number"
                            step="25"
                            defaultValue={150}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                            placeholder="150"
                          />
                          <span className="flex items-center text-sm text-gray-500">/mo</span>
                        </div>
                        <button className="w-full px-3 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-colors">
                          Compare PMI Impact
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Scenario Insights */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-100 rounded-xl p-6 border border-blue-200">
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <InformationCircleIcon className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-blue-900 mb-3">Smart Insights</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div className="bg-white/50 rounded-lg p-4">
                            <h4 className="font-medium text-blue-800 mb-2">💡 Best for Interest Savings</h4>
                            <p className="text-blue-700">A 15-year term saves the most in total interest but increases monthly payments significantly.</p>
                          </div>
                          <div className="bg-white/50 rounded-lg p-4">
                            <h4 className="font-medium text-blue-800 mb-2">🎯 Best for Cash Flow</h4>
                            <p className="text-blue-700">Extra monthly payments of $200 provide a good balance of savings and manageable payments.</p>
                          </div>
                          <div className="bg-white/50 rounded-lg p-4">
                            <h4 className="font-medium text-blue-800 mb-2">⚡ Best for Flexibility</h4>
                            <p className="text-blue-700">Bi-weekly payments align with paychecks and reduce loan term without commitment to extra payments.</p>
                          </div>
                          <div className="bg-white/50 rounded-lg p-4">
                            <h4 className="font-medium text-blue-800 mb-2">🔄 Rate Shopping Impact</h4>
                            <p className="text-blue-700">Every 0.25% rate reduction saves approximately {formatCurrency(toBig(summary?.totalInterest ? summary.totalInterest * 0.05 : 0))} over the loan term.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};