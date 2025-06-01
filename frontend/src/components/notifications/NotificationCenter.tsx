import { useState, useEffect, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  XMarkIcon,
  BellIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
  ClockIcon,
  UserIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  EyeIcon,
  TrashIcon,
  CogIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ArchiveBoxIcon,
  CheckIcon,
  BellSlashIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { format, differenceInMinutes, differenceInHours, differenceInDays } from 'date-fns';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Notification {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  timestamp: Date;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'UNREAD' | 'READ' | 'ARCHIVED' | 'DISMISSED';
  actionRequired: boolean;
  actionUrl?: string;
  actionText?: string;
  relatedEntity?: {
    type: 'LOAN' | 'APPLICATION' | 'PAYMENT' | 'USER' | 'SYSTEM';
    id: string;
    name?: string;
  };
  metadata?: Record<string, any>;
  expiresAt?: Date;
  createdBy?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

interface NotificationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: NotificationCategory;
  trigger: NotificationTrigger;
  conditions: NotificationCondition[];
  actions: NotificationAction[];
  recipients: NotificationRecipient[];
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  cooldown?: number; // Minutes between similar notifications
  schedule?: NotificationSchedule;
}

interface NotificationSettings {
  emailEnabled: boolean;
  smsEnabled: boolean;
  browserEnabled: boolean;
  soundEnabled: boolean;
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
  };
  categories: Record<NotificationCategory, {
    enabled: boolean;
    methods: ('EMAIL' | 'SMS' | 'BROWSER' | 'SOUND')[];
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }>;
}

type NotificationType = 
  | 'LOAN_STATUS_CHANGE' 
  | 'PAYMENT_RECEIVED' 
  | 'PAYMENT_FAILED' 
  | 'PAYMENT_DUE' 
  | 'DELINQUENCY_ALERT' 
  | 'COMPLIANCE_ISSUE' 
  | 'DOCUMENT_RECEIVED' 
  | 'UNDERWRITING_DECISION' 
  | 'SYSTEM_ALERT' 
  | 'USER_ACTION_REQUIRED'
  | 'MODIFICATION_APPLIED'
  | 'COLLECTIONS_UPDATE'
  | 'ORIGINATION_STAGE';

type NotificationCategory = 
  | 'PAYMENTS' 
  | 'LOANS' 
  | 'COMPLIANCE' 
  | 'DOCUMENTS' 
  | 'UNDERWRITING' 
  | 'COLLECTIONS' 
  | 'ORIGINATION'
  | 'SYSTEM' 
  | 'SECURITY';

interface NotificationTrigger {
  event: string;
  entityType: string;
  conditions: string[];
}

interface NotificationCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'regex';
  value: any;
}

interface NotificationAction {
  type: 'EMAIL' | 'SMS' | 'BROWSER' | 'WEBHOOK' | 'SYSTEM_ACTION';
  target: string;
  template?: string;
  delay?: number; // Minutes to delay action
}

interface NotificationRecipient {
  type: 'USER' | 'ROLE' | 'DEPARTMENT' | 'EXTERNAL';
  identifier: string;
  name: string;
}

interface NotificationSchedule {
  enabled: boolean;
  days: number[]; // 0-6 (Sunday-Saturday)
  startTime: string;
  endTime: string;
  timezone: string;
}

export const NotificationCenter = ({ isOpen, onClose, onSuccess }: NotificationCenterProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [selectedTab, setSelectedTab] = useState<'NOTIFICATIONS' | 'RULES' | 'SETTINGS' | 'ANALYTICS'>('NOTIFICATIONS');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'timestamp' | 'priority' | 'category'>('timestamp');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    loadNotifications();
    loadNotificationRules();
    loadNotificationSettings();
    
    // Set up real-time notification polling
    const interval = setInterval(loadNotifications, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Play notification sound for new high-priority notifications
    if (soundEnabled && notifications.some(n => n.status === 'UNREAD' && n.priority === 'CRITICAL')) {
      playNotificationSound();
    }
  }, [notifications, soundEnabled]);

  const loadNotifications = async () => {
    // Demo notifications data
    setNotifications([
      {
        id: 'notif_001',
        type: 'PAYMENT_FAILED',
        category: 'PAYMENTS',
        title: 'Payment Failed',
        message: 'Payment of $2,150.00 failed for loan APP-001 due to insufficient funds',
        timestamp: new Date(Date.now() - 10 * 60 * 1000),
        priority: 'HIGH',
        status: 'UNREAD',
        actionRequired: true,
        actionUrl: '/loans/APP-001/payments',
        actionText: 'Retry Payment',
        relatedEntity: {
          type: 'LOAN',
          id: 'APP-001',
          name: 'John Smith - Mortgage',
        },
        metadata: {
          amount: 2150.00,
          failureReason: 'NSF',
          retryCount: 1,
        },
      },
      {
        id: 'notif_002',
        type: 'DELINQUENCY_ALERT',
        category: 'COLLECTIONS',
        title: 'Loan Delinquency Alert',
        message: 'Loan APP-003 is now 30 days past due. Automatic collections workflow initiated.',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        priority: 'CRITICAL',
        status: 'UNREAD',
        actionRequired: true,
        actionUrl: '/collections/APP-003',
        actionText: 'Manage Collections',
        relatedEntity: {
          type: 'LOAN',
          id: 'APP-003',
          name: 'Alice Johnson - Personal Loan',
        },
        metadata: {
          daysPastDue: 30,
          amount: 1850.00,
          bucket: '30-59',
        },
      },
      {
        id: 'notif_003',
        type: 'UNDERWRITING_DECISION',
        category: 'UNDERWRITING',
        title: 'Underwriting Decision Required',
        message: 'Application APP-005 requires manual underwriting review due to credit exceptions',
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
        priority: 'MEDIUM',
        status: 'UNREAD',
        actionRequired: true,
        actionUrl: '/underwriting/APP-005',
        actionText: 'Review Application',
        relatedEntity: {
          type: 'APPLICATION',
          id: 'APP-005',
          name: 'Michael Brown - Home Purchase',
        },
        metadata: {
          creditScore: 580,
          dti: 45,
          exceptions: ['Low credit score', 'High DTI ratio'],
        },
      },
      {
        id: 'notif_004',
        type: 'COMPLIANCE_ISSUE',
        category: 'COMPLIANCE',
        title: 'SCRA Verification Required',
        message: 'Military status verification required for borrower in loan APP-007',
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
        priority: 'HIGH',
        status: 'READ',
        actionRequired: true,
        actionUrl: '/compliance/scra/APP-007',
        actionText: 'Verify Military Status',
        relatedEntity: {
          type: 'LOAN',
          id: 'APP-007',
          name: 'David Wilson - VA Loan',
        },
        metadata: {
          regulation: 'SCRA',
          deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        },
      },
      {
        id: 'notif_005',
        type: 'DOCUMENT_RECEIVED',
        category: 'DOCUMENTS',
        title: 'Document Uploaded',
        message: 'Income verification documents received for application APP-008',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        priority: 'LOW',
        status: 'READ',
        actionRequired: false,
        relatedEntity: {
          type: 'APPLICATION',
          id: 'APP-008',
          name: 'Sarah Martinez - Refinance',
        },
        metadata: {
          documentType: 'INCOME_VERIFICATION',
          documentCount: 3,
        },
      },
      {
        id: 'notif_006',
        type: 'SYSTEM_ALERT',
        category: 'SYSTEM',
        title: 'System Maintenance Scheduled',
        message: 'Planned maintenance window scheduled for tomorrow 2:00 AM - 4:00 AM EST',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        priority: 'MEDIUM',
        status: 'read',
        actionRequired: false,
        metadata: {
          maintenanceStart: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
          maintenanceDuration: 120, // minutes
          affectedSystems: ['Loan Origination', 'Payment Processing'],
        },
      },
    ]);
  };

  const loadNotificationRules = async () => {
    // Demo notification rules
    setRules([
      {
        id: 'rule_001',
        name: 'Payment Failure Alert',
        description: 'Alert when payment fails for any loan',
        enabled: true,
        category: 'PAYMENTS',
        trigger: {
          event: 'payment_failed',
          entityType: 'payment',
          conditions: ['status = failed'],
        },
        conditions: [],
        actions: [
          { type: 'EMAIL', target: 'collections@company.com', template: 'payment_failure' },
          { type: 'BROWSER', target: 'collections_team' },
        ],
        recipients: [
          { type: 'ROLE', identifier: 'collections_agent', name: 'Collections Agents' },
          { type: 'ROLE', identifier: 'loan_officer', name: 'Loan Officers' },
        ],
        priority: 'HIGH',
        cooldown: 60,
      },
      {
        id: 'rule_002',
        name: 'Delinquency Escalation',
        description: 'Alert when loan becomes delinquent',
        enabled: true,
        category: 'COLLECTIONS',
        trigger: {
          event: 'loan_delinquent',
          entityType: 'loan',
          conditions: ['days_past_due > 0'],
        },
        conditions: [
          { field: 'days_past_due', operator: 'greater_than', value: 0 },
        ],
        actions: [
          { type: 'EMAIL', target: 'collections@company.com' },
          { type: 'BROWSER', target: 'all_users' },
          { type: 'SYSTEM_ACTION', target: 'start_collections_workflow' },
        ],
        recipients: [
          { type: 'ROLE', identifier: 'collections_manager', name: 'Collections Manager' },
        ],
        priority: 'CRITICAL',
        cooldown: 1440, // 24 hours
      },
      {
        id: 'rule_003',
        name: 'Underwriting Queue Alert',
        description: 'Alert when underwriting queue exceeds threshold',
        enabled: true,
        category: 'UNDERWRITING',
        trigger: {
          event: 'queue_threshold_exceeded',
          entityType: 'application',
          conditions: ['queue_count > 10'],
        },
        conditions: [
          { field: 'queue_count', operator: 'greater_than', value: 10 },
        ],
        actions: [
          { type: 'EMAIL', target: 'underwriting@company.com' },
          { type: 'BROWSER', target: 'underwriting_team' },
        ],
        recipients: [
          { type: 'ROLE', identifier: 'underwriter', name: 'Underwriters' },
          { type: 'ROLE', identifier: 'underwriting_manager', name: 'Underwriting Manager' },
        ],
        priority: 'MEDIUM',
        cooldown: 120,
      },
    ]);
  };

  const loadNotificationSettings = async () => {
    // Demo notification settings
    setSettings({
      emailEnabled: true,
      smsEnabled: false,
      browserEnabled: true,
      soundEnabled: true,
      quietHours: {
        enabled: true,
        startTime: '22:00',
        endTime: '06:00',
      },
      categories: {
        PAYMENTS: {
          enabled: true,
          methods: ['EMAIL', 'BROWSER'],
          priority: 'HIGH',
        },
        LOANS: {
          enabled: true,
          methods: ['EMAIL', 'BROWSER'],
          priority: 'MEDIUM',
        },
        COMPLIANCE: {
          enabled: true,
          methods: ['EMAIL', 'BROWSER', 'SMS'],
          priority: 'CRITICAL',
        },
        DOCUMENTS: {
          enabled: true,
          methods: ['EMAIL'],
          priority: 'LOW',
        },
        UNDERWRITING: {
          enabled: true,
          methods: ['EMAIL', 'BROWSER'],
          priority: 'MEDIUM',
        },
        COLLECTIONS: {
          enabled: true,
          methods: ['EMAIL', 'BROWSER', 'SMS'],
          priority: 'HIGH',
        },
        ORIGINATION: {
          enabled: true,
          methods: ['EMAIL', 'BROWSER'],
          priority: 'MEDIUM',
        },
        SYSTEM: {
          enabled: true,
          methods: ['EMAIL', 'BROWSER'],
          priority: 'MEDIUM',
        },
        SECURITY: {
          enabled: true,
          methods: ['EMAIL', 'BROWSER', 'SMS'],
          priority: 'CRITICAL',
        },
      },
    });
  };

  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.log('Could not play notification sound:', e));
    }
  };

  const markAsRead = async (notificationIds: string[]) => {
    setNotifications(prev => prev.map(notif => 
      notificationIds.includes(notif.id) 
        ? { ...notif, status: 'READ' as const }
        : notif
    ));
  };

  const markAsArchived = async (notificationIds: string[]) => {
    setNotifications(prev => prev.map(notif => 
      notificationIds.includes(notif.id) 
        ? { ...notif, status: 'ARCHIVED' as const }
        : notif
    ));
  };

  const deleteNotifications = async (notificationIds: string[]) => {
    setNotifications(prev => prev.filter(notif => !notificationIds.includes(notif.id)));
    setSelectedNotifications(new Set());
    toast.success(`${notificationIds.length} notification(s) deleted`);
  };

  const acknowledgeNotification = async (notificationId: string) => {
    setNotifications(prev => prev.map(notif => 
      notif.id === notificationId 
        ? { 
            ...notif, 
            acknowledgedBy: 'Current User',
            acknowledgedAt: new Date(),
            status: 'READ' as const,
          }
        : notif
    ));
    toast.success('Notification acknowledged');
  };

  const bulkAction = async (action: 'read' | 'archive' | 'delete') => {
    setIsProcessing(true);
    try {
      const ids = Array.from(selectedNotifications);
      
      switch (action) {
        case 'read':
          await markAsRead(ids);
          toast.success(`${ids.length} notification(s) marked as read`);
          break;
        case 'archive':
          await markAsArchived(ids);
          toast.success(`${ids.length} notification(s) archived`);
          break;
        case 'delete':
          await deleteNotifications(ids);
          break;
      }
      
      setSelectedNotifications(new Set());
    } catch (error) {
      toast.error('Failed to perform bulk action');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleNotificationSelection = (notificationId: string) => {
    const newSelection = new Set(selectedNotifications);
    if (newSelection.has(notificationId)) {
      newSelection.delete(notificationId);
    } else {
      newSelection.add(notificationId);
    }
    setSelectedNotifications(newSelection);
  };

  const selectAllNotifications = () => {
    const visibleNotificationIds = filteredNotifications.map(n => n.id);
    setSelectedNotifications(new Set(visibleNotificationIds));
  };

  const clearSelection = () => {
    setSelectedNotifications(new Set());
  };

  const getRelativeTime = (timestamp: Date) => {
    const now = new Date();
    const diffMinutes = differenceInMinutes(now, timestamp);
    const diffHours = differenceInHours(now, timestamp);
    const diffDays = differenceInDays(now, timestamp);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getNotificationIcon = (type: NotificationType, priority: string) => {
    const baseClasses = "h-5 w-5";
    const colorClasses = priority === 'CRITICAL' ? 'text-red-500' :
                        priority === 'HIGH' ? 'text-orange-500' :
                        priority === 'MEDIUM' ? 'text-yellow-500' :
                        'text-blue-500';

    switch (type) {
      case 'PAYMENT_FAILED':
        return <XCircleIcon className={`${baseClasses} ${colorClasses}`} />;
      case 'PAYMENT_RECEIVED':
        return <CheckCircleIcon className={`${baseClasses} text-green-500`} />;
      case 'DELINQUENCY_ALERT':
        return <ExclamationTriangleIcon className={`${baseClasses} ${colorClasses}`} />;
      case 'COMPLIANCE_ISSUE':
        return <ShieldCheckIcon className={`${baseClasses} ${colorClasses}`} />;
      case 'DOCUMENT_RECEIVED':
        return <DocumentTextIcon className={`${baseClasses} ${colorClasses}`} />;
      case 'UNDERWRITING_DECISION':
        return <UserIcon className={`${baseClasses} ${colorClasses}`} />;
      case 'SYSTEM_ALERT':
        return <InformationCircleIcon className={`${baseClasses} ${colorClasses}`} />;
      default:
        return <BellIcon className={`${baseClasses} ${colorClasses}`} />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'text-red-600 bg-red-100';
      case 'HIGH': return 'text-orange-600 bg-orange-100';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100';
      case 'LOW': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const filteredNotifications = notifications
    .filter(notif => {
      if (!showArchived && notif.status === 'ARCHIVED') return false;
      if (filterCategory !== 'all' && notif.category !== filterCategory) return false;
      if (filterStatus !== 'all' && notif.status !== filterStatus) return false;
      if (filterPriority !== 'all' && notif.priority !== filterPriority) return false;
      if (searchTerm && !notif.title.toLowerCase().includes(searchTerm.toLowerCase()) && 
          !notif.message.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'timestamp':
          return b.timestamp.getTime() - a.timestamp.getTime();
        case 'priority':
          const priorityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        case 'category':
          return a.category.localeCompare(b.category);
        default:
          return 0;
      }
    });

  const unreadCount = notifications.filter(n => n.status === 'UNREAD').length;
  const actionRequiredCount = notifications.filter(n => n.actionRequired && n.status !== 'ARCHIVED').length;

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
                  <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-purple-100 border border-purple-200">
                          <BellIcon className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <Dialog.Title as="h3" className="text-xl font-bold leading-6 text-gray-900">
                            Notification Center
                          </Dialog.Title>
                          <p className="mt-1 text-sm text-gray-600 flex items-center space-x-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              {unreadCount} unread
                            </span>
                            <span>•</span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                              {actionRequiredCount} require action
                            </span>
                            <span>•</span>
                            <span>{notifications.length} total</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setSoundEnabled(!soundEnabled)}
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors shadow-sm ${
                            soundEnabled 
                              ? 'bg-purple-100 text-purple-600 hover:bg-purple-200' 
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          }`}
                          title={soundEnabled ? 'Disable sound' : 'Enable sound'}
                        >
                          {soundEnabled ? <SpeakerWaveIcon className="h-4 w-4" /> : <SpeakerXMarkIcon className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
                          onClick={onClose}
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="px-6 py-6">
                    {/* Tab Navigation */}
                    <div className="border-b border-gray-200 mb-6">
                      <nav className="-mb-px flex space-x-8">
                        {[
                          { key: 'NOTIFICATIONS', label: 'Notifications', icon: BellIcon, count: unreadCount },
                          { key: 'RULES', label: 'Notification Rules', icon: CogIcon, count: rules.filter(r => r.enabled).length },
                          { key: 'SETTINGS', label: 'Settings', icon: CogIcon },
                          { key: 'ANALYTICS', label: 'Analytics', icon: ChartBarIcon },
                        ].map((tab) => {
                          const IconComponent = tab.icon;
                          return (
                            <button
                              key={tab.key}
                              onClick={() => setSelectedTab(tab.key as any)}
                              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                                selectedTab === tab.key
                                  ? 'border-purple-500 text-purple-600'
                                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                              }`}
                            >
                              <IconComponent className="h-4 w-4" />
                              <span>{tab.label}</span>
                              {tab.count !== undefined && tab.count > 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  {tab.count}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </nav>
                    </div>

                    {/* Notifications Tab */}
                    {selectedTab === 'NOTIFICATIONS' && (
                      <div className="space-y-6">
                        {/* Filters and Actions */}
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="flex items-center space-x-4">
                            {/* Search */}
                            <div className="relative">
                              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                              <input
                                type="text"
                                placeholder="Search notifications..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                              />
                            </div>

                            {/* Filters */}
                            <select
                              value={filterCategory}
                              onChange={(e) => setFilterCategory(e.target.value)}
                              className="rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                            >
                              <option value="all">All Categories</option>
                              <option value="PAYMENTS">Payments</option>
                              <option value="LOANS">Loans</option>
                              <option value="COMPLIANCE">Compliance</option>
                              <option value="DOCUMENTS">Documents</option>
                              <option value="UNDERWRITING">Underwriting</option>
                              <option value="COLLECTIONS">Collections</option>
                              <option value="ORIGINATION">Origination</option>
                              <option value="SYSTEM">System</option>
                            </select>

                            <select
                              value={filterStatus}
                              onChange={(e) => setFilterStatus(e.target.value)}
                              className="rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                            >
                              <option value="all">All Status</option>
                              <option value="UNREAD">Unread</option>
                              <option value="READ">Read</option>
                              <option value="ARCHIVED">Archived</option>
                            </select>

                            <select
                              value={filterPriority}
                              onChange={(e) => setFilterPriority(e.target.value)}
                              className="rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                            >
                              <option value="all">All Priority</option>
                              <option value="CRITICAL">Critical</option>
                              <option value="HIGH">High</option>
                              <option value="MEDIUM">Medium</option>
                              <option value="LOW">Low</option>
                            </select>

                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={showArchived}
                                onChange={(e) => setShowArchived(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                              />
                              <span className="text-sm text-gray-700">Show archived</span>
                            </label>
                          </div>

                          <div className="flex items-center space-x-2">
                            {selectedNotifications.size > 0 && (
                              <>
                                <span className="text-sm text-gray-600">
                                  {selectedNotifications.size} selected
                                </span>
                                <button
                                  onClick={() => bulkAction('read')}
                                  disabled={isProcessing}
                                  className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                                >
                                  <CheckIcon className="h-4 w-4 mr-1" />
                                  Mark Read
                                </button>
                                <button
                                  onClick={() => bulkAction('archive')}
                                  disabled={isProcessing}
                                  className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                                >
                                  <ArchiveBoxIcon className="h-4 w-4 mr-1" />
                                  Archive
                                </button>
                                <button
                                  onClick={() => bulkAction('delete')}
                                  disabled={isProcessing}
                                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                                >
                                  <TrashIcon className="h-4 w-4 mr-1" />
                                  Delete
                                </button>
                                <button
                                  onClick={clearSelection}
                                  className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                                >
                                  Clear
                                </button>
                              </>
                            )}
                            
                            {filteredNotifications.length > 0 && selectedNotifications.size === 0 && (
                              <button
                                onClick={selectAllNotifications}
                                className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                              >
                                Select All
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Notifications List */}
                        <div className="space-y-3">
                          {filteredNotifications.map((notification) => (
                            <div
                              key={notification.id}
                              className={`bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${
                                notification.status === 'UNREAD' ? 'border-purple-200 bg-purple-50' : 'border-gray-200'
                              } ${selectedNotifications.has(notification.id) ? 'ring-2 ring-purple-500' : ''}`}
                            >
                              <div className="flex items-start space-x-4">
                                <input
                                  type="checkbox"
                                  checked={selectedNotifications.has(notification.id)}
                                  onChange={() => toggleNotificationSelection(notification.id)}
                                  className="mt-1 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                />
                                
                                <div className="flex-shrink-0 mt-1">
                                  {getNotificationIcon(notification.type, notification.priority)}
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-2 mb-1">
                                        <h4 className={`text-sm font-medium ${
                                          notification.status === 'UNREAD' ? 'text-gray-900' : 'text-gray-700'
                                        }`}>
                                          {notification.title}
                                        </h4>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(notification.priority)}`}>
                                          {notification.priority}
                                        </span>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                          {notification.category}
                                        </span>
                                      </div>
                                      
                                      <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
                                      
                                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                                        <span>{getRelativeTime(notification.timestamp)}</span>
                                        {notification.relatedEntity && (
                                          <>
                                            <span>•</span>
                                            <span>{notification.relatedEntity.type}: {notification.relatedEntity.name || notification.relatedEntity.id}</span>
                                          </>
                                        )}
                                        {notification.acknowledgedBy && (
                                          <>
                                            <span>•</span>
                                            <span>Acknowledged by {notification.acknowledgedBy}</span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center space-x-2 ml-4">
                                      {notification.actionRequired && (
                                        <button
                                          onClick={() => acknowledgeNotification(notification.id)}
                                          className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
                                        >
                                          <ArrowRightIcon className="h-4 w-4 mr-1" />
                                          {notification.actionText || 'Take Action'}
                                        </button>
                                      )}
                                      
                                      <button
                                        onClick={() => markAsRead([notification.id])}
                                        className="inline-flex items-center p-1 border border-gray-300 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                                        title="Mark as read"
                                      >
                                        <EyeIcon className="h-4 w-4" />
                                      </button>
                                      
                                      <button
                                        onClick={() => markAsArchived([notification.id])}
                                        className="inline-flex items-center p-1 border border-gray-300 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                                        title="Archive"
                                      >
                                        <ArchiveBoxIcon className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}

                          {filteredNotifications.length === 0 && (
                            <div className="text-center py-12">
                              <BellSlashIcon className="mx-auto h-12 w-12 text-gray-400" />
                              <h3 className="mt-2 text-sm font-medium text-gray-900">No notifications found</h3>
                              <p className="mt-1 text-sm text-gray-500">
                                {searchTerm || filterCategory !== 'all' || filterStatus !== 'all' || filterPriority !== 'all'
                                  ? 'Try adjusting your filters to see more notifications.'
                                  : 'You\'re all caught up! No new notifications.'}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Rules Tab */}
                    {selectedTab === 'RULES' && (
                      <div className="space-y-6">
                        <div className="flex justify-between items-center">
                          <h4 className="text-lg font-semibold text-gray-900">Notification Rules</h4>
                          <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700">
                            <CogIcon className="h-4 w-4 mr-2" />
                            Create Rule
                          </button>
                        </div>

                        <div className="space-y-4">
                          {rules.map((rule) => (
                            <div key={rule.id} className="bg-white border border-gray-200 rounded-lg p-6">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-3 mb-2">
                                    <h5 className="text-lg font-medium text-gray-900">{rule.name}</h5>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                      rule.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                    }`}>
                                      {rule.enabled ? 'Enabled' : 'Disabled'}
                                    </span>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(rule.priority)}`}>
                                      {rule.priority}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-600 mb-3">{rule.description}</p>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                    <div>
                                      <span className="font-medium text-gray-700">Category:</span>
                                      <span className="ml-2">{rule.category}</span>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-700">Actions:</span>
                                      <span className="ml-2">{rule.actions.length}</span>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-700">Recipients:</span>
                                      <span className="ml-2">{rule.recipients.length}</span>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                  <button className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                                    Edit
                                  </button>
                                  <button className={`inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md ${
                                    rule.enabled 
                                      ? 'text-white bg-red-600 hover:bg-red-700'
                                      : 'text-white bg-green-600 hover:bg-green-700'
                                  }`}>
                                    {rule.enabled ? 'Disable' : 'Enable'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Settings Tab */}
                    {selectedTab === 'SETTINGS' && settings && (
                      <div className="space-y-6">
                        <h4 className="text-lg font-semibold text-gray-900">Notification Settings</h4>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="bg-white border border-gray-200 rounded-lg p-6">
                            <h5 className="text-sm font-medium text-gray-900 mb-4">General Settings</h5>
                            <div className="space-y-4">
                              <label className="flex items-center space-x-3">
                                <input
                                  type="checkbox"
                                  checked={settings.emailEnabled}
                                  onChange={(e) => setSettings({...settings, emailEnabled: e.target.checked})}
                                  className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                />
                                <span className="text-sm text-gray-700">Email notifications</span>
                              </label>
                              
                              <label className="flex items-center space-x-3">
                                <input
                                  type="checkbox"
                                  checked={settings.smsEnabled}
                                  onChange={(e) => setSettings({...settings, smsEnabled: e.target.checked})}
                                  className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                />
                                <span className="text-sm text-gray-700">SMS notifications</span>
                              </label>
                              
                              <label className="flex items-center space-x-3">
                                <input
                                  type="checkbox"
                                  checked={settings.browserEnabled}
                                  onChange={(e) => setSettings({...settings, browserEnabled: e.target.checked})}
                                  className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                />
                                <span className="text-sm text-gray-700">Browser notifications</span>
                              </label>
                              
                              <label className="flex items-center space-x-3">
                                <input
                                  type="checkbox"
                                  checked={settings.soundEnabled}
                                  onChange={(e) => setSettings({...settings, soundEnabled: e.target.checked})}
                                  className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                />
                                <span className="text-sm text-gray-700">Sound notifications</span>
                              </label>
                            </div>
                          </div>

                          <div className="bg-white border border-gray-200 rounded-lg p-6">
                            <h5 className="text-sm font-medium text-gray-900 mb-4">Quiet Hours</h5>
                            <div className="space-y-4">
                              <label className="flex items-center space-x-3">
                                <input
                                  type="checkbox"
                                  checked={settings.quietHours.enabled}
                                  onChange={(e) => setSettings({
                                    ...settings, 
                                    quietHours: {...settings.quietHours, enabled: e.target.checked}
                                  })}
                                  className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                />
                                <span className="text-sm text-gray-700">Enable quiet hours</span>
                              </label>
                              
                              {settings.quietHours.enabled && (
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700">Start Time</label>
                                    <input
                                      type="time"
                                      value={settings.quietHours.startTime}
                                      onChange={(e) => setSettings({
                                        ...settings,
                                        quietHours: {...settings.quietHours, startTime: e.target.value}
                                      })}
                                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700">End Time</label>
                                    <input
                                      type="time"
                                      value={settings.quietHours.endTime}
                                      onChange={(e) => setSettings({
                                        ...settings,
                                        quietHours: {...settings.quietHours, endTime: e.target.value}
                                      })}
                                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-lg p-6">
                          <h5 className="text-sm font-medium text-gray-900 mb-4">Category Settings</h5>
                          <div className="space-y-4">
                            {Object.entries(settings.categories).map(([category, config]) => (
                              <div key={category} className="flex items-center justify-between py-3 border-b border-gray-100">
                                <div className="flex items-center space-x-3">
                                  <input
                                    type="checkbox"
                                    checked={config.enabled}
                                    onChange={(e) => setSettings({
                                      ...settings,
                                      categories: {
                                        ...settings.categories,
                                        [category]: {...config, enabled: e.target.checked}
                                      }
                                    })}
                                    className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                  />
                                  <span className="text-sm font-medium text-gray-900">{category}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(config.priority)}`}>
                                    {config.priority}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {config.methods.join(', ')}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Analytics Tab */}
                    {selectedTab === 'ANALYTICS' && (
                      <div className="space-y-6">
                        <h4 className="text-lg font-semibold text-gray-900">Notification Analytics</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                          <div className="bg-white overflow-hidden shadow rounded-lg">
                            <div className="p-5">
                              <div className="flex items-center">
                                <div className="flex-shrink-0">
                                  <BellIcon className="h-6 w-6 text-purple-600" />
                                </div>
                                <div className="ml-5 w-0 flex-1">
                                  <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Total Sent</dt>
                                    <dd className="text-lg font-semibold text-gray-900">2,547</dd>
                                  </dl>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="bg-white overflow-hidden shadow rounded-lg">
                            <div className="p-5">
                              <div className="flex items-center">
                                <div className="flex-shrink-0">
                                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                                </div>
                                <div className="ml-5 w-0 flex-1">
                                  <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Delivered</dt>
                                    <dd className="text-lg font-semibold text-gray-900">98.2%</dd>
                                  </dl>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="bg-white overflow-hidden shadow rounded-lg">
                            <div className="p-5">
                              <div className="flex items-center">
                                <div className="flex-shrink-0">
                                  <EyeIcon className="h-6 w-6 text-blue-600" />
                                </div>
                                <div className="ml-5 w-0 flex-1">
                                  <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Read Rate</dt>
                                    <dd className="text-lg font-semibold text-gray-900">76.4%</dd>
                                  </dl>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="bg-white overflow-hidden shadow rounded-lg">
                            <div className="p-5">
                              <div className="flex items-center">
                                <div className="flex-shrink-0">
                                  <ArrowRightIcon className="h-6 w-6 text-orange-600" />
                                </div>
                                <div className="ml-5 w-0 flex-1">
                                  <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Action Rate</dt>
                                    <dd className="text-lg font-semibold text-gray-900">42.1%</dd>
                                  </dl>
                                </div>
                              </div>
                            </div>
                          </div>
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
                        toast.success('Notification settings updated');
                      }}
                      className="inline-flex justify-center rounded-md bg-purple-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-500"
                    >
                      <CheckCircleIcon className="h-5 w-5 mr-2" />
                      Save Settings
                    </button>
                  </div>
                </div>

                {/* Hidden audio element for notification sounds */}
                <audio ref={audioRef} preload="auto">
                  <source src="/notification-sound.mp3" type="audio/mpeg" />
                  <source src="/notification-sound.wav" type="audio/wav" />
                </audio>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};