import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../services/api';
import { WaterfallStep } from './PaymentWaterfallBuilder';
import { CalculatorIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface WaterfallTesterProps {
  waterfallSteps: WaterfallStep[];
}

export const PaymentWaterfallTester: React.FC<WaterfallTesterProps> = ({ waterfallSteps }) => {
  const [testPayment, setTestPayment] = useState(1000);
  const [outstandingAmounts, setOutstandingAmounts] = useState({
    interest: 500,
    principal: 100000,
    fees: 50,
    penalties: 25,
    escrow: 300,
  });
  const [showTest, setShowTest] = useState(false);
  
  const testQuery = useQuery({
    queryKey: ['waterfall-test', testPayment, outstandingAmounts, waterfallSteps],
    queryFn: () => apiClient.applyWaterfall({
      payment: testPayment.toString(),
      outstandingAmounts: {
        interest: outstandingAmounts.interest.toString(),
        principal: outstandingAmounts.principal.toString(),
        fees: outstandingAmounts.fees.toString(),
        penalties: outstandingAmounts.penalties.toString(),
        escrow: outstandingAmounts.escrow.toString(),
      },
      waterfallConfig: waterfallSteps,
    }),
    enabled: showTest && waterfallSteps.length > 0,
  });

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  const calculatePercentage = (applied: string, total: number) => {
    const appliedNum = parseFloat(applied);
    if (total === 0) return 0;
    return (appliedNum / total) * 100;
  };

  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-gray-900">Test Payment Waterfall</h4>
        <button
          type="button"
          onClick={() => setShowTest(!showTest)}
          className="text-sm text-primary-600 hover:text-primary-700"
        >
          {showTest ? 'Hide' : 'Show'} Tester
        </button>
      </div>

      {showTest && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Test Payment Amount
              </label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  value={testPayment}
                  onChange={(e) => setTestPayment(Number(e.target.value))}
                  className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Outstanding Amounts
              </label>
              <div className="space-y-2">
                {Object.entries(outstandingAmounts).map(([key, value]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <label className="text-xs text-gray-500 w-16 capitalize">{key}:</label>
                    <div className="relative rounded-md shadow-sm flex-1">
                      <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                        <span className="text-gray-500 text-xs">$</span>
                      </div>
                      <input
                        type="number"
                        value={value}
                        onChange={(e) => setOutstandingAmounts({
                          ...outstandingAmounts,
                          [key]: Number(e.target.value),
                        })}
                        className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-6 pr-2 py-1 text-xs border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => testQuery.refetch()}
            disabled={testQuery.isFetching || waterfallSteps.length === 0}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <CalculatorIcon className="h-4 w-4 mr-2" />
            Calculate Allocation
          </button>

          {testQuery.data && (
            <div className="mt-4 space-y-4">
              <div className="bg-white p-4 rounded-md border border-gray-200">
                <h5 className="text-sm font-medium text-gray-900 mb-3">Payment Allocation Results</h5>
                
                <div className="space-y-3">
                  {Object.entries(testQuery.data.appliedAmounts).map(([category, amount]) => {
                    const applied = parseFloat(amount);
                    const outstanding = outstandingAmounts[category as keyof typeof outstandingAmounts];
                    const percentage = calculatePercentage(amount, testPayment);
                    
                    return applied > 0 ? (
                      <div key={category} className="flex items-center">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-700 capitalize">{category}</span>
                            <span className="text-xs text-gray-500">
                              {formatCurrency(applied)} of {formatCurrency(outstanding)}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-primary-600 h-2 rounded-full"
                              style={{ width: `${Math.min((applied / outstanding) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                        <ChevronRightIcon className="h-4 w-4 text-gray-400 mx-2" />
                        <span className="text-xs font-medium text-gray-900 w-12 text-right">
                          {percentage.toFixed(0)}%
                        </span>
                      </div>
                    ) : null;
                  })}
                </div>

                {parseFloat(testQuery.data.remainingPayment) > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-700">Remaining Payment</span>
                      <span className="text-xs font-medium text-green-600">
                        {formatCurrency(testQuery.data.remainingPayment)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-xs text-gray-500">
                <p>Payment Flow Visualization:</p>
                <div className="mt-2 flex items-center flex-wrap gap-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100">
                    Payment: {formatCurrency(testPayment)}
                  </span>
                  {Object.entries(testQuery.data.appliedAmounts).map(([category, amount], idx) => {
                    const applied = parseFloat(amount);
                    return applied > 0 ? (
                      <React.Fragment key={category}>
                        <ChevronRightIcon className="h-3 w-3 text-gray-400" />
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary-100 text-primary-800">
                          {category}: {formatCurrency(applied)}
                        </span>
                      </React.Fragment>
                    ) : null;
                  })}
                  {parseFloat(testQuery.data.remainingPayment) > 0 && (
                    <>
                      <ChevronRightIcon className="h-3 w-3 text-gray-400" />
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-green-100 text-green-800">
                        Prepayment: {formatCurrency(testQuery.data.remainingPayment)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};