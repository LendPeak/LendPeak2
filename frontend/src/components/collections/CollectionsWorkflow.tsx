import { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  XMarkIcon,
  ExclamationTriangleIcon,
  PhoneIcon,
  EnvelopeIcon,
  DocumentTextIcon,
  CalendarIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  UserIcon,
  BellIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  FunnelIcon,
  PlayIcon,
  PauseIcon,
  CogIcon,
  ShieldCheckIcon,
  BuildingLibraryIcon,
  ScaleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { format, addDays, differenceInDays, subDays } from 'date-fns';

interface CollectionsWorkflowProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface CollectionsAccount {
  id: string;
  loanId: string;
  borrowerName: string;
  borrowerEmail: string;
  borrowerPhone: string;
  principalBalance: number;
  pastDueAmount: number;
  daysPastDue: number;
  delinquencyBucket: '30-59' | '60-89' | '90-119' | '120-179' | '180+';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'NEW' | 'IN_PROGRESS' | 'CONTACTED' | 'ARRANGED' | 'ESCALATED' | 'LEGAL' | 'CLOSED';
  assignedAgent: string;
  lastContactDate?: Date;
  nextActionDate: Date;
  currentWorkflowStep: number;
  workflowId: string;
  notes: CollectionsNote[];
  paymentArrangements: PaymentArrangement[];
  legalStatus?: LegalStatus;
  complianceFlags: ComplianceFlag[];
  collectionsScore: number;
}

interface CollectionsWorkflow {
  id: string;
  name: string;
  description: string;
  delinquencyBuckets: string[];
  steps: WorkflowStep[];
  enabled: boolean;
  priority: number;
  compliance: ComplianceRequirement[];
}

interface WorkflowStep {
  id: string;
  stepNumber: number;
  name: string;
  description: string;
  actionType: 'EMAIL' | 'PHONE' | 'LETTER' | 'SMS' | 'LEGAL_NOTICE' | 'SKIP_TRACE' | 'FIELD_VISIT';
  autoExecute: boolean;
  daysFromPrevious: number;
  template?: string;
  requiresApproval: boolean;
  complianceChecks: string[];
  escalationConditions: EscalationCondition[];
  successCriteria: SuccessCriteria[];
}

interface CollectionsNote {
  id: string;
  date: Date;
  agent: string;
  type: 'CALL' | 'EMAIL' | 'LETTER' | 'PAYMENT' | 'PROMISE' | 'DISPUTE' | 'COMPLAINT';
  subject: string;
  content: string;
  outcome: string;
  followUpDate?: Date;
  complianceVerified: boolean;
}

interface PaymentArrangement {
  id: string;
  type: 'FULL_PAYMENT' | 'PARTIAL_PAYMENT' | 'PAYMENT_PLAN' | 'SETTLEMENT';
  amount: number;
  dueDate: Date;
  status: 'PROPOSED' | 'ACCEPTED' | 'ACTIVE' | 'COMPLETED' | 'BROKEN';
  terms: string;
  createdDate: Date;
  modifiedDate?: Date;
}

interface LegalStatus {
  phase: 'PRE_LEGAL' | 'DEMAND_LETTER' | 'SUIT_FILED' | 'JUDGMENT' | 'GARNISHMENT' | 'ASSET_RECOVERY';
  attorney: string;
  filedDate?: Date;
  courtCase?: string;
  estimatedCosts: number;
  recoveryProbability: number;
}

interface ComplianceFlag {
  type: 'FCRA' | 'FDCPA' | 'SCRA' | 'TCPA' | 'STATE_LAW';
  description: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  requiresAction: boolean;
  dueDate?: Date;
}

interface EscalationCondition {
  type: 'NO_CONTACT' | 'BROKEN_PROMISE' | 'DISPUTE' | 'BANKRUPTCY' | 'DECEASED';
  threshold: number;
  action: 'ESCALATE' | 'LEGAL' | 'CLOSE' | 'SKIP_TRACE';
}

interface SuccessCriteria {
  type: 'PAYMENT_MADE' | 'PROMISE_TO_PAY' | 'ARRANGEMENT_MADE' | 'CONTACT_ESTABLISHED';
  moveToStep?: number;
  exitWorkflow?: boolean;
}

interface ComplianceRequirement {
  regulation: string;
  description: string;
  checkRequired: boolean;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
}

const DEFAULT_WORKFLOWS: CollectionsWorkflow[] = [
  {
    id: 'early_delinquency',
    name: 'Early Delinquency (30-59 Days)',
    description: 'Soft collection approach for early delinquency',
    delinquencyBuckets: ['30-59'],
    enabled: true,
    priority: 1,
    compliance: [
      {
        regulation: 'FDCPA',
        description: 'Fair Debt Collection Practices Act compliance',
        checkRequired: true,
        frequency: 'DAILY',
      },
    ],
    steps: [
      {
        id: 'early_1',
        stepNumber: 1,
        name: 'Automated Reminder Email',
        description: 'Send automated payment reminder',
        actionType: 'EMAIL',
        autoExecute: true,
        daysFromPrevious: 0,
        template: 'early_reminder_email',
        requiresApproval: false,
        complianceChecks: ['TCPA_EMAIL_CONSENT'],
        escalationConditions: [],
        successCriteria: [
          { type: 'PAYMENT_MADE', exitWorkflow: true },
        ],
      },
      {
        id: 'early_2',
        stepNumber: 2,
        name: 'Courtesy Call',
        description: 'Make friendly courtesy call',
        actionType: 'PHONE',
        autoExecute: false,
        daysFromPrevious: 3,
        requiresApproval: false,
        complianceChecks: ['TCPA_PHONE_CONSENT', 'TIME_ZONE_CHECK'],
        escalationConditions: [
          { type: 'NO_CONTACT', threshold: 3, action: 'ESCALATE' },
        ],
        successCriteria: [
          { type: 'PAYMENT_MADE', exitWorkflow: true },
          { type: 'PROMISE_TO_PAY', moveToStep: 4 },
        ],
      },
      {
        id: 'early_3',
        stepNumber: 3,
        name: 'Follow-up Email',
        description: 'Send follow-up email with payment options',
        actionType: 'EMAIL',
        autoExecute: true,
        daysFromPrevious: 5,
        template: 'payment_options_email',
        requiresApproval: false,
        complianceChecks: ['TCPA_EMAIL_CONSENT'],
        escalationConditions: [],
        successCriteria: [
          { type: 'PAYMENT_MADE', exitWorkflow: true },
          { type: 'CONTACT_ESTABLISHED', moveToStep: 2 },
        ],
      },
      {
        id: 'early_4',
        stepNumber: 4,
        name: 'Promise Follow-up',
        description: 'Follow up on payment promise',
        actionType: 'PHONE',
        autoExecute: false,
        daysFromPrevious: 1,
        requiresApproval: false,
        complianceChecks: ['TCPA_PHONE_CONSENT'],
        escalationConditions: [
          { type: 'BROKEN_PROMISE', threshold: 1, action: 'ESCALATE' },
        ],
        successCriteria: [
          { type: 'PAYMENT_MADE', exitWorkflow: true },
        ],
      },
    ],
  },
  {
    id: 'mid_delinquency',
    name: 'Mid Delinquency (60-89 Days)',
    description: 'Escalated collection efforts',
    delinquencyBuckets: ['60-89'],
    enabled: true,
    priority: 2,
    compliance: [
      {
        regulation: 'FDCPA',
        description: 'Fair Debt Collection Practices Act compliance',
        checkRequired: true,
        frequency: 'DAILY',
      },
      {
        regulation: 'SCRA',
        description: 'Servicemembers Civil Relief Act check',
        checkRequired: true,
        frequency: 'MONTHLY',
      },
    ],
    steps: [
      {
        id: 'mid_1',
        stepNumber: 1,
        name: 'Formal Notice Letter',
        description: 'Send formal delinquency notice',
        actionType: 'LETTER',
        autoExecute: true,
        daysFromPrevious: 0,
        template: 'formal_notice_letter',
        requiresApproval: false,
        complianceChecks: ['FDCPA_VALIDATION_NOTICE'],
        escalationConditions: [],
        successCriteria: [
          { type: 'PAYMENT_MADE', exitWorkflow: true },
        ],
      },
      {
        id: 'mid_2',
        stepNumber: 2,
        name: 'Collections Call',
        description: 'Professional collections call',
        actionType: 'PHONE',
        autoExecute: false,
        daysFromPrevious: 5,
        requiresApproval: false,
        complianceChecks: ['TCPA_PHONE_CONSENT', 'FDCPA_MINI_MIRANDA'],
        escalationConditions: [
          { type: 'NO_CONTACT', threshold: 5, action: 'SKIP_TRACE' },
        ],
        successCriteria: [
          { type: 'PAYMENT_MADE', exitWorkflow: true },
          { type: 'ARRANGEMENT_MADE', moveToStep: 4 },
        ],
      },
      {
        id: 'mid_3',
        stepNumber: 3,
        name: 'Skip Trace',
        description: 'Locate updated contact information',
        actionType: 'SKIP_TRACE',
        autoExecute: true,
        daysFromPrevious: 0,
        requiresApproval: false,
        complianceChecks: ['FCRA_PERMISSIBLE_PURPOSE'],
        escalationConditions: [],
        successCriteria: [
          { type: 'CONTACT_ESTABLISHED', moveToStep: 2 },
        ],
      },
      {
        id: 'mid_4',
        stepNumber: 4,
        name: 'Arrangement Follow-up',
        description: 'Monitor payment arrangement',
        actionType: 'PHONE',
        autoExecute: false,
        daysFromPrevious: 7,
        requiresApproval: false,
        complianceChecks: ['TCPA_PHONE_CONSENT'],
        escalationConditions: [
          { type: 'BROKEN_PROMISE', threshold: 1, action: 'LEGAL' },
        ],
        successCriteria: [
          { type: 'PAYMENT_MADE', exitWorkflow: true },
        ],
      },
    ],
  },
];

export const CollectionsWorkflow = ({ isOpen, onClose, onSuccess }: CollectionsWorkflowProps) => {
  const [collectionsAccounts, setCollectionsAccounts] = useState<CollectionsAccount[]>([]);
  const [workflows, setWorkflows] = useState<CollectionsWorkflow[]>(DEFAULT_WORKFLOWS);
  const [selectedTab, setSelectedTab] = useState<'ACCOUNTS' | 'WORKFLOWS' | 'ANALYTICS' | 'COMPLIANCE'>('ACCOUNTS');
  const [selectedAccount, setSelectedAccount] = useState<CollectionsAccount | null>(null);
  const [filterBucket, setFilterBucket] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterAgent, setFilterAgent] = useState<string>('all');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadCollectionsData();
    // Set up polling for real-time updates
    const interval = setInterval(loadCollectionsData, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const loadCollectionsData = async () => {
    // Demo collections accounts
    setCollectionsAccounts([
      {
        id: 'coll_1',
        loanId: 'loan_123',
        borrowerName: 'John Smith',
        borrowerEmail: 'john.smith@email.com',
        borrowerPhone: '+1-555-0123',
        principalBalance: 185000,
        pastDueAmount: 2500,
        daysPastDue: 45,
        delinquencyBucket: '30-59',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        assignedAgent: 'Sarah Johnson',
        lastContactDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        nextActionDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        currentWorkflowStep: 2,
        workflowId: 'early_delinquency',
        collectionsScore: 75,
        notes: [
          {
            id: 'note_1',
            date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            agent: 'Sarah Johnson',
            type: 'CALL',
            subject: 'Courtesy call attempt',
            content: 'Left voicemail message requesting return call to discuss payment options.',
            outcome: 'Left Message',
            followUpDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
            complianceVerified: true,
          },
        ],
        paymentArrangements: [],
        complianceFlags: [
          {
            type: 'TCPA',
            description: 'Phone consent verified',
            severity: 'INFO',
            requiresAction: false,
          },
        ],
      },
      {
        id: 'coll_2',
        loanId: 'loan_456',
        borrowerName: 'Alice Brown',
        borrowerEmail: 'alice.brown@email.com',
        borrowerPhone: '+1-555-0456',
        principalBalance: 295000,
        pastDueAmount: 4200,
        daysPastDue: 75,
        delinquencyBucket: '60-89',
        priority: 'CRITICAL',
        status: 'ESCALATED',
        assignedAgent: 'Mike Rodriguez',
        lastContactDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        nextActionDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        currentWorkflowStep: 3,
        workflowId: 'mid_delinquency',
        collectionsScore: 45,
        notes: [
          {
            id: 'note_2',
            date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            agent: 'Mike Rodriguez',
            type: 'PHONE',
            subject: 'Collections call - payment arrangement',
            content: 'Spoke with borrower. Agreed to payment of $2000 by Friday.',
            outcome: 'Promise to Pay',
            followUpDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
            complianceVerified: true,
          },
        ],
        paymentArrangements: [
          {
            id: 'arr_1',
            type: 'PARTIAL_PAYMENT',
            amount: 2000,
            dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
            status: 'ACCEPTED',
            terms: 'Partial payment of $2000 by Friday, remaining balance next month',
            createdDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          },
        ],
        complianceFlags: [
          {
            type: 'FDCPA',
            description: 'Mini-Miranda warning required',
            severity: 'WARNING',
            requiresAction: true,
          },
        ],
      },
      {
        id: 'coll_3',
        loanId: 'loan_789',
        borrowerName: 'Robert Wilson',
        borrowerEmail: 'robert.wilson@email.com',
        borrowerPhone: '+1-555-0789',
        principalBalance: 150000,
        pastDueAmount: 6500,
        daysPastDue: 120,
        delinquencyBucket: '90-119',
        priority: 'CRITICAL',
        status: 'LEGAL',
        assignedAgent: 'Legal Department',
        lastContactDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        nextActionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        currentWorkflowStep: 1,
        workflowId: 'legal_workflow',
        collectionsScore: 25,
        notes: [],
        paymentArrangements: [],
        legalStatus: {
          phase: 'DEMAND_LETTER',
          attorney: 'Smith & Associates',
          estimatedCosts: 2500,
          recoveryProbability: 65,
        },
        complianceFlags: [
          {
            type: 'SCRA',
            description: 'Military status verification required',
            severity: 'CRITICAL',
            requiresAction: true,
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          },
        ],
      },
    ]);
  };

  const executeWorkflowStep = async (account: CollectionsAccount, stepNumber: number) => {
    setIsProcessing(true);
    try {
      const workflow = workflows.find(w => w.id === account.workflowId);
      const step = workflow?.steps.find(s => s.stepNumber === stepNumber);
      
      if (!step) {
        throw new Error('Workflow step not found');
      }

      // Simulate step execution
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Update account with step completion
      setCollectionsAccounts(prev => prev.map(acc => 
        acc.id === account.id 
          ? {
              ...acc,
              currentWorkflowStep: stepNumber + 1,
              lastContactDate: new Date(),
              nextActionDate: addDays(new Date(), step.daysFromPrevious || 7),
            }
          : acc
      ));

      // Add note for the action
      const newNote: CollectionsNote = {
        id: 'note_' + Date.now(),
        date: new Date(),
        agent: 'Current User',
        type: step.actionType as any,
        subject: `${step.name} - Step ${stepNumber}`,
        content: `Executed workflow step: ${step.description}`,
        outcome: 'Completed',
        complianceVerified: true,
      };

      setCollectionsAccounts(prev => prev.map(acc => 
        acc.id === account.id 
          ? { ...acc, notes: [newNote, ...acc.notes] }
          : acc
      ));

      toast.success(`${step.name} completed successfully`);
    } catch (error) {
      toast.error('Failed to execute workflow step');
    } finally {
      setIsProcessing(false);
    }
  };

  const addNote = async (accountId: string, note: Omit<CollectionsNote, 'id'>) => {
    const newNote: CollectionsNote = {
      ...note,
      id: 'note_' + Date.now(),
    };

    setCollectionsAccounts(prev => prev.map(acc => 
      acc.id === accountId 
        ? { ...acc, notes: [newNote, ...acc.notes] }
        : acc
    ));

    toast.success('Note added successfully');
  };

  const filterAccounts = (accounts: CollectionsAccount[]) => {
    return accounts.filter(account => {
      if (filterBucket !== 'all' && account.delinquencyBucket !== filterBucket) return false;
      if (filterStatus !== 'all' && account.status !== filterStatus) return false;
      if (filterAgent !== 'all' && account.assignedAgent !== filterAgent) return false;
      return true;
    });
  };

  const getStatusColor = (status: CollectionsAccount['status']) => {
    switch (status) {
      case 'NEW': return 'text-blue-600 bg-blue-100';
      case 'IN_PROGRESS': return 'text-yellow-600 bg-yellow-100';
      case 'CONTACTED': return 'text-green-600 bg-green-100';
      case 'ARRANGED': return 'text-purple-600 bg-purple-100';
      case 'ESCALATED': return 'text-orange-600 bg-orange-100';
      case 'LEGAL': return 'text-red-600 bg-red-100';
      case 'CLOSED': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getPriorityColor = (priority: CollectionsAccount['priority']) => {
    switch (priority) {
      case 'LOW': return 'text-green-600 bg-green-100';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100';
      case 'HIGH': return 'text-orange-600 bg-orange-100';
      case 'CRITICAL': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const filteredAccounts = filterAccounts(collectionsAccounts);
  const allAgents = Array.from(new Set(collectionsAccounts.map(acc => acc.assignedAgent)));

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
                  <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-red-50 to-orange-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-red-100 border border-red-200">
                          <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                          <Dialog.Title as="h3" className="text-xl font-bold leading-6 text-gray-900">
                            Collections Workflow Automation
                          </Dialog.Title>
                          <p className="mt-1 text-sm text-gray-600 flex items-center space-x-2">
                            <span>{collectionsAccounts.length} accounts in collections</span>
                            <span>•</span>
                            <span>{collectionsAccounts.filter(a => a.status === 'IN_PROGRESS').length} active workflows</span>
                            <span>•</span>
                            <span>{workflows.filter(w => w.enabled).length} enabled workflows</span>
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
                          { key: 'ACCOUNTS', label: 'Collections Accounts', icon: UserIcon, count: collectionsAccounts.length },
                          { key: 'WORKFLOWS', label: 'Workflow Management', icon: CogIcon, count: workflows.length },
                          { key: 'ANALYTICS', label: 'Performance Analytics', icon: ChartBarIcon },
                          { key: 'COMPLIANCE', label: 'Compliance Monitor', icon: ShieldCheckIcon, count: collectionsAccounts.reduce((sum, acc) => sum + acc.complianceFlags.filter(f => f.requiresAction).length, 0) },
                        ].map((tab) => {
                          const IconComponent = tab.icon;
                          return (
                            <button
                              key={tab.key}
                              onClick={() => setSelectedTab(tab.key as any)}
                              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                                selectedTab === tab.key
                                  ? 'border-red-500 text-red-600'
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

                    {/* Collections Accounts Tab */}
                    {selectedTab === 'ACCOUNTS' && (
                      <div className="space-y-6">
                        {/* Filters */}
                        <div className="flex flex-wrap items-center gap-4">
                          <select
                            value={filterBucket}
                            onChange={(e) => setFilterBucket(e.target.value)}
                            className="rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                          >
                            <option value="all">All Buckets</option>
                            <option value="30-59">30-59 Days</option>
                            <option value="60-89">60-89 Days</option>
                            <option value="90-119">90-119 Days</option>
                            <option value="120-179">120-179 Days</option>
                            <option value="180+">180+ Days</option>
                          </select>

                          <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                          >
                            <option value="all">All Statuses</option>
                            <option value="NEW">New</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="CONTACTED">Contacted</option>
                            <option value="ARRANGED">Arranged</option>
                            <option value="ESCALATED">Escalated</option>
                            <option value="LEGAL">Legal</option>
                          </select>

                          <select
                            value={filterAgent}
                            onChange={(e) => setFilterAgent(e.target.value)}
                            className="rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                          >
                            <option value="all">All Agents</option>
                            {allAgents.map(agent => (
                              <option key={agent} value={agent}>{agent}</option>
                            ))}
                          </select>

                          <div className="text-sm text-gray-600">
                            Showing {filteredAccounts.length} of {collectionsAccounts.length} accounts
                          </div>
                        </div>

                        {/* Accounts List */}
                        <div className="space-y-4">
                          {filteredAccounts.map((account) => {
                            const workflow = workflows.find(w => w.id === account.workflowId);
                            const currentStep = workflow?.steps.find(s => s.stepNumber === account.currentWorkflowStep);
                            
                            return (
                              <div key={account.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-3 mb-3">
                                      <h5 className="text-lg font-medium text-gray-900">
                                        {account.borrowerName}
                                      </h5>
                                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(account.status)}`}>
                                        {account.status.replace('_', ' ')}
                                      </span>
                                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(account.priority)}`}>
                                        {account.priority}
                                      </span>
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                        {account.delinquencyBucket} Days
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 text-sm mb-4">
                                      <div>
                                        <span className="font-medium text-gray-700">Loan ID:</span>
                                        <span className="ml-2">{account.loanId}</span>
                                      </div>
                                      <div>
                                        <span className="font-medium text-gray-700">Past Due:</span>
                                        <span className="ml-2 text-red-600 font-medium">{formatCurrency(account.pastDueAmount)}</span>
                                      </div>
                                      <div>
                                        <span className="font-medium text-gray-700">Days Past Due:</span>
                                        <span className="ml-2">{account.daysPastDue}</span>
                                      </div>
                                      <div>
                                        <span className="font-medium text-gray-700">Agent:</span>
                                        <span className="ml-2">{account.assignedAgent}</span>
                                      </div>
                                      <div>
                                        <span className="font-medium text-gray-700">Score:</span>
                                        <span className="ml-2">{account.collectionsScore}/100</span>
                                      </div>
                                    </div>

                                    {/* Current Workflow Step */}
                                    {currentStep && (
                                      <div className="bg-gray-50 rounded-lg p-3 mb-4">
                                        <div className="flex items-center justify-between">
                                          <div>
                                            <h6 className="text-sm font-medium text-gray-900">
                                              Current Step: {currentStep.name}
                                            </h6>
                                            <p className="text-sm text-gray-600">{currentStep.description}</p>
                                            <p className="text-xs text-gray-500 mt-1">
                                              Next action due: {format(account.nextActionDate, 'MMM d, yyyy h:mm a')}
                                            </p>
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            {currentStep.autoExecute ? (
                                              <span className="inline-flex items-center text-sm text-blue-600">
                                                <PlayIcon className="h-4 w-4 mr-1" />
                                                Auto
                                              </span>
                                            ) : (
                                              <button
                                                onClick={() => executeWorkflowStep(account, account.currentWorkflowStep)}
                                                disabled={isProcessing}
                                                className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                                              >
                                                <PlayIcon className="h-4 w-4 mr-1" />
                                                Execute
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Recent Notes */}
                                    {account.notes.length > 0 && (
                                      <div className="border-t pt-3">
                                        <h6 className="text-sm font-medium text-gray-900 mb-2">Recent Activity</h6>
                                        <div className="space-y-2">
                                          {account.notes.slice(0, 2).map((note) => (
                                            <div key={note.id} className="text-sm">
                                              <div className="flex items-center space-x-2">
                                                <span className="font-medium text-gray-700">{note.type}:</span>
                                                <span>{note.subject}</span>
                                                <span className="text-gray-500">•</span>
                                                <span className="text-gray-500">{format(note.date, 'MMM d')}</span>
                                                <span className="text-gray-500">•</span>
                                                <span className="text-gray-500">{note.agent}</span>
                                              </div>
                                              <p className="text-gray-600 text-xs mt-1">{note.content}</p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Compliance Flags */}
                                    {account.complianceFlags.filter(f => f.requiresAction).length > 0 && (
                                      <div className="border-t pt-3 mt-3">
                                        <h6 className="text-sm font-medium text-red-900 mb-2 flex items-center">
                                          <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                                          Compliance Alerts
                                        </h6>
                                        <div className="space-y-1">
                                          {account.complianceFlags.filter(f => f.requiresAction).map((flag, index) => (
                                            <div key={index} className="text-sm text-red-700 bg-red-50 rounded p-2">
                                              <span className="font-medium">{flag.type}:</span> {flag.description}
                                              {flag.dueDate && (
                                                <span className="text-xs ml-2">Due: {format(flag.dueDate, 'MMM d')}</span>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center space-x-2 ml-4">
                                    <button
                                      onClick={() => setSelectedAccount(account)}
                                      className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                                    >
                                      <UserIcon className="h-4 w-4 mr-1" />
                                      Details
                                    </button>
                                    
                                    <button className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                                      <PhoneIcon className="h-4 w-4 mr-1" />
                                      Call
                                    </button>
                                    
                                    <button className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                                      <EnvelopeIcon className="h-4 w-4 mr-1" />
                                      Email
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {filteredAccounts.length === 0 && (
                            <div className="text-center py-12">
                              <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400" />
                              <h3 className="mt-2 text-sm font-medium text-gray-900">No accounts found</h3>
                              <p className="mt-1 text-sm text-gray-500">
                                Try adjusting your filters to see more results.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Other tabs would continue here... */}
                    {selectedTab === 'WORKFLOWS' && (
                      <div className="text-center py-12">
                        <CogIcon className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">Workflow Management</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          Configure and manage collections workflows.
                        </p>
                      </div>
                    )}

                    {selectedTab === 'ANALYTICS' && (
                      <div className="space-y-6">
                        <h4 className="text-lg font-semibold text-gray-900">Collections Performance</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                          <div className="bg-white overflow-hidden shadow rounded-lg">
                            <div className="p-5">
                              <div className="flex items-center">
                                <div className="flex-shrink-0">
                                  <CurrencyDollarIcon className="h-6 w-6 text-green-600" />
                                </div>
                                <div className="ml-5 w-0 flex-1">
                                  <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Collections Rate</dt>
                                    <dd className="text-lg font-semibold text-gray-900">68%</dd>
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
                                    <dt className="text-sm font-medium text-gray-500 truncate">Avg Resolution Time</dt>
                                    <dd className="text-lg font-semibold text-gray-900">14 days</dd>
                                  </dl>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="bg-white overflow-hidden shadow rounded-lg">
                            <div className="p-5">
                              <div className="flex items-center">
                                <div className="flex-shrink-0">
                                  <PhoneIcon className="h-6 w-6 text-purple-600" />
                                </div>
                                <div className="ml-5 w-0 flex-1">
                                  <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Contact Rate</dt>
                                    <dd className="text-lg font-semibold text-gray-900">42%</dd>
                                  </dl>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="bg-white overflow-hidden shadow rounded-lg">
                            <div className="p-5">
                              <div className="flex items-center">
                                <div className="flex-shrink-0">
                                  <ScaleIcon className="h-6 w-6 text-red-600" />
                                </div>
                                <div className="ml-5 w-0 flex-1">
                                  <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Legal Referrals</dt>
                                    <dd className="text-lg font-semibold text-gray-900">12</dd>
                                  </dl>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedTab === 'COMPLIANCE' && (
                      <div className="space-y-6">
                        <h4 className="text-lg font-semibold text-gray-900">Compliance Monitoring</h4>
                        
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                          <div className="flex">
                            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
                            <div className="ml-3">
                              <h3 className="text-sm font-medium text-yellow-800">
                                {collectionsAccounts.reduce((sum, acc) => sum + acc.complianceFlags.filter(f => f.requiresAction).length, 0)} compliance items require attention
                              </h3>
                              <div className="mt-2 text-sm text-yellow-700">
                                <p>Review and resolve compliance flags before proceeding with collections activities.</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {collectionsAccounts.map(account => 
                            account.complianceFlags.filter(f => f.requiresAction).length > 0 && (
                              <div key={account.id} className="bg-white border border-gray-200 rounded-lg p-4">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <h5 className="font-medium text-gray-900">{account.borrowerName} - {account.loanId}</h5>
                                    <div className="mt-2 space-y-2">
                                      {account.complianceFlags.filter(f => f.requiresAction).map((flag, index) => (
                                        <div key={index} className={`p-2 rounded text-sm ${
                                          flag.severity === 'CRITICAL' ? 'bg-red-50 text-red-700' :
                                          flag.severity === 'WARNING' ? 'bg-yellow-50 text-yellow-700' :
                                          'bg-blue-50 text-blue-700'
                                        }`}>
                                          <span className="font-medium">{flag.type}:</span> {flag.description}
                                          {flag.dueDate && (
                                            <span className="text-xs ml-2">Due: {format(flag.dueDate, 'MMM d, yyyy')}</span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <button className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700">
                                    Resolve
                                  </button>
                                </div>
                              </div>
                            )
                          )}
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
                        toast.success('Collections workflow updated');
                      }}
                      className="inline-flex justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500"
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