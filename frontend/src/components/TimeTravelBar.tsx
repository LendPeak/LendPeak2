import { useState } from 'react';
import { useTimeTravel } from '../contexts/TimeTravelContext';
import { 
  CalendarDaysIcon, 
  ClockIcon, 
  XMarkIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import DatePicker from 'react-datepicker';
import { format, subDays, subMonths, endOfMonth, endOfQuarter, endOfYear } from 'date-fns';
import clsx from 'clsx';

export const TimeTravelBar = () => {
  const { asOfDate, isTimeTravelActive, mode, setAsOfDate, resetToPresent } = useTimeTravel();
  const [showPresets, setShowPresets] = useState(false);

  const presets = [
    { label: 'Yesterday', date: subDays(new Date(), 1) },
    { label: 'Last Week', date: subDays(new Date(), 7) },
    { label: 'Last Month', date: subMonths(new Date(), 1) },
    { label: 'Last Month End', date: endOfMonth(subMonths(new Date(), 1)) },
    { label: 'Last Quarter End', date: endOfQuarter(subMonths(new Date(), 3)) },
    { label: 'Last Year End', date: endOfYear(subMonths(new Date(), 12)) },
  ];

  if (!isTimeTravelActive) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[60] bg-white border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 min-w-0">
                <CalendarDaysIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-700 whitespace-nowrap">As of:</span>
                <DatePicker
                  selected={asOfDate}
                  onChange={(date) => setAsOfDate(date)}
                  dateFormat="MMM d, yyyy"
                  className="text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 min-w-[120px]"
                  placeholderText="Current"
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                  maxDate={new Date(new Date().setFullYear(new Date().getFullYear() + 5))}
                />
              </div>
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setShowPresets(!showPresets)}
                  className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded text-gray-600 bg-white hover:bg-gray-50"
                >
                  Quick
                  <ChevronDownIcon className="ml-1 h-3 w-3" />
                </button>
                {showPresets && (
                  <div className="absolute top-full mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                    {presets.map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => {
                          setAsOfDate(preset.date);
                          setShowPresets(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        {preset.label}
                        <span className="block text-xs text-gray-500">
                          {format(preset.date, 'MMM d, yyyy')}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="text-xs text-gray-500 hidden sm:block">
              Current view
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Time Travel Active State
  return (
    <div className={clsx(
      "fixed top-0 left-0 right-0 z-[60] shadow-md",
      mode === 'HISTORICAL' && "bg-amber-50 border-b-2 border-amber-300",
      mode === 'FUTURE' && "bg-blue-50 border-b-2 border-blue-300",
      mode === 'CURRENT' && "bg-gray-50 border-b-2 border-gray-300"
    )}>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div className={clsx(
              "flex items-center space-x-2 px-2 py-1 rounded-full flex-shrink-0",
              mode === 'HISTORICAL' && "bg-amber-100 text-amber-800",
              mode === 'FUTURE' && "bg-blue-100 text-blue-800",
              mode === 'CURRENT' && "bg-gray-100 text-gray-800"
            )}>
              <ClockIcon className="h-4 w-4" />
              <span className="text-xs font-semibold hidden sm:inline">
                {mode === 'HISTORICAL' && 'Historical'}
                {mode === 'FUTURE' && 'Future'}
                {mode === 'CURRENT' && 'Current'}
              </span>
            </div>
            
            <div className="flex items-center space-x-2 min-w-0">
              <span className="text-sm font-medium text-gray-700 whitespace-nowrap">As of:</span>
              <DatePicker
                selected={asOfDate}
                onChange={(date) => setAsOfDate(date)}
                dateFormat="MMM d, yyyy"
                className={clsx(
                  "text-sm font-semibold rounded-md px-2 py-1 min-w-[120px]",
                  mode === 'HISTORICAL' && "bg-amber-100 border-amber-300 text-amber-900",
                  mode === 'FUTURE' && "bg-blue-100 border-blue-300 text-blue-900",
                  mode === 'CURRENT' && "bg-gray-100 border-gray-300 text-gray-900"
                )}
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
                maxDate={new Date(new Date().setFullYear(new Date().getFullYear() + 5))}
              />
            </div>

            {mode === 'HISTORICAL' && (
              <div className="flex items-center space-x-1 text-amber-700 hidden lg:flex">
                <ExclamationTriangleIcon className="h-4 w-4" />
                <span className="text-xs whitespace-nowrap">Data filtered</span>
              </div>
            )}

            {mode === 'FUTURE' && (
              <div className="flex items-center space-x-1 text-blue-700 hidden lg:flex">
                <ExclamationTriangleIcon className="h-4 w-4" />
                <span className="text-xs whitespace-nowrap">Projected</span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={resetToPresent}
              className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-700"
            >
              <ArrowPathIcon className="h-4 w-4 mr-1" />
              Return to Present
            </button>
            <button
              onClick={() => setAsOfDate(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Visual indicator bar */}
      <div className={clsx(
        "h-1",
        mode === 'HISTORICAL' && "bg-gradient-to-r from-amber-400 to-amber-600",
        mode === 'FUTURE' && "bg-gradient-to-r from-blue-400 to-blue-600",
        mode === 'CURRENT' && "bg-gradient-to-r from-gray-400 to-gray-600"
      )} />
    </div>
  );
};