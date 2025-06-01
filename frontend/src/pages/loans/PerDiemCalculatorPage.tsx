import { PerDiemCalculator } from '../../components/loans/PerDiemCalculator';

export const PerDiemCalculatorPage = () => {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Per Diem Interest Calculator</h1>
        <p className="mt-1 text-sm text-gray-500">
          Calculate daily interest charges for short-term periods or payoff amounts
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <PerDiemCalculator />
        
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Common Use Cases</h3>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700">Closing to First Payment</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Calculate interest from loan closing date to the first regular payment date.
                  This is typically collected at closing as "prepaid interest."
                </p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-700">Payoff Calculations</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Determine exact interest owed from the last payment date to the payoff date
                  for accurate loan payoff quotes.
                </p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-700">Construction Loans</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Calculate interest on draws during the construction phase when only interest
                  payments are required.
                </p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-700">Bridge Financing</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Short-term loans often use per diem interest for flexibility in payoff timing.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Calendar Type Comparison</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Calendar
                    </th>
                    <th className="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Days/Year
                    </th>
                    <th className="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Daily Rate*
                    </th>
                    <th className="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Use Case
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      30/360
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      360
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      0.01528%
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      Corporate bonds, commercial loans
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      Actual/365
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      365
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      0.01507%
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      Consumer loans, mortgages
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      Actual/360
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      360
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      0.01528%
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      Money market, short-term loans
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-2 text-xs text-gray-500">
                * Daily rate shown for 5.5% annual rate
              </p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-amber-800">
                  Important Considerations
                </h3>
                <div className="mt-2 text-sm text-amber-700">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Different calendar conventions can result in different interest amounts</li>
                    <li>Always verify which calendar type is specified in the loan agreement</li>
                    <li>Some states have specific requirements for interest calculation methods</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};