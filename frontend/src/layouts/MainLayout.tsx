import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  BanknotesIcon,
  UsersIcon,
  ChartBarIcon,
  CogIcon,
  ArrowRightOnRectangleIcon,
  CalculatorIcon,
  BellIcon,
  LightBulbIcon,
  DocumentTextIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  CreditCardIcon,
  BuildingOfficeIcon,
  ClipboardDocumentListIcon,
  CircleStackIcon,
  PresentationChartLineIcon,
  DocumentDuplicateIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../store/auth-context';
import { useDemoAuth } from '../contexts/DemoAuthContext';

// Check if we're in demo mode
const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true' || 
                  !import.meta.env.VITE_API_URL || 
                  import.meta.env.VITE_API_URL === 'demo';
import { clsx } from 'clsx';
import { Notifications } from '../components/NotificationsTailwind';
import { DemoDataManager } from '../components/DemoDataManager';
import { TimeTravelBar } from '../components/TimeTravelBar';
import { useTimeTravel } from '../contexts/TimeTravelContext';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Loans', href: '/loans', icon: BanknotesIcon },
  { name: 'Loan Origination', href: '/loans/origination', icon: ClipboardDocumentListIcon },
  { name: 'Collections', href: '/collections', icon: ExclamationTriangleIcon },
  { name: 'Delinquency', href: '/delinquency', icon: ExclamationTriangleIcon },
  { name: 'Payment Retry', href: '/payments/retry', icon: CreditCardIcon },
  { name: 'Bulk Payments', href: '/payments/bulk', icon: DocumentDuplicateIcon },
  { name: 'Suspense Account', href: '/payments/suspense', icon: QuestionMarkCircleIcon },
  { name: 'Portfolio', href: '/portfolio', icon: BuildingOfficeIcon },
  { name: 'Documents', href: '/documents', icon: DocumentTextIcon },
  { name: 'Calculator', href: '/calculator', icon: CalculatorIcon },
  { name: 'Per Diem', href: '/per-diem', icon: CalculatorIcon },
  { name: 'Amortization', href: '/amortization', icon: ChartBarIcon },
  { name: 'Recommendations', href: '/recommendations', icon: LightBulbIcon },
  { name: 'Analytics', href: '/analytics', icon: ChartBarIcon },
  { name: 'Business Intelligence', href: '/analytics/business-intelligence', icon: PresentationChartLineIcon },
  { name: 'Reports', href: '/reports', icon: ChartBarIcon },
  { name: 'Users', href: '/users', icon: UsersIcon, requiredRoles: ['ADMIN', 'SUPER_ADMIN'] },
  { name: 'System Config', href: '/admin/system', icon: CircleStackIcon, requiredRoles: ['ADMIN', 'SUPER_ADMIN'] },
  { name: 'Notifications', href: '/notifications', icon: BellIcon },
  { name: 'Settings', href: '/settings', icon: CogIcon },
];

export const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const authContext = isDemoMode ? useDemoAuth() : useAuth();
  const { user, logout } = authContext;
  const { isTimeTravelActive } = useTimeTravel();
  const hasRole = isDemoMode ? () => true : (authContext as any).hasRole;
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const filteredNavigation = navigation.filter(item => 
    !item.requiredRoles || item.requiredRoles.some(role => hasRole(role))
  );

  return (
    <div>
      {/* Time Travel Bar */}
      <TimeTravelBar />
      
      {/* Main Content - Add padding when time travel is active */}
      <div className={clsx(isTimeTravelActive ? "pt-16" : "pt-12")}>
        <Transition.Root show={sidebarOpen} as={Fragment}>
          <Dialog as="div" className="relative z-50 lg:hidden" onClose={setSidebarOpen}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-900/80" />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                <Transition.Child
                  as={Fragment}
                  enter="ease-in-out duration-300"
                  enterFrom="opacity-0"
                  enterTo="opacity-100"
                  leave="ease-in-out duration-300"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                    <button
                      type="button"
                      className="-m-2.5 p-2.5"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span className="sr-only">Close sidebar</span>
                      <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                    </button>
                  </div>
                </Transition.Child>
                
                <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-gray-900 px-6 pb-4 ring-1 ring-white/10">
                  <div className="flex h-16 shrink-0 items-center">
                    <h1 className="text-xl font-bold text-white">LendPeak</h1>
                  </div>
                  <nav className="flex flex-1 flex-col">
                    <ul role="list" className="flex flex-1 flex-col gap-y-7">
                      <li>
                        <ul role="list" className="-mx-2 space-y-1">
                          {filteredNavigation.map((item) => (
                            <li key={item.name}>
                              <Link
                                to={item.href}
                                className={clsx(
                                  location.pathname === item.href
                                    ? 'bg-gray-800 text-white'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-800',
                                  'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                                )}
                              >
                                <item.icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                                {item.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </li>
                      <li className="mt-auto">
                        <button
                          onClick={handleLogout}
                          className="group -mx-2 flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-gray-400 hover:bg-gray-800 hover:text-white w-full"
                        >
                          <ArrowRightOnRectangleIcon
                            className="h-6 w-6 shrink-0"
                            aria-hidden="true"
                          />
                          Log out
                        </button>
                      </li>
                    </ul>
                  </nav>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Static sidebar for desktop */}
      <div className={clsx(
        "hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:flex-col transition-all duration-300",
        sidebarCollapsed ? "lg:w-16" : "lg:w-72"
      )}>
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-gray-900 px-6 pb-4">
          <div className="flex h-16 shrink-0 items-center justify-between">
            <h1 className={clsx(
              "text-xl font-bold text-white transition-opacity duration-300",
              sidebarCollapsed ? "opacity-0" : "opacity-100"
            )}>LendPeak</h1>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {filteredNavigation.map((item) => (
                    <li key={item.name}>
                      <Link
                        to={item.href}
                        className={clsx(
                          location.pathname === item.href
                            ? 'bg-gray-800 text-white'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800',
                          'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold relative'
                        )}
                        title={sidebarCollapsed ? item.name : undefined}
                      >
                        <item.icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                        <span className={clsx(
                          "transition-opacity duration-300",
                          sidebarCollapsed ? "opacity-0" : "opacity-100"
                        )}>
                          {item.name}
                        </span>
                        {sidebarCollapsed && (
                          <div className="absolute left-full ml-6 px-2 py-1 bg-gray-900 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                            {item.name}
                          </div>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
              <li className="mt-auto space-y-2">
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="group -mx-2 flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-gray-400 hover:bg-gray-800 hover:text-white w-full"
                  title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  {sidebarCollapsed ? (
                    <ChevronRightIcon className="h-6 w-6 shrink-0" aria-hidden="true" />
                  ) : (
                    <>
                      <ChevronLeftIcon className="h-6 w-6 shrink-0" aria-hidden="true" />
                      <span>Collapse</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleLogout}
                  className="group -mx-2 flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-gray-400 hover:bg-gray-800 hover:text-white w-full"
                  title={sidebarCollapsed ? "Log out" : undefined}
                >
                  <ArrowRightOnRectangleIcon
                    className="h-6 w-6 shrink-0"
                    aria-hidden="true"
                  />
                  <span className={clsx(
                    "transition-opacity duration-300",
                    sidebarCollapsed ? "opacity-0" : "opacity-100"
                  )}>
                    Log out
                  </span>
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      <div className={clsx(
        "transition-all duration-300",
        sidebarCollapsed ? "lg:pl-16" : "lg:pl-72"
      )}>
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <Bars3Icon className="h-6 w-6" aria-hidden="true" />
          </button>

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1"></div>
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              <Notifications />
              <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-900/10" aria-hidden="true" />
              <div className="flex items-center">
                <span className="text-sm font-medium text-gray-900">
                  {user?.firstName} {user?.lastName}
                </span>
              </div>
            </div>
          </div>
        </div>

        <main className="py-10">
          <div className="px-4 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
        </div>

        {/* Demo Data Manager - only show in demo mode */}
        {isDemoMode && <DemoDataManager />}
      </div>
    </div>
  );
};