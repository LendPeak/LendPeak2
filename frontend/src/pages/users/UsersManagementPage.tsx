import { useState } from 'react';
import { format } from 'date-fns';
import {
  UserIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  KeyIcon,
} from '@heroicons/react/24/outline';
import { UserManagementModal } from '../../components/users/UserManagementModal';
import { toast } from 'react-toastify';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'AGENT' | 'VIEWER';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  department: string;
  lastLogin: Date;
  createdAt: Date;
  twoFactorEnabled: boolean;
}

const mockUsers: User[] = [
  {
    id: '1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@lendpeak.com',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    department: 'IT',
    lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000),
    createdAt: new Date('2023-01-15'),
    twoFactorEnabled: true,
  },
  {
    id: '2',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@lendpeak.com',
    role: 'ADMIN',
    status: 'ACTIVE',
    department: 'Operations',
    lastLogin: new Date(Date.now() - 24 * 60 * 60 * 1000),
    createdAt: new Date('2023-02-20'),
    twoFactorEnabled: true,
  },
  {
    id: '3',
    firstName: 'Bob',
    lastName: 'Johnson',
    email: 'bob.johnson@lendpeak.com',
    role: 'MANAGER',
    status: 'ACTIVE',
    department: 'Servicing',
    lastLogin: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    createdAt: new Date('2023-03-10'),
    twoFactorEnabled: false,
  },
  {
    id: '4',
    firstName: 'Alice',
    lastName: 'Williams',
    email: 'alice.williams@lendpeak.com',
    role: 'AGENT',
    status: 'ACTIVE',
    department: 'Customer Service',
    lastLogin: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date('2023-04-05'),
    twoFactorEnabled: false,
  },
  {
    id: '5',
    firstName: 'Charlie',
    lastName: 'Brown',
    email: 'charlie.brown@lendpeak.com',
    role: 'VIEWER',
    status: 'SUSPENDED',
    department: 'Compliance',
    lastLogin: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    createdAt: new Date('2023-05-15'),
    twoFactorEnabled: false,
  },
];

const roleColors = {
  SUPER_ADMIN: 'bg-red-100 text-red-800',
  ADMIN: 'bg-purple-100 text-purple-800',
  MANAGER: 'bg-blue-100 text-blue-800',
  AGENT: 'bg-green-100 text-green-800',
  VIEWER: 'bg-gray-100 text-gray-800',
};

const statusIcons = {
  ACTIVE: CheckCircleIcon,
  INACTIVE: XCircleIcon,
  SUSPENDED: ExclamationTriangleIcon,
};

const statusColors = {
  ACTIVE: 'text-green-600',
  INACTIVE: 'text-gray-400',
  SUSPENDED: 'text-red-600',
};

export const UsersManagementPage = () => {
  const [users, setUsers] = useState(mockUsers);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.department.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = !roleFilter || user.role === roleFilter;
    const matchesStatus = !statusFilter || user.status === statusFilter;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleCreateUser = () => {
    setSelectedUser(null);
    setShowUserModal(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  const handleDeleteUser = async (userId: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      // In a real app, this would call the API
      setUsers(users.filter(u => u.id !== userId));
      toast.success('User deleted successfully');
    }
  };

  const handleResetPassword = async (userId: string) => {
    // In a real app, this would call the API
    toast.success('Password reset email sent');
  };

  const handleToggle2FA = async (user: User) => {
    // In a real app, this would call the API
    setUsers(users.map(u => 
      u.id === user.id 
        ? { ...u, twoFactorEnabled: !u.twoFactorEnabled }
        : u
    ));
    toast.success(`Two-factor authentication ${user.twoFactorEnabled ? 'disabled' : 'enabled'}`);
  };

  const handleSaveUser = (userData: any) => {
    if (selectedUser) {
      // Update existing user
      setUsers(users.map(u => 
        u.id === selectedUser.id 
          ? { ...u, ...userData }
          : u
      ));
      toast.success('User updated successfully');
    } else {
      // Create new user
      const newUser: User = {
        id: Date.now().toString(),
        ...userData,
        lastLogin: new Date(),
        createdAt: new Date(),
        twoFactorEnabled: false,
      };
      setUsers([...users, newUser]);
      toast.success('User created successfully');
    }
  };

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Users Management</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage user accounts, roles, and permissions
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            onClick={handleCreateUser}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:w-auto"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
            Add User
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-gray-700">
            Search
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              id="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
              placeholder="Search users..."
            />
          </div>
        </div>

        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700">
            Role
          </label>
          <select
            id="role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
          >
            <option value="">All Roles</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="ADMIN">Admin</option>
            <option value="MANAGER">Manager</option>
            <option value="AGENT">Agent</option>
            <option value="VIEWER">Viewer</option>
          </select>
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700">
            Status
          </label>
          <select
            id="status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="mt-8 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      User
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Role
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Department
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Status
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Last Login
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Security
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredUsers.map((user) => {
                    const StatusIcon = statusIcons[user.status];
                    return (
                      <tr key={user.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                          <div className="flex items-center">
                            <div className="h-10 w-10 flex-shrink-0">
                              <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                                <UserIcon className="h-6 w-6 text-gray-600" />
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="font-medium text-gray-900">
                                {user.firstName} {user.lastName}
                              </div>
                              <div className="text-gray-500">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${roleColors[user.role]}`}>
                            {user.role.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {user.department}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          <div className="flex items-center">
                            <StatusIcon className={`h-5 w-5 mr-1 ${statusColors[user.status]}`} />
                            <span className={statusColors[user.status]}>
                              {user.status}
                            </span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {format(user.lastLogin, 'MMM d, yyyy HH:mm')}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          <div className="flex items-center space-x-2">
                            {user.twoFactorEnabled ? (
                              <div className="flex items-center text-green-600">
                                <ShieldCheckIcon className="h-5 w-5" />
                                <span className="ml-1 text-xs">2FA</span>
                              </div>
                            ) : (
                              <div className="flex items-center text-gray-400">
                                <ShieldCheckIcon className="h-5 w-5" />
                                <span className="ml-1 text-xs">2FA</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleToggle2FA(user)}
                              className="text-gray-600 hover:text-gray-900"
                              title={`${user.twoFactorEnabled ? 'Disable' : 'Enable'} 2FA`}
                            >
                              <ShieldCheckIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleResetPassword(user.id)}
                              className="text-gray-600 hover:text-gray-900"
                              title="Reset Password"
                            >
                              <KeyIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleEditUser(user)}
                              className="text-primary-600 hover:text-primary-900"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="text-red-600 hover:text-red-900"
                              disabled={user.role === 'SUPER_ADMIN'}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* User Statistics */}
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UserIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Users</dt>
                  <dd className="text-lg font-semibold text-gray-900">{users.length}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircleIcon className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Active Users</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {users.filter(u => u.status === 'ACTIVE').length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ShieldCheckIcon className="h-6 w-6 text-primary-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">With 2FA</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {users.filter(u => u.twoFactorEnabled).length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Suspended</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {users.filter(u => u.status === 'SUSPENDED').length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* User Modal */}
      {showUserModal && (
        <UserManagementModal
          user={selectedUser}
          isOpen={showUserModal}
          onClose={() => setShowUserModal(false)}
          onSave={handleSaveUser}
        />
      )}
    </div>
  );
};