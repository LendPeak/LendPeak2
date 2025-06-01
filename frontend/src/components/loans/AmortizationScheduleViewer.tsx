import { useState } from 'react';
import { format } from 'date-fns';
import { ArrowDownTrayIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { LoanEngine } from '@lendpeak/engine';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface AmortizationScheduleViewerProps {
  loan: any;
}

export const AmortizationScheduleViewer = ({ loan }: AmortizationScheduleViewerProps) => {
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  const [showAll, setShowAll] = useState(false);

  // Calculate amortization schedule using stateless LoanEngine
  const loanTerms = LoanEngine.createLoan(
    loan.loanParameters.principal,
    loan.loanParameters.interestRate,
    loan.loanParameters.termMonths,
    loan.loanParameters.startDate,
    {
      paymentFrequency: 'monthly',
      interestType: 'amortized',
    }
  );
  const schedule = LoanEngine.generateSchedule(loanTerms);
  const paymentResult = LoanEngine.calculatePayment(loanTerms);
  const paymentSchedule = schedule.payments.map((payment, index) => ({
    paymentNumber: index + 1,
    dueDate: payment.dueDate.toDate(),
    principal: payment.principal?.toNumber() || 0,
    interest: payment.interest?.toNumber() || 0,
    remainingBalance: payment.remainingBalance?.toNumber() || 0,
  }));
  
  // Calculate totals
  const totalInterest = paymentSchedule.reduce((sum, payment) => sum + payment.interest, 0);
  const totalPayment = paymentSchedule.reduce((sum, payment) => sum + payment.principal + payment.interest, 0);

  const displayedSchedule = showAll ? paymentSchedule : paymentSchedule.slice(0, 12);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const exportToCSV = () => {
    const headers = ['Payment #', 'Date', 'Payment', 'Principal', 'Interest', 'Balance'];
    const rows = paymentSchedule.map((payment) => [
      payment.paymentNumber,
      format(payment.dueDate, 'yyyy-MM-dd'),
      (payment.principal + payment.interest).toFixed(2),
      payment.principal.toFixed(2),
      payment.interest.toFixed(2),
      payment.remainingBalance.toFixed(2),
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loan-${loan.id}-amortization-schedule.csv`;
    a.click();
  };

  const chartData = paymentSchedule.slice(0, 60).map((payment) => ({
    month: payment.paymentNumber,
    principal: payment.principal,
    interest: payment.interest,
    balance: payment.remainingBalance,
  }));

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Amortization Schedule</h3>
            <p className="mt-1 text-sm text-gray-500">
              Monthly payment: {formatCurrency(paymentResult.monthlyPayment.toNumber())} for {schedule.payments.length} months
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode(viewMode === 'table' ? 'chart' : 'table')}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <ChartBarIcon className="h-4 w-4 mr-2" />
              {viewMode === 'table' ? 'View Chart' : 'View Table'}
            </button>
            <button
              onClick={exportToCSV}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              Export
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'table' ? (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Principal
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Interest
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayedSchedule.map((payment) => (
                  <tr key={payment.paymentNumber} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.paymentNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(payment.dueDate, 'MMM yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(payment.principal + payment.interest)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(payment.principal)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(payment.interest)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(payment.remainingBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {schedule.payments.length > 12 && (
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
              <button
                onClick={() => setShowAll(!showAll)}
                className="text-sm text-primary-600 hover:text-primary-500"
              >
                {showAll
                  ? 'Show first 12 months'
                  : `Show all ${paymentSchedule.length} payments`}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="p-6">
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  label={{ value: 'Payment Number', position: 'insideBottom', offset: -5 }}
                />
                <YAxis
                  label={{ value: 'Amount ($)', angle: -90, position: 'insideLeft' }}
                  tickFormatter={(value) => `$${value.toLocaleString()}`}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label) => `Payment #${label}`}
                />
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
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke="#10b981"
                  name="Balance"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 text-center text-sm text-gray-500">
            Showing first 60 months of {schedule.payments.length} total payments
          </div>
        </div>
      )}

      {/* Summary Statistics */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <dt className="text-sm font-medium text-gray-500">Total of Payments</dt>
            <dd className="mt-1 text-sm font-semibold text-gray-900">
              {formatCurrency(totalPayment)}
            </dd>
          </div>
          <div className="sm:col-span-1">
            <dt className="text-sm font-medium text-gray-500">Total Interest</dt>
            <dd className="mt-1 text-sm font-semibold text-gray-900">
              {formatCurrency(totalInterest)}
            </dd>
          </div>
          <div className="sm:col-span-1">
            <dt className="text-sm font-medium text-gray-500">Interest as % of Principal</dt>
            <dd className="mt-1 text-sm font-semibold text-gray-900">
              {((totalInterest / loan.loanParameters.principal) * 100).toFixed(2)}%
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
};