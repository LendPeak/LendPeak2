import { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  XMarkIcon,
  CogIcon,
  ServerIcon,
  DocumentTextIcon,
  ClockIcon,
  CircleStackIcon,
  WifiIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  PencilIcon,
  PlusIcon,
  DocumentArrowDownIcon,
  LockClosedIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { format } from 'date-fns';

interface SystemConfigurationManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ConfigurationSetting {
  id: string;
  category: ConfigCategory;
  key: string;
  name: string;
  description: string;
  type: ConfigType;
  value: any;
  defaultValue: any;
  required: boolean;
  sensitive: boolean;
  validation?: ValidationRule;
  options?: ConfigOption[];
  lastModified: Date;
  modifiedBy: string;
  environment: 'ALL' | 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';
  isSystem: boolean;
  tags: string[];
}

interface ValidationRule {
  type: 'REGEX' | 'RANGE' | 'LENGTH' | 'EMAIL' | 'URL' | 'CUSTOM';
  rule: string;
  message: string;
  min?: number;
  max?: number;
}

interface ConfigOption {
  value: string;
  label: string;
  description?: string;
}

interface ConfigurationTemplate {
  id: string;
  name: string;
  description: string;
  category: ConfigCategory;
  settings: Partial<ConfigurationSetting>[];
  isPrebuilt: boolean;
}

interface SystemHealth {
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  lastCheck: Date;
  checks: HealthCheck[];
  uptime: number; // seconds
  version: string;
  environment: string;
}

interface HealthCheck {
  name: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  message: string;
  duration: number; // milliseconds
  lastRun: Date;
}

interface SystemLog {
  id: string;
  timestamp: Date;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  category: string;
  message: string;
  details?: Record<string, any>;
  userId?: string;
  ipAddress?: string;
}

interface BackupConfiguration {
  id: string;
  name: string;
  enabled: boolean;
  schedule: string; // cron expression
  retentionDays: number;
  includeDatabase: boolean;
  includeFiles: boolean;
  includeConfigs: boolean;
  destination: 'LOCAL' | 'S3' | 'AZURE' | 'GCP';
  encryption: boolean;
  lastBackup?: Date;
  nextBackup?: Date;
  status: 'IDLE' | 'RUNNING' | 'SUCCESS' | 'FAILED';
}

type ConfigCategory = 
  | 'SYSTEM' 
  | 'DATABASE' 
  | 'SECURITY' 
  | 'NOTIFICATION' 
  | 'LOAN_ENGINE' 
  | 'PAYMENT_PROCESSING' 
  | 'COMPLIANCE' 
  | 'INTEGRATION' 
  | 'UI_PREFERENCES'
  | 'BUSINESS_RULES';

type ConfigType = 
  | 'STRING' 
  | 'NUMBER' 
  | 'BOOLEAN' 
  | 'JSON' 
  | 'PASSWORD' 
  | 'EMAIL' 
  | 'URL' 
  | 'SELECT' 
  | 'MULTI_SELECT'
  | 'FILE_PATH'
  | 'COLOR'
  | 'DATETIME';

export const SystemConfigurationManager = ({ isOpen, onClose, onSuccess }: SystemConfigurationManagerProps) => {
  const [settings, setSettings] = useState<ConfigurationSetting[]>([]);
  const [templates] = useState<ConfigurationTemplate[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [backupConfigs, setBackupConfigs] = useState<BackupConfiguration[]>([]);
  
  const [selectedTab, setSelectedTab] = useState<'SETTINGS' | 'SYSTEM_HEALTH' | 'LOGS' | 'BACKUPS' | 'TEMPLATES' | 'INTEGRATIONS'>('SETTINGS');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterEnvironment, setFilterEnvironment] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showSensitive, setShowSensitive] = useState(false);
  const [editingSetting, setEditingSetting] = useState<ConfigurationSetting | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSettings();
    loadSystemHealth();
    loadSystemLogs();
    loadBackupConfigurations();
  }, []);

  const loadSettings = async () => {
    // Demo configuration settings
    setSettings([
      // System Settings
      {
        id: 'sys_app_name',
        category: 'SYSTEM',
        key: 'app.name',
        name: 'Application Name',
        description: 'The display name of the application',
        type: 'STRING',
        value: 'LendPeak Loan Management System',
        defaultValue: 'LendPeak',
        required: true,
        sensitive: false,
        lastModified: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        modifiedBy: 'admin',
        environment: 'ALL',
        isSystem: true,
        tags: ['branding', 'ui'],
      },
      {
        id: 'sys_session_timeout',
        category: 'SYSTEM',
        key: 'session.timeout',
        name: 'Session Timeout',
        description: 'User session timeout in minutes',
        type: 'NUMBER',
        value: 480,
        defaultValue: 240,
        required: true,
        sensitive: false,
        validation: {
          type: 'RANGE',
          rule: '30-1440',
          message: 'Session timeout must be between 30 minutes and 24 hours',
          min: 30,
          max: 1440,
        },
        lastModified: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        modifiedBy: 'john.smith',
        environment: 'ALL',
        isSystem: true,
        tags: ['security', 'session'],
      },
      
      // Database Settings
      {
        id: 'db_connection_pool',
        category: 'DATABASE',
        key: 'database.pool.size',
        name: 'Database Connection Pool Size',
        description: 'Maximum number of database connections in the pool',
        type: 'NUMBER',
        value: 20,
        defaultValue: 10,
        required: true,
        sensitive: false,
        validation: {
          type: 'RANGE',
          rule: '5-100',
          message: 'Pool size must be between 5 and 100',
          min: 5,
          max: 100,
        },
        lastModified: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        modifiedBy: 'dba',
        environment: 'PRODUCTION',
        isSystem: true,
        tags: ['database', 'performance'],
      },
      {
        id: 'db_backup_enabled',
        category: 'DATABASE',
        key: 'database.backup.enabled',
        name: 'Automatic Database Backups',
        description: 'Enable automatic database backups',
        type: 'BOOLEAN',
        value: true,
        defaultValue: true,
        required: true,
        sensitive: false,
        lastModified: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        modifiedBy: 'admin',
        environment: 'ALL',
        isSystem: true,
        tags: ['database', 'backup'],
      },
      
      // Security Settings
      {
        id: 'sec_mfa_required',
        category: 'SECURITY',
        key: 'security.mfa.required',
        name: 'Require Multi-Factor Authentication',
        description: 'Require MFA for all user accounts',
        type: 'BOOLEAN',
        value: true,
        defaultValue: false,
        required: true,
        sensitive: false,
        lastModified: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        modifiedBy: 'security.admin',
        environment: 'PRODUCTION',
        isSystem: true,
        tags: ['security', 'mfa', 'authentication'],
      },
      {
        id: 'sec_password_policy',
        category: 'SECURITY',
        key: 'security.password.policy',
        name: 'Password Policy',
        description: 'Password complexity requirements',
        type: 'SELECT',
        value: 'STRICT',
        defaultValue: 'MODERATE',
        required: true,
        sensitive: false,
        options: [
          { value: 'BASIC', label: 'Basic (8 chars, mixed case)', description: 'Minimum security requirements' },
          { value: 'MODERATE', label: 'Moderate (10 chars, symbols)', description: 'Standard security requirements' },
          { value: 'STRICT', label: 'Strict (12 chars, all types)', description: 'High security requirements' },
          { value: 'CUSTOM', label: 'Custom Policy', description: 'Define custom password rules' },
        ],
        lastModified: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        modifiedBy: 'security.admin',
        environment: 'ALL',
        isSystem: true,
        tags: ['security', 'password'],
      },
      {
        id: 'sec_api_key',
        category: 'SECURITY',
        key: 'security.api.key',
        name: 'API Security Key',
        description: 'Master API key for internal services',
        type: 'PASSWORD',
        value: 'sk_live_abc123...hidden',
        defaultValue: '',
        required: true,
        sensitive: true,
        validation: {
          type: 'LENGTH',
          rule: '32-128',
          message: 'API key must be between 32 and 128 characters',
          min: 32,
          max: 128,
        },
        lastModified: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        modifiedBy: 'system',
        environment: 'PRODUCTION',
        isSystem: true,
        tags: ['security', 'api', 'sensitive'],
      },
      
      // Loan Engine Settings
      {
        id: 'loan_interest_precision',
        category: 'LOAN_ENGINE',
        key: 'loan.interest.precision',
        name: 'Interest Calculation Precision',
        description: 'Number of decimal places for interest calculations',
        type: 'SELECT',
        value: '6',
        defaultValue: '4',
        required: true,
        sensitive: false,
        options: [
          { value: '2', label: '2 decimal places' },
          { value: '4', label: '4 decimal places' },
          { value: '6', label: '6 decimal places' },
          { value: '8', label: '8 decimal places' },
        ],
        lastModified: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        modifiedBy: 'loan.admin',
        environment: 'ALL',
        isSystem: false,
        tags: ['loan-engine', 'calculations', 'precision'],
      },
      
      // Payment Processing
      {
        id: 'pay_gateway_endpoint',
        category: 'PAYMENT_PROCESSING',
        key: 'payment.gateway.endpoint',
        name: 'Payment Gateway Endpoint',
        description: 'Primary payment processing endpoint URL',
        type: 'URL',
        value: 'https://api.stripe.com/v1',
        defaultValue: 'https://sandbox.stripe.com/v1',
        required: true,
        sensitive: false,
        validation: {
          type: 'URL',
          rule: 'https://',
          message: 'Must be a valid HTTPS URL',
        },
        lastModified: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        modifiedBy: 'payments.admin',
        environment: 'PRODUCTION',
        isSystem: false,
        tags: ['payments', 'gateway', 'integration'],
      },
      
      // Notification Settings
      {
        id: 'notif_email_enabled',
        category: 'NOTIFICATION',
        key: 'notification.email.enabled',
        name: 'Email Notifications Enabled',
        description: 'Enable email notification delivery',
        type: 'BOOLEAN',
        value: true,
        defaultValue: true,
        required: true,
        sensitive: false,
        lastModified: new Date(Date.now() - 12 * 60 * 60 * 1000),
        modifiedBy: 'notification.admin',
        environment: 'ALL',
        isSystem: false,
        tags: ['notifications', 'email'],
      },
      {
        id: 'notif_email_from',
        category: 'NOTIFICATION',
        key: 'notification.email.from',
        name: 'Email From Address',
        description: 'Default sender email address for notifications',
        type: 'EMAIL',
        value: 'noreply@lendpeak.com',
        defaultValue: 'system@company.com',
        required: true,
        sensitive: false,
        validation: {
          type: 'EMAIL',
          rule: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
          message: 'Must be a valid email address',
        },
        lastModified: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        modifiedBy: 'admin',
        environment: 'ALL',
        isSystem: false,
        tags: ['notifications', 'email', 'sender'],
      },
    ]);
  };

  const loadSystemHealth = async () => {
    // Demo system health data
    setSystemHealth({
      status: 'HEALTHY',
      lastCheck: new Date(Date.now() - 5 * 60 * 1000),
      uptime: 2547890, // ~29 days
      version: '2.1.4',
      environment: 'Production',
      checks: [
        {
          name: 'Database Connection',
          status: 'PASS',
          message: 'All database connections healthy',
          duration: 45,
          lastRun: new Date(Date.now() - 5 * 60 * 1000),
        },
        {
          name: 'API Response Time',
          status: 'PASS',
          message: 'Average response time: 142ms',
          duration: 12,
          lastRun: new Date(Date.now() - 5 * 60 * 1000),
        },
        {
          name: 'Memory Usage',
          status: 'WARN',
          message: 'Memory usage at 78% (warning threshold: 75%)',
          duration: 8,
          lastRun: new Date(Date.now() - 5 * 60 * 1000),
        },
        {
          name: 'Disk Space',
          status: 'PASS',
          message: 'Disk usage: 45% of 500GB',
          duration: 15,
          lastRun: new Date(Date.now() - 5 * 60 * 1000),
        },
        {
          name: 'External Services',
          status: 'PASS',
          message: 'All external integrations responding',
          duration: 234,
          lastRun: new Date(Date.now() - 5 * 60 * 1000),
        },
        {
          name: 'Background Jobs',
          status: 'PASS',
          message: '15 jobs in queue, processing normally',
          duration: 6,
          lastRun: new Date(Date.now() - 5 * 60 * 1000),
        },
      ],
    });
  };

  const loadSystemLogs = async () => {
    // Demo system logs
    setSystemLogs([
      {
        id: 'log_001',
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
        level: 'INFO',
        category: 'authentication',
        message: 'User login successful',
        details: { userId: 'user_123', ipAddress: '192.168.1.100' },
        userId: 'user_123',
        ipAddress: '192.168.1.100',
      },
      {
        id: 'log_002',
        timestamp: new Date(Date.now() - 15 * 60 * 1000),
        level: 'WARN',
        category: 'system',
        message: 'High memory usage detected',
        details: { memoryUsage: '78%', threshold: '75%' },
      },
      {
        id: 'log_003',
        timestamp: new Date(Date.now() - 25 * 60 * 1000),
        level: 'ERROR',
        category: 'payment',
        message: 'Payment gateway timeout',
        details: { gateway: 'stripe', timeout: '30s', retryCount: 3 },
      },
      {
        id: 'log_004',
        timestamp: new Date(Date.now() - 45 * 60 * 1000),
        level: 'INFO',
        category: 'configuration',
        message: 'Configuration setting updated',
        details: { setting: 'loan.interest.precision', oldValue: '4', newValue: '6' },
        userId: 'admin',
      },
    ]);
  };

  const loadBackupConfigurations = async () => {
    // Demo backup configurations
    setBackupConfigs([
      {
        id: 'backup_daily',
        name: 'Daily Database Backup',
        enabled: true,
        schedule: '0 2 * * *', // Daily at 2 AM
        retentionDays: 30,
        includeDatabase: true,
        includeFiles: false,
        includeConfigs: true,
        destination: 'S3',
        encryption: true,
        lastBackup: new Date(Date.now() - 6 * 60 * 60 * 1000),
        nextBackup: new Date(Date.now() + 18 * 60 * 60 * 1000),
        status: 'SUCCESS',
      },
      {
        id: 'backup_weekly',
        name: 'Weekly Full Backup',
        enabled: true,
        schedule: '0 1 * * 0', // Weekly on Sunday at 1 AM
        retentionDays: 90,
        includeDatabase: true,
        includeFiles: true,
        includeConfigs: true,
        destination: 'S3',
        encryption: true,
        lastBackup: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        nextBackup: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        status: 'SUCCESS',
      },
    ]);
  };

  const updateSetting = async (settingId: string, newValue: any) => {
    setIsProcessing(true);
    try {
      setSettings(prev => prev.map(setting => 
        setting.id === settingId 
          ? { 
              ...setting, 
              value: newValue,
              lastModified: new Date(),
              modifiedBy: 'Current User',
            }
          : setting
      ));
      
      setPendingChanges(prev => new Set([...prev, settingId]));
      toast.success('Setting updated (pending restart)');
    } catch (error) {
      toast.error('Failed to update setting');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetSetting = async (settingId: string) => {
    const setting = settings.find(s => s.id === settingId);
    if (setting) {
      await updateSetting(settingId, setting.defaultValue);
      toast.success('Setting reset to default value');
    }
  };

  const applyPendingChanges = async () => {
    setIsProcessing(true);
    try {
      // Simulate applying configuration changes
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setPendingChanges(new Set());
      toast.success('All configuration changes applied successfully');
    } catch (error) {
      toast.error('Failed to apply configuration changes');
    } finally {
      setIsProcessing(false);
    }
  };

  const runHealthCheck = async () => {
    setIsProcessing(true);
    try {
      // Simulate health check
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      await loadSystemHealth();
      toast.success('System health check completed');
    } catch (error) {
      toast.error('Health check failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const runBackup = async (backupId: string) => {
    setIsProcessing(true);
    try {
      setBackupConfigs(prev => prev.map(backup => 
        backup.id === backupId 
          ? { ...backup, status: 'RUNNING' }
          : backup
      ));

      // Simulate backup process
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      setBackupConfigs(prev => prev.map(backup => 
        backup.id === backupId 
          ? { 
              ...backup, 
              status: 'SUCCESS',
              lastBackup: new Date(),
            }
          : backup
      ));
      
      toast.success('Backup completed successfully');
    } catch (error) {
      setBackupConfigs(prev => prev.map(backup => 
        backup.id === backupId 
          ? { ...backup, status: 'FAILED' }
          : backup
      ));
      toast.error('Backup failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const exportConfiguration = () => {
    const config = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.sensitive ? '[SENSITIVE]' : setting.value;
      return acc;
    }, {} as Record<string, any>);
    
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-config-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Configuration exported successfully');
  };

  const getHealthStatusColor = (status: HealthCheck['status']) => {
    switch (status) {
      case 'PASS': return 'text-green-600 bg-green-100';
      case 'WARN': return 'text-yellow-600 bg-yellow-100';
      case 'FAIL': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getLogLevelColor = (level: SystemLog['level']) => {
    switch (level) {
      case 'DEBUG': return 'text-gray-600 bg-gray-100';
      case 'INFO': return 'text-blue-600 bg-blue-100';
      case 'WARN': return 'text-yellow-600 bg-yellow-100';
      case 'ERROR': return 'text-red-600 bg-red-100';
      case 'FATAL': return 'text-red-800 bg-red-200';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getBackupStatusColor = (status: BackupConfiguration['status']) => {
    switch (status) {
      case 'SUCCESS': return 'text-green-600 bg-green-100';
      case 'RUNNING': return 'text-blue-600 bg-blue-100';
      case 'FAILED': return 'text-red-600 bg-red-100';
      case 'IDLE': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const filteredSettings = settings.filter(setting => {
    if (filterCategory !== 'all' && setting.category !== filterCategory) return false;
    if (filterEnvironment !== 'all' && setting.environment !== 'ALL' && setting.environment !== filterEnvironment) return false;
    if (searchTerm && !setting.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !setting.key.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !setting.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const pendingCount = pendingChanges.size;
  const warningChecks = systemHealth?.checks.filter(c => c.status === 'WARN').length || 0;
  const failedChecks = systemHealth?.checks.filter(c => c.status === 'FAIL').length || 0;

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
                  <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 border border-slate-200">
                          <CogIcon className="h-5 w-5 text-slate-600" />
                        </div>
                        <div>
                          <Dialog.Title as="h3" className="text-xl font-bold leading-6 text-gray-900">
                            System Configuration Manager
                          </Dialog.Title>
                          <p className="mt-1 text-sm text-gray-600 flex items-center space-x-2">
                            {pendingCount > 0 && (
                              <>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                  {pendingCount} pending changes
                                </span>
                                <span>•</span>
                              </>
                            )}
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              systemHealth?.status === 'HEALTHY' ? 'bg-green-100 text-green-800' :
                              systemHealth?.status === 'WARNING' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              System {systemHealth?.status || 'Unknown'}
                            </span>
                            <span>•</span>
                            <span>{settings.length} configuration settings</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {pendingCount > 0 && (
                          <button
                            onClick={applyPendingChanges}
                            disabled={isProcessing}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
                          >
                            <ArrowPathIcon className="h-4 w-4 mr-2" />
                            Apply Changes
                          </button>
                        )}
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
                          { key: 'SETTINGS', label: 'Configuration Settings', icon: CogIcon, count: settings.length },
                          { key: 'SYSTEM_HEALTH', label: 'System Health', icon: ServerIcon, count: warningChecks + failedChecks },
                          { key: 'LOGS', label: 'System Logs', icon: DocumentTextIcon, count: systemLogs.filter(l => l.level === 'ERROR').length },
                          { key: 'BACKUPS', label: 'Backup Management', icon: CircleStackIcon, count: backupConfigs.length },
                          { key: 'INTEGRATIONS', label: 'Integrations', icon: WifiIcon },
                        ].map((tab) => {
                          const IconComponent = tab.icon;
                          return (
                            <button
                              key={tab.key}
                              onClick={() => setSelectedTab(tab.key as any)}
                              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                                selectedTab === tab.key
                                  ? 'border-slate-500 text-slate-600'
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

                    {/* Configuration Settings Tab */}
                    {selectedTab === 'SETTINGS' && (
                      <div className="space-y-6">
                        {/* Filters and Actions */}
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="flex items-center space-x-4">
                            <input
                              type="text"
                              placeholder="Search settings..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="pl-4 pr-4 py-2 border border-gray-300 rounded-md focus:ring-slate-500 focus:border-slate-500 sm:text-sm"
                            />

                            <select
                              value={filterCategory}
                              onChange={(e) => setFilterCategory(e.target.value)}
                              className="rounded-md border-gray-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm"
                            >
                              <option value="all">All Categories</option>
                              <option value="SYSTEM">System</option>
                              <option value="DATABASE">Database</option>
                              <option value="SECURITY">Security</option>
                              <option value="NOTIFICATION">Notifications</option>
                              <option value="LOAN_ENGINE">Loan Engine</option>
                              <option value="PAYMENT_PROCESSING">Payment Processing</option>
                              <option value="COMPLIANCE">Compliance</option>
                            </select>

                            <select
                              value={filterEnvironment}
                              onChange={(e) => setFilterEnvironment(e.target.value)}
                              className="rounded-md border-gray-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm"
                            >
                              <option value="all">All Environments</option>
                              <option value="DEVELOPMENT">Development</option>
                              <option value="STAGING">Staging</option>
                              <option value="PRODUCTION">Production</option>
                            </select>

                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={showSensitive}
                                onChange={(e) => setShowSensitive(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-slate-600 focus:ring-slate-500"
                              />
                              <span className="text-sm text-gray-700">Show sensitive values</span>
                            </label>
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              onClick={exportConfiguration}
                              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                            >
                              <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                              Export Config
                            </button>
                          </div>
                        </div>

                        {/* Settings List */}
                        <div className="space-y-4">
                          {Object.entries(
                            filteredSettings.reduce((acc, setting) => {
                              if (!acc[setting.category]) acc[setting.category] = [];
                              acc[setting.category].push(setting);
                              return acc;
                            }, {} as Record<string, ConfigurationSetting[]>)
                          ).map(([category, categorySettings]) => (
                            <div key={category} className="bg-white border border-gray-200 rounded-lg">
                              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                                <h4 className="text-lg font-medium text-gray-900">{category.replace('_', ' ')}</h4>
                              </div>
                              <div className="divide-y divide-gray-200">
                                {categorySettings.map((setting) => (
                                  <div key={setting.id} className="px-6 py-4">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center space-x-3 mb-2">
                                          <h5 className="text-sm font-medium text-gray-900">{setting.name}</h5>
                                          {setting.required && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                              Required
                                            </span>
                                          )}
                                          {setting.sensitive && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                              <LockClosedIcon className="h-3 w-3 mr-1" />
                                              Sensitive
                                            </span>
                                          )}
                                          {pendingChanges.has(setting.id) && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                              Pending
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-sm text-gray-600 mb-2">{setting.description}</p>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                          <div>
                                            <span className="font-medium text-gray-700">Key:</span>
                                            <span className="ml-2 font-mono text-xs">{setting.key}</span>
                                          </div>
                                          <div>
                                            <span className="font-medium text-gray-700">Current Value:</span>
                                            <span className="ml-2">
                                              {setting.sensitive && !showSensitive 
                                                ? '••••••••' 
                                                : setting.type === 'BOOLEAN'
                                                  ? setting.value ? 'True' : 'False'
                                                  : String(setting.value)
                                              }
                                            </span>
                                          </div>
                                          <div>
                                            <span className="font-medium text-gray-700">Environment:</span>
                                            <span className="ml-2">{setting.environment}</span>
                                          </div>
                                        </div>
                                        
                                        <div className="mt-2 text-xs text-gray-500">
                                          Last modified by {setting.modifiedBy} on {format(setting.lastModified, 'MMM d, yyyy h:mm a')}
                                        </div>
                                      </div>
                                      
                                      <div className="flex items-center space-x-2 ml-4">
                                        <button
                                          onClick={() => setEditingSetting(setting)}
                                          className="inline-flex items-center px-2 py-1 border border-gray-300 text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                                        >
                                          <PencilIcon className="h-4 w-4 mr-1" />
                                          Edit
                                        </button>
                                        <button
                                          onClick={() => resetSetting(setting.id)}
                                          disabled={isProcessing}
                                          className="inline-flex items-center px-2 py-1 border border-gray-300 text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                                        >
                                          <ArrowPathIcon className="h-4 w-4 mr-1" />
                                          Reset
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* System Health Tab */}
                    {selectedTab === 'SYSTEM_HEALTH' && systemHealth && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h4 className="text-lg font-semibold text-gray-900">System Health Dashboard</h4>
                          <button
                            onClick={runHealthCheck}
                            disabled={isProcessing}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-slate-600 hover:bg-slate-700 disabled:opacity-50"
                          >
                            <ArrowPathIcon className={`h-4 w-4 mr-2 ${isProcessing ? 'animate-spin' : ''}`} />
                            Run Health Check
                          </button>
                        </div>

                        {/* System Overview */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                          <div className="bg-white overflow-hidden shadow rounded-lg">
                            <div className="p-5">
                              <div className="flex items-center">
                                <div className="flex-shrink-0">
                                  <ServerIcon className={`h-6 w-6 ${
                                    systemHealth.status === 'HEALTHY' ? 'text-green-600' :
                                    systemHealth.status === 'WARNING' ? 'text-yellow-600' :
                                    'text-red-600'
                                  }`} />
                                </div>
                                <div className="ml-5 w-0 flex-1">
                                  <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">System Status</dt>
                                    <dd className="text-lg font-semibold text-gray-900">{systemHealth.status}</dd>
                                  </dl>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="bg-white overflow-hidden shadow rounded-lg">
                            <div className="p-5">
                              <div className="flex items-center">
                                <div className="flex-shrink-0">
                                  <ClockIcon className="h-6 w-6 text-blue-600" />
                                </div>
                                <div className="ml-5 w-0 flex-1">
                                  <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Uptime</dt>
                                    <dd className="text-lg font-semibold text-gray-900">{formatUptime(systemHealth.uptime)}</dd>
                                  </dl>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="bg-white overflow-hidden shadow rounded-lg">
                            <div className="p-5">
                              <div className="flex items-center">
                                <div className="flex-shrink-0">
                                  <DocumentTextIcon className="h-6 w-6 text-purple-600" />
                                </div>
                                <div className="ml-5 w-0 flex-1">
                                  <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Version</dt>
                                    <dd className="text-lg font-semibold text-gray-900">{systemHealth.version}</dd>
                                  </dl>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="bg-white overflow-hidden shadow rounded-lg">
                            <div className="p-5">
                              <div className="flex items-center">
                                <div className="flex-shrink-0">
                                  <GlobeAltIcon className="h-6 w-6 text-indigo-600" />
                                </div>
                                <div className="ml-5 w-0 flex-1">
                                  <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Environment</dt>
                                    <dd className="text-lg font-semibold text-gray-900">{systemHealth.environment}</dd>
                                  </dl>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Health Checks */}
                        <div className="bg-white shadow overflow-hidden sm:rounded-md">
                          <div className="px-4 py-5 sm:px-6">
                            <h3 className="text-lg font-medium text-gray-900">Health Checks</h3>
                            <p className="mt-1 text-sm text-gray-500">
                              Last checked: {format(systemHealth.lastCheck, 'MMM d, yyyy h:mm:ss a')}
                            </p>
                          </div>
                          <ul className="divide-y divide-gray-200">
                            {systemHealth.checks.map((check, index) => (
                              <li key={index}>
                                <div className="px-4 py-4 flex items-center justify-between">
                                  <div className="flex items-center space-x-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getHealthStatusColor(check.status)}`}>
                                      {check.status}
                                    </span>
                                    <div>
                                      <p className="text-sm font-medium text-gray-900">{check.name}</p>
                                      <p className="text-sm text-gray-600">{check.message}</p>
                                    </div>
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {check.duration}ms
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* System Logs Tab */}
                    {selectedTab === 'LOGS' && (
                      <div className="space-y-6">
                        <h4 className="text-lg font-semibold text-gray-900">System Logs</h4>
                        
                        <div className="bg-white shadow overflow-hidden sm:rounded-md">
                          <ul className="divide-y divide-gray-200">
                            {systemLogs.map((log) => (
                              <li key={log.id}>
                                <div className="px-4 py-4">
                                  <div className="flex items-start justify-between">
                                    <div className="flex items-start space-x-4">
                                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getLogLevelColor(log.level)}`}>
                                        {log.level}
                                      </span>
                                      <div className="flex-1">
                                        <div className="flex items-center space-x-2">
                                          <p className="text-sm font-medium text-gray-900">{log.message}</p>
                                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                            {log.category}
                                          </span>
                                        </div>
                                        {log.details && (
                                          <pre className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                                            {JSON.stringify(log.details, null, 2)}
                                          </pre>
                                        )}
                                        <div className="mt-1 text-xs text-gray-500">
                                          {format(log.timestamp, 'MMM d, yyyy h:mm:ss a')}
                                          {log.userId && ` • User: ${log.userId}`}
                                          {log.ipAddress && ` • IP: ${log.ipAddress}`}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* Backup Management Tab */}
                    {selectedTab === 'BACKUPS' && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h4 className="text-lg font-semibold text-gray-900">Backup Management</h4>
                          <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-slate-600 hover:bg-slate-700">
                            <PlusIcon className="h-4 w-4 mr-2" />
                            Create Backup Job
                          </button>
                        </div>

                        <div className="space-y-4">
                          {backupConfigs.map((backup) => (
                            <div key={backup.id} className="bg-white border border-gray-200 rounded-lg p-6">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-3 mb-2">
                                    <h5 className="text-lg font-medium text-gray-900">{backup.name}</h5>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBackupStatusColor(backup.status)}`}>
                                      {backup.status}
                                    </span>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                      backup.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                    }`}>
                                      {backup.enabled ? 'Enabled' : 'Disabled'}
                                    </span>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mb-3">
                                    <div>
                                      <span className="font-medium text-gray-700">Schedule:</span>
                                      <span className="ml-2">{backup.schedule}</span>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-700">Retention:</span>
                                      <span className="ml-2">{backup.retentionDays} days</span>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-700">Destination:</span>
                                      <span className="ml-2">{backup.destination}</span>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-700">Encryption:</span>
                                      <span className="ml-2">{backup.encryption ? 'Enabled' : 'Disabled'}</span>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center space-x-6 text-sm text-gray-600">
                                    <div>
                                      <span className="font-medium">Last Backup:</span>
                                      <span className="ml-2">{backup.lastBackup ? format(backup.lastBackup, 'MMM d, h:mm a') : 'Never'}</span>
                                    </div>
                                    <div>
                                      <span className="font-medium">Next Backup:</span>
                                      <span className="ml-2">{backup.nextBackup ? format(backup.nextBackup, 'MMM d, h:mm a') : 'Not scheduled'}</span>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => runBackup(backup.id)}
                                    disabled={isProcessing || backup.status === 'RUNNING'}
                                    className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                                  >
                                    <CircleStackIcon className="h-4 w-4 mr-1" />
                                    Run Now
                                  </button>
                                  <button className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                                    <PencilIcon className="h-4 w-4 mr-1" />
                                    Edit
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Integrations Tab */}
                    {selectedTab === 'INTEGRATIONS' && (
                      <div className="text-center py-12">
                        <WifiIcon className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">Integration Management</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          Configure and monitor external service integrations and API connections.
                        </p>
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
                    <div className="flex items-center space-x-3">
                      {pendingCount > 0 && (
                        <span className="text-sm text-gray-600">
                          {pendingCount} change{pendingCount !== 1 ? 's' : ''} pending restart
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          onSuccess();
                          toast.success('System configuration updated');
                        }}
                        className="inline-flex justify-center rounded-md bg-slate-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-500"
                      >
                        <CheckCircleIcon className="h-5 w-5 mr-2" />
                        Save Configuration
                      </button>
                    </div>
                  </div>
                </div>

                {/* Edit Setting Modal */}
                {editingSetting && (
                  <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-[80]">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-gray-900">
                          Edit Configuration Setting
                        </h3>
                        <button
                          onClick={() => setEditingSetting(null)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <XMarkIcon className="h-6 w-6" />
                        </button>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">{editingSetting.name}</label>
                          <p className="mt-1 text-sm text-gray-500">{editingSetting.description}</p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
                          {editingSetting.type === 'BOOLEAN' ? (
                            <select
                              value={editingSetting.value ? 'true' : 'false'}
                              onChange={(e) => setEditingSetting({
                                ...editingSetting,
                                value: e.target.value === 'true'
                              })}
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm"
                            >
                              <option value="true">True</option>
                              <option value="false">False</option>
                            </select>
                          ) : editingSetting.type === 'SELECT' ? (
                            <select
                              value={editingSetting.value}
                              onChange={(e) => setEditingSetting({
                                ...editingSetting,
                                value: e.target.value
                              })}
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm"
                            >
                              {editingSetting.options?.map(option => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={editingSetting.sensitive ? 'password' : editingSetting.type === 'NUMBER' ? 'number' : 'text'}
                              value={editingSetting.value}
                              onChange={(e) => setEditingSetting({
                                ...editingSetting,
                                value: editingSetting.type === 'NUMBER' ? parseFloat(e.target.value) || 0 : e.target.value
                              })}
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm"
                            />
                          )}
                        </div>
                        
                        <div className="text-sm text-gray-500">
                          <div><strong>Default:</strong> {String(editingSetting.defaultValue)}</div>
                          <div><strong>Environment:</strong> {editingSetting.environment}</div>
                        </div>
                      </div>
                      
                      <div className="mt-6 flex justify-end space-x-3">
                        <button
                          onClick={() => setEditingSetting(null)}
                          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            updateSetting(editingSetting.id, editingSetting.value);
                            setEditingSetting(null);
                          }}
                          className="px-4 py-2 bg-slate-600 text-white rounded-md text-sm font-medium hover:bg-slate-700"
                        >
                          Update Setting
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};