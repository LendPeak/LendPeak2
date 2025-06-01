import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { CalculatorIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { differenceInDays, format } from 'date-fns';
import { LoanEngine } from '@lendpeak/engine';
import Big from 'big.js';

// Define types locally until they're fully exported from engine
type CalendarType = '30/360' | 'ACTUAL/365' | 'ACTUAL/360';
type PerDiemMethod = 'STABLE' | 'VARIABLE';
import DatePicker from 'react-datepicker';

const schema = yup.object({
  principal: yup
    .number()
    .positive('Principal must be positive')
    .required('Principal is required'),
  annualRate: yup
    .number()
    .positive('Interest rate must be positive')
    .required('Interest rate is required')
    .min(0.01, 'Minimum interest rate is 0.01%')
    .max(50, 'Maximum interest rate is 50%'),
  startDate: yup.date().required('Start date is required'),
  endDate: yup.date().required('End date is required').min(
    yup.ref('startDate'),
    'End date must be after start date'
  ),
  calendarType: yup.string().required('Calendar type is required'),
  perDiemMethod: yup.string().required('Per diem method is required'),
});

type FormData = yup.InferType<typeof schema>;

interface PerDiemResult {
  principal: number;
  annualRate: number;
  days: number;
  dailyRate: number;
  dailyInterest: number;
  totalInterest: number;
  calendarType: string;
  perDiemMethod: string;
  daysInYear: number;
  daysInMonth?: number;
  monthlyRate?: number;
  monthByMonthBreakdown?: Array<{
    month: string;
    days: number;
    dailyRate: number;
    interest: number;
  }>;
}

const CALENDAR_TYPES = [
  { value: '30/360', label: '30/360' },
  { value: 'ACTUAL/365', label: 'Actual/365' },
  { value: 'ACTUAL/360', label: 'Actual/360' },
];

export const PerDiemCalculator: React.FC = () => {
  const [result, setResult] = useState<PerDiemResult | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    control,
  } = useForm<FormData>({
    resolver: yupResolver(schema),
    defaultValues: {
      principal: 100000,
      annualRate: 5.5,
      startDate: new Date(),
      endDate: new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days later
      calendarType: 'ACTUAL/365',
      perDiemMethod: 'STABLE',
    },
  });

  const startDate = watch('startDate');
  const endDate = watch('endDate');
  const calendarType = watch('calendarType');

  const calculate = (data: FormData) => {
    // Use stateless LoanEngine for daily interest calculations
    const principalBig = new Big(data.principal);
    const annualRateBig = new Big(data.annualRate);

    // Calculate using stateless LoanEngine 
    const totalDays = differenceInDays(data.endDate, data.startDate);
    const dailyInterest = LoanEngine.calculateDailyInterest(
      principalBig,
      annualRateBig
    ).toNumber();
    
    const totalInterest = dailyInterest * totalDays;
    
    // Calculate daily rate based on calendar type
    let daysInYear = 365;
    if (data.calendarType === '30/360') {
      daysInYear = 360;
    } else if (data.calendarType === 'ACTUAL/360') {
      daysInYear = 360;
    }
    
    const dailyRate = data.annualRate / daysInYear / 100;

    const result: PerDiemResult = {
      principal: data.principal,
      annualRate: data.annualRate,
      days: totalDays,
      dailyRate,
      dailyInterest,
      totalInterest,
      calendarType: data.calendarType,
      perDiemMethod: data.perDiemMethod,
      daysInYear,
    };

    setResult(result);
  };

  const onSubmit = (data: FormData) => {
    calculate(data);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(5)}%`;
  };

  const actualDays = startDate && endDate 
    ? differenceInDays(endDate, startDate)
    : 0;

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium text-gray-900">Per Diem Interest Calculator</h2>
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
          <h4 className="text-sm font-medium text-blue-900 mb-2">About Per Diem Interest</h4>
          <p className="text-sm text-blue-700 mb-2">
            Per diem interest is the daily interest charge on a loan. It's commonly used for:
          </p>
          <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
            <li>Calculating interest between closing and first payment</li>
            <li>Payoff calculations for exact interest amounts</li>
            <li>Short-term bridge loans</li>
            <li>Construction loan interest during draw periods</li>
          </ul>
          <div className="mt-3 text-sm text-blue-700">
            <p className="font-medium">Calendar Type Impact:</p>
            <ul className="mt-1 space-y-1 list-disc list-inside">
              <li><strong>30/360:</strong> Assumes 30 days per month, 360 days per year</li>
              <li><strong>Actual/365:</strong> Uses actual days, 365 days per year</li>
              <li><strong>Actual/360:</strong> Uses actual days, 360 days per year (higher rate)</li>
            </ul>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="principal" className="block text-sm font-medium text-gray-700">
              Principal Amount
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                type="number"
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

          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
              End Date
            </label>
            <Controller
              control={control}
              name="endDate"
              render={({ field }) => (
                <DatePicker
                  selected={field.value}
                  onChange={field.onChange}
                  dateFormat="MM/dd/yyyy"
                  className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                  placeholderText="Select end date"
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                  minDate={watch('startDate')}
                />
              )}
            />
            {errors.endDate && (
              <p className="mt-1 text-sm text-red-600">{errors.endDate.message}</p>
            )}
            {actualDays > 0 && (
              <p className="mt-1 text-xs text-gray-500">
                {actualDays} actual day{actualDays !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="calendarType" className="block text-sm font-medium text-gray-700">
              Calendar Type
            </label>
            <select
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
          </div>

          <div>
            <label htmlFor="perDiemMethod" className="block text-sm font-medium text-gray-700">
              Per Diem Method
            </label>
            <select
              {...register('perDiemMethod')}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
            >
              <option value="STABLE">Stable (Rate ÷ Days in Year)</option>
              <option value="VARIABLE">Variable (Monthly Rate ÷ Days in Month)</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {watch('perDiemMethod') === 'STABLE' 
                ? 'Same daily rate throughout the year'
                : 'Daily rate varies by month'}
            </p>
            {errors.perDiemMethod && (
              <p className="mt-1 text-sm text-red-600">{errors.perDiemMethod.message}</p>
            )}
          </div>
        </div>

        <button
          type="submit"
          className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
        >
          <CalculatorIcon className="h-5 w-5 mr-2" />
          Calculate
        </button>
      </form>

      {result && (
        <div className="mt-6 space-y-4">
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Calculation Results</h3>
            
            <div className="bg-primary-50 border border-primary-200 rounded-md p-4 mb-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-primary-900">Daily Interest</p>
                  <p className="text-2xl font-bold text-primary-900">
                    {formatCurrency(result.dailyInterest)}
                  </p>
                  <p className="text-xs text-primary-700 mt-1">per day</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-primary-900">Total Interest</p>
                  <p className="text-2xl font-bold text-primary-900">
                    {formatCurrency(result.totalInterest)}
                  </p>
                  <p className="text-xs text-primary-700 mt-1">for {result.days} days</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 rounded-md p-3">
                <p className="text-xs text-gray-500">Daily Rate</p>
                <p className="font-semibold">{formatPercentage(result.dailyRate)}</p>
              </div>
              <div className="bg-gray-50 rounded-md p-3">
                <p className="text-xs text-gray-500">Days in Year</p>
                <p className="font-semibold">{result.daysInYear} days</p>
              </div>
              <div className="bg-gray-50 rounded-md p-3">
                <p className="text-xs text-gray-500">Interest Days</p>
                <p className="font-semibold">{result.days} days</p>
              </div>
              <div className="bg-gray-50 rounded-md p-3">
                <p className="text-xs text-gray-500">Calendar Type</p>
                <p className="font-semibold">{result.calendarType}</p>
              </div>
              <div className="bg-gray-50 rounded-md p-3">
                <p className="text-xs text-gray-500">Per Diem Method</p>
                <p className="font-semibold">{result.perDiemMethod === 'STABLE' ? 'Stable' : 'Variable'}</p>
              </div>
              {result.monthlyRate !== undefined && (
                <div className="bg-gray-50 rounded-md p-3">
                  <p className="text-xs text-gray-500">Monthly Rate</p>
                  <p className="font-semibold">{formatPercentage(result.monthlyRate)}</p>
                </div>
              )}
            </div>

            <div className="mt-4 p-3 bg-blue-50 rounded-md">
              <p className="text-xs text-blue-700">
                <strong>Calculation Formula:</strong><br />
                {result.perDiemMethod === 'STABLE' ? (
                  <>
                    Daily Interest = Principal × (Annual Rate ÷ {result.daysInYear})<br />
                    Total Interest = Daily Interest × {result.days} days
                  </>
                ) : (
                  <>
                    Monthly Rate = Annual Rate ÷ 12<br />
                    Daily Interest = Principal × (Monthly Rate ÷ Days in Month)<br />
                    Total Interest = Sum of daily interest for each day
                  </>
                )}
              </p>
            </div>

            {result.monthByMonthBreakdown && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Month-by-Month Breakdown</h4>
                <div className="bg-gray-50 rounded-md overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Days</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Daily Rate</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Interest</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {result.monthByMonthBreakdown.map((month, index) => (
                        <tr key={index}>
                          <td className="px-3 py-2 text-sm text-gray-900">{month.month}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 text-right">{month.days}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 text-right">{formatPercentage(month.dailyRate)}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 text-right">{formatCurrency(month.interest)}</td>
                        </tr>
                      ))}
                      <tr className="bg-gray-100 font-semibold">
                        <td className="px-3 py-2 text-sm text-gray-900">Total</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">{result.days}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">-</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">{formatCurrency(result.totalInterest)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result.calendarType === 'ACTUAL/360' && (
              <div className="mt-3 p-3 bg-amber-50 rounded-md">
                <p className="text-xs text-amber-700">
                  <strong>Note:</strong> Actual/360 calendar results in a higher effective rate 
                  because the annual rate is divided by 360 instead of 365 days.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};