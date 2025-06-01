import { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  XMarkIcon,
  UserIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  ArrowPathIcon,
  ChartBarIcon,
  BuildingLibraryIcon,
  ScaleIcon,
  ShieldCheckIcon,
  BellIcon,
  CogIcon,
  PlayIcon,
  PauseIcon,
  CalendarIcon,
  DocumentCheckIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { format, addDays, differenceInDays } from 'date-fns';
import { LoanEngine } from '@lendpeak/engine';

interface LoanOriginationPipelineProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface LoanApplication {
  id: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  loanAmount: number;
  loanPurpose: string;
  requestedTerm: number;
  applicationDate: Date;
  status: ApplicationStatus;
  currentStage: number;
  creditScore?: number;
  income: number;
  debtToIncome?: number;
  loanToValue?: number;
  propertyValue?: number;
  documents: ApplicationDocument[];
  underwritingDecision?: UnderwritingDecision;
  complianceChecks: ComplianceCheck[];
  riskScore: number;
  assignedProcessor: string;
  estimatedCloseDate?: Date;
  notes: ApplicationNote[];
}

interface ApplicationDocument {
  id: string;
  type: DocumentType;
  name: string;
  status: 'PENDING' | 'RECEIVED' | 'VERIFIED' | 'REJECTED';
  uploadedDate?: Date;
  verifiedDate?: Date;
  required: boolean;
}

interface UnderwritingDecision {
  decision: 'APPROVED' | 'DECLINED' | 'CONDITIONAL' | 'SUSPENDED';
  conditions: string[];
  approvedAmount?: number;
  approvedRate?: number;
  approvedTerm?: number;
  decisionDate: Date;
  underwriter: string;
  reasoning: string;
}

interface ComplianceCheck {
  type: 'OFAC' | 'PATRIOT_ACT' | 'SCRA' | 'FLOOD_ZONE' | 'ATR' | 'QM';
  status: 'PENDING' | 'PASSED' | 'FAILED' | 'REVIEW_REQUIRED';
  checkedDate?: Date;
  result?: string;
  required: boolean;
}

interface ApplicationNote {
  id: string;
  date: Date;
  author: string;
  content: string;
  category: 'GENERAL' | 'UNDERWRITING' | 'COMPLIANCE' | 'DOCUMENT' | 'CUSTOMER_CONTACT';
  isInternal: boolean;
}

interface OriginationStage {
  id: number;
  name: string;
  description: string;
  estimatedDays: number;
  required: boolean;
  automated: boolean;
  responsibleParty: string;
}

type ApplicationStatus = 
  | 'RECEIVED' 
  | 'INITIAL_REVIEW' 
  | 'DOCUMENT_COLLECTION' 
  | 'CREDIT_VERIFICATION' 
  | 'UNDERWRITING' 
  | 'COMPLIANCE_REVIEW' 
  | 'CONDITIONAL_APPROVAL' 
  | 'FINAL_APPROVAL' 
  | 'CLOSING' 
  | 'FUNDED' 
  | 'DECLINED' 
  | 'WITHDRAWN';

type DocumentType = 
  | 'APPLICATION' 
  | 'INCOME_VERIFICATION' 
  | 'BANK_STATEMENTS' 
  | 'CREDIT_REPORT' 
  | 'APPRAISAL' 
  | 'TITLE_REPORT' 
  | 'INSURANCE' 
  | 'TAX_RETURNS' 
  | 'EMPLOYMENT_VERIFICATION';

const ORIGINATION_STAGES: OriginationStage[] = [
  {
    id: 1,
    name: 'Application Received',
    description: 'Initial application received and logged',
    estimatedDays: 1,
    required: true,
    automated: true,
    responsibleParty: 'System',
  },
  {
    id: 2,
    name: 'Initial Review',
    description: 'Basic eligibility and completeness check',
    estimatedDays: 1,
    required: true,
    automated: false,
    responsibleParty: 'Loan Processor',
  },
  {
    id: 3,
    name: 'Document Collection',
    description: 'Gather required documentation',
    estimatedDays: 5,
    required: true,
    automated: false,
    responsibleParty: 'Loan Processor',
  },
  {
    id: 4,
    name: 'Credit Verification',
    description: 'Pull and analyze credit report',
    estimatedDays: 1,
    required: true,
    automated: true,
    responsibleParty: 'System',
  },
  {
    id: 5,
    name: 'Property Appraisal',
    description: 'Order and review property appraisal',
    estimatedDays: 7,
    required: true,
    automated: false,
    responsibleParty: 'Appraiser',
  },
  {
    id: 6,
    name: 'Underwriting Review',
    description: 'Comprehensive loan analysis and decision',
    estimatedDays: 3,
    required: true,
    automated: false,
    responsibleParty: 'Underwriter',
  },
  {
    id: 7,
    name: 'Compliance Review',
    description: 'Final compliance and regulatory checks',
    estimatedDays: 2,
    required: true,
    automated: true,
    responsibleParty: 'Compliance Team',
  },
  {
    id: 8,
    name: 'Final Approval',
    description: 'Senior management approval',
    estimatedDays: 1,
    required: true,
    automated: false,
    responsibleParty: 'Senior Underwriter',
  },
  {
    id: 9,
    name: 'Closing Preparation',
    description: 'Prepare closing documents',
    estimatedDays: 3,
    required: true,
    automated: false,
    responsibleParty: 'Closing Team',
  },
  {
    id: 10,
    name: 'Funding',
    description: 'Loan funding and disbursement',
    estimatedDays: 1,
    required: true,
    automated: true,
    responsibleParty: 'Operations',
  },
];

export const LoanOriginationPipeline = ({ isOpen, onClose, onSuccess }: LoanOriginationPipelineProps) => {
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<LoanApplication | null>(null);
  const [selectedTab, setSelectedTab] = useState<'PIPELINE' | 'APPLICATIONS' | 'ANALYTICS' | 'AUTOMATION'>('PIPELINE');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterProcessor, setFilterProcessor] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'stage' | 'risk'>('date');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showApplicationModal, setShowApplicationModal] = useState(false);

  useEffect(() => {
    loadApplications();
    // Set up real-time updates
    const interval = setInterval(loadApplications, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const loadApplications = async () => {
    // Demo applications data
    setApplications([
      {
        id: 'APP-001',
        applicantName: 'John Smith',
        applicantEmail: 'john.smith@email.com',
        applicantPhone: '+1-555-0123',
        loanAmount: 350000,
        loanPurpose: 'Home Purchase',
        requestedTerm: 360,
        applicationDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        status: 'UNDERWRITING',
        currentStage: 6,
        creditScore: 750,
        income: 85000,
        debtToIncome: 28,
        loanToValue: 80,
        propertyValue: 437500,
        riskScore: 72,
        assignedProcessor: 'Sarah Johnson',
        estimatedCloseDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        documents: [
          { id: 'doc1', type: 'APPLICATION', name: 'Loan Application', status: 'VERIFIED', required: true, uploadedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), verifiedDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) },
          { id: 'doc2', type: 'INCOME_VERIFICATION', name: 'Pay Stubs', status: 'VERIFIED', required: true, uploadedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), verifiedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
          { id: 'doc3', type: 'CREDIT_REPORT', name: 'Credit Report', status: 'VERIFIED', required: true, uploadedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), verifiedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
          { id: 'doc4', type: 'APPRAISAL', name: 'Property Appraisal', status: 'PENDING', required: true },
        ],
        complianceChecks: [
          { type: 'OFAC', status: 'PASSED', required: true, checkedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), result: 'No matches found' },
          { type: 'PATRIOT_ACT', status: 'PASSED', required: true, checkedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), result: 'Identity verified' },
          { type: 'SCRA', status: 'PASSED', required: true, checkedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), result: 'Not active military' },
          { type: 'FLOOD_ZONE', status: 'PENDING', required: true },
        ],
        notes: [
          {
            id: 'note1',
            date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            author: 'Sarah Johnson',
            content: 'Applicant has excellent credit history and stable employment. DTI ratio is within acceptable limits.',
            category: 'UNDERWRITING',
            isInternal: true,
          },
        ],
      },
      {
        id: 'APP-002',
        applicantName: 'Maria Garcia',
        applicantEmail: 'maria.garcia@email.com',
        applicantPhone: '+1-555-0456',
        loanAmount: 275000,
        loanPurpose: 'Refinance',
        requestedTerm: 300,
        applicationDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        status: 'DOCUMENT_COLLECTION',
        currentStage: 3,
        creditScore: 680,
        income: 72000,
        debtToIncome: 35,
        loanToValue: 75,
        propertyValue: 366667,
        riskScore: 58,
        assignedProcessor: 'Mike Rodriguez',
        estimatedCloseDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        documents: [
          { id: 'doc5', type: 'APPLICATION', name: 'Loan Application', status: 'VERIFIED', required: true, uploadedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), verifiedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
          { id: 'doc6', type: 'INCOME_VERIFICATION', name: 'Pay Stubs', status: 'PENDING', required: true },
          { id: 'doc7', type: 'BANK_STATEMENTS', name: 'Bank Statements', status: 'PENDING', required: true },
          { id: 'doc8', type: 'TAX_RETURNS', name: 'Tax Returns', status: 'PENDING', required: true },
        ],
        complianceChecks: [
          { type: 'OFAC', status: 'PASSED', required: true, checkedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), result: 'No matches found' },
          { type: 'PATRIOT_ACT', status: 'PENDING', required: true },
          { type: 'SCRA', status: 'PENDING', required: true },
        ],
        notes: [
          {
            id: 'note2',
            date: new Date(Date.now() - 6 * 60 * 60 * 1000),
            author: 'Mike Rodriguez',
            content: 'Following up with applicant on missing documentation. Left voicemail requesting bank statements.',
            category: 'DOCUMENT',
            isInternal: true,
          },
        ],
      },
      {
        id: 'APP-003',
        applicantName: 'Robert Chen',
        applicantEmail: 'robert.chen@email.com',
        applicantPhone: '+1-555-0789',
        loanAmount: 425000,
        loanPurpose: 'Home Purchase',
        requestedTerm: 360,
        applicationDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        status: 'INITIAL_REVIEW',
        currentStage: 2,
        creditScore: 720,
        income: 95000,
        debtToIncome: 30,
        loanToValue: 85,
        propertyValue: 500000,
        riskScore: 65,
        assignedProcessor: 'Lisa Wang',
        estimatedCloseDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
        documents: [
          { id: 'doc9', type: 'APPLICATION', name: 'Loan Application', status: 'RECEIVED', required: true, uploadedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
        ],
        complianceChecks: [
          { type: 'OFAC', status: 'PENDING', required: true },
          { type: 'PATRIOT_ACT', status: 'PENDING', required: true },
        ],
        notes: [],
      },
    ]);
  };

  const advanceStage = async (application: LoanApplication) => {
    setIsProcessing(true);
    try {
      const nextStage = application.currentStage + 1;
      const maxStage = ORIGINATION_STAGES.length;
      
      if (nextStage > maxStage) {
        toast.warning('Application is already at the final stage');
        return;
      }

      // Simulate stage advancement processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Update application
      setApplications(prev => prev.map(app => 
        app.id === application.id 
          ? {
              ...app,
              currentStage: nextStage,
              status: getStatusFromStage(nextStage),
            }
          : app
      ));

      const stage = ORIGINATION_STAGES.find(s => s.id === nextStage);
      toast.success(`Application advanced to: ${stage?.name}`);

      // Add note for stage advancement
      const note: ApplicationNote = {
        id: 'note_' + Date.now(),
        date: new Date(),
        author: 'Current User',
        content: `Application advanced to stage ${nextStage}: ${stage?.name}`,
        category: 'GENERAL',
        isInternal: true,
      };

      setApplications(prev => prev.map(app => 
        app.id === application.id 
          ? { ...app, notes: [note, ...app.notes] }
          : app
      ));
    } catch (error) {
      toast.error('Failed to advance application stage');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusFromStage = (stage: number): ApplicationStatus => {
    switch (stage) {
      case 1: return 'RECEIVED';
      case 2: return 'INITIAL_REVIEW';
      case 3: return 'DOCUMENT_COLLECTION';
      case 4: return 'CREDIT_VERIFICATION';
      case 5: case 6: return 'UNDERWRITING';
      case 7: return 'COMPLIANCE_REVIEW';
      case 8: return 'FINAL_APPROVAL';
      case 9: return 'CLOSING';
      case 10: return 'FUNDED';
      default: return 'RECEIVED';
    }
  };

  const makeUnderwritingDecision = async (application: LoanApplication, decision: UnderwritingDecision['decision']) => {
    setIsProcessing(true);
    try {
      // Simulate underwriting decision
      await new Promise(resolve => setTimeout(resolve, 1500));

      const underwritingDecision: UnderwritingDecision = {
        decision,
        conditions: decision === 'CONDITIONAL' ? ['Verify additional income', 'Update property insurance'] : [],
        approvedAmount: decision === 'APPROVED' ? application.loanAmount : undefined,
        approvedRate: decision === 'APPROVED' ? 4.25 : undefined,
        approvedTerm: decision === 'APPROVED' ? application.requestedTerm : undefined,
        decisionDate: new Date(),
        underwriter: 'Current User',
        reasoning: decision === 'APPROVED' ? 'Strong credit profile and income verification' : 
                   decision === 'DECLINED' ? 'DTI ratio exceeds guidelines' :
                   'Approval pending satisfaction of conditions',
      };

      setApplications(prev => prev.map(app => 
        app.id === application.id 
          ? {
              ...app,
              underwritingDecision,
              status: decision === 'APPROVED' ? 'FINAL_APPROVAL' : 
                     decision === 'DECLINED' ? 'DECLINED' : 'CONDITIONAL_APPROVAL',
              currentStage: decision === 'DECLINED' ? app.currentStage : app.currentStage + 1,
            }
          : app
      ));

      toast.success(`Underwriting decision: ${decision}`);
    } catch (error) {
      toast.error('Failed to make underwriting decision');
    } finally {
      setIsProcessing(false);
    }
  };

  const runAutomatedChecks = async (application: LoanApplication) => {
    setIsProcessing(true);
    try {
      // Simulate automated compliance checks
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Update compliance checks
      const updatedChecks = application.complianceChecks.map(check => ({
        ...check,
        status: 'PASSED' as const,
        checkedDate: new Date(),
        result: 'Check completed successfully',
      }));

      setApplications(prev => prev.map(app => 
        app.id === application.id 
          ? { ...app, complianceChecks: updatedChecks }
          : app
      ));

      toast.success('Automated compliance checks completed');
    } catch (error) {
      toast.error('Automated checks failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const calculateRiskScore = (application: LoanApplication): number => {
    let score = 50; // Base score
    
    // Credit score impact (30% weight)
    if (application.creditScore) {
      if (application.creditScore >= 740) score += 20;
      else if (application.creditScore >= 680) score += 10;
      else if (application.creditScore >= 620) score -= 10;
      else score -= 20;
    }
    
    // DTI impact (25% weight)
    if (application.debtToIncome) {
      if (application.debtToIncome <= 28) score += 15;
      else if (application.debtToIncome <= 36) score += 5;
      else if (application.debtToIncome <= 43) score -= 5;
      else score -= 15;
    }
    
    // LTV impact (25% weight)
    if (application.loanToValue) {
      if (application.loanToValue <= 80) score += 15;
      else if (application.loanToValue <= 90) score += 5;
      else if (application.loanToValue <= 95) score -= 5;
      else score -= 15;
    }
    
    // Loan amount impact (20% weight)
    if (application.loanAmount > 500000) score -= 10;
    else if (application.loanAmount > 300000) score -= 5;
    else score += 5;
    
    return Math.max(0, Math.min(100, score));
  };

  const getStatusColor = (status: ApplicationStatus) => {
    switch (status) {
      case 'RECEIVED': return 'text-blue-600 bg-blue-100';
      case 'INITIAL_REVIEW': return 'text-yellow-600 bg-yellow-100';
      case 'DOCUMENT_COLLECTION': return 'text-orange-600 bg-orange-100';
      case 'CREDIT_VERIFICATION': return 'text-purple-600 bg-purple-100';
      case 'UNDERWRITING': return 'text-indigo-600 bg-indigo-100';
      case 'COMPLIANCE_REVIEW': return 'text-pink-600 bg-pink-100';
      case 'CONDITIONAL_APPROVAL': return 'text-amber-600 bg-amber-100';
      case 'FINAL_APPROVAL': return 'text-green-600 bg-green-100';
      case 'CLOSING': return 'text-teal-600 bg-teal-100';
      case 'FUNDED': return 'text-emerald-600 bg-emerald-100';
      case 'DECLINED': return 'text-red-600 bg-red-100';
      case 'WITHDRAWN': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getRiskScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    if (score >= 40) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const filteredApplications = applications
    .filter(app => {
      if (filterStatus !== 'all' && app.status !== filterStatus) return false;
      if (filterProcessor !== 'all' && app.assignedProcessor !== filterProcessor) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return b.applicationDate.getTime() - a.applicationDate.getTime();
        case 'amount':
          return b.loanAmount - a.loanAmount;
        case 'stage':
          return b.currentStage - a.currentStage;
        case 'risk':
          return b.riskScore - a.riskScore;
        default:
          return 0;
      }
    });

  const allProcessors = Array.from(new Set(applications.map(app => app.assignedProcessor)));

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
                  <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 border border-blue-200">
                          <BuildingLibraryIcon className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <Dialog.Title as="h3" className="text-xl font-bold leading-6 text-gray-900">
                            Loan Origination Pipeline
                          </Dialog.Title>
                          <p className="mt-1 text-sm text-gray-600 flex items-center space-x-2">
                            <span>{applications.length} active applications</span>
                            <span>•</span>
                            <span>{applications.filter(a => a.status === 'UNDERWRITING').length} in underwriting</span>
                            <span>•</span>
                            <span>{applications.filter(a => a.status === 'FUNDED').length} funded this month</span>
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
                          { key: 'PIPELINE', label: 'Pipeline Overview', icon: ArrowRightIcon },
                          { key: 'APPLICATIONS', label: 'Applications', icon: DocumentTextIcon, count: applications.length },
                          { key: 'ANALYTICS', label: 'Analytics', icon: ChartBarIcon },
                          { key: 'AUTOMATION', label: 'Automation Rules', icon: CogIcon },
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

                    {/* Pipeline Overview Tab */}
                    {selectedTab === 'PIPELINE' && (
                      <div className="space-y-6">
                        {/* Stage Progress */}
                        <div className="bg-white border border-gray-200 rounded-lg p-6">
                          <h4 className="text-lg font-semibold text-gray-900 mb-4">Origination Stages</h4>
                          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-5 gap-4">
                            {ORIGINATION_STAGES.slice(0, 10).map((stage, index) => {
                              const applicationsInStage = applications.filter(app => app.currentStage === stage.id).length;
                              
                              return (
                                <div key={stage.id} className="relative">
                                  <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200 hover:border-blue-300 transition-colors">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                        applicationsInStage > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                                      }`}>
                                        {stage.id}
                                      </div>
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                        applicationsInStage > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                                      }`}>
                                        {applicationsInStage}
                                      </span>
                                    </div>
                                    <h5 className="font-medium text-gray-900 text-sm mb-1">{stage.name}</h5>
                                    <p className="text-xs text-gray-600 mb-2">{stage.description}</p>
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="text-gray-500">{stage.estimatedDays}d</span>
                                      <span className={`${stage.automated ? 'text-green-600' : 'text-orange-600'}`}>
                                        {stage.automated ? 'Auto' : 'Manual'}
                                      </span>
                                    </div>
                                  </div>
                                  {index < ORIGINATION_STAGES.length - 1 && (
                                    <ArrowRightIcon className="hidden xl:block absolute top-1/2 -right-2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Recent Activity */}
                        <div className="bg-white border border-gray-200 rounded-lg p-6">
                          <h4 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h4>
                          <div className="space-y-3">
                            {applications.slice(0, 5).map((app) => (
                              <div key={app.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                                <div className="flex items-center space-x-3">
                                  <UserIcon className="h-5 w-5 text-gray-400" />
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">{app.applicantName}</p>
                                    <p className="text-xs text-gray-500">
                                      {formatCurrency(app.loanAmount)} • Stage {app.currentStage} • {app.assignedProcessor}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(app.status)}`}>
                                    {app.status.replace('_', ' ')}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {differenceInDays(new Date(), app.applicationDate)}d ago
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Applications Tab */}
                    {selectedTab === 'APPLICATIONS' && (
                      <div className="space-y-6">
                        {/* Filters */}
                        <div className="flex flex-wrap items-center gap-4">
                          <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          >
                            <option value="all">All Statuses</option>
                            <option value="RECEIVED">Received</option>
                            <option value="INITIAL_REVIEW">Initial Review</option>
                            <option value="DOCUMENT_COLLECTION">Document Collection</option>
                            <option value="UNDERWRITING">Underwriting</option>
                            <option value="FINAL_APPROVAL">Final Approval</option>
                            <option value="FUNDED">Funded</option>
                            <option value="DECLINED">Declined</option>
                          </select>

                          <select
                            value={filterProcessor}
                            onChange={(e) => setFilterProcessor(e.target.value)}
                            className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          >
                            <option value="all">All Processors</option>
                            {allProcessors.map(processor => (
                              <option key={processor} value={processor}>{processor}</option>
                            ))}
                          </select>

                          <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          >
                            <option value="date">Sort by Date</option>
                            <option value="amount">Sort by Amount</option>
                            <option value="stage">Sort by Stage</option>
                            <option value="risk">Sort by Risk Score</option>
                          </select>

                          <div className="text-sm text-gray-600">
                            Showing {filteredApplications.length} of {applications.length} applications
                          </div>
                        </div>

                        {/* Applications List */}
                        <div className="space-y-4">
                          {filteredApplications.map((application) => {
                            const currentStage = ORIGINATION_STAGES.find(s => s.id === application.currentStage);
                            const riskScore = calculateRiskScore(application);
                            
                            return (
                              <div key={application.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-3 mb-3">
                                      <h5 className="text-lg font-medium text-gray-900">
                                        {application.applicantName}
                                      </h5>
                                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(application.status)}`}>
                                        {application.status.replace('_', ' ')}
                                      </span>
                                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRiskScoreColor(riskScore)}`}>
                                        Risk: {riskScore}
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mb-4">
                                      <div>
                                        <span className="font-medium text-gray-700">Loan Amount:</span>
                                        <span className="ml-2">{formatCurrency(application.loanAmount)}</span>
                                      </div>
                                      <div>
                                        <span className="font-medium text-gray-700">Purpose:</span>
                                        <span className="ml-2">{application.loanPurpose}</span>
                                      </div>
                                      <div>
                                        <span className="font-medium text-gray-700">Term:</span>
                                        <span className="ml-2">{application.requestedTerm} months</span>
                                      </div>
                                      <div>
                                        <span className="font-medium text-gray-700">Processor:</span>
                                        <span className="ml-2">{application.assignedProcessor}</span>
                                      </div>
                                      {application.creditScore && (
                                        <div>
                                          <span className="font-medium text-gray-700">Credit Score:</span>
                                          <span className="ml-2">{application.creditScore}</span>
                                        </div>
                                      )}
                                      {application.debtToIncome && (
                                        <div>
                                          <span className="font-medium text-gray-700">DTI:</span>
                                          <span className="ml-2">{application.debtToIncome}%</span>
                                        </div>
                                      )}
                                      {application.loanToValue && (
                                        <div>
                                          <span className="font-medium text-gray-700">LTV:</span>
                                          <span className="ml-2">{application.loanToValue}%</span>
                                        </div>
                                      )}
                                      <div>
                                        <span className="font-medium text-gray-700">Applied:</span>
                                        <span className="ml-2">{format(application.applicationDate, 'MMM d, yyyy')}</span>
                                      </div>
                                    </div>

                                    {/* Current Stage */}
                                    {currentStage && (
                                      <div className="bg-gray-50 rounded-lg p-3 mb-4">
                                        <div className="flex items-center justify-between">
                                          <div>
                                            <h6 className="text-sm font-medium text-gray-900">
                                              Stage {currentStage.id}: {currentStage.name}
                                            </h6>
                                            <p className="text-sm text-gray-600">{currentStage.description}</p>
                                            <p className="text-xs text-gray-500 mt-1">
                                              Responsible: {currentStage.responsibleParty}
                                            </p>
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            <span className={`inline-flex items-center text-sm ${
                                              currentStage.automated ? 'text-green-600' : 'text-orange-600'
                                            }`}>
                                              {currentStage.automated ? <CheckCircleIcon className="h-4 w-4 mr-1" /> : <UserIcon className="h-4 w-4 mr-1" />}
                                              {currentStage.automated ? 'Auto' : 'Manual'}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Documents Status */}
                                    <div className="border-t pt-3">
                                      <h6 className="text-sm font-medium text-gray-900 mb-2">Document Status</h6>
                                      <div className="flex flex-wrap gap-2">
                                        {application.documents.map((doc) => (
                                          <span key={doc.id} className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                            doc.status === 'VERIFIED' ? 'bg-green-100 text-green-800' :
                                            doc.status === 'RECEIVED' ? 'bg-blue-100 text-blue-800' :
                                            doc.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                                            'bg-yellow-100 text-yellow-800'
                                          }`}>
                                            {doc.type.replace('_', ' ')}: {doc.status}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex flex-col items-end space-y-2 ml-4">
                                    <button
                                      onClick={() => setSelectedApplication(application)}
                                      className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                                    >
                                      <DocumentTextIcon className="h-4 w-4 mr-1" />
                                      View Details
                                    </button>
                                    
                                    {application.status === 'UNDERWRITING' && (
                                      <div className="flex space-x-1">
                                        <button
                                          onClick={() => makeUnderwritingDecision(application, 'APPROVED')}
                                          disabled={isProcessing}
                                          className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                                        >
                                          Approve
                                        </button>
                                        <button
                                          onClick={() => makeUnderwritingDecision(application, 'DECLINED')}
                                          disabled={isProcessing}
                                          className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                                        >
                                          Decline
                                        </button>
                                      </div>
                                    )}
                                    
                                    {currentStage && !currentStage.automated && application.status !== 'DECLINED' && application.status !== 'FUNDED' && (
                                      <button
                                        onClick={() => advanceStage(application)}
                                        disabled={isProcessing}
                                        className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                                      >
                                        <ArrowRightIcon className="h-4 w-4 mr-1" />
                                        Advance
                                      </button>
                                    )}
                                    
                                    <button
                                      onClick={() => runAutomatedChecks(application)}
                                      disabled={isProcessing}
                                      className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                                    >
                                      <PlayIcon className="h-3 w-3 mr-1" />
                                      Run Checks
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {filteredApplications.length === 0 && (
                            <div className="text-center py-12">
                              <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                              <h3 className="mt-2 text-sm font-medium text-gray-900">No applications found</h3>
                              <p className="mt-1 text-sm text-gray-500">
                                Try adjusting your filters to see more results.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Analytics Tab */}
                    {selectedTab === 'ANALYTICS' && (
                      <div className="space-y-6">
                        <h4 className="text-lg font-semibold text-gray-900">Origination Analytics</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                          <div className="bg-white overflow-hidden shadow rounded-lg">
                            <div className="p-5">
                              <div className="flex items-center">
                                <div className="flex-shrink-0">
                                  <DocumentTextIcon className="h-6 w-6 text-blue-600" />
                                </div>
                                <div className="ml-5 w-0 flex-1">
                                  <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Total Applications</dt>
                                    <dd className="text-lg font-semibold text-gray-900">{applications.length}</dd>
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
                                    <dt className="text-sm font-medium text-gray-500 truncate">Approval Rate</dt>
                                    <dd className="text-lg font-semibold text-gray-900">78%</dd>
                                  </dl>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="bg-white overflow-hidden shadow rounded-lg">
                            <div className="p-5">
                              <div className="flex items-center">
                                <div className="flex-shrink-0">
                                  <ClockIcon className="h-6 w-6 text-yellow-600" />
                                </div>
                                <div className="ml-5 w-0 flex-1">
                                  <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Avg Time to Close</dt>
                                    <dd className="text-lg font-semibold text-gray-900">18 days</dd>
                                  </dl>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="bg-white overflow-hidden shadow rounded-lg">
                            <div className="p-5">
                              <div className="flex items-center">
                                <div className="flex-shrink-0">
                                  <CurrencyDollarIcon className="h-6 w-6 text-purple-600" />
                                </div>
                                <div className="ml-5 w-0 flex-1">
                                  <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Total Volume</dt>
                                    <dd className="text-lg font-semibold text-gray-900">
                                      {formatCurrency(applications.reduce((sum, app) => sum + app.loanAmount, 0))}
                                    </dd>
                                  </dl>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Automation Tab */}
                    {selectedTab === 'AUTOMATION' && (
                      <div className="space-y-6">
                        <h4 className="text-lg font-semibold text-gray-900">Automation Rules</h4>
                        
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                          <div className="flex">
                            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
                            <div className="ml-3">
                              <h3 className="text-sm font-medium text-yellow-800">
                                Automation Configuration
                              </h3>
                              <div className="mt-2 text-sm text-yellow-700">
                                <p>Configure automated workflows, decision rules, and compliance checks for the origination pipeline.</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="text-center py-12">
                          <CogIcon className="mx-auto h-12 w-12 text-gray-400" />
                          <h3 className="mt-2 text-sm font-medium text-gray-900">Automation Rules</h3>
                          <p className="mt-1 text-sm text-gray-500">
                            Advanced automation configuration panel would be implemented here.
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
                        toast.success('Origination pipeline updated');
                      }}
                      className="inline-flex justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
                    >
                      <CheckCircleIcon className="h-5 w-5 mr-2" />
                      Save Changes
                    </button>
                  </div>
                </div>

                {/* Application Detail Modal */}
                {selectedApplication && (
                  <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-[80]">
                    <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-gray-900">
                          Application Details - {selectedApplication.applicantName}
                        </h3>
                        <button
                          onClick={() => setSelectedApplication(null)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <XMarkIcon className="h-6 w-6" />
                        </button>
                      </div>
                      
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 mb-3">Applicant Information</h4>
                            <div className="space-y-2 text-sm">
                              <div><span className="font-medium">Name:</span> {selectedApplication.applicantName}</div>
                              <div><span className="font-medium">Email:</span> {selectedApplication.applicantEmail}</div>
                              <div><span className="font-medium">Phone:</span> {selectedApplication.applicantPhone}</div>
                              <div><span className="font-medium">Income:</span> {formatCurrency(selectedApplication.income)}</div>
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 mb-3">Loan Details</h4>
                            <div className="space-y-2 text-sm">
                              <div><span className="font-medium">Amount:</span> {formatCurrency(selectedApplication.loanAmount)}</div>
                              <div><span className="font-medium">Purpose:</span> {selectedApplication.loanPurpose}</div>
                              <div><span className="font-medium">Term:</span> {selectedApplication.requestedTerm} months</div>
                              <div><span className="font-medium">Property Value:</span> {selectedApplication.propertyValue ? formatCurrency(selectedApplication.propertyValue) : 'N/A'}</div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-3">Documents</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {selectedApplication.documents.map((doc) => (
                              <div key={doc.id} className="flex items-center justify-between p-2 border rounded">
                                <span className="text-sm">{doc.type.replace('_', ' ')}</span>
                                <span className={`text-xs px-2 py-1 rounded ${
                                  doc.status === 'VERIFIED' ? 'bg-green-100 text-green-800' :
                                  doc.status === 'RECEIVED' ? 'bg-blue-100 text-blue-800' :
                                  doc.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {doc.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-3">Compliance Checks</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {selectedApplication.complianceChecks.map((check, index) => (
                              <div key={index} className="flex items-center justify-between p-2 border rounded">
                                <span className="text-sm">{check.type}</span>
                                <span className={`text-xs px-2 py-1 rounded ${
                                  check.status === 'PASSED' ? 'bg-green-100 text-green-800' :
                                  check.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                                  check.status === 'REVIEW_REQUIRED' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {check.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {selectedApplication.notes.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 mb-3">Notes</h4>
                            <div className="space-y-3">
                              {selectedApplication.notes.map((note) => (
                                <div key={note.id} className="p-3 bg-gray-50 rounded">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium">{note.author}</span>
                                    <span className="text-xs text-gray-500">{format(note.date, 'MMM d, yyyy h:mm a')}</span>
                                  </div>
                                  <p className="text-sm text-gray-700">{note.content}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-6 flex justify-end">
                        <button
                          onClick={() => setSelectedApplication(null)}
                          className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm font-medium hover:bg-gray-700"
                        >
                          Close
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