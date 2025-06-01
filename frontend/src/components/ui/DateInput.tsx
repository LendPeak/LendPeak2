import React, { forwardRef } from 'react';
import DatePicker from 'react-datepicker';
import { CalendarIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import 'react-datepicker/dist/react-datepicker.css';

interface DateInputProps {
  value?: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  required?: boolean;
  showMonthYearPicker?: boolean;
  dateFormat?: string;
  className?: string;
}

const CustomInput = forwardRef<HTMLDivElement, any>(
  ({ value, onClick, placeholder, disabled, error }, ref) => (
    <div ref={ref} className="relative">
      <div
        onClick={disabled ? undefined : onClick}
        className={`
          relative w-full px-3 py-2 pr-10 text-left bg-white border rounded-lg shadow-sm cursor-pointer
          transition-all duration-150
          ${disabled 
            ? 'bg-gray-50 text-gray-500 cursor-not-allowed border-gray-200' 
            : 'hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900'
          }
          ${error ? 'border-red-300' : 'border-gray-300'}
        `}
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>
          {value ? format(new Date(value), 'MMM dd, yyyy') : placeholder}
        </span>
        <CalendarIcon className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
      </div>
    </div>
  )
);

CustomInput.displayName = 'CustomInput';

export const DateInput: React.FC<DateInputProps> = ({
  value,
  onChange,
  placeholder = 'Select date',
  label,
  error,
  minDate,
  maxDate,
  disabled = false,
  required = false,
  showMonthYearPicker = false,
  dateFormat = 'MM/dd/yyyy',
  className = '',
}) => {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <DatePicker
        selected={value}
        onChange={onChange}
        customInput={<CustomInput error={error} />}
        dateFormat={dateFormat}
        placeholderText={placeholder}
        disabled={disabled}
        minDate={minDate}
        maxDate={maxDate}
        showMonthDropdown={!showMonthYearPicker}
        showYearDropdown={!showMonthYearPicker}
        showMonthYearPicker={showMonthYearPicker}
        dropdownMode="select"
        popperClassName="react-datepicker-popper"
        popperPlacement="bottom-start"
        popperModifiers={[
          {
            name: 'offset',
            options: {
              offset: [0, 4],
            },
          },
          {
            name: 'preventOverflow',
            options: {
              boundary: 'viewport',
            },
          },
        ]}
      />
      
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};