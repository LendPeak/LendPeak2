import React, { Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import {
  BellIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  BanknotesIcon,
  CreditCardIcon,
  BuildingLibraryIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import { useWebSocket } from '../contexts/WebSocketContext';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';

const NotificationIcon: React.FC<{ type: string; severity?: string }> = ({ type, severity }) => {
  // Type-based icons
  if (type.includes('loan:payment')) return <CreditCardIcon className="h-5 w-5" />;
  if (type.includes('loan:application')) return <BuildingLibraryIcon className="h-5 w-5" />;
  if (type.includes('loan:')) return <BanknotesIcon className="h-5 w-5" />;
  if (type.includes('system:')) return <InformationCircleIcon className="h-5 w-5" />;

  // Severity-based icons
  switch (severity) {
    case 'success':
      return <CheckCircleIcon className="h-5 w-5 text-green-400" />;
    case 'error':
      return <ExclamationCircleIcon className="h-5 w-5 text-red-400" />;
    case 'warning':
      return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />;
    default:
      return <InformationCircleIcon className="h-5 w-5 text-blue-400" />;
  }
};

export const Notifications: React.FC = () => {
  const { notifications, unreadCount, markNotificationAsRead, clearNotifications } = useWebSocket();

  return (
    <Menu as="div" className="relative">
      <Menu.Button className="relative rounded-full bg-gray-800 p-1 text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800">
        <span className="sr-only">View notifications</span>
        <BellIcon className="h-6 w-6" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 text-xs text-white items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </span>
        )}
      </Menu.Button>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 z-[65] mt-2 w-96 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                  {unreadCount} new
                </span>
              )}
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="p-8 text-center">
              <BellIcon className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-500">No notifications yet</p>
            </div>
          ) : (
            <>
              <div className="max-h-96 overflow-y-auto">
                {notifications.map((notification) => (
                  <Menu.Item key={notification.id}>
                    {({ active }) => (
                      <div
                        onClick={() => markNotificationAsRead(notification.id)}
                        className={clsx(
                          active ? 'bg-gray-50' : '',
                          !notification.read ? 'bg-blue-50' : '',
                          'px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100'
                        )}
                      >
                        <div className="flex space-x-3">
                          <div className="flex-shrink-0">
                            <NotificationIcon
                              type={notification.type}
                              severity={notification.severity}
                            />
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-medium text-gray-900">
                                {notification.title}
                              </h4>
                              {!notification.read && (
                                <span className="h-2 w-2 rounded-full bg-blue-400"></span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-400">
                              {formatDistanceToNow(new Date(notification.timestamp), {
                                addSuffix: true,
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </Menu.Item>
                ))}
              </div>

              <div className="p-2 border-t border-gray-200 bg-gray-50">
                <div className="flex space-x-2">
                  <Link
                    to="/notifications"
                    className="flex-1 text-center py-2 px-4 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
                  >
                    View all
                  </Link>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => {
                        notifications.filter(n => !n.read).forEach(n => 
                          markNotificationAsRead(n.id)
                        );
                      }}
                      className="flex-1 text-center py-2 px-4 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
                    >
                      Mark all as read
                    </button>
                  )}
                  <button
                    onClick={clearNotifications}
                    className="text-center py-2 px-4 text-sm text-red-600 hover:bg-red-50 rounded-md"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </>
          )}
        </Menu.Items>
      </Transition>
    </Menu>
  );
};

// Notification Center Component (for dedicated page)
export const NotificationCenter: React.FC = () => {
  const { notifications, markNotificationAsRead, clearNotifications } = useWebSocket();
  const [filter, setFilter] = React.useState<'all' | 'unread'>('all');

  const filteredNotifications = notifications.filter(n => 
    filter === 'all' || !n.read
  );

  const groupedNotifications = filteredNotifications.reduce((acc, notification) => {
    const date = new Date(notification.timestamp).toLocaleDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(notification);
    return acc;
  }, {} as Record<string, typeof notifications>);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Notification Center</h1>
        <div className="flex items-center space-x-4">
          <div className="flex space-x-2">
            <button
              onClick={() => setFilter('all')}
              className={clsx(
                'px-4 py-2 text-sm font-medium rounded-md',
                filter === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              All
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={clsx(
                'px-4 py-2 text-sm font-medium rounded-md',
                filter === 'unread'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              Unread
            </button>
          </div>
          {notifications.length > 0 && (
            <button
              onClick={clearNotifications}
              className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {Object.entries(groupedNotifications).length === 0 ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <BellIcon className="mx-auto h-16 w-16 text-gray-400" />
          <h3 className="mt-2 text-lg font-medium text-gray-900">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            You'll see notifications here when there are updates to your loans or account.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedNotifications).map(([date, dateNotifications]) => (
            <div key={date}>
              <h3 className="text-sm font-medium text-gray-500 mb-3">
                {date === new Date().toLocaleDateString() ? 'Today' : date}
              </h3>
              <div className="bg-white shadow rounded-lg overflow-hidden">
                {dateNotifications.map((notification, index) => (
                  <div
                    key={notification.id}
                    onClick={() => markNotificationAsRead(notification.id)}
                    className={clsx(
                      'px-6 py-4 hover:bg-gray-50 cursor-pointer',
                      !notification.read && 'bg-blue-50',
                      index < dateNotifications.length - 1 && 'border-b border-gray-200'
                    )}
                  >
                    <div className="flex space-x-3">
                      <div className="flex-shrink-0">
                        <NotificationIcon
                          type={notification.type}
                          severity={notification.severity}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900">
                            {notification.title}
                          </p>
                          <div className="flex items-center space-x-2">
                            {!notification.read && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                New
                              </span>
                            )}
                            <span
                              className={clsx(
                                'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                                notification.severity === 'success' && 'bg-green-100 text-green-800',
                                notification.severity === 'error' && 'bg-red-100 text-red-800',
                                notification.severity === 'warning' && 'bg-yellow-100 text-yellow-800',
                                (!notification.severity || notification.severity === 'info') && 'bg-gray-100 text-gray-800'
                              )}
                            >
                              {notification.severity || 'info'}
                            </span>
                          </div>
                        </div>
                        <p className="mt-1 text-sm text-gray-500">
                          {notification.message}
                        </p>
                        <p className="mt-2 text-xs text-gray-400">
                          <ClockIcon className="inline h-3 w-3 mr-1" />
                          {formatDistanceToNow(new Date(notification.timestamp), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};