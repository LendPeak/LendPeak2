import { useState } from 'react';
import { InformationCircleIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';

export interface BlendedPeriod {
  id: string;
  startDate: Date;
  endDate: Date | null;
  mode: 'amortization' | 'dsi';
  trigger: 'date' | 'balance' | 'payment' | 'manual';
  triggerValue?: string;
}

interface BlendedLoanConfiguratorProps {
  loanStartDate: Date;
  loanEndDate: Date;
  value: BlendedPeriod[];
  onChange: (periods: BlendedPeriod[]) => void;
  disabled?: boolean;
}

const MODE_LABELS = {
  amortization: 'Amortization',
  dsi: 'Daily Simple Interest (DSI)',
};

const TRIGGER_LABELS = {
  date: 'Specific Date',
  balance: 'Balance Threshold',
  payment: 'Payment Number',
  manual: 'Manual Switch',
};

const TRIGGER_DESCRIPTIONS = {
  date: 'Switch modes on a specific date',
  balance: 'Switch when balance reaches a certain amount',
  payment: 'Switch after a specific number of payments',
  manual: 'Switch will be triggered manually',
};

export const BlendedLoanConfigurator: React.FC<BlendedLoanConfiguratorProps> = ({
  loanStartDate,
  loanEndDate,
  value = [],
  onChange,
  disabled = false,
}) => {
  const [showInfo, setShowInfo] = useState(false);

  const handleAddPeriod = () => {
    const lastPeriod = value[value.length - 1];
    const newPeriod: BlendedPeriod = {
      id: Date.now().toString(),
      startDate: lastPeriod?.endDate || loanStartDate,
      endDate: null,
      mode: lastPeriod?.mode === 'amortization' ? 'dsi' : 'amortization',
      trigger: 'date',
    };
    onChange([...value, newPeriod]);
  };

  const handleUpdatePeriod = (id: string, updates: Partial<BlendedPeriod>) => {
    const updatedPeriods = value.map((period, index) => {
      if (period.id === id) {
        const updated = { ...period, ...updates };
        
        // Update subsequent periods' start dates if end date changed
        if (updates.endDate && index < value.length - 1) {
          const nextPeriods = value.slice(index + 1);
          nextPeriods[0] = { ...nextPeriods[0], startDate: updates.endDate };
        }
        
        return updated;
      }
      return period;
    });
    
    onChange(updatedPeriods);
  };

  const handleRemovePeriod = (id: string) => {
    const index = value.findIndex(p => p.id === id);
    if (index === 0) return; // Don't remove the first period
    
    const filteredPeriods = value.filter(p => p.id !== id);
    
    // Update the start date of the next period if needed
    if (index < filteredPeriods.length) {
      filteredPeriods[index].startDate = filteredPeriods[index - 1]?.endDate || loanStartDate;
    }
    
    onChange(filteredPeriods);
  };

  // Initialize with default period if empty
  if (value.length === 0) {
    const defaultPeriod: BlendedPeriod = {
      id: '1',
      startDate: loanStartDate,
      endDate: null,
      mode: 'amortization',
      trigger: 'manual',
    };
    onChange([defaultPeriod]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Blended Loan Configuration</h3>
        <button
          type="button"
          onClick={() => setShowInfo(!showInfo)}
          className="text-gray-400 hover:text-gray-600"
        >
          <InformationCircleIcon className="h-5 w-5" />
        </button>
      </div>

      {showInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">About Blended Loans</h4>
          <p className="text-sm text-blue-700 mb-2">
            Blended loans allow you to switch between different calculation modes during the life of the loan.
            This is useful for scenarios like:
          </p>
          <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
            <li>Interest-only periods followed by amortization</li>
            <li>Variable rate periods with different calculation methods</li>
            <li>Construction loans that convert to permanent financing</li>
          </ul>
        </div>
      )}

      <div className="space-y-3">
        {value.map((period, index) => (
          <div key={period.id} className="bg-white border rounded-lg p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-900">
                Period {index + 1}
                {index === 0 && ' (Initial)'}
                {index === value.length - 1 && period.endDate === null && ' (Final)'}
              </h4>
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => handleRemovePeriod(period.id)}
                  disabled={disabled}
                  className="text-red-400 hover:text-red-600"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Calculation Mode
                </label>
                <select
                  value={period.mode}
                  onChange={(e) => handleUpdatePeriod(period.id, { mode: e.target.value as 'amortization' | 'dsi' })}
                  disabled={disabled}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                >
                  {Object.entries(MODE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Start Date
                </label>
                <input
                  type="date"
                  value={format(period.startDate, 'yyyy-MM-dd')}
                  disabled={true} // Start dates are managed automatically
                  className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md bg-gray-50"
                />
              </div>

              {index < value.length - 1 && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Switch Trigger
                    </label>
                    <select
                      value={period.trigger}
                      onChange={(e) => handleUpdatePeriod(period.id, { trigger: e.target.value as BlendedPeriod['trigger'] })}
                      disabled={disabled}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                    >
                      {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      {TRIGGER_DESCRIPTIONS[period.trigger]}
                    </p>
                  </div>

                  <div>
                    {period.trigger === 'date' && (
                      <>
                        <label className="block text-sm font-medium text-gray-700">
                          Switch Date
                        </label>
                        <input
                          type="date"
                          value={period.endDate ? format(period.endDate, 'yyyy-MM-dd') : ''}
                          onChange={(e) => handleUpdatePeriod(period.id, { 
                            endDate: e.target.value ? new Date(e.target.value) : null,
                            triggerValue: e.target.value 
                          })}
                          disabled={disabled}
                          min={format(period.startDate, 'yyyy-MM-dd')}
                          max={format(loanEndDate, 'yyyy-MM-dd')}
                          className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        />
                      </>
                    )}
                    
                    {period.trigger === 'balance' && (
                      <>
                        <label className="block text-sm font-medium text-gray-700">
                          Balance Threshold
                        </label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">$</span>
                          </div>
                          <input
                            type="number"
                            value={period.triggerValue || ''}
                            onChange={(e) => handleUpdatePeriod(period.id, { triggerValue: e.target.value })}
                            disabled={disabled}
                            className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                            placeholder="50,000"
                          />
                        </div>
                      </>
                    )}
                    
                    {period.trigger === 'payment' && (
                      <>
                        <label className="block text-sm font-medium text-gray-700">
                          Payment Number
                        </label>
                        <input
                          type="number"
                          value={period.triggerValue || ''}
                          onChange={(e) => handleUpdatePeriod(period.id, { triggerValue: e.target.value })}
                          disabled={disabled}
                          className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          placeholder="60"
                        />
                      </>
                    )}
                    
                    {period.trigger === 'manual' && (
                      <p className="text-sm text-gray-500 mt-2">
                        Mode will be switched manually by loan servicer
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            {index === value.length - 1 && period.endDate === null && (
              <p className="mt-2 text-xs text-gray-500">
                This period continues until loan maturity
              </p>
            )}
          </div>
        ))}
      </div>

      {value.length < 5 && value[value.length - 1]?.endDate !== null && (
        <button
          type="button"
          onClick={handleAddPeriod}
          disabled={disabled}
          className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Add Period
        </button>
      )}

      {value.length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 rounded-md">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Timeline Preview</h4>
          <div className="space-y-2">
            {value.map((period) => (
              <div key={period.id} className="flex items-center text-sm">
                <span className="text-gray-500 w-24">
                  {format(period.startDate, 'MMM yyyy')}
                </span>
                <span className="mx-2">→</span>
                <span className={`flex-1 px-2 py-1 rounded text-xs font-medium ${
                  period.mode === 'amortization' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-green-100 text-green-800'
                }`}>
                  {MODE_LABELS[period.mode]}
                </span>
                {period.endDate && (
                  <>
                    <span className="mx-2">→</span>
                    <span className="text-gray-500 w-24 text-right">
                      {format(period.endDate, 'MMM yyyy')}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};