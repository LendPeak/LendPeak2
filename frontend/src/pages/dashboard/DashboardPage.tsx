import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpIcon,
  ArrowDownIcon,
  BanknotesIcon,
  UsersIcon,
  CurrencyDollarIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import apiClient from '../../services/api';
import { useAuth } from '../../store/auth-context';
import { useTimeTravel } from '../../contexts/TimeTravelContext';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export const DashboardPage = () => {
  const { user } = useAuth();
  const { asOfDate } = useTimeTravel();

  const { data: loanStats } = useQuery({
    queryKey: ['loanStatistics', asOfDate?.toISOString()],
    queryFn: () => apiClient.getLoanStatistics(asOfDate?.toISOString()),
  });

  const { data: userStats } = useQuery({
    queryKey: ['userStatistics'],
    queryFn: () => apiClient.getUserStatistics(),
    enabled: user?.roles.some(role => ['ADMIN', 'SUPER_ADMIN'].includes(role)) || false,
  });

  const stats = [
    {
      id: 1,
      name: 'Total Portfolio',
      stat: loanStats ? `$${Number(loanStats.totalPortfolioValue).toLocaleString()}` : '-',
      icon: CurrencyDollarIcon,
      change: '12%',
      changeType: 'increase',
    },
    {
      id: 2,
      name: 'Active Loans',
      stat: loanStats?.activeLoans || '-',
      icon: BanknotesIcon,
      change: '5.4%',
      changeType: 'increase',
    },
    {
      id: 3,
      name: 'Delinquent Loans',
      stat: loanStats?.delinquentLoans || '-',
      icon: ClockIcon,
      change: '3.2%',
      changeType: 'decrease',
    },
    {
      id: 4,
      name: 'Total Users',
      stat: userStats?.totalUsers || '-',
      icon: UsersIcon,
      change: '8',
      changeType: 'increase',
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          Welcome back, {user?.firstName}!
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Here's what's happening with your loan portfolio today.
        </p>
      </div>

      <div>
        <h3 className="text-lg font-medium leading-6 text-gray-900">Overview</h3>
        <dl className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((item) => (
            <div
              key={item.id}
              className="relative overflow-hidden rounded-lg bg-white px-4 pt-5 pb-12 shadow sm:px-6 sm:pt-6"
            >
              <dt>
                <div className="absolute rounded-md bg-primary-500 p-3">
                  <item.icon className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                <p className="ml-16 truncate text-sm font-medium text-gray-500">
                  {item.name}
                </p>
              </dt>
              <dd className="ml-16 flex items-baseline pb-6 sm:pb-7">
                <p className="text-2xl font-semibold text-gray-900">{item.stat}</p>
                <p
                  className={classNames(
                    item.changeType === 'increase' ? 'text-green-600' : 'text-red-600',
                    'ml-2 flex items-baseline text-sm font-semibold'
                  )}
                >
                  {item.changeType === 'increase' ? (
                    <ArrowUpIcon
                      className="h-5 w-5 flex-shrink-0 self-center text-green-500"
                      aria-hidden="true"
                    />
                  ) : (
                    <ArrowDownIcon
                      className="h-5 w-5 flex-shrink-0 self-center text-red-500"
                      aria-hidden="true"
                    />
                  )}
                  <span className="sr-only">
                    {' '}
                    {item.changeType === 'increase' ? 'Increased' : 'Decreased'} by{' '}
                  </span>
                  {item.change}
                </p>
                <div className="absolute inset-x-0 bottom-0 bg-gray-50 px-4 py-4 sm:px-6">
                  <div className="text-sm">
                    <a
                      href="#"
                      className="font-medium text-primary-600 hover:text-primary-500"
                    >
                      View all<span className="sr-only"> {item.name} stats</span>
                    </a>
                  </div>
                </div>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-medium leading-6 text-gray-900">Recent Activity</h3>
        <div className="mt-5 bg-white shadow overflow-hidden sm:rounded-md">
          <ul role="list" className="divide-y divide-gray-200">
            <li>
              <div className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-primary-600 truncate">
                    New loan application
                  </p>
                  <div className="ml-2 flex-shrink-0 flex">
                    <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      Pending Review
                    </p>
                  </div>
                </div>
                <div className="mt-2 sm:flex sm:justify-between">
                  <div className="sm:flex">
                    <p className="flex items-center text-sm text-gray-500">
                      John Doe - $50,000 - 30-year fixed
                    </p>
                  </div>
                  <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                    <p>5 minutes ago</p>
                  </div>
                </div>
              </div>
            </li>
            <li>
              <div className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-primary-600 truncate">
                    Payment received
                  </p>
                  <div className="ml-2 flex-shrink-0 flex">
                    <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      Processed
                    </p>
                  </div>
                </div>
                <div className="mt-2 sm:flex sm:justify-between">
                  <div className="sm:flex">
                    <p className="flex items-center text-sm text-gray-500">
                      Jane Smith - $1,250.00 - Loan #LN-2024-001
                    </p>
                  </div>
                  <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                    <p>2 hours ago</p>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};