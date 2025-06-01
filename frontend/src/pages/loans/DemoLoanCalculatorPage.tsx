import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { format } from 'date-fns';
import { CalculatorIcon, ChartBarIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import DatePicker from 'react-datepicker';
import { 
  LoanEngine, 
  type LoanTerms,
  formatPercentage,
  toBig
} from '@lendpeak/engine';

// Define types locally until they're fully exported from engine
type CalendarType = '30/360' | 'ACTUAL/365' | 'ACTUAL/360';
type AccrualTiming = 'DAY_0' | 'DAY_1';
type PerDiemMethod = 'STABLE' | 'VARIABLE';
type RoundingMethod = 'BANKERS' | 'HALF_UP' | 'HALF_DOWN' | 'UP' | 'DOWN' | 'HALF_AWAY' | 'HALF_TOWARD';

interface PaymentWaterfall {
  name: string;
  description?: string;
  steps: Array<{
    type: string;
    description: string;
    priority: number;
  }>;
}

interface LoanParameters extends LoanTerms {
  calendarType?: CalendarType;
  accrualTiming?: AccrualTiming;
  perDiemMethod?: PerDiemMethod;
  paymentWaterfall?: PaymentWaterfall;
  roundingConfig?: {
    method: RoundingMethod;
    decimalPlaces: number;
  };
  fees?: {
    origination?: number;
  };
}

interface LoanCalculationResult {
  monthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
  effectiveInterestRate: number;
  apr: number;
  paymentSchedule: any[];
  fees: {
    origination: number;
    processing: number;
    total: number;
  };
}

// Define waterfall templates locally
const WATERFALL_TEMPLATES: PaymentWaterfall[] = [
  {
    name: 'Standard',
    description: 'Default payment allocation: Fees → Interest → Principal',
    steps: [
      { type: 'FEES', description: 'Late fees and penalties', priority: 1 },
      { type: 'INTEREST', description: 'Accrued interest', priority: 2 },
      { type: 'PRINCIPAL', description: 'Principal balance', priority: 3 },
      { type: 'ESCROW', description: 'Escrow payments', priority: 4 },
    ],
  },
  {
    name: 'Interest First',
    description: 'Prioritize interest over principal',
    steps: [
      { type: 'INTEREST', description: 'Accrued interest', priority: 1 },
      { type: 'FEES', description: 'Fees and penalties', priority: 2 },
      { type: 'PRINCIPAL', description: 'Principal balance', priority: 3 },
    ],
  },
  {
    name: 'Principal First',
    description: 'Prioritize principal reduction',
    steps: [
      { type: 'PRINCIPAL', description: 'Principal balance', priority: 1 },
      { type: 'INTEREST', description: 'Accrued interest', priority: 2 },
      { type: 'FEES', description: 'Fees and penalties', priority: 3 },
    ],
  },
];
import { useLocation, useNavigate } from 'react-router-dom';
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
    .min(100, 'Minimum loan amount is $100')
    .max(10000000, 'Maximum loan amount is $10,000,000')
    .test('is-decimal', 'Principal can have at most 2 decimal places', (value) => {
      if (value !== undefined) {
        const decimal = value.toString().split('.')[1];
        return !decimal || decimal.length <= 2;
      }
      return true;
    }),
  originationFee: yup
    .number()
    .min(0, 'Origination fee cannot be negative')
    .max(100000, 'Maximum origination fee is $100,000')
    .test('is-decimal', 'Origination fee can have at most 2 decimal places', (value) => {
      if (value !== undefined) {
        const decimal = value.toString().split('.')[1];
        return !decimal || decimal.length <= 2;
      }
      return true;
    }),
  originationFeeType: yup.string().oneOf(['AMOUNT', 'PERCENTAGE'], 'Invalid origination fee type'),
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
  balloonMonths: yup
    .number()
    .nullable()
    .positive('Balloon period must be positive')
    .integer('Balloon period must be a whole number')
    .max(yup.ref('termMonths'), 'Balloon period cannot exceed loan term')
    .when('interestType', {
      is: 'BALLOON',
      then: yup.number().required('Balloon period is required for balloon loans'),
    }),
  startDate: yup.date().required('Start date is required'),
  interestType: yup.string().required('Interest type is required'),
  calendarType: yup.string().required('Calendar type is required'),
  accrualTiming: yup.string().required('Accrual timing is required'),
  perDiemMethod: yup.string().required('Per diem method is required'),
  waterfallIndex: yup.number().required('Payment waterfall is required'),
  roundingMethod: yup.string().required('Rounding method is required'),
  roundingDecimalPlaces: yup
    .number()
    .integer('Decimal places must be a whole number')
    .min(0, 'Cannot have negative decimal places')
    .max(6, 'Maximum 6 decimal places allowed')
    .required('Decimal places is required'),
});

type FormData = yup.InferType<typeof schema>;

// Modern color palette with gradients
const MODERN_COLORS = {
  primary: ['#6366f1', '#8b5cf6'],      // Indigo to Purple gradient
  success: ['#10b981', '#059669'],      // Emerald gradient  
  warning: ['#f59e0b', '#d97706'],      // Amber gradient
  info: ['#3b82f6', '#2563eb'],         // Blue gradient
  accent: ['#ec4899', '#be185d'],       // Pink gradient
  neutral: ['#6b7280', '#4b5563'],      // Gray gradient
};

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'];

export const DemoLoanCalculatorPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const template = location.state?.template;
  const [calculationResult, setCalculationResult] = useState<LoanCalculationResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  // const [engine, setEngine] = useState<LoanEngine | null>(null); // Not needed with stateless engine
  const [loanParams, setLoanParams] = useState<LoanParameters | null>(null);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showAllPayments, setShowAllPayments] = useState(false);
  const [showCreateLoanModal, setShowCreateLoanModal] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    control,
  } = useForm<FormData>({
    resolver: yupResolver(schema),
    defaultValues: {
      principal: template?.principal || 100000,
      originationFee: template?.originationFee || 0,
      originationFeeType: template?.originationFeeType || 'AMOUNT',
      annualRate: template?.interestRate || 5.5,
      termMonths: template?.termMonths || 360,
      balloonMonths: template?.balloonMonths || null,
      startDate: template?.startDate ? new Date(template.startDate) : new Date(),
      interestType: template?.interestType || 'FIXED',
      calendarType: template?.calendarType || 'ACTUAL/365',
      accrualTiming: template?.accrualTiming || 'DAY_1',
      perDiemMethod: template?.perDiemMethod || 'STABLE',
      waterfallIndex: 0,
      roundingMethod: template?.roundingMethod || 'BANKERS',
      roundingDecimalPlaces: template?.roundingDecimalPlaces ?? 2,
    },
  });
  
  const interestType = watch('interestType');
  const originationFeeType = watch('originationFeeType');
  const originationFeeAmount = watch('originationFee');
  const principalAmount = watch('principal');
  const roundingMethod = watch('roundingMethod');

  // Calculate origination fee amount and total loan amount
  const calculateOriginationFee = (principal: number, fee: number, feeType: string) => {
    if (!fee || fee === 0) return 0;
    if (feeType === 'PERCENTAGE') {
      return (principal * fee) / 100;
    }
    return fee;
  };

  const calculatedOriginationFee = calculateOriginationFee(principalAmount || 0, originationFeeAmount || 0, originationFeeType || 'AMOUNT');
  const totalLoanAmount = (principalAmount || 0) + calculatedOriginationFee;

  const onSubmit = (data: FormData) => {
    setIsCalculating(true);
    
    // Calculate origination fee
    const originationFee = calculateOriginationFee(data.principal, data.originationFee || 0, data.originationFeeType || 'AMOUNT');
    const totalPrincipal = data.principal + originationFee;
    
    // Create loan terms using LoanEngine API
    const loanTerms = LoanEngine.createLoan(
      totalPrincipal,
      data.annualRate,
      data.termMonths,
      data.startDate,
      {
        paymentFrequency: 'monthly',
        interestType: data.interestType === 'BALLOON' ? 'balloon' : 'amortized',
        dayCountConvention: data.calendarType === '30/360' ? '30/360' : 
                           data.calendarType === 'ACTUAL/360' ? 'actual/360' : 'actual/365',
        balloonPayment: data.interestType === 'BALLOON' && data.balloonMonths 
          ? totalPrincipal // Balloon payment is typically the remaining principal
          : undefined,
      }
    );

    // Calculate payment
    const paymentResult = LoanEngine.calculatePayment(loanTerms);
    
    // Generate amortization schedule
    const schedule = LoanEngine.generateSchedule(loanTerms);
    
    // Calculate total interest from schedule
    const totalInterest = schedule.payments.reduce((sum, payment) => {
      return sum + (payment.interest ? payment.interest.toNumber() : 0);
    }, 0);
    
    // Calculate total payment
    const totalPayment = paymentResult.monthlyPayment.times(data.termMonths).toNumber();
    
    // Calculate APR
    const apr = LoanEngine.calculateAPR(
      totalPrincipal,
      paymentResult.monthlyPayment,
      data.termMonths,
      originationFee
    ).toNumber();
    
    // Create result object matching expected format
    const result: LoanCalculationResult = {
      monthlyPayment: paymentResult.monthlyPayment.toNumber(),
      totalPayment: totalPayment,
      totalInterest: totalInterest,
      effectiveInterestRate: data.annualRate, // Simplified for now
      apr: apr,
      paymentSchedule: schedule.payments.map((payment, index) => ({
        paymentNumber: index + 1,
        dueDate: payment.dueDate.toDate(),
        principal: payment.principal?.toNumber() || 0,
        interest: payment.interest?.toNumber() || 0,
        totalPayment: payment.totalPayment?.toNumber() || 0,
        remainingBalance: payment.remainingBalance?.toNumber() || 0,
        cumulativeInterest: 0, // Would need to calculate
        cumulativePrincipal: 0, // Would need to calculate
      })),
      fees: {
        origination: originationFee,
        processing: 0,
        total: originationFee,
      },
    };
    
    setLoanParams(loanTerms as any);
    setCalculationResult(result);
    setIsCalculating(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const pieData = calculationResult
    ? [
        { name: 'Principal', value: calculationResult.monthlyPayment * calculationResult.paymentSchedule.length - calculationResult.totalInterest },
        { name: 'Interest', value: calculationResult.totalInterest },
      ]
    : [];

  const chartData = calculationResult?.paymentSchedule
    ?.slice(0, 60) // First 5 years
    .map((payment) => ({
      month: payment.paymentNumber,
      principal: payment.principal,
      interest: payment.interest,
      balance: payment.remainingBalance,
    }));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Loan Calculator</h1>
        <p className="mt-1 text-sm text-gray-500">
          Calculate monthly payments and view amortization schedules - All calculations performed in your browser
        </p>
      </div>

      {/* Calculator Form - Full Width */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-6">Loan Parameters</h2>
        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Basic Parameters */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                  step="0.01"
                  {...register('principal', { valueAsNumber: true })}
                  className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                  placeholder="100,000.00"
                />
              </div>
              {errors.principal && (
                <p className="mt-1 text-sm text-red-600">{errors.principal.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="originationFee" className="block text-sm font-medium text-gray-700">
                Origination Fee
              </label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">
                      {originationFeeType === 'PERCENTAGE' ? '%' : '$'}
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    {...register('originationFee', { valueAsNumber: true })}
                    className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-7 pr-3 sm:text-sm border-gray-300 rounded-md"
                    placeholder={originationFeeType === 'PERCENTAGE' ? '2.50' : '2,500.00'}
                  />
                </div>
                <select
                  {...register('originationFeeType')}
                  className="focus:ring-primary-500 focus:border-primary-500 block w-full border-gray-300 rounded-md sm:text-sm"
                >
                  <option value="AMOUNT">Amount</option>
                  <option value="PERCENTAGE">Percent</option>
                </select>
              </div>
              {calculatedOriginationFee > 0 && (
                <p className="mt-1 text-xs text-gray-600">
                  Fee: {formatCurrency(calculatedOriginationFee)} | Total: {formatCurrency(totalLoanAmount)}
                </p>
              )}
              {errors.originationFee && (
                <p className="mt-1 text-sm text-red-600">{errors.originationFee.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="annualRate" className="block text-sm font-medium text-gray-700">
                Annual Interest Rate
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <input
                  type="number"
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
          </div>

          {/* Second Row */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mt-6">
            <div>
              <label htmlFor="termMonths" className="block text-sm font-medium text-gray-700">
                Loan Term (Months)
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

            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
                Start Date
              </label>
              <Controller
                control={control}
                name="startDate"
                render={({ field }) => (
                  <DatePicker
                    selected={field.value}
                    onChange={field.onChange}
                    dateFormat="MM/dd/yyyy"
                    className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                    placeholderText="Select start date"
                    showMonthDropdown
                    showYearDropdown
                    dropdownMode="select"
                  />
                )}
              />
              {errors.startDate && (
                <p className="mt-1 text-sm text-red-600">{errors.startDate.message}</p>
              )}
            </div>

            {/* Total Loan Amount Display */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Total Loan Amount
              </label>
              <div className="mt-1 bg-gray-50 border border-gray-300 rounded-md px-3 py-2">
                <div className="text-lg font-semibold text-gray-900">
                  {formatCurrency(totalLoanAmount)}
                </div>
                {calculatedOriginationFee > 0 && (
                  <div className="text-xs text-gray-500">
                    Principal: {formatCurrency(principalAmount || 0)} + Fee: {formatCurrency(calculatedOriginationFee)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="border-t pt-6 mt-6">
            <button
              type="button"
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              className="flex items-center justify-between w-full text-left"
            >
              <h3 className="text-sm font-medium text-gray-900">Advanced Settings</h3>
              {showAdvancedSettings ? (
                <ChevronUpIcon className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronDownIcon className="h-5 w-5 text-gray-500" />
              )}
            </button>
            
            {showAdvancedSettings && (
              <div className="mt-4 transition-all duration-200 ease-in-out">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label htmlFor="interestType" className="block text-sm font-medium text-gray-700">
                  Interest Type
                </label>
                <select
                  {...register('interestType')}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                >
                  <option value="FIXED">Fixed Rate</option>
                  <option value="SIMPLE">Daily Simple Interest (DSI)</option>
                  <option value="VARIABLE">Variable Rate</option>
                  <option value="COMPOUND">Compound Interest</option>
                  <option value="BALLOON">Balloon</option>
                </select>
                {errors.interestType && (
                  <p className="mt-1 text-sm text-red-600">{errors.interestType.message}</p>
                )}
              </div>

              {interestType === 'BALLOON' && (
                <div>
                  <label htmlFor="balloonMonths" className="block text-sm font-medium text-gray-700">
                    Balloon Period (Months)
                  </label>
                  <input
                    type="number"
                    {...register('balloonMonths', { valueAsNumber: true })}
                    className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                    placeholder="60"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Number of months before the balloon payment is due
                  </p>
                  {errors.balloonMonths && (
                    <p className="mt-1 text-sm text-red-600">{errors.balloonMonths.message}</p>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="calendarType" className="block text-sm font-medium text-gray-700">
                  Calendar Type
                </label>
                <select
                  {...register('calendarType')}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                >
                  <option value="ACTUAL/365">Actual/365</option>
                  <option value="ACTUAL/360">Actual/360</option>
                  <option value="30/360">30/360</option>
                </select>
                {errors.calendarType && (
                  <p className="mt-1 text-sm text-red-600">{errors.calendarType.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="accrualTiming" className="block text-sm font-medium text-gray-700">
                  Interest Accrual Timing
                </label>
                <select
                  {...register('accrualTiming')}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                >
                  <option value="DAY_1">Day 1 (Interest starts day after funding)</option>
                  <option value="DAY_0">Day 0 (Interest starts on funding day)</option>
                </select>
                {errors.accrualTiming && (
                  <p className="mt-1 text-sm text-red-600">{errors.accrualTiming.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="perDiemMethod" className="block text-sm font-medium text-gray-700">
                  Per Diem Calculation Method
                </label>
                <select
                  {...register('perDiemMethod')}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                >
                  <option value="STABLE">Stable (Annual Rate ÷ Days in Year)</option>
                  <option value="VARIABLE">Variable (Monthly Rate ÷ Days in Month)</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {watch('perDiemMethod') === 'STABLE' 
                    ? 'Same daily rate throughout the year'
                    : 'Daily rate varies by month (higher in Feb, lower in 31-day months)'}
                </p>
                {errors.perDiemMethod && (
                  <p className="mt-1 text-sm text-red-600">{errors.perDiemMethod.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="waterfallIndex" className="block text-sm font-medium text-gray-700">
                  Payment Waterfall
                </label>
                <select
                  {...register('waterfallIndex', { valueAsNumber: true })}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                >
                  {WATERFALL_TEMPLATES.map((waterfall, index) => (
                    <option key={index} value={index}>
                      {waterfall.name} - {waterfall.description}
                    </option>
                  ))}
                </select>
                {errors.waterfallIndex && (
                  <p className="mt-1 text-sm text-red-600">{errors.waterfallIndex.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="roundingMethod" className="block text-sm font-medium text-gray-700">
                  Rounding Method
                </label>
                <select
                  {...register('roundingMethod')}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                >
                  <option value="BANKERS">Banker's Rounding (Round half to even)</option>
                  <option value="HALF_UP">Traditional (Round half up)</option>
                  <option value="HALF_DOWN">Round half down</option>
                  <option value="UP">Always round up</option>
                  <option value="DOWN">Always round down</option>
                  <option value="HALF_AWAY">Round half away from zero</option>
                  <option value="HALF_TOWARD">Round half toward zero</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {watch('roundingMethod') === 'BANKERS' 
                    ? 'Industry standard - rounds 0.5 to nearest even number'
                    : watch('roundingMethod') === 'HALF_UP'
                    ? 'Traditional rounding - 0.5 always rounds up'
                    : watch('roundingMethod') === 'HALF_DOWN'
                    ? 'Conservative - 0.5 always rounds down'
                    : watch('roundingMethod') === 'UP'
                    ? 'Always rounds up (ceiling)'
                    : watch('roundingMethod') === 'DOWN'
                    ? 'Always rounds down (floor)'
                    : watch('roundingMethod') === 'HALF_AWAY'
                    ? 'Rounds 0.5 away from zero'
                    : 'Rounds 0.5 toward zero'}
                </p>
                {errors.roundingMethod && (
                  <p className="mt-1 text-sm text-red-600">{errors.roundingMethod.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="roundingDecimalPlaces" className="block text-sm font-medium text-gray-700">
                  Decimal Places
                </label>
                <input
                  type="number"
                  {...register('roundingDecimalPlaces', { valueAsNumber: true })}
                  className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                  placeholder="2"
                  min="0"
                  max="6"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Number of decimal places to preserve (default: 2 for cents)
                </p>
                {errors.roundingDecimalPlaces && (
                  <p className="mt-1 text-sm text-red-600">{errors.roundingDecimalPlaces.message}</p>
                )}
              </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 flex justify-center">
            <button
              type="submit"
              disabled={isCalculating}
              className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              <CalculatorIcon className="h-5 w-5 mr-2" />
              {isCalculating ? 'Calculating...' : 'Calculate Loan'}
            </button>
          </div>
        </form>
      </div>

      {/* Results Section - Full Width */}
      {calculationResult && (
        <div>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-6 mb-8 sm:grid-cols-2 lg:grid-cols-5">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <dt className="text-sm font-medium text-gray-500 truncate">Monthly Payment</dt>
                <dd className="mt-1 text-2xl font-semibold text-gray-900">
                  {formatCurrency(calculationResult.monthlyPayment)}
                </dd>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <dt className="text-sm font-medium text-gray-500 truncate">Total Interest</dt>
                <dd className="mt-1 text-2xl font-semibold text-gray-900">
                  {formatCurrency(calculationResult.totalInterest)}
                </dd>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <dt className="text-sm font-medium text-gray-500 truncate">Total Amount</dt>
                <dd className="mt-1 text-2xl font-semibold text-gray-900">
                  {formatCurrency(calculationResult.totalPayment)}
                </dd>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <dt className="text-sm font-medium text-gray-500 truncate">APR</dt>
                <dd className="mt-1 text-2xl font-semibold text-gray-900">
                  {formatPercentage(toBig(calculationResult.apr))}
                </dd>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <dt className="text-sm font-medium text-gray-500 truncate">Total Fees</dt>
                <dd className="mt-1 text-2xl font-semibold text-gray-900">
                  {formatCurrency(calculationResult.fees.total)}
                </dd>
              </div>
            </div>
          </div>

          {/* Origination Fee Breakdown - if applicable */}
          {calculatedOriginationFee > 0 && (
            <div className="bg-white shadow rounded-lg p-6 mb-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Loan Breakdown</h3>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Principal Amount</dt>
                  <dd className="text-sm font-semibold text-gray-900">
                    {formatCurrency(principalAmount || 0)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Origination Fee</dt>
                  <dd className="text-sm font-semibold text-gray-900">
                    {formatCurrency(calculatedOriginationFee)}
                    {originationFeeType === 'PERCENTAGE' && (
                      <span className="text-xs text-gray-500 ml-1">
                        ({originationFeeAmount}%)
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Total Loan Amount</dt>
                  <dd className="text-sm font-semibold text-gray-900">
                    {formatCurrency(totalLoanAmount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Effective Rate</dt>
                  <dd className="text-sm font-semibold text-gray-900">
                    {formatPercentage(toBig(calculationResult.apr))}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* Balloon Payment Details - if applicable */}
          {interestType === 'BALLOON' && calculationResult.balloonPayment && (
            <div className="bg-amber-50 border border-amber-200 shadow rounded-lg p-6 mb-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Balloon Payment Details</h3>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-sm font-medium text-gray-600">Balloon Payment Amount</dt>
                  <dd className="text-xl font-bold text-amber-800">
                    {formatCurrency(calculationResult.balloonPayment)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-600">Due After</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {watch('balloonMonths')} months
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-600">Regular Payment Until Balloon</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {formatCurrency(calculationResult.monthlyPayment)}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-sm text-amber-700">
                <svg className="inline-block h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                A large balloon payment of {formatCurrency(calculationResult.balloonPayment)} will be due after {watch('balloonMonths')} months.
              </p>
            </div>
          )}

          {/* Per Diem Details - if applicable */}
          {interestType === 'SIMPLE' && loanParams && (
            <div className="bg-white shadow rounded-lg p-6 mb-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Daily Simple Interest Details</h3>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Daily Interest</dt>
                  <dd className="text-sm font-semibold text-gray-900">
                    {formatCurrency(LoanEngine.calculateDailyInterest(
                      loanParams.principal, 
                      loanParams.annualInterestRate
                    ))}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Per Diem Method</dt>
                  <dd className="text-sm font-semibold text-gray-900">
                    {watch('perDiemMethod') === 'STABLE' ? 'Stable' : 'Variable by Month'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Calendar Type</dt>
                  <dd className="text-sm font-semibold text-gray-900">
                    {loanParams.calendarType}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* Rounding Configuration Display */}
          {loanParams?.roundingConfig && (
            <div className="bg-white shadow rounded-lg p-6 mb-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Calculation Precision</h3>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Rounding Method</dt>
                  <dd className="text-sm font-semibold text-gray-900">
                    {loanParams.roundingConfig.method === 'BANKERS' && "Banker's Rounding"}
                    {loanParams.roundingConfig.method === 'HALF_UP' && "Traditional Rounding"}
                    {loanParams.roundingConfig.method === 'HALF_DOWN' && "Half Down"}
                    {loanParams.roundingConfig.method === 'UP' && "Always Round Up"}
                    {loanParams.roundingConfig.method === 'DOWN' && "Always Round Down"}
                    {loanParams.roundingConfig.method === 'HALF_AWAY' && "Half Away from Zero"}
                    {loanParams.roundingConfig.method === 'HALF_TOWARD' && "Half Toward Zero"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Decimal Precision</dt>
                  <dd className="text-sm font-semibold text-gray-900">
                    {loanParams.roundingConfig.decimalPlaces} decimal places
                    <span className="text-xs text-gray-500 ml-1">
                      (${(1 / Math.pow(10, loanParams.roundingConfig.decimalPlaces)).toFixed(loanParams.roundingConfig.decimalPlaces)} precision)
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* Modern Charts Section */}
          <div className="grid grid-cols-1 gap-8 mb-8 lg:grid-cols-2">
            {/* Modern Donut Chart */}
            <div className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow duration-300">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Payment Breakdown</h3>
                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"></div>
              </div>
              <div className="h-80 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      <linearGradient id="principalGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                      <linearGradient id="interestGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#059669" />
                      </linearGradient>
                    </defs>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}\n${(percent * 100).toFixed(1)}%`}
                      outerRadius={120}
                      innerRadius={60}
                      fill="url(#principalGradient)"
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((_, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={index === 0 ? "url(#principalGradient)" : "url(#interestGradient)"} 
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                        fontSize: '14px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center total amount */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-500">Total</div>
                    <div className="text-lg font-bold text-gray-900">
                      {calculationResult && formatCurrency(calculationResult.totalPayment)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Modern Area Chart */}
            <div className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow duration-300">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Payment Progression</h3>
                <div className="flex space-x-2">
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-600"></div>
                    <span className="text-xs text-gray-600">Principal</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600"></div>
                    <span className="text-xs text-gray-600">Interest</span>
                  </div>
                </div>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  >
                    <defs>
                      <linearGradient id="principalAreaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="interestAreaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid 
                      strokeDasharray="3 3" 
                      stroke="#e5e7eb" 
                      strokeOpacity={0.6}
                    />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                    />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(label) => `Month ${label}`}
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                        fontSize: '14px'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="principal"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      fill="url(#principalAreaGradient)"
                      name="Principal Payment"
                      dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, fill: '#3b82f6', strokeWidth: 2 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="interest"
                      stroke="#10b981"
                      strokeWidth={3}
                      fill="url(#interestAreaGradient)"
                      name="Interest Payment"
                      dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, fill: '#10b981', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-500">First 5 years • Hover for details</p>
              </div>
            </div>
          </div>

          {/* Amortization Table - Full Width */}
          <div className="bg-white shadow rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Amortization Schedule</h3>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Show:</span>
                <select
                  value={showAllPayments ? 'all' : '12'}
                  onChange={(e) => setShowAllPayments(e.target.value === 'all')}
                  className="text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="12">First 12 payments</option>
                  <option value="all">All payments ({calculationResult.paymentSchedule.length})</option>
                </select>
              </div>
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
                  {(showAllPayments ? calculationResult.paymentSchedule : calculationResult.paymentSchedule.slice(0, 12)).map((payment) => (
                    <tr key={payment.paymentNumber}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payment.paymentNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(payment.dueDate, 'MMM yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(toBig(payment.principal))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(toBig(payment.interest))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(toBig(payment.remainingBalance))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!showAllPayments && calculationResult.paymentSchedule.length > 12 && (
                <div className="px-6 py-3 bg-gray-50 text-sm text-gray-500 text-center">
                  Showing first 12 of {calculationResult.paymentSchedule.length} total payments
                  <button
                    onClick={() => setShowAllPayments(true)}
                    className="ml-2 text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Show all payments
                  </button>
                </div>
              )}
              {showAllPayments && (
                <div className="px-6 py-3 bg-gray-50 text-sm text-gray-500 text-center">
                  Showing all {calculationResult.paymentSchedule.length} payments
                  <button
                    onClick={() => setShowAllPayments(false)}
                    className="ml-2 text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Show first 12 only
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Create Loan Button */}
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => setShowCreateLoanModal(true)}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <svg className="-ml-1 mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Loan from Calculation
            </button>
          </div>

          {/* Demo Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mt-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Browser-Based Calculations
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>
                    All calculations are performed locally using the LendPeak engine running in your browser.
                    No data is sent to any server.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Loan Modal */}
      {showCreateLoanModal && calculationResult && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Create Loan from Calculation</h2>
              <button
                onClick={() => setShowCreateLoanModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">Loan Summary</h3>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-gray-500">Principal Amount</dt>
                    <dd className="font-medium">{formatCurrency(totalLoanAmount)}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Interest Rate</dt>
                    <dd className="font-medium">{watch('annualRate')}%</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Term</dt>
                    <dd className="font-medium">{watch('termMonths')} months</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Monthly Payment</dt>
                    <dd className="font-medium">{formatCurrency(calculationResult.monthlyPayment)}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Total Interest</dt>
                    <dd className="font-medium">{formatCurrency(calculationResult.totalInterest)}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">APR</dt>
                    <dd className="font-medium">{formatPercentage(toBig(calculationResult.apr))}</dd>
                  </div>
                </dl>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-amber-700">
                      This will create a demo loan. In production, additional borrower information would be required.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setShowCreateLoanModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // Navigate to create loan page with parameters
                    const params = new URLSearchParams({
                      principal: principalAmount.toString(),
                      interestRate: watch('annualRate').toString(),
                      termMonths: watch('termMonths').toString(),
                      originationFee: (originationFeeAmount || 0).toString(),
                      originationFeeType: originationFeeType,
                      interestType: watch('interestType'),
                      calendarType: watch('calendarType'),
                      accrualTiming: watch('accrualTiming'),
                      perDiemMethod: watch('perDiemMethod'),
                      roundingMethod: watch('roundingMethod'),
                      roundingDecimalPlaces: watch('roundingDecimalPlaces').toString(),
                      startDate: watch('startDate').toISOString(),
                    });
                    navigate(`/loans/new?${params.toString()}`);
                  }}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Continue to Create Loan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};