import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

interface PaymentAllocation {
  principal: number;
  interest: number;
  fees: number;
  penalties: number;
  escrow: number;
  total: number;
}

interface PaymentAllocationVisualizerProps {
  allocation: PaymentAllocation;
  waterfallSteps?: Array<{ category: string; percentage: number }>;
  paymentNumber?: number;
  paymentDate?: Date;
}

const CATEGORY_COLORS = {
  principal: '#3b82f6',
  interest: '#ef4444',
  fees: '#f59e0b',
  penalties: '#f97316',
  escrow: '#10b981',
};

const CATEGORY_LABELS = {
  principal: 'Principal',
  interest: 'Interest',
  fees: 'Fees',
  penalties: 'Penalties',
  escrow: 'Escrow',
};

export const PaymentAllocationVisualizer: React.FC<PaymentAllocationVisualizerProps> = ({
  allocation,
  waterfallSteps,
  paymentNumber,
  paymentDate,
}) => {
  const [viewMode, setViewMode] = useState<'pie' | 'bar' | 'waterfall'>('pie');
  const [showDetails, setShowDetails] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatPercentage = (value: number, total: number) => {
    if (total === 0) return '0%';
    return `${((value / total) * 100).toFixed(1)}%`;
  };

  // Prepare data for charts
  const pieData = Object.entries(allocation)
    .filter(([key, value]) => key !== 'total' && value > 0)
    .map(([key, value]) => ({
      name: CATEGORY_LABELS[key as keyof typeof CATEGORY_LABELS],
      value,
      key,
    }));

  const barData = Object.entries(allocation)
    .filter(([key]) => key !== 'total')
    .map(([key, value]) => ({
      category: CATEGORY_LABELS[key as keyof typeof CATEGORY_LABELS],
      amount: value,
      key,
    }));

  // Waterfall data calculation
  const waterfallData = waterfallSteps?.map((step, index) => {
    const category = step.category as keyof Omit<typeof allocation, 'total'>;
    const allocated = category === 'total' ? 0 : allocation[category] || 0;
    const cumulative = waterfallSteps
      .slice(0, index + 1)
      .reduce((sum, s) => {
        const cat = s.category as keyof Omit<typeof allocation, 'total'>;
        return sum + (cat === 'total' ? 0 : allocation[cat] || 0);
      }, 0);
    
    return {
      name: CATEGORY_LABELS[category],
      allocated,
      cumulative,
      percentage: step.percentage,
    };
  }) || [];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-white p-3 shadow-lg rounded-md border border-gray-200">
          <p className="text-sm font-medium">{data.name || data.payload.name}</p>
          <p className="text-sm text-gray-600">
            {formatCurrency(data.value || data.payload.allocated)}
          </p>
          <p className="text-xs text-gray-500">
            {formatPercentage(data.value || data.payload.allocated, allocation.total)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Payment Allocation</h3>
          {(paymentNumber || paymentDate) && (
            <p className="text-sm text-gray-500">
              {paymentNumber && `Payment #${paymentNumber}`}
              {paymentNumber && paymentDate && ' - '}
              {paymentDate && new Date(paymentDate).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setViewMode('pie')}
            className={`px-3 py-1 text-sm rounded-md ${
              viewMode === 'pie'
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Pie
          </button>
          <button
            type="button"
            onClick={() => setViewMode('bar')}
            className={`px-3 py-1 text-sm rounded-md ${
              viewMode === 'bar'
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Bar
          </button>
          {waterfallSteps && (
            <button
              type="button"
              onClick={() => setViewMode('waterfall')}
              className={`px-3 py-1 text-sm rounded-md ${
                viewMode === 'waterfall'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Waterfall
            </button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-md">
          <span className="text-sm font-medium text-gray-700">Total Payment</span>
          <span className="text-lg font-semibold text-gray-900">
            {formatCurrency(allocation.total)}
          </span>
        </div>
      </div>

      <div className="h-64 mb-4">
        {viewMode === 'pie' && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={CATEGORY_COLORS[entry.key as keyof typeof CATEGORY_COLORS]} 
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                formatter={(value) => <span className="text-sm">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}

        {viewMode === 'bar' && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="category" 
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="amount" fill="#3b82f6">
                {barData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={CATEGORY_COLORS[entry.key as keyof typeof CATEGORY_COLORS]} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {viewMode === 'waterfall' && waterfallSteps && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={waterfallData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="cumulative" fill="#e5e7eb" />
              <Bar dataKey="allocated" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
      >
        <span>Allocation Details</span>
        {showDetails ? (
          <ChevronUpIcon className="h-4 w-4" />
        ) : (
          <ChevronDownIcon className="h-4 w-4" />
        )}
      </button>

      {showDetails && (
        <div className="mt-4 space-y-3">
          {Object.entries(allocation)
            .filter(([key]) => key !== 'total')
            .map(([key, value]) => {
              const percentage = (value / allocation.total) * 100;
              return (
                <div key={key} className="flex items-center">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 capitalize">
                        {CATEGORY_LABELS[key as keyof typeof CATEGORY_LABELS]}
                      </span>
                      <span className="text-sm text-gray-900">
                        {formatCurrency(value)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: CATEGORY_COLORS[key as keyof typeof CATEGORY_COLORS],
                        }}
                      />
                    </div>
                  </div>
                  <span className="ml-3 text-xs text-gray-500 w-12 text-right">
                    {percentage.toFixed(1)}%
                  </span>
                </div>
              );
            })}
        </div>
      )}

      {waterfallSteps && viewMode === 'waterfall' && (
        <div className="mt-4 p-3 bg-blue-50 rounded-md">
          <p className="text-xs text-blue-700">
            <strong>Waterfall View:</strong> Shows how the payment flows through each category
            in order. Gray bars show cumulative allocation, blue bars show amount allocated to each category.
          </p>
        </div>
      )}
    </div>
  );
};