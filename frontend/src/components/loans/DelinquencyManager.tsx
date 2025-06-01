import { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  XMarkIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  PhoneIcon,
  EnvelopeIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  UserIcon,
  BellIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { format, differenceInDays, addDays } from 'date-fns';

interface DelinquencyManagerProps {
  loan: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface DelinquencyStatus {
  daysPastDue: number;
  bucket: '0-30' | '31-60' | '61-90' | '91-120' | '120+';
  severity: 'CURRENT' | 'EARLY' | 'MODERATE' | 'SEVERE' | 'CRITICAL';
  escalationLevel: number;
  nextAction: string;
  nextActionDate: Date;
}

interface ContactAttempt {
  id: string;
  date: Date;
  type: 'PHONE' | 'EMAIL' | 'LETTER' | 'SMS' | 'VISIT';
  status: 'ATTEMPTED' | 'SUCCESSFUL' | 'NO_RESPONSE' | 'INVALID_CONTACT';
  notes: string;
  outcome?: string;
  nextFollowUp?: Date;
  representative: string;
}

interface PaymentArrangement {
  id: string;
  type: 'PAYMENT_PLAN' | 'DEFERMENT' | 'MODIFICATION' | 'SETTLEMENT';
  proposedDate: Date;
  amount: number;
  terms: string;
  status: 'PROPOSED' | 'ACCEPTED' | 'DECLINED' | 'ACTIVE' | 'BROKEN';
  createdBy: string;
  createdAt: Date;
}

interface EscalationAction {
  level: number;
  action: string;
  daysFromDelinquency: number;
  automated: boolean;
  requiresApproval: boolean;
  description: string;
}

export const DelinquencyManager = ({ loan, isOpen, onClose, onSuccess }: DelinquencyManagerProps) => {
  const [delinquencyStatus, setDelinquencyStatus] = useState<DelinquencyStatus | null>(null);
  const [contactAttempts, setContactAttempts] = useState<ContactAttempt[]>([]);
  const [paymentArrangements, setPaymentArrangements] = useState<PaymentArrangement[]>([]);
  const [escalationActions] = useState<EscalationAction[]>([
    { level: 1, action: 'Automated Email Reminder', daysFromDelinquency: 5, automated: true, requiresApproval: false, description: 'Send automated payment reminder email' },
    { level: 2, action: 'Phone Call Attempt', daysFromDelinquency: 10, automated: false, requiresApproval: false, description: 'First phone contact attempt' },
    { level: 3, action: 'Formal Notice Letter', daysFromDelinquency: 15, automated: true, requiresApproval: false, description: 'Send formal delinquency notice' },
    { level: 4, action: 'Payment Plan Outreach', daysFromDelinquency: 30, automated: false, requiresApproval: false, description: 'Offer payment plan options' },
    { level: 5, action: 'Demand Letter', daysFromDelinquency: 45, automated: true, requiresApproval: true, description: 'Send legal demand letter' },
    { level: 6, action: 'Collections Referral', daysFromDelinquency: 60, automated: false, requiresApproval: true, description: 'Refer to collections agency' },
    { level: 7, action: 'Legal Action Preparation', daysFromDelinquency: 90, automated: false, requiresApproval: true, description: 'Prepare for legal proceedings' },
  ]);
  
  const [newContactAttempt, setNewContactAttempt] = useState({
    type: 'PHONE' as ContactAttempt['type'],
    status: 'ATTEMPTED' as ContactAttempt['status'],
    notes: '',
    outcome: '',
  });
  
  const [newPaymentArrangement, setNewPaymentArrangement] = useState({
    type: 'PAYMENT_PLAN' as PaymentArrangement['type'],
    proposedDate: new Date(),
    amount: 0,
    terms: '',
  });
  
  const [activeTab, setActiveTab] = useState<'STATUS' | 'CONTACTS' | 'ARRANGEMENTS' | 'ESCALATION'>('STATUS');
  const [showContactForm, setShowContactForm] = useState(false);
  const [showArrangementForm, setShowArrangementForm] = useState(false);

  useEffect(() => {
    calculateDelinquencyStatus();
    loadContactHistory();
    loadPaymentArrangements();
  }, [loan]);

  const calculateDelinquencyStatus = () => {
    // Demo calculation - in real app, this would be based on actual payment history
    const lastPaymentDate = new Date(Date.now() - 25 * 24 * 60 * 60 * 1000); // 25 days ago
    const nextDueDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
    const daysPastDue = Math.max(0, differenceInDays(new Date(), nextDueDate));
    
    let bucket: DelinquencyStatus['bucket'];
    let severity: DelinquencyStatus['severity'];
    let escalationLevel: number;
    
    if (daysPastDue === 0) {
      bucket = '0-30';
      severity = 'CURRENT';
      escalationLevel = 0;
    } else if (daysPastDue <= 30) {
      bucket = '0-30';
      severity = 'EARLY';
      escalationLevel = Math.floor(daysPastDue / 5) + 1;
    } else if (daysPastDue <= 60) {
      bucket = '31-60';
      severity = 'MODERATE';
      escalationLevel = 4;
    } else if (daysPastDue <= 90) {
      bucket = '61-90';
      severity = 'SEVERE';
      escalationLevel = 5;
    } else if (daysPastDue <= 120) {
      bucket = '91-120';
      severity = 'CRITICAL';
      escalationLevel = 6;
    } else {
      bucket = '120+';
      severity = 'CRITICAL';
      escalationLevel = 7;
    }
    
    const currentAction = escalationActions.find(action => action.level === escalationLevel);
    const nextAction = currentAction?.action || 'Review Account';
    const nextActionDate = addDays(new Date(), 1);
    
    setDelinquencyStatus({
      daysPastDue,
      bucket,
      severity,
      escalationLevel,
      nextAction,
      nextActionDate,
    });
  };

  const loadContactHistory = () => {
    // Demo contact history
    setContactAttempts([
      {
        id: '1',
        date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        type: 'EMAIL',
        status: 'SUCCESSFUL',
        notes: 'Sent payment reminder email to primary email address',
        outcome: 'Email delivered, no response yet',
        representative: 'System Automated',
      },
      {
        id: '2',
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        type: 'PHONE',
        status: 'NO_RESPONSE',
        notes: 'Called primary phone number, left voicemail message',
        outcome: 'No answer, voicemail left',
        nextFollowUp: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        representative: 'Jane Smith',
      },
      {
        id: '3',
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        type: 'SMS',
        status: 'ATTEMPTED',
        notes: 'Sent SMS payment reminder to mobile number',
        outcome: 'Message sent, delivery confirmed',
        representative: 'System Automated',
      },
    ]);
  };

  const loadPaymentArrangements = () => {
    // Demo payment arrangements
    setPaymentArrangements([
      {
        id: '1',
        type: 'PAYMENT_PLAN',
        proposedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        amount: 500,
        terms: 'Partial payment of $500 by next week, remaining balance split over 3 months',
        status: 'PROPOSED',
        createdBy: 'Jane Smith',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    ]);
  };

  const addContactAttempt = async () => {
    const attempt: ContactAttempt = {
      id: Date.now().toString(),
      date: new Date(),
      type: newContactAttempt.type,
      status: newContactAttempt.status,
      notes: newContactAttempt.notes,
      outcome: newContactAttempt.outcome,
      representative: 'Current User',
    };
    
    setContactAttempts([attempt, ...contactAttempts]);
    setNewContactAttempt({
      type: 'PHONE',
      status: 'ATTEMPTED',
      notes: '',
      outcome: '',
    });
    setShowContactForm(false);
    toast.success('Contact attempt recorded');
  };

  const addPaymentArrangement = async () => {
    const arrangement: PaymentArrangement = {
      id: Date.now().toString(),
      type: newPaymentArrangement.type,
      proposedDate: newPaymentArrangement.proposedDate,
      amount: newPaymentArrangement.amount,
      terms: newPaymentArrangement.terms,
      status: 'PROPOSED',
      createdBy: 'Current User',
      createdAt: new Date(),
    };
    
    setPaymentArrangements([arrangement, ...paymentArrangements]);
    setNewPaymentArrangement({
      type: 'PAYMENT_PLAN',
      proposedDate: new Date(),
      amount: 0,
      terms: '',
    });
    setShowArrangementForm(false);
    toast.success('Payment arrangement created');
  };

  const executeEscalationAction = async (action: EscalationAction) => {
    // Simulate executing escalation action
    console.log('Executing escalation action:', action);
    toast.success(`${action.action} executed successfully`);
    
    // Add contact attempt record for the action
    const attempt: ContactAttempt = {
      id: Date.now().toString(),
      date: new Date(),
      type: action.automated ? 'EMAIL' : 'PHONE',
      status: 'SUCCESSFUL',
      notes: `Automated escalation: ${action.description}`,
      outcome: 'Action completed',
      representative: action.automated ? 'System Automated' : 'Collections Team',
    };
    
    setContactAttempts([attempt, ...contactAttempts]);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const getSeverityColor = (severity: DelinquencyStatus['severity']) => {
    switch (severity) {
      case 'CURRENT': return 'text-green-600 bg-green-100';
      case 'EARLY': return 'text-yellow-600 bg-yellow-100';
      case 'MODERATE': return 'text-orange-600 bg-orange-100';
      case 'SEVERE': return 'text-red-600 bg-red-100';
      case 'CRITICAL': return 'text-red-800 bg-red-200';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getContactStatusIcon = (status: ContactAttempt['status']) => {
    switch (status) {
      case 'SUCCESSFUL': return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
      case 'NO_RESPONSE': return <ClockIcon className="h-4 w-4 text-yellow-500" />;
      case 'ATTEMPTED': return <ArrowRightIcon className="h-4 w-4 text-blue-500" />;
      case 'INVALID_CONTACT': return <XMarkIcon className="h-4 w-4 text-red-500" />;
      default: return <ClockIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  if (!delinquencyStatus) {
    return null;
  }

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
              <Dialog.Panel className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-2xl transition-all sm:my-8 w-full max-w-6xl">
                <div className="bg-white">
                  <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-yellow-50 to-red-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-yellow-100 border border-yellow-200">
                          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />
                        </div>
                        <div>
                          <Dialog.Title as="h3" className="text-xl font-bold leading-6 text-gray-900">
                            Delinquency Management
                          </Dialog.Title>
                          <p className="mt-1 text-sm text-gray-600 flex items-center space-x-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              {loan.id}
                            </span>
                            <span>•</span>
                            <span>{delinquencyStatus.daysPastDue} days past due</span>
                            <span>•</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(delinquencyStatus.severity)}`}>
                              {delinquencyStatus.severity}
                            </span>
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
                          { key: 'STATUS', label: 'Status Overview', icon: ExclamationTriangleIcon },
                          { key: 'CONTACTS', label: 'Contact History', icon: PhoneIcon },
                          { key: 'ARRANGEMENTS', label: 'Payment Arrangements', icon: CurrencyDollarIcon },
                          { key: 'ESCALATION', label: 'Escalation Actions', icon: BellIcon },
                        ].map((tab) => {
                          const IconComponent = tab.icon;
                          return (
                            <button
                              key={tab.key}
                              onClick={() => setActiveTab(tab.key as any)}
                              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                                activeTab === tab.key
                                  ? 'border-yellow-500 text-yellow-600'
                                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                              }`}
                            >
                              <IconComponent className="h-4 w-4" />
                              <span>{tab.label}</span>
                            </button>
                          );
                        })}
                      </nav>
                    </div>

                    {/* Status Tab */}
                    {activeTab === 'STATUS' && (
                      <div className="space-y-6">
                        {/* Current Status */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                            <div className="flex items-center">
                              <ClockIcon className="h-8 w-8 text-yellow-600" />
                              <div className="ml-4">
                                <h3 className="text-lg font-semibold text-yellow-900">
                                  {delinquencyStatus.daysPastDue} Days Past Due
                                </h3>
                                <p className="text-sm text-yellow-700">Bucket: {delinquencyStatus.bucket}</p>
                              </div>
                            </div>
                          </div>

                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                            <div className="flex items-center">
                              <BellIcon className="h-8 w-8 text-blue-600" />
                              <div className="ml-4">
                                <h3 className="text-lg font-semibold text-blue-900">
                                  Level {delinquencyStatus.escalationLevel}
                                </h3>
                                <p className="text-sm text-blue-700">Escalation Level</p>
                              </div>
                            </div>
                          </div>

                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                            <div className="flex items-center">
                              <CalendarIcon className="h-8 w-8 text-gray-600" />
                              <div className="ml-4">
                                <h3 className="text-lg font-semibold text-gray-900">Next Action</h3>
                                <p className="text-sm text-gray-700">{delinquencyStatus.nextAction}</p>
                                <p className="text-xs text-gray-500">{format(delinquencyStatus.nextActionDate, 'MMM d, yyyy')}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Account Summary */}
                        <div className="bg-white border border-gray-200 rounded-lg p-6">
                          <h4 className="text-lg font-semibold text-gray-900 mb-4">Account Summary</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="text-center p-4 bg-gray-50 rounded-lg">
                              <div className="text-2xl font-bold text-gray-900">{formatCurrency(1250)}</div>
                              <div className="text-sm text-gray-600">Past Due Amount</div>
                            </div>
                            <div className="text-center p-4 bg-gray-50 rounded-lg">
                              <div className="text-2xl font-bold text-gray-900">{formatCurrency(185000)}</div>
                              <div className="text-sm text-gray-600">Current Balance</div>
                            </div>
                            <div className="text-center p-4 bg-gray-50 rounded-lg">
                              <div className="text-2xl font-bold text-gray-900">{contactAttempts.length}</div>
                              <div className="text-sm text-gray-600">Contact Attempts</div>
                            </div>
                            <div className="text-center p-4 bg-gray-50 rounded-lg">
                              <div className="text-2xl font-bold text-gray-900">{paymentArrangements.length}</div>
                              <div className="text-sm text-gray-600">Payment Plans</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Contacts Tab */}
                    {activeTab === 'CONTACTS' && (
                      <div className="space-y-6">
                        <div className="flex justify-between items-center">
                          <h4 className="text-lg font-semibold text-gray-900">Contact History</h4>
                          <button
                            onClick={() => setShowContactForm(true)}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                          >
                            <PhoneIcon className="h-4 w-4 mr-2" />
                            Add Contact Attempt
                          </button>
                        </div>

                        <div className="space-y-4">
                          {contactAttempts.map((attempt) => (
                            <div key={attempt.id} className="bg-white border border-gray-200 rounded-lg p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex items-start space-x-3">
                                  {getContactStatusIcon(attempt.status)}
                                  <div>
                                    <div className="flex items-center space-x-2">
                                      <span className="font-medium text-gray-900">{attempt.type}</span>
                                      <span className="text-sm text-gray-500">•</span>
                                      <span className="text-sm text-gray-500">{format(attempt.date, 'MMM d, yyyy h:mm a')}</span>
                                      <span className="text-sm text-gray-500">•</span>
                                      <span className="text-sm text-gray-500">{attempt.representative}</span>
                                    </div>
                                    <p className="text-sm text-gray-700 mt-1">{attempt.notes}</p>
                                    {attempt.outcome && (
                                      <p className="text-sm text-gray-600 mt-1 italic">Outcome: {attempt.outcome}</p>
                                    )}
                                    {attempt.nextFollowUp && (
                                      <p className="text-sm text-blue-600 mt-1">Next follow-up: {format(attempt.nextFollowUp, 'MMM d, yyyy')}</p>
                                    )}
                                  </div>
                                </div>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  attempt.status === 'SUCCESSFUL' ? 'bg-green-100 text-green-800' :
                                  attempt.status === 'NO_RESPONSE' ? 'bg-yellow-100 text-yellow-800' :
                                  attempt.status === 'ATTEMPTED' ? 'bg-blue-100 text-blue-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {attempt.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Contact Form Modal */}
                        {showContactForm && (
                          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-[80]">
                            <div className="bg-white rounded-lg p-6 max-w-md w-full">
                              <h3 className="text-lg font-medium text-gray-900 mb-4">Add Contact Attempt</h3>
                              <div className="space-y-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Contact Type</label>
                                  <select
                                    value={newContactAttempt.type}
                                    onChange={(e) => setNewContactAttempt({ ...newContactAttempt, type: e.target.value as any })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                  >
                                    <option value="PHONE">Phone Call</option>
                                    <option value="EMAIL">Email</option>
                                    <option value="LETTER">Letter</option>
                                    <option value="SMS">SMS</option>
                                    <option value="VISIT">In-Person Visit</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Status</label>
                                  <select
                                    value={newContactAttempt.status}
                                    onChange={(e) => setNewContactAttempt({ ...newContactAttempt, status: e.target.value as any })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                  >
                                    <option value="ATTEMPTED">Attempted</option>
                                    <option value="SUCCESSFUL">Successful</option>
                                    <option value="NO_RESPONSE">No Response</option>
                                    <option value="INVALID_CONTACT">Invalid Contact</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Notes</label>
                                  <textarea
                                    value={newContactAttempt.notes}
                                    onChange={(e) => setNewContactAttempt({ ...newContactAttempt, notes: e.target.value })}
                                    rows={3}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Outcome</label>
                                  <input
                                    type="text"
                                    value={newContactAttempt.outcome}
                                    onChange={(e) => setNewContactAttempt({ ...newContactAttempt, outcome: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                  />
                                </div>
                              </div>
                              <div className="mt-6 flex justify-end space-x-3">
                                <button
                                  onClick={() => setShowContactForm(false)}
                                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={addContactAttempt}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                                >
                                  Add Contact
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Arrangements Tab */}
                    {activeTab === 'ARRANGEMENTS' && (
                      <div className="space-y-6">
                        <div className="flex justify-between items-center">
                          <h4 className="text-lg font-semibold text-gray-900">Payment Arrangements</h4>
                          <button
                            onClick={() => setShowArrangementForm(true)}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
                          >
                            <CurrencyDollarIcon className="h-4 w-4 mr-2" />
                            Create Arrangement
                          </button>
                        </div>

                        <div className="space-y-4">
                          {paymentArrangements.map((arrangement) => (
                            <div key={arrangement.id} className="bg-white border border-gray-200 rounded-lg p-4">
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center space-x-2">
                                    <span className="font-medium text-gray-900">{arrangement.type}</span>
                                    <span className="text-sm text-gray-500">•</span>
                                    <span className="text-sm text-gray-500">{formatCurrency(arrangement.amount)}</span>
                                    <span className="text-sm text-gray-500">•</span>
                                    <span className="text-sm text-gray-500">by {format(arrangement.proposedDate, 'MMM d, yyyy')}</span>
                                  </div>
                                  <p className="text-sm text-gray-700 mt-1">{arrangement.terms}</p>
                                  <p className="text-xs text-gray-500 mt-2">
                                    Created by {arrangement.createdBy} on {format(arrangement.createdAt, 'MMM d, yyyy')}
                                  </p>
                                </div>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  arrangement.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                                  arrangement.status === 'ACCEPTED' ? 'bg-blue-100 text-blue-800' :
                                  arrangement.status === 'PROPOSED' ? 'bg-yellow-100 text-yellow-800' :
                                  arrangement.status === 'DECLINED' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {arrangement.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Arrangement Form Modal */}
                        {showArrangementForm && (
                          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-[80]">
                            <div className="bg-white rounded-lg p-6 max-w-md w-full">
                              <h3 className="text-lg font-medium text-gray-900 mb-4">Create Payment Arrangement</h3>
                              <div className="space-y-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Arrangement Type</label>
                                  <select
                                    value={newPaymentArrangement.type}
                                    onChange={(e) => setNewPaymentArrangement({ ...newPaymentArrangement, type: e.target.value as any })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                                  >
                                    <option value="PAYMENT_PLAN">Payment Plan</option>
                                    <option value="DEFERMENT">Deferment</option>
                                    <option value="MODIFICATION">Loan Modification</option>
                                    <option value="SETTLEMENT">Settlement</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Amount</label>
                                  <div className="mt-1 relative rounded-md shadow-sm">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                      <span className="text-gray-500 sm:text-sm">$</span>
                                    </div>
                                    <input
                                      type="number"
                                      value={newPaymentArrangement.amount}
                                      onChange={(e) => setNewPaymentArrangement({ ...newPaymentArrangement, amount: parseFloat(e.target.value) || 0 })}
                                      className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Terms</label>
                                  <textarea
                                    value={newPaymentArrangement.terms}
                                    onChange={(e) => setNewPaymentArrangement({ ...newPaymentArrangement, terms: e.target.value })}
                                    rows={3}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                                    placeholder="Describe the payment arrangement terms..."
                                  />
                                </div>
                              </div>
                              <div className="mt-6 flex justify-end space-x-3">
                                <button
                                  onClick={() => setShowArrangementForm(false)}
                                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={addPaymentArrangement}
                                  className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700"
                                >
                                  Create Arrangement
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Escalation Tab */}
                    {activeTab === 'ESCALATION' && (
                      <div className="space-y-6">
                        <h4 className="text-lg font-semibold text-gray-900">Escalation Actions</h4>
                        
                        <div className="space-y-4">
                          {escalationActions.map((action, index) => {
                            const isActive = action.level === delinquencyStatus.escalationLevel;
                            const isCompleted = action.level < delinquencyStatus.escalationLevel;
                            const isFuture = action.level > delinquencyStatus.escalationLevel;
                            
                            return (
                              <div key={index} className={`border rounded-lg p-4 ${
                                isActive ? 'border-yellow-300 bg-yellow-50' :
                                isCompleted ? 'border-green-300 bg-green-50' :
                                'border-gray-200 bg-white'
                              }`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                      isActive ? 'bg-yellow-200 text-yellow-800' :
                                      isCompleted ? 'bg-green-200 text-green-800' :
                                      'bg-gray-200 text-gray-600'
                                    }`}>
                                      {action.level}
                                    </div>
                                    <div>
                                      <h5 className="font-medium text-gray-900">{action.action}</h5>
                                      <p className="text-sm text-gray-600">{action.description}</p>
                                      <p className="text-xs text-gray-500">
                                        Day {action.daysFromDelinquency} • {action.automated ? 'Automated' : 'Manual'} • 
                                        {action.requiresApproval ? ' Requires Approval' : ' No Approval Required'}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    {isCompleted && <CheckCircleIcon className="h-5 w-5 text-green-500" />}
                                    {isActive && (
                                      <button
                                        onClick={() => executeEscalationAction(action)}
                                        className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700"
                                      >
                                        Execute
                                      </button>
                                    )}
                                    {isFuture && action.requiresApproval && (
                                      <ShieldCheckIcon className="h-5 w-5 text-gray-400" />
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
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
                        onClose();
                      }}
                      className="inline-flex justify-center rounded-md bg-yellow-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-yellow-500"
                    >
                      <CheckCircleIcon className="h-5 w-5 mr-2" />
                      Update Status
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