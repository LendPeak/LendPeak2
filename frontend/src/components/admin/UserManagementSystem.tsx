import { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  XMarkIcon,
  UserIcon,
  UsersIcon,
  ShieldCheckIcon,
  KeyIcon,
  EyeIcon,
  EyeSlashIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  LockClosedIcon,
  LockOpenIcon,
  CogIcon,
  DocumentTextIcon,
  CalendarIcon,
  ArrowRightIcon,
  BellIcon,
  EnvelopeIcon,
  PhoneIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { format, differenceInDays, addDays } from 'date-fns';

interface UserManagementSystemProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  department: string;
  jobTitle: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING';
  roles: Role[];
  permissions: Permission[];
  createdAt: Date;
  lastLoginAt?: Date;
  passwordLastChanged: Date;
  mfaEnabled: boolean;
  accountLocked: boolean;
  failedLoginAttempts: number;
  sessionTimeout: number; // minutes
  profilePicture?: string;
  notes?: string;
  supervisor?: string;
  workSchedule: WorkSchedule;
  auditLog: AuditLogEntry[];
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt?: Date;
  userCount: number;
}

interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: PermissionAction;
  category: PermissionCategory;
  isSystem: boolean;
}

interface WorkSchedule {
  timezone: string;
  workDays: number[]; // 0-6 (Sunday-Saturday)
  workHours: {
    start: string;
    end: string;
  };
  allowOverride: boolean;
}

interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  details?: string;
}

interface UserSession {
  id: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  startTime: Date;
  lastActivity: Date;
  expiresAt: Date;
  isActive: boolean;
  location?: string;
}

interface AccessRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  requestType: 'ROLE_ASSIGNMENT' | 'PERMISSION_GRANT' | 'ACCESS_LEVEL_CHANGE' | 'ACCOUNT_UNLOCK';
  targetUserId: string;
  targetUserName: string;
  requestedRoles?: string[];
  requestedPermissions?: string[];
  justification: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED';
  requestedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewNotes?: string;
  expiresAt: Date;
}

type PermissionAction = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXECUTE' | 'APPROVE' | 'MANAGE';
type PermissionCategory = 'LOANS' | 'PAYMENTS' | 'UNDERWRITING' | 'COMPLIANCE' | 'DOCUMENTS' | 'REPORTS' | 'ADMIN' | 'SYSTEM';

const DEFAULT_ROLES: Role[] = [
  {
    id: 'role_loan_officer',
    name: 'Loan Officer',
    description: 'Can create and manage loan applications, review documents',
    permissions: [],
    isSystem: true,
    createdAt: new Date(),
    userCount: 12,
  },
  {
    id: 'role_underwriter',
    name: 'Underwriter',
    description: 'Can review and approve loan applications, access credit reports',
    permissions: [],
    isSystem: true,
    createdAt: new Date(),
    userCount: 8,
  },
  {
    id: 'role_collections_agent',
    name: 'Collections Agent',
    description: 'Can manage delinquent accounts, initiate collection activities',
    permissions: [],
    isSystem: true,
    createdAt: new Date(),
    userCount: 6,
  },
  {
    id: 'role_compliance_officer',
    name: 'Compliance Officer',
    description: 'Can monitor regulatory compliance, generate reports',
    permissions: [],
    isSystem: true,
    createdAt: new Date(),
    userCount: 3,
  },
  {
    id: 'role_admin',
    name: 'System Administrator',
    description: 'Full system access and configuration capabilities',
    permissions: [],
    isSystem: true,
    createdAt: new Date(),
    userCount: 2,
  },
];

const DEFAULT_PERMISSIONS: Permission[] = [
  // Loan Management
  { id: 'perm_loans_create', name: 'Create Loans', description: 'Create new loan applications', resource: 'loans', action: 'CREATE', category: 'LOANS', isSystem: true },
  { id: 'perm_loans_read', name: 'View Loans', description: 'View loan details and status', resource: 'loans', action: 'READ', category: 'LOANS', isSystem: true },
  { id: 'perm_loans_update', name: 'Update Loans', description: 'Modify loan terms and status', resource: 'loans', action: 'UPDATE', category: 'LOANS', isSystem: true },
  { id: 'perm_loans_delete', name: 'Delete Loans', description: 'Delete loan applications', resource: 'loans', action: 'DELETE', category: 'LOANS', isSystem: true },
  
  // Payment Management
  { id: 'perm_payments_create', name: 'Process Payments', description: 'Process loan payments', resource: 'payments', action: 'CREATE', category: 'PAYMENTS', isSystem: true },
  { id: 'perm_payments_read', name: 'View Payments', description: 'View payment history', resource: 'payments', action: 'READ', category: 'PAYMENTS', isSystem: true },
  { id: 'perm_payments_refund', name: 'Process Refunds', description: 'Process payment refunds', resource: 'payments', action: 'EXECUTE', category: 'PAYMENTS', isSystem: true },
  
  // Underwriting
  { id: 'perm_underwriting_review', name: 'Review Applications', description: 'Review loan applications for approval', resource: 'underwriting', action: 'READ', category: 'UNDERWRITING', isSystem: true },
  { id: 'perm_underwriting_approve', name: 'Approve Loans', description: 'Approve or deny loan applications', resource: 'underwriting', action: 'APPROVE', category: 'UNDERWRITING', isSystem: true },
  { id: 'perm_underwriting_conditions', name: 'Set Conditions', description: 'Set approval conditions', resource: 'underwriting', action: 'UPDATE', category: 'UNDERWRITING', isSystem: true },
  
  // Compliance
  { id: 'perm_compliance_monitor', name: 'Monitor Compliance', description: 'Monitor regulatory compliance', resource: 'compliance', action: 'READ', category: 'COMPLIANCE', isSystem: true },
  { id: 'perm_compliance_reports', name: 'Generate Reports', description: 'Generate compliance reports', resource: 'compliance', action: 'EXECUTE', category: 'COMPLIANCE', isSystem: true },
  
  // Documents
  { id: 'perm_documents_upload', name: 'Upload Documents', description: 'Upload loan documents', resource: 'documents', action: 'CREATE', category: 'DOCUMENTS', isSystem: true },
  { id: 'perm_documents_view', name: 'View Documents', description: 'View loan documents', resource: 'documents', action: 'READ', category: 'DOCUMENTS', isSystem: true },
  { id: 'perm_documents_verify', name: 'Verify Documents', description: 'Verify document authenticity', resource: 'documents', action: 'UPDATE', category: 'DOCUMENTS', isSystem: true },
  
  // Admin
  { id: 'perm_users_manage', name: 'Manage Users', description: 'Create, update, and delete user accounts', resource: 'users', action: 'MANAGE', category: 'ADMIN', isSystem: true },
  { id: 'perm_roles_manage', name: 'Manage Roles', description: 'Create and modify user roles', resource: 'roles', action: 'MANAGE', category: 'ADMIN', isSystem: true },
  { id: 'perm_system_config', name: 'System Configuration', description: 'Configure system settings', resource: 'system', action: 'MANAGE', category: 'SYSTEM', isSystem: true },
];

export const UserManagementSystem = ({ isOpen, onClose, onSuccess }: UserManagementSystemProps) => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>(DEFAULT_ROLES);
  const [permissions] = useState<Permission[]>(DEFAULT_PERMISSIONS);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  
  const [selectedTab, setSelectedTab] = useState<'USERS' | 'ROLES' | 'PERMISSIONS' | 'SESSIONS' | 'REQUESTS' | 'AUDIT'>('USERS');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'email' | 'created' | 'lastLogin'>('name');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  
  const [showUserModal, setShowUserModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadUsers();
    loadSessions();
    loadAccessRequests();
  }, []);

  const loadUsers = async () => {
    // Demo users data
    setUsers([
      {
        id: 'user_001',
        username: 'john.smith',
        email: 'john.smith@company.com',
        firstName: 'John',
        lastName: 'Smith',
        phone: '+1-555-0123',
        department: 'Lending',
        jobTitle: 'Senior Loan Officer',
        status: 'ACTIVE',
        roles: [roles.find(r => r.id === 'role_loan_officer')!],
        permissions: [],
        createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        lastLoginAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        passwordLastChanged: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        mfaEnabled: true,
        accountLocked: false,
        failedLoginAttempts: 0,
        sessionTimeout: 480, // 8 hours
        supervisor: 'Jane Wilson',
        workSchedule: {
          timezone: 'America/New_York',
          workDays: [1, 2, 3, 4, 5],
          workHours: { start: '09:00', end: '17:00' },
          allowOverride: false,
        },
        auditLog: [],
      },
      {
        id: 'user_002',
        username: 'sarah.johnson',
        email: 'sarah.johnson@company.com',
        firstName: 'Sarah',
        lastName: 'Johnson',
        phone: '+1-555-0456',
        department: 'Underwriting',
        jobTitle: 'Senior Underwriter',
        status: 'ACTIVE',
        roles: [roles.find(r => r.id === 'role_underwriter')!],
        permissions: [],
        createdAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
        lastLoginAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
        passwordLastChanged: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        mfaEnabled: true,
        accountLocked: false,
        failedLoginAttempts: 0,
        sessionTimeout: 240, // 4 hours
        supervisor: 'Michael Brown',
        workSchedule: {
          timezone: 'America/New_York',
          workDays: [1, 2, 3, 4, 5],
          workHours: { start: '08:30', end: '16:30' },
          allowOverride: true,
        },
        auditLog: [],
      },
      {
        id: 'user_003',
        username: 'mike.rodriguez',
        email: 'mike.rodriguez@company.com',
        firstName: 'Mike',
        lastName: 'Rodriguez',
        phone: '+1-555-0789',
        department: 'Collections',
        jobTitle: 'Collections Agent',
        status: 'ACTIVE',
        roles: [roles.find(r => r.id === 'role_collections_agent')!],
        permissions: [],
        createdAt: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000),
        lastLoginAt: new Date(Date.now() - 30 * 60 * 1000),
        passwordLastChanged: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        mfaEnabled: false,
        accountLocked: false,
        failedLoginAttempts: 2,
        sessionTimeout: 180, // 3 hours
        supervisor: 'Lisa Wang',
        workSchedule: {
          timezone: 'America/New_York',
          workDays: [1, 2, 3, 4, 5],
          workHours: { start: '10:00', end: '18:00' },
          allowOverride: false,
        },
        auditLog: [],
      },
      {
        id: 'user_004',
        username: 'emily.davis',
        email: 'emily.davis@company.com',
        firstName: 'Emily',
        lastName: 'Davis',
        phone: '+1-555-0321',
        department: 'Compliance',
        jobTitle: 'Compliance Officer',
        status: 'ACTIVE',
        roles: [roles.find(r => r.id === 'role_compliance_officer')!],
        permissions: [],
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        lastLoginAt: new Date(Date.now() - 45 * 60 * 1000),
        passwordLastChanged: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        mfaEnabled: true,
        accountLocked: false,
        failedLoginAttempts: 0,
        sessionTimeout: 600, // 10 hours
        supervisor: 'David Wilson',
        workSchedule: {
          timezone: 'America/New_York',
          workDays: [1, 2, 3, 4, 5],
          workHours: { start: '09:00', end: '17:00' },
          allowOverride: true,
        },
        auditLog: [],
      },
      {
        id: 'user_005',
        username: 'alex.kim',
        email: 'alex.kim@company.com',
        firstName: 'Alex',
        lastName: 'Kim',
        department: 'Lending',
        jobTitle: 'Junior Loan Officer',
        status: 'SUSPENDED',
        roles: [roles.find(r => r.id === 'role_loan_officer')!],
        permissions: [],
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        lastLoginAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        passwordLastChanged: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        mfaEnabled: false,
        accountLocked: false,
        failedLoginAttempts: 0,
        sessionTimeout: 240,
        notes: 'Account suspended pending investigation',
        supervisor: 'Jane Wilson',
        workSchedule: {
          timezone: 'America/New_York',
          workDays: [1, 2, 3, 4, 5],
          workHours: { start: '09:00', end: '17:00' },
          allowOverride: false,
        },
        auditLog: [],
      },
    ]);
  };

  const loadSessions = async () => {
    // Demo session data
    setSessions([
      {
        id: 'session_001',
        userId: 'user_001',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        startTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
        lastActivity: new Date(Date.now() - 5 * 60 * 1000),
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
        isActive: true,
        location: 'New York, NY',
      },
      {
        id: 'session_002',
        userId: 'user_002',
        ipAddress: '192.168.1.105',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        startTime: new Date(Date.now() - 1 * 60 * 60 * 1000),
        lastActivity: new Date(Date.now() - 1 * 60 * 1000),
        expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
        isActive: true,
        location: 'Boston, MA',
      },
    ]);
  };

  const loadAccessRequests = async () => {
    // Demo access request data
    setAccessRequests([
      {
        id: 'req_001',
        requesterId: 'user_003',
        requesterName: 'Mike Rodriguez',
        requestType: 'ROLE_ASSIGNMENT',
        targetUserId: 'user_003',
        targetUserName: 'Mike Rodriguez',
        requestedRoles: ['role_underwriter'],
        justification: 'Promotion to Senior Collections Agent requires underwriting permissions',
        status: 'PENDING',
        requestedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'req_002',
        requesterId: 'user_001',
        requesterName: 'John Smith',
        requestType: 'PERMISSION_GRANT',
        targetUserId: 'user_005',
        targetUserName: 'Alex Kim',
        requestedPermissions: ['perm_loans_read'],
        justification: 'Temporary access needed for training purposes',
        status: 'APPROVED',
        requestedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        reviewedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        reviewedBy: 'admin',
        reviewNotes: 'Approved for 30-day training period',
        expiresAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      },
    ]);
  };

  const updateUserStatus = async (userId: string, status: User['status']) => {
    setIsProcessing(true);
    try {
      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, status } : user
      ));
      toast.success(`User status updated to ${status}`);
    } catch (error) {
      toast.error('Failed to update user status');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetUserPassword = async (userId: string) => {
    setIsProcessing(true);
    try {
      // Simulate password reset
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setUsers(prev => prev.map(user => 
        user.id === userId 
          ? { ...user, passwordLastChanged: new Date(), failedLoginAttempts: 0 }
          : user
      ));
      toast.success('Password reset email sent to user');
    } catch (error) {
      toast.error('Failed to reset password');
    } finally {
      setIsProcessing(false);
    }
  };

  const unlockUserAccount = async (userId: string) => {
    setIsProcessing(true);
    try {
      setUsers(prev => prev.map(user => 
        user.id === userId 
          ? { ...user, accountLocked: false, failedLoginAttempts: 0 }
          : user
      ));
      toast.success('User account unlocked');
    } catch (error) {
      toast.error('Failed to unlock account');
    } finally {
      setIsProcessing(false);
    }
  };

  const terminateSession = async (sessionId: string) => {
    setIsProcessing(true);
    try {
      setSessions(prev => prev.map(session => 
        session.id === sessionId ? { ...session, isActive: false } : session
      ));
      toast.success('Session terminated');
    } catch (error) {
      toast.error('Failed to terminate session');
    } finally {
      setIsProcessing(false);
    }
  };

  const approveAccessRequest = async (requestId: string, approved: boolean, notes?: string) => {
    setIsProcessing(true);
    try {
      setAccessRequests(prev => prev.map(request => 
        request.id === requestId 
          ? { 
              ...request, 
              status: approved ? 'APPROVED' : 'DENIED',
              reviewedAt: new Date(),
              reviewedBy: 'Current User',
              reviewNotes: notes,
            }
          : request
      ));
      toast.success(`Access request ${approved ? 'approved' : 'denied'}`);
    } catch (error) {
      toast.error('Failed to process access request');
    } finally {
      setIsProcessing(false);
    }
  };

  const bulkUserAction = async (action: 'activate' | 'deactivate' | 'reset_password') => {
    setIsProcessing(true);
    try {
      const userIds = Array.from(selectedUsers);
      
      switch (action) {
        case 'activate':
          setUsers(prev => prev.map(user => 
            userIds.includes(user.id) ? { ...user, status: 'ACTIVE' } : user
          ));
          toast.success(`${userIds.length} user(s) activated`);
          break;
        case 'deactivate':
          setUsers(prev => prev.map(user => 
            userIds.includes(user.id) ? { ...user, status: 'INACTIVE' } : user
          ));
          toast.success(`${userIds.length} user(s) deactivated`);
          break;
        case 'reset_password':
          setUsers(prev => prev.map(user => 
            userIds.includes(user.id) 
              ? { ...user, passwordLastChanged: new Date(), failedLoginAttempts: 0 }
              : user
          ));
          toast.success(`Password reset emails sent to ${userIds.length} user(s)`);
          break;
      }
      
      setSelectedUsers(new Set());
    } catch (error) {
      toast.error('Failed to perform bulk action');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status: User['status']) => {
    switch (status) {
      case 'ACTIVE': return 'text-green-600 bg-green-100';
      case 'INACTIVE': return 'text-gray-600 bg-gray-100';
      case 'SUSPENDED': return 'text-red-600 bg-red-100';
      case 'PENDING': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getRequestStatusColor = (status: AccessRequest['status']) => {
    switch (status) {
      case 'APPROVED': return 'text-green-600 bg-green-100';
      case 'DENIED': return 'text-red-600 bg-red-100';
      case 'PENDING': return 'text-yellow-600 bg-yellow-100';
      case 'EXPIRED': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const isPasswordExpired = (passwordDate: Date) => {
    return differenceInDays(new Date(), passwordDate) > 90;
  };

  const toggleUserSelection = (userId: string) => {
    const newSelection = new Set(selectedUsers);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedUsers(newSelection);
  };

  const filteredUsers = users
    .filter(user => {
      if (filterStatus !== 'all' && user.status !== filterStatus) return false;
      if (filterRole !== 'all' && !user.roles.some(role => role.id === filterRole)) return false;
      if (filterDepartment !== 'all' && user.department !== filterDepartment) return false;
      if (searchTerm && !user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) && 
          !user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !user.email.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !user.username.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
        case 'email':
          return a.email.localeCompare(b.email);
        case 'created':
          return b.createdAt.getTime() - a.createdAt.getTime();
        case 'lastLogin':
          if (!a.lastLoginAt) return 1;
          if (!b.lastLoginAt) return -1;
          return b.lastLoginAt.getTime() - a.lastLoginAt.getTime();
        default:
          return 0;
      }
    });

  const departments = Array.from(new Set(users.map(user => user.department)));
  const activeUserCount = users.filter(u => u.status === 'ACTIVE').length;
  const suspendedUserCount = users.filter(u => u.status === 'SUSPENDED').length;
  const pendingRequestCount = accessRequests.filter(r => r.status === 'PENDING').length;

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[70]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-2xl transition-all sm:my-8 w-full max-w-7xl">
                <div className="bg-white">
                  <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-cyan-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 border border-blue-200">
                          <UsersIcon className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <Dialog.Title as="h3" className="text-xl font-bold leading-6 text-gray-900">
                            User Management System
                          </Dialog.Title>
                          <p className="mt-1 text-sm text-gray-600 flex items-center space-x-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {activeUserCount} active
                            </span>
                            <span>•</span>
                            {suspendedUserCount > 0 && (
                              <>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  {suspendedUserCount} suspended
                                </span>
                                <span>•</span>
                              </>
                            )}
                            <span>{users.length} total users</span>
                            <span>•</span>
                            <span>{roles.length} roles</span>
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
                        onClick={onClose}
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  <div className="px-6 py-6">
                    {/* Tab Navigation */}
                    <div className="border-b border-gray-200 mb-6">
                      <nav className="-mb-px flex space-x-8">
                        {[
                          { key: 'USERS', label: 'Users', icon: UsersIcon, count: users.length },
                          { key: 'ROLES', label: 'Roles & Permissions', icon: ShieldCheckIcon, count: roles.length },
                          { key: 'SESSIONS', label: 'Active Sessions', icon: ClockIcon, count: sessions.filter(s => s.isActive).length },
                          { key: 'REQUESTS', label: 'Access Requests', icon: KeyIcon, count: pendingRequestCount },
                          { key: 'AUDIT', label: 'Audit Log', icon: DocumentTextIcon },
                        ].map((tab) => {
                          const IconComponent = tab.icon;
                          return (
                            <button
                              key={tab.key}
                              onClick={() => setSelectedTab(tab.key as any)}
                              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                                selectedTab === tab.key
                                  ? 'border-blue-500 text-blue-600'
                                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                              }`}
                            >
                              <IconComponent className="h-4 w-4" />
                              <span>{tab.label}</span>
                              {tab.count !== undefined && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  {tab.count}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </nav>
                    </div>

                    {/* Users Tab */}
                    {selectedTab === 'USERS' && (
                      <div className="space-y-6">
                        {/* Filters and Actions */}
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="flex items-center space-x-4">
                            {/* Search */}
                            <div className="relative">
                              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                              <input
                                type="text"
                                placeholder="Search users..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                              />
                            </div>

                            {/* Filters */}
                            <select
                              value={filterStatus}
                              onChange={(e) => setFilterStatus(e.target.value)}
                              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            >
                              <option value="all">All Status</option>
                              <option value="ACTIVE">Active</option>
                              <option value="INACTIVE">Inactive</option>
                              <option value="SUSPENDED">Suspended</option>
                              <option value="PENDING">Pending</option>
                            </select>

                            <select
                              value={filterRole}
                              onChange={(e) => setFilterRole(e.target.value)}
                              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            >
                              <option value="all">All Roles</option>
                              {roles.map(role => (
                                <option key={role.id} value={role.id}>{role.name}</option>
                              ))}
                            </select>

                            <select
                              value={filterDepartment}
                              onChange={(e) => setFilterDepartment(e.target.value)}
                              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            >
                              <option value="all">All Departments</option>
                              {departments.map(dept => (
                                <option key={dept} value={dept}>{dept}</option>
                              ))}
                            </select>
                          </div>

                          <div className="flex items-center space-x-2">
                            {selectedUsers.size > 0 && (
                              <>
                                <span className="text-sm text-gray-600">{selectedUsers.size} selected</span>
                                <button
                                  onClick={() => bulkUserAction('activate')}
                                  disabled={isProcessing}
                                  className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                                >
                                  <CheckCircleIcon className="h-4 w-4 mr-1" />
                                  Activate
                                </button>
                                <button
                                  onClick={() => bulkUserAction('deactivate')}
                                  disabled={isProcessing}
                                  className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                                >
                                  <XCircleIcon className="h-4 w-4 mr-1" />
                                  Deactivate
                                </button>
                                <button
                                  onClick={() => bulkUserAction('reset_password')}
                                  disabled={isProcessing}
                                  className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                                >
                                  <KeyIcon className="h-4 w-4 mr-1" />
                                  Reset Password
                                </button>
                              </>
                            )}
                            
                            <button
                              onClick={() => setShowUserModal(true)}
                              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                            >
                              <PlusIcon className="h-4 w-4 mr-2" />
                              Add User
                            </button>
                          </div>
                        </div>

                        {/* Users Table */}
                        <div className="bg-white shadow overflow-hidden sm:rounded-md">
                          <ul className="divide-y divide-gray-200">
                            {filteredUsers.map((user) => (
                              <li key={user.id}>
                                <div className="px-6 py-4 flex items-center justify-between">
                                  <div className="flex items-center space-x-4">
                                    <input
                                      type="checkbox"
                                      checked={selectedUsers.has(user.id)}
                                      onChange={() => toggleUserSelection(user.id)}
                                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    
                                    <div className="flex-shrink-0">
                                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                        <UserIcon className="h-5 w-5 text-blue-600" />
                                      </div>
                                    </div>
                                    
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center space-x-3">
                                        <p className="text-sm font-medium text-gray-900">
                                          {user.firstName} {user.lastName}
                                        </p>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(user.status)}`}>
                                          {user.status}
                                        </span>
                                        {user.mfaEnabled && (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            MFA
                                          </span>
                                        )}
                                        {user.accountLocked && (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                            <LockClosedIcon className="h-3 w-3 mr-1" />
                                            Locked
                                          </span>
                                        )}
                                        {isPasswordExpired(user.passwordLastChanged) && (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                            Password Expired
                                          </span>
                                        )}
                                      </div>
                                      <div className="mt-1 text-sm text-gray-500 space-y-1">
                                        <div className="flex items-center space-x-4">
                                          <span>{user.email}</span>
                                          <span>•</span>
                                          <span>{user.jobTitle}</span>
                                          <span>•</span>
                                          <span>{user.department}</span>
                                        </div>
                                        <div className="flex items-center space-x-4">
                                          <span>Roles: {user.roles.map(r => r.name).join(', ')}</span>
                                          {user.lastLoginAt && (
                                            <>
                                              <span>•</span>
                                              <span>Last login: {format(user.lastLoginAt, 'MMM d, yyyy h:mm a')}</span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center space-x-2">
                                    {user.accountLocked && (
                                      <button
                                        onClick={() => unlockUserAccount(user.id)}
                                        disabled={isProcessing}
                                        className="inline-flex items-center px-2 py-1 border border-transparent text-sm font-medium rounded text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                                      >
                                        <LockOpenIcon className="h-4 w-4 mr-1" />
                                        Unlock
                                      </button>
                                    )}
                                    
                                    <button
                                      onClick={() => resetUserPassword(user.id)}
                                      disabled={isProcessing}
                                      className="inline-flex items-center px-2 py-1 border border-gray-300 text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                                    >
                                      <KeyIcon className="h-4 w-4 mr-1" />
                                      Reset
                                    </button>
                                    
                                    <button
                                      onClick={() => setEditingUser(user)}
                                      className="inline-flex items-center px-2 py-1 border border-gray-300 text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                                    >
                                      <PencilIcon className="h-4 w-4 mr-1" />
                                      Edit
                                    </button>
                                    
                                    {user.status === 'ACTIVE' ? (
                                      <button
                                        onClick={() => updateUserStatus(user.id, 'SUSPENDED')}
                                        disabled={isProcessing}
                                        className="inline-flex items-center px-2 py-1 border border-transparent text-sm font-medium rounded text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                                      >
                                        Suspend
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => updateUserStatus(user.id, 'ACTIVE')}
                                        disabled={isProcessing}
                                        className="inline-flex items-center px-2 py-1 border border-transparent text-sm font-medium rounded text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                                      >
                                        Activate
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* Roles Tab */}
                    {selectedTab === 'ROLES' && (
                      <div className="space-y-6">
                        <div className="flex justify-between items-center">
                          <h4 className="text-lg font-semibold text-gray-900">Roles & Permissions</h4>
                          <button
                            onClick={() => setShowRoleModal(true)}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                          >
                            <PlusIcon className="h-4 w-4 mr-2" />
                            Create Role
                          </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div>
                            <h5 className="text-sm font-medium text-gray-900 mb-4">System Roles</h5>
                            <div className="space-y-4">
                              {roles.map((role) => (
                                <div key={role.id} className="bg-white border border-gray-200 rounded-lg p-4">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-3 mb-2">
                                        <h6 className="text-sm font-medium text-gray-900">{role.name}</h6>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                          {role.userCount} users
                                        </span>
                                        {role.isSystem && (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                            System
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-sm text-gray-600 mb-2">{role.description}</p>
                                      <p className="text-xs text-gray-500">
                                        Created {format(role.createdAt, 'MMM d, yyyy')}
                                      </p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <button
                                        onClick={() => setEditingRole(role)}
                                        className="inline-flex items-center p-1 border border-gray-300 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                                      >
                                        <PencilIcon className="h-4 w-4" />
                                      </button>
                                      {!role.isSystem && (
                                        <button className="inline-flex items-center p-1 border border-gray-300 rounded text-gray-400 hover:text-red-600 hover:bg-red-50">
                                          <TrashIcon className="h-4 w-4" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <h5 className="text-sm font-medium text-gray-900 mb-4">Available Permissions</h5>
                            <div className="space-y-3">
                              {Object.entries(
                                permissions.reduce((acc, perm) => {
                                  if (!acc[perm.category]) acc[perm.category] = [];
                                  acc[perm.category].push(perm);
                                  return acc;
                                }, {} as Record<string, Permission[]>)
                              ).map(([category, perms]) => (
                                <div key={category} className="bg-gray-50 rounded-lg p-3">
                                  <h6 className="text-sm font-medium text-gray-900 mb-2">{category}</h6>
                                  <div className="space-y-1">
                                    {perms.map((perm) => (
                                      <div key={perm.id} className="flex items-center justify-between text-sm">
                                        <span className="text-gray-700">{perm.name}</span>
                                        <span className="text-xs text-gray-500">{perm.action}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Sessions Tab */}
                    {selectedTab === 'SESSIONS' && (
                      <div className="space-y-6">
                        <h4 className="text-lg font-semibold text-gray-900">Active User Sessions</h4>
                        
                        <div className="bg-white shadow overflow-hidden sm:rounded-md">
                          <ul className="divide-y divide-gray-200">
                            {sessions.filter(s => s.isActive).map((session) => {
                              const user = users.find(u => u.id === session.userId);
                              const timeRemaining = Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / (1000 * 60)));
                              
                              return (
                                <li key={session.id}>
                                  <div className="px-6 py-4 flex items-center justify-between">
                                    <div className="flex items-center space-x-4">
                                      <div className="flex-shrink-0">
                                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                                          <ClockIcon className="h-5 w-5 text-green-600" />
                                        </div>
                                      </div>
                                      
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-gray-900">
                                          {user ? `${user.firstName} ${user.lastName}` : 'Unknown User'}
                                        </p>
                                        <div className="mt-1 text-sm text-gray-500 space-y-1">
                                          <div className="flex items-center space-x-4">
                                            <span>IP: {session.ipAddress}</span>
                                            {session.location && (
                                              <>
                                                <span>•</span>
                                                <span>{session.location}</span>
                                              </>
                                            )}
                                          </div>
                                          <div className="flex items-center space-x-4">
                                            <span>Started: {format(session.startTime, 'MMM d, h:mm a')}</span>
                                            <span>•</span>
                                            <span>Last activity: {format(session.lastActivity, 'h:mm a')}</span>
                                            <span>•</span>
                                            <span className={timeRemaining < 60 ? 'text-red-600' : 'text-gray-500'}>
                                              Expires in {timeRemaining}m
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center space-x-2">
                                      <button
                                        onClick={() => terminateSession(session.id)}
                                        disabled={isProcessing}
                                        className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                                      >
                                        Terminate
                                      </button>
                                    </div>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                          
                          {sessions.filter(s => s.isActive).length === 0 && (
                            <div className="text-center py-12">
                              <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
                              <h3 className="mt-2 text-sm font-medium text-gray-900">No active sessions</h3>
                              <p className="mt-1 text-sm text-gray-500">
                                All users are currently logged out.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Access Requests Tab */}
                    {selectedTab === 'REQUESTS' && (
                      <div className="space-y-6">
                        <h4 className="text-lg font-semibold text-gray-900">Access Requests</h4>
                        
                        <div className="space-y-4">
                          {accessRequests.map((request) => (
                            <div key={request.id} className="bg-white border border-gray-200 rounded-lg p-6">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-3 mb-3">
                                    <h5 className="text-sm font-medium text-gray-900">
                                      {request.requestType.replace('_', ' ')} Request
                                    </h5>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRequestStatusColor(request.status)}`}>
                                      {request.status}
                                    </span>
                                    {differenceInDays(request.expiresAt, new Date()) <= 1 && request.status === 'PENDING' && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                        Expires Soon
                                      </span>
                                    )}
                                  </div>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-3">
                                    <div>
                                      <span className="font-medium text-gray-700">Requester:</span>
                                      <span className="ml-2">{request.requesterName}</span>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-700">Target User:</span>
                                      <span className="ml-2">{request.targetUserName}</span>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-700">Requested:</span>
                                      <span className="ml-2">{format(request.requestedAt, 'MMM d, yyyy h:mm a')}</span>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-700">Expires:</span>
                                      <span className="ml-2">{format(request.expiresAt, 'MMM d, yyyy')}</span>
                                    </div>
                                  </div>
                                  
                                  <p className="text-sm text-gray-600 mb-3">
                                    <span className="font-medium">Justification:</span> {request.justification}
                                  </p>
                                  
                                  {request.requestedRoles && (
                                    <div className="mb-3">
                                      <span className="text-sm font-medium text-gray-700">Requested Roles:</span>
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {request.requestedRoles.map(roleId => {
                                          const role = roles.find(r => r.id === roleId);
                                          return (
                                            <span key={roleId} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                              {role?.name || roleId}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {request.reviewNotes && (
                                    <div className="mt-3 p-3 bg-gray-50 rounded">
                                      <p className="text-sm">
                                        <span className="font-medium">Review Notes:</span> {request.reviewNotes}
                                      </p>
                                      <p className="text-xs text-gray-500 mt-1">
                                        Reviewed by {request.reviewedBy} on {request.reviewedAt && format(request.reviewedAt, 'MMM d, yyyy h:mm a')}
                                      </p>
                                    </div>
                                  )}
                                </div>
                                
                                {request.status === 'PENDING' && (
                                  <div className="flex items-center space-x-2 ml-4">
                                    <button
                                      onClick={() => approveAccessRequest(request.id, true, 'Request approved')}
                                      disabled={isProcessing}
                                      className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                                    >
                                      <CheckCircleIcon className="h-4 w-4 mr-1" />
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => approveAccessRequest(request.id, false, 'Request denied')}
                                      disabled={isProcessing}
                                      className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                                    >
                                      <XCircleIcon className="h-4 w-4 mr-1" />
                                      Deny
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                          
                          {accessRequests.length === 0 && (
                            <div className="text-center py-12">
                              <KeyIcon className="mx-auto h-12 w-12 text-gray-400" />
                              <h3 className="mt-2 text-sm font-medium text-gray-900">No access requests</h3>
                              <p className="mt-1 text-sm text-gray-500">
                                No pending access requests at this time.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Audit Log Tab */}
                    {selectedTab === 'AUDIT' && (
                      <div className="space-y-6">
                        <h4 className="text-lg font-semibold text-gray-900">Audit Log</h4>
                        
                        <div className="text-center py-12">
                          <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                          <h3 className="mt-2 text-sm font-medium text-gray-900">Audit Log</h3>
                          <p className="mt-1 text-sm text-gray-500">
                            Comprehensive audit trail of all user actions and system events.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-50 px-6 py-4 flex justify-between">
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSuccess();
                        toast.success('User management updated');
                      }}
                      className="inline-flex justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
                    >
                      <CheckCircleIcon className="h-5 w-5 mr-2" />
                      Save Changes
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};