import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  ArrowUpIcon,
  ArrowDownIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { format, subDays } from 'date-fns';
import { apiClient as api } from '../../services/api';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { clsx } from 'clsx';

interface MetricCard {
  title: string;
  value: string | number;
  icon: React.ComponentType<any>;
  change?: number;
  changeLabel?: string;
  color?: string;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export const AnalyticsDashboard: React.FC = () => {
  const { socket, subscribeToAnalytics, unsubscribeFromAnalytics } = useWebSocket();
  const [realtimeMetrics, setRealtimeMetrics] = useState<any>(null);

  // Fetch dashboard metrics
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: () => api.get('/analytics/dashboard').then(res => res.data.data),
  });

  // Fetch portfolio analysis
  const { data: portfolioData } = useQuery({
    queryKey: ['analytics', 'portfolio'],
    queryFn: () => api.get('/analytics/portfolio').then(res => res.data.data),
  });

  // Fetch performance metrics
  const { data: performanceData } = useQuery({
    queryKey: ['analytics', 'performance'],
    queryFn: () => api.get('/analytics/performance').then(res => res.data.data),
  });

  // Fetch revenue for last 30 days
  const { data: revenueData } = useQuery({
    queryKey: ['analytics', 'revenue'],
    queryFn: () => {
      const endDate = new Date();
      const startDate = subDays(endDate, 30);
      return api.get('/analytics/revenue', {
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      }).then(res => res.data.data);
    },
  });

  // Subscribe to real-time analytics
  useEffect(() => {
    if (socket?.connected) {
      subscribeToAnalytics(['dashboard', 'performance']);

      socket.on('analytics:update', (data: any) => {
        setRealtimeMetrics(data);
      });

      return () => {
        unsubscribeFromAnalytics();
        socket.off('analytics:update');
      };
    }
  }, [socket, subscribeToAnalytics, unsubscribeFromAnalytics]);

  const metrics = realtimeMetrics?.metrics || dashboardData;

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const metricCards: MetricCard[] = [
    {
      title: 'Total Loans',
      value: metrics?.totalLoans || 0,
      icon: ChartBarIcon,
      change: 12,
      changeLabel: 'from last month',
      color: 'blue',
    },
    {
      title: 'Total Disbursed',
      value: `$${Number(metrics?.totalDisbursed || 0).toLocaleString()}`,
      icon: CurrencyDollarIcon,
      change: 8,
      changeLabel: 'from last month',
      color: 'green',
    },
    {
      title: 'Outstanding Balance',
      value: `$${Number(metrics?.outstandingBalance || 0).toLocaleString()}`,
      icon: CurrencyDollarIcon,
      change: -3,
      changeLabel: 'from last month',
      color: 'yellow',
    },
    {
      title: 'Total Users',
      value: metrics?.totalUsers || 0,
      icon: UserGroupIcon,
      change: 15,
      changeLabel: 'new this month',
      color: 'purple',
    },
  ];

  // Prepare portfolio data for pie chart
  const portfolioChartData = portfolioData?.byStatus
    ? Object.entries(portfolioData.byStatus).map(([status, count]) => ({
        name: status,
        value: count,
      }))
    : [];

  // Mock data for revenue trend (in real app, fetch historical data)
  const revenueTrendData = Array.from({ length: 30 }, (_, i) => ({
    date: format(subDays(new Date(), 29 - i), 'MMM dd'),
    revenue: Math.floor(Math.random() * 5000) + 1000,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
        {realtimeMetrics && (
          <div className="flex items-center space-x-2">
            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-500">Real-time</span>
          </div>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((metric) => (
          <div
            key={metric.title}
            className="relative bg-white overflow-hidden shadow rounded-lg"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className={`flex-shrink-0 p-3 rounded-md bg-${metric.color}-100`}>
                  <metric.icon className={`h-6 w-6 text-${metric.color}-600`} />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {metric.title}
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {metric.value}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            {metric.change !== undefined && (
              <div className="bg-gray-50 px-5 py-3">
                <div className="text-sm">
                  <span
                    className={clsx(
                      'flex items-center',
                      metric.change > 0 ? 'text-green-600' : 'text-red-600'
                    )}
                  >
                    {metric.change > 0 ? (
                      <ArrowUpIcon className="h-4 w-4 mr-1" />
                    ) : (
                      <ArrowDownIcon className="h-4 w-4 mr-1" />
                    )}
                    {Math.abs(metric.change)}%
                    <span className="ml-2 text-gray-500">{metric.changeLabel}</span>
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Portfolio Distribution */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Loan Portfolio Distribution
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={portfolioChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {portfolioChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue Trend */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Revenue Trend (30 Days)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => `$${value}`} />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="bg-white shadow rounded-lg p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">
            Loan Performance
          </h4>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">
                On-time Payment Rate
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-gray-900">
                {performanceData?.onTimePaymentRate || 0}%
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">
                Delinquency Rate
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-red-600">
                {performanceData?.delinquencyRate || 0}%
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">
                Avg Days to First Payment
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-gray-900">
                {performanceData?.averageDaysToFirstPayment || 0}
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">
            Revenue Summary (30 Days)
          </h4>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">
                Total Revenue
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-green-600">
                ${Number(revenueData?.totalRevenue || 0).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">
                Interest Revenue
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-gray-900">
                ${Number(revenueData?.interestRevenue || 0).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">
                Fee Revenue
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-gray-900">
                ${Number(revenueData?.feeRevenue || 0).toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">
            Portfolio Risk
          </h4>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">
                At-Risk Value
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-yellow-600">
                ${Number(portfolioData?.atRiskValue || 0).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">
                At-Risk Percentage
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-gray-900">
                {portfolioData?.atRiskPercentage || 0}%
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">
                Default Rate
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-red-600">
                {metrics?.defaultRate || 0}%
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Export Actions */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Export Analytics</h3>
          <div className="flex space-x-4">
            <button
              onClick={() => {
                // Export as CSV
                api.post('/analytics/export', { format: 'csv' }, {
                  params: { type: 'dashboard' },
                  responseType: 'blob',
                }).then(response => {
                  const url = window.URL.createObjectURL(new Blob([response.data]));
                  const link = document.createElement('a');
                  link.href = url;
                  link.setAttribute('download', `analytics-dashboard-${Date.now()}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                });
              }}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Export CSV
            </button>
            <button
              onClick={() => {
                // Export as JSON
                api.post('/analytics/export', { format: 'json' }, {
                  params: { type: 'dashboard' },
                  responseType: 'blob',
                }).then(response => {
                  const url = window.URL.createObjectURL(new Blob([response.data]));
                  const link = document.createElement('a');
                  link.href = url;
                  link.setAttribute('download', `analytics-dashboard-${Date.now()}.json`);
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                });
              }}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Export JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};