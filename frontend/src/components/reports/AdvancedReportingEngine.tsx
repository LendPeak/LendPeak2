import { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  XMarkIcon,
  DocumentChartBarIcon,
  ChartBarIcon,
  ArrowDownTrayIcon,
  CalendarIcon,
  FunnelIcon,
  CogIcon,
  PlayIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  TableCellsIcon,
  ChartPieIcon,
  PresentationChartLineIcon,
  BuildingLibraryIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  EyeIcon,
  ShareIcon,
  BookmarkIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { format, subDays, subMonths, startOfYear, endOfYear, startOfMonth, endOfMonth } from 'date-fns';
import { LoanEngine } from '@lendpeak/engine';

interface AdvancedReportingEngineProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Report {
  id: string;
  name: string;
  description: string;
  category: ReportCategory;
  type: ReportType;
  status: 'DRAFT' | 'PUBLISHED' | 'SCHEDULED' | 'ARCHIVED';
  createdBy: string;
  createdAt: Date;
  lastRun?: Date;
  nextRun?: Date;
  parameters: ReportParameter[];
  dataSource: DataSource;
  visualization: VisualizationType;
  schedule?: ReportSchedule;
  recipients: string[];
  retention: number; // days
  isRegulatory: boolean;
  compliance: ComplianceRequirement[];
  metrics: ReportMetric[];
  filters: ReportFilter[];
  customFields: CustomField[];
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: ReportCategory;
  type: ReportType;
  isStandard: boolean;
  previewImage?: string;
  estimatedTime: string;
  complexity: 'SIMPLE' | 'MODERATE' | 'COMPLEX';
  requiredPermissions: string[];
  defaultParameters: ReportParameter[];
  sampleData: any[];
}

interface ReportExecution {
  id: string;
  reportId: string;
  reportName: string;
  executedBy: string;
  executedAt: Date;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number;
  duration?: number; // seconds
  recordCount?: number;
  fileSize?: number; // bytes
  outputFormat: OutputFormat;
  downloadUrl?: string;
  errorMessage?: string;
  parameters: Record<string, any>;
}

interface ReportParameter {
  id: string;
  name: string;
  label: string;
  type: 'DATE' | 'DATE_RANGE' | 'NUMBER' | 'TEXT' | 'SELECT' | 'MULTI_SELECT' | 'BOOLEAN';
  required: boolean;
  defaultValue?: any;
  options?: { value: string; label: string }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

interface DataSource {
  id: string;
  name: string;
  type: 'DATABASE' | 'API' | 'FILE' | 'CALCULATION';
  connection: string;
  query?: string;
  endpoint?: string;
  refreshRate: number; // minutes
  lastRefresh?: Date;
}

interface ReportMetric {
  id: string;
  name: string;
  label: string;
  formula: string;
  format: 'CURRENCY' | 'PERCENTAGE' | 'NUMBER' | 'INTEGER';
  aggregation: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' | 'MEDIAN';
  groupBy?: string[];
}

interface ReportFilter {
  id: string;
  field: string;
  operator: 'EQUALS' | 'NOT_EQUALS' | 'GREATER_THAN' | 'LESS_THAN' | 'BETWEEN' | 'IN' | 'NOT_IN' | 'CONTAINS';
  value: any;
  dataType: 'STRING' | 'NUMBER' | 'DATE' | 'BOOLEAN';
}

interface CustomField {
  id: string;
  name: string;
  label: string;
  expression: string;
  dataType: 'STRING' | 'NUMBER' | 'DATE' | 'BOOLEAN';
  format?: string;
}

interface ReportSchedule {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM';
  time: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  timezone: string;
  enabled: boolean;
  endDate?: Date;
}

interface ComplianceRequirement {
  regulation: string;
  frequency: string;
  deadline: string;
  retentionPeriod: number;
  approvalRequired: boolean;
}

type ReportCategory = 
  | 'FINANCIAL' 
  | 'OPERATIONAL' 
  | 'COMPLIANCE' 
  | 'RISK' 
  | 'COLLECTIONS' 
  | 'UNDERWRITING' 
  | 'PORTFOLIO' 
  | 'CUSTOM';

type ReportType = 
  | 'SUMMARY' 
  | 'DETAILED' 
  | 'COMPARATIVE' 
  | 'TREND' 
  | 'EXCEPTION' 
  | 'REGULATORY' 
  | 'DASHBOARD';

type VisualizationType = 
  | 'TABLE' 
  | 'BAR_CHART' 
  | 'LINE_CHART' 
  | 'PIE_CHART' 
  | 'SCATTER_PLOT' 
  | 'HEATMAP' 
  | 'DASHBOARD' 
  | 'CUSTOM';

type OutputFormat = 'PDF' | 'EXCEL' | 'CSV' | 'JSON' | 'HTML';

const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'template_portfolio_summary',
    name: 'Portfolio Performance Summary',
    description: 'Comprehensive overview of loan portfolio performance metrics',
    category: 'PORTFOLIO',
    type: 'SUMMARY',
    isStandard: true,
    estimatedTime: '2-3 minutes',
    complexity: 'SIMPLE',
    requiredPermissions: ['reports_portfolio_read'],
    defaultParameters: [
      {
        id: 'date_range',
        name: 'dateRange',
        label: 'Report Period',
        type: 'DATE_RANGE',
        required: true,
        defaultValue: {
          start: startOfMonth(new Date()),
          end: endOfMonth(new Date()),
        },
      },
      {
        id: 'loan_types',
        name: 'loanTypes',
        label: 'Loan Types',
        type: 'MULTI_SELECT',
        required: false,
        options: [
          { value: 'mortgage', label: 'Mortgage' },
          { value: 'personal', label: 'Personal Loan' },
          { value: 'auto', label: 'Auto Loan' },
          { value: 'business', label: 'Business Loan' },
        ],
      },
    ],
    sampleData: [],
  },
  {
    id: 'template_delinquency_aging',
    name: 'Delinquency Aging Report',
    description: 'Detailed breakdown of delinquent loans by aging buckets',
    category: 'COLLECTIONS',
    type: 'DETAILED',
    isStandard: true,
    estimatedTime: '3-5 minutes',
    complexity: 'MODERATE',
    requiredPermissions: ['reports_collections_read'],
    defaultParameters: [
      {
        id: 'as_of_date',
        name: 'asOfDate',
        label: 'As of Date',
        type: 'DATE',
        required: true,
        defaultValue: new Date(),
      },
      {
        id: 'include_charged_off',
        name: 'includeChargedOff',
        label: 'Include Charged Off Loans',
        type: 'BOOLEAN',
        required: false,
        defaultValue: false,
      },
    ],
    sampleData: [],
  },
  {
    id: 'template_underwriting_metrics',
    name: 'Underwriting Performance Metrics',
    description: 'Analysis of underwriting decisions and approval rates',
    category: 'UNDERWRITING',
    type: 'SUMMARY',
    isStandard: true,
    estimatedTime: '1-2 minutes',
    complexity: 'SIMPLE',
    requiredPermissions: ['reports_underwriting_read'],
    defaultParameters: [
      {
        id: 'period',
        name: 'period',
        label: 'Analysis Period',
        type: 'SELECT',
        required: true,
        defaultValue: 'monthly',
        options: [
          { value: 'weekly', label: 'Weekly' },
          { value: 'monthly', label: 'Monthly' },
          { value: 'quarterly', label: 'Quarterly' },
          { value: 'yearly', label: 'Yearly' },
        ],
      },
    ],
    sampleData: [],
  },
  {
    id: 'template_regulatory_call_report',
    name: 'Regulatory Call Report',
    description: 'Quarterly regulatory reporting for banking authorities',
    category: 'COMPLIANCE',
    type: 'REGULATORY',
    isStandard: true,
    estimatedTime: '10-15 minutes',
    complexity: 'COMPLEX',
    requiredPermissions: ['reports_regulatory_generate'],
    defaultParameters: [
      {
        id: 'quarter',
        name: 'quarter',
        label: 'Reporting Quarter',
        type: 'SELECT',
        required: true,
        options: [
          { value: 'Q1', label: 'Q1 (Jan-Mar)' },
          { value: 'Q2', label: 'Q2 (Apr-Jun)' },
          { value: 'Q3', label: 'Q3 (Jul-Sep)' },
          { value: 'Q4', label: 'Q4 (Oct-Dec)' },
        ],
      },
      {
        id: 'year',
        name: 'year',
        label: 'Reporting Year',
        type: 'NUMBER',
        required: true,
        defaultValue: new Date().getFullYear(),
        validation: {
          min: 2020,
          max: new Date().getFullYear(),
        },
      },
    ],
    sampleData: [],
  },
  {
    id: 'template_risk_assessment',
    name: 'Portfolio Risk Assessment',
    description: 'Comprehensive risk analysis across loan portfolio',
    category: 'RISK',
    type: 'DETAILED',
    isStandard: true,
    estimatedTime: '5-8 minutes',
    complexity: 'COMPLEX',
    requiredPermissions: ['reports_risk_read'],
    defaultParameters: [
      {
        id: 'risk_model',
        name: 'riskModel',
        label: 'Risk Model',
        type: 'SELECT',
        required: true,
        defaultValue: 'standard',
        options: [
          { value: 'standard', label: 'Standard Risk Model' },
          { value: 'enhanced', label: 'Enhanced Risk Model' },
          { value: 'stress_test', label: 'Stress Test Scenario' },
        ],
      },
    ],
    sampleData: [],
  },
];

export const AdvancedReportingEngine = ({ isOpen, onClose, onSuccess }: AdvancedReportingEngineProps) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [templates] = useState<ReportTemplate[]>(REPORT_TEMPLATES);
  const [executions, setExecutions] = useState<ReportExecution[]>([]);
  const [selectedTab, setSelectedTab] = useState<'TEMPLATES' | 'REPORTS' | 'EXECUTIONS' | 'BUILDER' | 'SCHEDULER'>('TEMPLATES');
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showParameterModal, setShowParameterModal] = useState(false);
  const [reportParameters, setReportParameters] = useState<Record<string, any>>({});

  useEffect(() => {
    loadReports();
    loadExecutions();
  }, []);

  const loadReports = async () => {
    // Demo reports data
    setReports([
      {
        id: 'report_001',
        name: 'Monthly Portfolio Summary',
        description: 'Monthly summary of portfolio performance and key metrics',
        category: 'PORTFOLIO',
        type: 'SUMMARY',
        status: 'PUBLISHED',
        createdBy: 'John Smith',
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000),
        nextRun: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        parameters: templates[0].defaultParameters,
        dataSource: {
          id: 'ds_portfolio',
          name: 'Portfolio Database',
          type: 'DATABASE',
          connection: 'main_db',
          refreshRate: 60,
          lastRefresh: new Date(Date.now() - 30 * 60 * 1000),
        },
        visualization: 'DASHBOARD',
        schedule: {
          frequency: 'MONTHLY',
          time: '09:00',
          dayOfMonth: 1,
          timezone: 'America/New_York',
          enabled: true,
        },
        recipients: ['management@company.com', 'risk@company.com'],
        retention: 2555, // 7 years
        isRegulatory: false,
        compliance: [],
        metrics: [],
        filters: [],
        customFields: [],
      },
      {
        id: 'report_002',
        name: 'Weekly Delinquency Report',
        description: 'Weekly tracking of delinquent accounts and collections activity',
        category: 'COLLECTIONS',
        type: 'DETAILED',
        status: 'PUBLISHED',
        createdBy: 'Sarah Johnson',
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        lastRun: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        nextRun: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
        parameters: templates[1].defaultParameters,
        dataSource: {
          id: 'ds_collections',
          name: 'Collections Database',
          type: 'DATABASE',
          connection: 'collections_db',
          refreshRate: 30,
          lastRefresh: new Date(Date.now() - 15 * 60 * 1000),
        },
        visualization: 'TABLE',
        schedule: {
          frequency: 'WEEKLY',
          time: '08:00',
          dayOfWeek: 1, // Monday
          timezone: 'America/New_York',
          enabled: true,
        },
        recipients: ['collections@company.com'],
        retention: 1095, // 3 years
        isRegulatory: false,
        compliance: [],
        metrics: [],
        filters: [],
        customFields: [],
      },
      {
        id: 'report_003',
        name: 'Quarterly Call Report',
        description: 'Regulatory quarterly call report for banking commission',
        category: 'COMPLIANCE',
        type: 'REGULATORY',
        status: 'SCHEDULED',
        createdBy: 'Emily Davis',
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        nextRun: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        parameters: templates[3].defaultParameters,
        dataSource: {
          id: 'ds_regulatory',
          name: 'Regulatory Data Warehouse',
          type: 'DATABASE',
          connection: 'regulatory_db',
          refreshRate: 1440, // daily
          lastRefresh: new Date(Date.now() - 6 * 60 * 60 * 1000),
        },
        visualization: 'TABLE',
        schedule: {
          frequency: 'QUARTERLY',
          time: '06:00',
          dayOfMonth: 15,
          timezone: 'America/New_York',
          enabled: true,
        },
        recipients: ['compliance@company.com', 'cfo@company.com'],
        retention: 3650, // 10 years
        isRegulatory: true,
        compliance: [
          {
            regulation: 'Call Report',
            frequency: 'Quarterly',
            deadline: '30 days after quarter end',
            retentionPeriod: 3650,
            approvalRequired: true,
          },
        ],
        metrics: [],
        filters: [],
        customFields: [],
      },
    ]);
  };

  const loadExecutions = async () => {
    // Demo execution history
    setExecutions([
      {
        id: 'exec_001',
        reportId: 'report_001',
        reportName: 'Monthly Portfolio Summary',
        executedBy: 'Scheduled Task',
        executedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        status: 'COMPLETED',
        progress: 100,
        duration: 145, // seconds
        recordCount: 15847,
        fileSize: 2457600, // bytes
        outputFormat: 'PDF',
        downloadUrl: '/downloads/portfolio_summary_2024_01.pdf',
        parameters: {
          dateRange: {
            start: '2024-01-01',
            end: '2024-01-31',
          },
          loanTypes: ['mortgage', 'personal'],
        },
      },
      {
        id: 'exec_002',
        reportId: 'report_002',
        reportName: 'Weekly Delinquency Report',
        executedBy: 'Sarah Johnson',
        executedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        status: 'COMPLETED',
        progress: 100,
        duration: 67,
        recordCount: 542,
        fileSize: 145920,
        outputFormat: 'EXCEL',
        downloadUrl: '/downloads/delinquency_report_week_03.xlsx',
        parameters: {
          asOfDate: '2024-01-21',
          includeChargedOff: false,
        },
      },
      {
        id: 'exec_003',
        reportId: 'report_001',
        reportName: 'Monthly Portfolio Summary',
        executedBy: 'John Smith',
        executedAt: new Date(),
        status: 'RUNNING',
        progress: 65,
        parameters: {
          dateRange: {
            start: '2024-02-01',
            end: '2024-02-29',
          },
        },
        outputFormat: 'PDF',
      },
      {
        id: 'exec_004',
        reportId: 'report_003',
        reportName: 'Quarterly Call Report',
        executedBy: 'Emily Davis',
        executedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        status: 'FAILED',
        progress: 0,
        errorMessage: 'Database connection timeout during data extraction',
        parameters: {
          quarter: 'Q4',
          year: 2023,
        },
        outputFormat: 'PDF',
      },
    ]);
  };

  const generateReport = async (templateId: string, parameters: Record<string, any>, format: OutputFormat = 'PDF') => {
    setIsGenerating(true);
    try {
      const template = templates.find(t => t.id === templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      // Create new execution record
      const execution: ReportExecution = {
        id: 'exec_' + Date.now(),
        reportId: templateId,
        reportName: template.name,
        executedBy: 'Current User',
        executedAt: new Date(),
        status: 'RUNNING',
        progress: 0,
        outputFormat: format,
        parameters,
      };

      setExecutions(prev => [execution, ...prev]);

      // Simulate report generation progress
      for (let progress = 0; progress <= 100; progress += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setExecutions(prev => prev.map(exec => 
          exec.id === execution.id ? { ...exec, progress } : exec
        ));
      }

      // Simulate completion
      const completedExecution: ReportExecution = {
        ...execution,
        status: 'COMPLETED',
        progress: 100,
        duration: Math.floor(Math.random() * 300) + 30, // 30-330 seconds
        recordCount: Math.floor(Math.random() * 50000) + 1000,
        fileSize: Math.floor(Math.random() * 5000000) + 100000,
        downloadUrl: `/downloads/${template.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.${format.toLowerCase()}`,
      };

      setExecutions(prev => prev.map(exec => 
        exec.id === execution.id ? completedExecution : exec
      ));

      toast.success(`Report "${template.name}" generated successfully`);
      setShowParameterModal(false);
      setSelectedTemplate(null);
    } catch (error) {
      toast.error('Failed to generate report');
      // Update execution status to failed
      setExecutions(prev => prev.map(exec => 
        exec.status === 'RUNNING' && exec.executedAt > new Date(Date.now() - 60000)
          ? { ...exec, status: 'FAILED', errorMessage: 'Generation failed' }
          : exec
      ));
    } finally {
      setIsGenerating(false);
    }
  };

  const scheduleReport = async (reportId: string, schedule: ReportSchedule) => {
    try {
      setReports(prev => prev.map(report => 
        report.id === reportId 
          ? { ...report, schedule, status: 'SCHEDULED' }
          : report
      ));
      toast.success('Report scheduled successfully');
    } catch (error) {
      toast.error('Failed to schedule report');
    }
  };

  const cancelExecution = async (executionId: string) => {
    try {
      setExecutions(prev => prev.map(exec => 
        exec.id === executionId 
          ? { ...exec, status: 'CANCELLED' }
          : exec
      ));
      toast.success('Report execution cancelled');
    } catch (error) {
      toast.error('Failed to cancel execution');
    }
  };

  const downloadReport = (execution: ReportExecution) => {
    if (execution.downloadUrl) {
      // Simulate download
      console.log('Downloading report:', execution.downloadUrl);
      toast.success(`Downloading ${execution.reportName}`);
    }
  };

  const getStatusColor = (status: ReportExecution['status']) => {
    switch (status) {
      case 'COMPLETED': return 'text-green-600 bg-green-100';
      case 'RUNNING': return 'text-blue-600 bg-blue-100';
      case 'FAILED': return 'text-red-600 bg-red-100';
      case 'CANCELLED': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getReportStatusColor = (status: Report['status']) => {
    switch (status) {
      case 'PUBLISHED': return 'text-green-600 bg-green-100';
      case 'SCHEDULED': return 'text-blue-600 bg-blue-100';
      case 'DRAFT': return 'text-yellow-600 bg-yellow-100';
      case 'ARCHIVED': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getComplexityColor = (complexity: ReportTemplate['complexity']) => {
    switch (complexity) {
      case 'SIMPLE': return 'text-green-600 bg-green-100';
      case 'MODERATE': return 'text-yellow-600 bg-yellow-100';
      case 'COMPLEX': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
  };

  const filteredTemplates = templates.filter(template => {
    if (filterCategory !== 'all' && template.category !== filterCategory) return false;
    if (filterType !== 'all' && template.type !== filterType) return false;
    if (searchTerm && !template.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !template.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const runningExecutions = executions.filter(e => e.status === 'RUNNING').length;
  const completedToday = executions.filter(e => 
    e.status === 'COMPLETED' && 
    e.executedAt > new Date(Date.now() - 24 * 60 * 60 * 1000)
  ).length;

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
                  <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-teal-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200">
                          <DocumentChartBarIcon className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <Dialog.Title as="h3" className="text-xl font-bold leading-6 text-gray-900">
                            Advanced Reporting Engine
                          </Dialog.Title>
                          <p className="mt-1 text-sm text-gray-600 flex items-center space-x-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {runningExecutions} running
                            </span>
                            <span>•</span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {completedToday} completed today
                            </span>
                            <span>•</span>
                            <span>{templates.length} templates available</span>
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
                          { key: 'TEMPLATES', label: 'Report Templates', icon: DocumentTextIcon, count: templates.length },
                          { key: 'REPORTS', label: 'Scheduled Reports', icon: ClockIcon, count: reports.length },
                          { key: 'EXECUTIONS', label: 'Execution History', icon: PlayIcon, count: executions.length },
                          { key: 'BUILDER', label: 'Report Builder', icon: CogIcon },
                          { key: 'SCHEDULER', label: 'Schedule Manager', icon: CalendarIcon },
                        ].map((tab) => {
                          const IconComponent = tab.icon;
                          return (
                            <button
                              key={tab.key}
                              onClick={() => setSelectedTab(tab.key as any)}
                              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                                selectedTab === tab.key
                                  ? 'border-emerald-500 text-emerald-600'
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

                    {/* Report Templates Tab */}
                    {selectedTab === 'TEMPLATES' && (
                      <div className="space-y-6">
                        {/* Filters */}
                        <div className="flex flex-wrap items-center gap-4">
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="Search templates..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="pl-4 pr-4 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                            />
                          </div>

                          <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                          >
                            <option value="all">All Categories</option>
                            <option value="FINANCIAL">Financial</option>
                            <option value="OPERATIONAL">Operational</option>
                            <option value="COMPLIANCE">Compliance</option>
                            <option value="RISK">Risk</option>
                            <option value="COLLECTIONS">Collections</option>
                            <option value="UNDERWRITING">Underwriting</option>
                            <option value="PORTFOLIO">Portfolio</option>
                          </select>

                          <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                          >
                            <option value="all">All Types</option>
                            <option value="SUMMARY">Summary</option>
                            <option value="DETAILED">Detailed</option>
                            <option value="COMPARATIVE">Comparative</option>
                            <option value="TREND">Trend</option>
                            <option value="REGULATORY">Regulatory</option>
                          </select>
                        </div>

                        {/* Templates Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {filteredTemplates.map((template) => (
                            <div key={template.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-2">
                                    <h5 className="text-lg font-medium text-gray-900">{template.name}</h5>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getComplexityColor(template.complexity)}`}>
                                      {template.complexity}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                                </div>
                              </div>

                              <div className="space-y-2 text-sm mb-4">
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Category:</span>
                                  <span className="font-medium">{template.category}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Type:</span>
                                  <span className="font-medium">{template.type}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Est. Time:</span>
                                  <span className="font-medium">{template.estimatedTime}</span>
                                </div>
                              </div>

                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => {
                                    setSelectedTemplate(template);
                                    setReportParameters({});
                                    setShowParameterModal(true);
                                  }}
                                  disabled={isGenerating}
                                  className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  <PlayIcon className="h-4 w-4 mr-2" />
                                  Generate
                                </button>
                                <button
                                  onClick={() => setSelectedTemplate(template)}
                                  className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                                >
                                  <EyeIcon className="h-4 w-4" />
                                </button>
                                <button className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                                  <BookmarkIcon className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Execution History Tab */}
                    {selectedTab === 'EXECUTIONS' && (
                      <div className="space-y-6">
                        <h4 className="text-lg font-semibold text-gray-900">Report Execution History</h4>
                        
                        <div className="bg-white shadow overflow-hidden sm:rounded-md">
                          <ul className="divide-y divide-gray-200">
                            {executions.map((execution) => (
                              <li key={execution.id}>
                                <div className="px-6 py-4">
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-3 mb-2">
                                        <h5 className="text-sm font-medium text-gray-900">
                                          {execution.reportName}
                                        </h5>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(execution.status)}`}>
                                          {execution.status}
                                        </span>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                          {execution.outputFormat}
                                        </span>
                                      </div>
                                      
                                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-600">
                                        <div>
                                          <span className="font-medium">Executed by:</span>
                                          <span className="ml-2">{execution.executedBy}</span>
                                        </div>
                                        <div>
                                          <span className="font-medium">Started:</span>
                                          <span className="ml-2">{format(execution.executedAt, 'MMM d, h:mm a')}</span>
                                        </div>
                                        {execution.duration && (
                                          <div>
                                            <span className="font-medium">Duration:</span>
                                            <span className="ml-2">{formatDuration(execution.duration)}</span>
                                          </div>
                                        )}
                                        {execution.recordCount && (
                                          <div>
                                            <span className="font-medium">Records:</span>
                                            <span className="ml-2">{execution.recordCount.toLocaleString()}</span>
                                          </div>
                                        )}
                                      </div>

                                      {execution.status === 'RUNNING' && (
                                        <div className="mt-3">
                                          <div className="flex items-center justify-between text-sm mb-1">
                                            <span>Progress</span>
                                            <span>{execution.progress}%</span>
                                          </div>
                                          <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div 
                                              className="bg-emerald-600 h-2 rounded-full transition-all duration-300" 
                                              style={{ width: `${execution.progress}%` }}
                                            />
                                          </div>
                                        </div>
                                      )}

                                      {execution.errorMessage && (
                                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                                          <p className="text-sm text-red-700">
                                            <ExclamationTriangleIcon className="h-4 w-4 inline mr-1" />
                                            {execution.errorMessage}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                    
                                    <div className="flex items-center space-x-2 ml-4">
                                      {execution.status === 'COMPLETED' && execution.downloadUrl && (
                                        <button
                                          onClick={() => downloadReport(execution)}
                                          className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700"
                                        >
                                          <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                                          Download
                                        </button>
                                      )}
                                      
                                      {execution.status === 'RUNNING' && (
                                        <button
                                          onClick={() => cancelExecution(execution.id)}
                                          className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                                        >
                                          Cancel
                                        </button>
                                      )}
                                      
                                      <button className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                                        <ShareIcon className="h-4 w-4 mr-1" />
                                        Share
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* Other tabs placeholder */}
                    {selectedTab === 'REPORTS' && (
                      <div className="space-y-6">
                        <h4 className="text-lg font-semibold text-gray-900">Scheduled Reports</h4>
                        
                        <div className="space-y-4">
                          {reports.map((report) => (
                            <div key={report.id} className="bg-white border border-gray-200 rounded-lg p-6">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-3 mb-2">
                                    <h5 className="text-lg font-medium text-gray-900">{report.name}</h5>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getReportStatusColor(report.status)}`}>
                                      {report.status}
                                    </span>
                                    {report.isRegulatory && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                        <ShieldCheckIcon className="h-3 w-3 mr-1" />
                                        Regulatory
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-600 mb-3">{report.description}</p>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                    <div>
                                      <span className="font-medium text-gray-700">Schedule:</span>
                                      <span className="ml-2">{report.schedule?.frequency} at {report.schedule?.time}</span>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-700">Last Run:</span>
                                      <span className="ml-2">{report.lastRun ? format(report.lastRun, 'MMM d, h:mm a') : 'Never'}</span>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-700">Next Run:</span>
                                      <span className="ml-2">{report.nextRun ? format(report.nextRun, 'MMM d, h:mm a') : 'Not scheduled'}</span>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                  <button className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                                    <PlayIcon className="h-4 w-4 mr-1" />
                                    Run Now
                                  </button>
                                  <button className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                                    Edit
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(selectedTab === 'BUILDER' || selectedTab === 'SCHEDULER') && (
                      <div className="text-center py-12">
                        <CogIcon className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">
                          {selectedTab === 'BUILDER' ? 'Report Builder' : 'Schedule Manager'}
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                          {selectedTab === 'BUILDER' 
                            ? 'Advanced report builder with drag-and-drop interface for creating custom reports.'
                            : 'Comprehensive scheduling system for automated report generation and distribution.'}
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
                    <button
                      type="button"
                      onClick={() => {
                        onSuccess();
                        toast.success('Reporting engine updated');
                      }}
                      className="inline-flex justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500"
                    >
                      <CheckCircleIcon className="h-5 w-5 mr-2" />
                      Save Configuration
                    </button>
                  </div>
                </div>

                {/* Parameter Modal */}
                {showParameterModal && selectedTemplate && (
                  <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-[80]">
                    <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-gray-900">
                          Generate Report: {selectedTemplate.name}
                        </h3>
                        <button
                          onClick={() => setShowParameterModal(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <XMarkIcon className="h-6 w-6" />
                        </button>
                      </div>
                      
                      <div className="space-y-4 mb-6">
                        {selectedTemplate.defaultParameters.map((param) => (
                          <div key={param.id}>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {param.label}
                              {param.required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            
                            {param.type === 'DATE' && (
                              <input
                                type="date"
                                value={reportParameters[param.name] || param.defaultValue || ''}
                                onChange={(e) => setReportParameters(prev => ({
                                  ...prev,
                                  [param.name]: e.target.value
                                }))}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                              />
                            )}
                            
                            {param.type === 'SELECT' && (
                              <select
                                value={reportParameters[param.name] || param.defaultValue || ''}
                                onChange={(e) => setReportParameters(prev => ({
                                  ...prev,
                                  [param.name]: e.target.value
                                }))}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                              >
                                <option value="">Select {param.label}</option>
                                {param.options?.map(option => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            )}
                            
                            {param.type === 'MULTI_SELECT' && (
                              <select
                                multiple
                                value={reportParameters[param.name] || []}
                                onChange={(e) => setReportParameters(prev => ({
                                  ...prev,
                                  [param.name]: Array.from(e.target.selectedOptions, option => option.value)
                                }))}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                              >
                                {param.options?.map(option => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            )}
                            
                            {param.type === 'BOOLEAN' && (
                              <label className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={reportParameters[param.name] || param.defaultValue || false}
                                  onChange={(e) => setReportParameters(prev => ({
                                    ...prev,
                                    [param.name]: e.target.checked
                                  }))}
                                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                />
                                <span className="text-sm text-gray-700">{param.label}</span>
                              </label>
                            )}
                          </div>
                        ))}
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Output Format
                          </label>
                          <select
                            value={reportParameters.outputFormat || 'PDF'}
                            onChange={(e) => setReportParameters(prev => ({
                              ...prev,
                              outputFormat: e.target.value as OutputFormat
                            }))}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                          >
                            <option value="PDF">PDF</option>
                            <option value="EXCEL">Excel</option>
                            <option value="CSV">CSV</option>
                            <option value="HTML">HTML</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="flex justify-end space-x-3">
                        <button
                          onClick={() => setShowParameterModal(false)}
                          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => generateReport(
                            selectedTemplate.id, 
                            reportParameters, 
                            reportParameters.outputFormat as OutputFormat || 'PDF'
                          )}
                          disabled={isGenerating}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {isGenerating ? 'Generating...' : 'Generate Report'}
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