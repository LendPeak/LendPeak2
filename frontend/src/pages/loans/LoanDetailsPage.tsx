import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Tab } from '@headlessui/react';
import { format } from 'date-fns';
import {
  ArrowLeftIcon,
  BanknotesIcon,
  DocumentTextIcon,
  ClockIcon,
  PencilIcon,
  CalculatorIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  IdentificationIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  BriefcaseIcon,
  StarIcon,
  XMarkIcon,
  CogIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { DEMO_LOANS, DEMO_CUSTOMERS } from '../../demo/demoData';
import { LoanEngine, formatCurrency, formatPercentage, toBig } from '@lendpeak/engine';
import { apiClient } from '../../services/api';
import { DemoRecordPayment } from '../../components/loans/DemoRecordPayment';
import { LoanStatusManager } from '../../components/loans/LoanStatusManager';
import { PaymentHistory } from '../../components/payments/PaymentHistory';
import { EnhancedModificationHistory } from '../../components/loans/EnhancedModificationHistory';
import { AuditTrail } from '../../components/loans/AuditTrail';
import { AmortizationScheduleViewer } from '../../components/loans/AmortizationScheduleViewer';
import { LoanModificationBuilder } from '../../components/loans/LoanModificationBuilder';
import { EnhancedLoanModificationBuilder } from '../../components/loans/EnhancedLoanModificationBuilder';
import { BalloonPaymentManager } from '../../components/loans/BalloonPaymentManager';
import { LoanClosureManager } from '../../components/loans/LoanClosureManager';
import { StatementGenerator } from '../../components/loans/StatementGenerator';
import { demoLoanStorage } from '../../services/demoLoanStorage';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

const statusColors = {
  ACTIVE: 'bg-green-100 text-green-800',
  DEFAULTED: 'bg-red-100 text-red-800',
  PAID_OFF: 'bg-blue-100 text-blue-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  FORBEARANCE: 'bg-purple-100 text-purple-800',
  DEFERMENT: 'bg-indigo-100 text-indigo-800',
};

const statusIcons = {
  ACTIVE: CheckCircleIcon,
  DEFAULTED: XCircleIcon,
  PAID_OFF: CheckCircleIcon,
  PENDING: ClockIcon,
  FORBEARANCE: ExclamationTriangleIcon,
  DEFERMENT: ClockIcon,
};

export const LoanDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showModificationModal, setShowModificationModal] = useState(false);
  const [showBalloonModal, setShowBalloonModal] = useState(false);
  const [showClosureModal, setShowClosureModal] = useState(false);
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [modifications, setModifications] = useState<any[]>([]);
  const [auditTrail, setAuditTrail] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentRefreshTrigger, setPaymentRefreshTrigger] = useState(0);
  const [editingModification, setEditingModification] = useState<any>(null);
  const [templateModification, setTemplateModification] = useState<any>(null);
  const [modificationMode, setModificationMode] = useState<'CREATE' | 'EDIT' | 'TEMPLATE'>('CREATE');
  const [showActionMenu, setShowActionMenu] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setShowActionMenu(false);
      }
    }

    if (showActionMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showActionMenu]);

  // Find loan from demo storage
  const loan = demoLoanStorage.getLoan(id!);
  const customer = loan ? DEMO_CUSTOMERS.find(c => c.id === loan.customerId) : null;

  useEffect(() => {
    if (loan) {
      loadLoanDetails();
    }
  }, [loan?.id]);

  const loadLoanDetails = async () => {
    setLoading(true);
    try {
      // Load payment history from demo storage
      const paymentData = demoLoanStorage.getPayments(loan!.id);
      setPayments(paymentData);

      // Load modifications from storage
      const mods = demoLoanStorage.getModifications(loan!.id);
      setModifications(mods.length > 0 ? mods : [
        {
          id: 'mod_1',
          type: 'RATE_CHANGE',
          date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          description: 'Interest rate reduced from 6.5% to 5.5%',
          previousValue: '6.5%',
          newValue: '5.5%',
          reason: 'Customer hardship',
          approvedBy: 'John Doe',
        },
        {
          id: 'mod_2',
          type: 'PAYMENT_DATE_CHANGE',
          date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          description: 'Payment date changed from 1st to 15th',
          previousValue: '1st of month',
          newValue: '15th of month',
          reason: 'Customer request - paycheck timing',
          approvedBy: 'Jane Smith',
        },
      ]);

      // Generate demo audit trail
      setAuditTrail([
        {
          id: 'audit_1',
          timestamp: new Date(),
          action: 'LOAN_VIEWED',
          user: 'Current User',
          details: 'Loan details viewed',
        },
        {
          id: 'audit_2',
          timestamp: new Date(Date.now() - 5 * 60 * 1000),
          action: 'PAYMENT_RECORDED',
          user: 'System',
          details: 'Payment of $1,500 recorded',
        },
        {
          id: 'audit_3',
          timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          action: 'MODIFICATION_APPROVED',
          user: 'Jane Smith',
          details: 'Payment date modification approved',
        },
      ]);
    } catch (error) {
      console.error('Error loading loan details:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshPayments = () => {
    loadLoanDetails();
    setPaymentRefreshTrigger(prev => prev + 1);
  };

  const handleEditModification = (modification: any) => {
    setEditingModification(modification);
    setModificationMode('EDIT');
    setShowModificationModal(true);
  };

  const handleCreateFromTemplate = (modification: any) => {
    setTemplateModification(modification);
    setModificationMode('TEMPLATE');
    setShowModificationModal(true);
  };

  const handleCreateNew = () => {
    setEditingModification(null);
    setTemplateModification(null);
    setModificationMode('CREATE');
    setShowModificationModal(true);
  };

  const handleCloseModificationModal = () => {
    setShowModificationModal(false);
    setEditingModification(null);
    setTemplateModification(null);
    setModificationMode('CREATE');
  };

  if (!loan || !customer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900">Loan not found</h2>
          <p className="mt-2 text-gray-600">The loan you're looking for doesn't exist.</p>
          <Link
            to="/loans"
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            Back to Loans
          </Link>
        </div>
      </div>
    );
  }

  // Calculate current loan metrics using stateless LoanEngine
  const loanTerms = LoanEngine.createLoan(
    loan.loanParameters.principal,
    loan.loanParameters.interestRate,
    loan.loanParameters.termMonths,
    loan.loanParameters.startDate,
    {
      paymentFrequency: 'monthly',
      interestType: 'amortized',
    }
  );
  const paymentResult = LoanEngine.calculatePayment(loanTerms);
  const currentBalance = loan.loanParameters.principal * 0.85; // Demo: 15% paid off
  const nextPaymentDate = new Date();
  nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
  nextPaymentDate.setDate(1);

  const StatusIcon = statusIcons[loan.status] || CheckCircleIcon;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        {/* Breadcrumb Navigation */}
        <div className="mb-6">
          <Link
            to="/loans"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Loans
          </Link>
        </div>

        {/* Loan Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center space-x-4">
            <h1 className="text-3xl font-bold text-gray-900">Loan #{loan.id}</h1>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${statusColors[loan.status]}`}>
              <StatusIcon className="h-4 w-4 mr-1" />
              {loan.status}
            </span>
          </div>

          {/* Action Groups */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Primary Actions */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowPaymentModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
              >
                <BanknotesIcon className="h-4 w-4 mr-2" />
                Record Payment
              </button>
            </div>

            {/* Secondary Actions Dropdown */}
            <div className="relative" ref={actionMenuRef}>
              <button
                type="button"
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                onClick={() => setShowActionMenu(!showActionMenu)}
              >
                <CogIcon className="h-4 w-4 mr-2" />
                Actions
                <ChevronDownIcon className={`ml-2 h-4 w-4 transition-transform ${showActionMenu ? 'rotate-180' : ''}`} />
              </button>

              {showActionMenu && (
                <div className="absolute right-0 z-10 mt-2 w-64 origin-top-right rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  <div className="py-1">
                    {/* Loan Management Group */}
                    <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-100">
                      Loan Management
                    </div>
                    <button
                      onClick={() => {
                        setShowStatusModal(true);
                        setShowActionMenu(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <PencilIcon className="h-4 w-4 mr-3 text-gray-400" />
                      Update Status
                    </button>
                    <button
                      onClick={() => {
                        handleCreateNew();
                        setShowActionMenu(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <ArrowPathIcon className="h-4 w-4 mr-3 text-gray-400" />
                      Modify Loan Terms
                    </button>
                    <button
                      onClick={() => {
                        setShowBalloonModal(true);
                        setShowActionMenu(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <CurrencyDollarIcon className="h-4 w-4 mr-3 text-gray-400" />
                      Balloon Payment Setup
                    </button>

                    {/* Analysis & Reports Group */}
                    <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-100 mt-2">
                      Analysis & Reports
                    </div>
                    <Link
                      to="/calculator"
                      state={{ template: loan.loanParameters }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      onClick={() => setShowActionMenu(false)}
                    >
                      <CalculatorIcon className="h-4 w-4 mr-3 text-gray-400" />
                      Recalculate & Analyze
                    </Link>
                    <button
                      onClick={() => {
                        setShowStatementModal(true);
                        setShowActionMenu(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <DocumentTextIcon className="h-4 w-4 mr-3 text-gray-400" />
                      Generate Statement
                    </button>

                    {/* Critical Actions Group */}
                    <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-100 mt-2">
                      Critical Actions
                    </div>
                    <button
                      onClick={() => {
                        setShowClosureModal(true);
                        setShowActionMenu(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50 transition-colors"
                    >
                      <XMarkIcon className="h-4 w-4 mr-3 text-red-400" />
                      Close Loan
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-6 mb-8 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BanknotesIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Current Balance</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {LoanEngine.formatCurrency(toBig(currentBalance))}
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
                <CalculatorIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Monthly Payment</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {formatCurrency(paymentResult.monthlyPayment)}
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
                <ClockIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Next Payment</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {format(nextPaymentDate, 'MMM d, yyyy')}
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
                <ChartBarIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Progress</dt>
                  <dd className="flex items-center">
                    <span className="text-lg font-semibold text-gray-900">15%</span>
                    <div className="ml-2 flex-1">
                      <div className="bg-gray-200 rounded-full h-2">
                        <div className="bg-primary-600 h-2 rounded-full" style={{ width: '15%' }} />
                      </div>
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabbed Content */}
      <Tab.Group>
        <Tab.List className="flex border-b border-gray-200 mb-6">
          <Tab
            className={({ selected }) =>
              classNames(
                'px-4 py-3 text-sm font-medium focus:outline-none transition-colors duration-200',
                selected
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 border-transparent'
              )
            }
          >
            <div className="flex items-center space-x-2">
              <DocumentTextIcon className="h-4 w-4" />
              <span>Loan Details</span>
            </div>
          </Tab>
          <Tab
            className={({ selected }) =>
              classNames(
                'px-4 py-3 text-sm font-medium focus:outline-none transition-colors duration-200 ml-8',
                selected
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 border-transparent'
              )
            }
          >
            <div className="flex items-center space-x-2">
              <UserIcon className="h-4 w-4" />
              <span>Borrower</span>
            </div>
          </Tab>
          <Tab
            className={({ selected }) =>
              classNames(
                'px-4 py-3 text-sm font-medium focus:outline-none transition-colors duration-200 ml-8',
                selected
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 border-transparent'
              )
            }
          >
            <div className="flex items-center space-x-2">
              <BanknotesIcon className="h-4 w-4" />
              <span>Payment History</span>
              {payments.length > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {payments.length}
                </span>
              )}
            </div>
          </Tab>
          <Tab
            className={({ selected }) =>
              classNames(
                'px-4 py-3 text-sm font-medium focus:outline-none transition-colors duration-200 ml-8',
                selected
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 border-transparent'
              )
            }
          >
            <div className="flex items-center space-x-2">
              <CalculatorIcon className="h-4 w-4" />
              <span>Amortization Schedule</span>
            </div>
          </Tab>
          <Tab
            className={({ selected }) =>
              classNames(
                'px-4 py-3 text-sm font-medium focus:outline-none transition-colors duration-200 ml-8',
                selected
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 border-transparent'
              )
            }
          >
            <div className="flex items-center space-x-2">
              <ArrowPathIcon className="h-4 w-4" />
              <span>Modifications</span>
              {modifications.length > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {modifications.length}
                </span>
              )}
            </div>
          </Tab>
          <Tab
            className={({ selected }) =>
              classNames(
                'px-4 py-3 text-sm font-medium focus:outline-none transition-colors duration-200 ml-8',
                selected
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 border-transparent'
              )
            }
          >
            <div className="flex items-center space-x-2">
              <ClockIcon className="h-4 w-4" />
              <span>Audit Trail</span>
            </div>
          </Tab>
        </Tab.List>
        <Tab.Panels>
          <Tab.Panel className="space-y-6">
            {/* Key Loan Information Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-primary-100 rounded-lg">
                    <BanknotesIcon className="h-6 w-6 text-primary-600" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Principal Amount</h3>
                    <p className="text-2xl font-bold text-gray-900">
                      {LoanEngine.formatCurrency(toBig(loan.loanParameters.principal))}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <ChartBarIcon className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Interest Rate</h3>
                    <p className="text-2xl font-bold text-gray-900">
                      {LoanEngine.formatPercentage(toBig(loan.loanParameters.interestRate))}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <ClockIcon className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Loan Term</h3>
                    <p className="text-2xl font-bold text-gray-900">
                      {loan.loanParameters.termMonths} <span className="text-lg font-normal text-gray-600">months</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Information Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Loan Details */}
              <div className="bg-white border border-gray-200 rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <DocumentTextIcon className="h-5 w-5 text-gray-400 mr-2" />
                    Loan Details
                  </h3>
                </div>
                <div className="p-6">
                  <dl className="space-y-4">
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <dt className="text-sm font-medium text-gray-600">Application Date</dt>
                      <dd className="text-sm font-semibold text-gray-900">
                        {format(loan.applicationDate, 'MMM d, yyyy')}
                      </dd>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <dt className="text-sm font-medium text-gray-600">Loan Purpose</dt>
                      <dd className="text-sm font-semibold text-gray-900">{loan.purpose}</dd>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <dt className="text-sm font-medium text-gray-600">Payment Frequency</dt>
                      <dd className="text-sm font-semibold text-gray-900">{loan.loanParameters.paymentFrequency}</dd>
                    </div>
                    <div className="flex justify-between py-2">
                      <dt className="text-sm font-medium text-gray-600">Loan Status</dt>
                      <dd>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[loan.status]}`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {loan.status}
                        </span>
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              {/* Calculation Configuration */}
              <div className="bg-white border border-gray-200 rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <CalculatorIcon className="h-5 w-5 text-gray-400 mr-2" />
                    Calculation Settings
                  </h3>
                </div>
                <div className="p-6">
                  <dl className="space-y-4">
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <dt className="text-sm font-medium text-gray-600">Interest Type</dt>
                      <dd className="text-sm font-semibold text-gray-900">
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                          {loan.loanParameters.interestType}
                        </span>
                      </dd>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <dt className="text-sm font-medium text-gray-600">Calendar Type</dt>
                      <dd className="text-sm font-semibold text-gray-900">{loan.loanParameters.calendarType}</dd>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <dt className="text-sm font-medium text-gray-600">Accrual Timing</dt>
                      <dd className="text-sm font-semibold text-gray-900">{loan.loanParameters.accrualTiming}</dd>
                    </div>
                    <div className="flex justify-between py-2">
                      <dt className="text-sm font-medium text-gray-600">Per Diem Method</dt>
                      <dd className="text-sm font-semibold text-gray-900">{loan.loanParameters.perDiemMethod || 'STABLE'}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <ChartBarIcon className="h-5 w-5 text-gray-400 mr-2" />
                  Financial Summary
                </h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <dt className="text-sm font-medium text-gray-600 mb-2">Monthly Payment</dt>
                    <dd className="text-xl font-bold text-gray-900">
                      {formatCurrency(paymentResult.monthlyPayment)}
                    </dd>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <dt className="text-sm font-medium text-gray-600 mb-2">Total Interest</dt>
                    <dd className="text-xl font-bold text-orange-600">
                      {formatCurrency(toBig(0))} {/* TODO: Calculate total interest */}
                    </dd>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <dt className="text-sm font-medium text-gray-600 mb-2">Total Amount</dt>
                    <dd className="text-xl font-bold text-gray-900">
                      {formatCurrency(paymentResult.monthlyPayment.times(loan.loanParameters.termMonths))}
                    </dd>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <dt className="text-sm font-medium text-gray-600 mb-2">APR</dt>
                    <dd className="text-xl font-bold text-primary-600">
                      {formatPercentage(toBig(loan.loanParameters.interestRate))}
                    </dd>
                  </div>
                </div>
              </div>
            </div>
          </Tab.Panel>

          <Tab.Panel className="space-y-6">
            {/* Borrower Header Card */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center space-x-6">
                <div className="flex-shrink-0">
                  <div className="h-20 w-20 bg-primary-100 rounded-full flex items-center justify-center">
                    <UserIcon className="h-10 w-10 text-primary-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {customer.firstName} {customer.lastName}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">Borrower Profile</p>
                  <div className="mt-3 flex items-center space-x-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5"></div>
                      Active Borrower
                    </span>
                    <span className="text-sm text-gray-500">
                      Customer since {format(loan.applicationDate, 'MMM yyyy')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Information Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <EnvelopeIcon className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Email</h3>
                    <p className="text-lg font-semibold text-gray-900 truncate">
                      {customer.email}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <PhoneIcon className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Phone</h3>
                    <p className="text-lg font-semibold text-gray-900">
                      {customer.phone}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <IdentificationIcon className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">SSN</h3>
                    <p className="text-lg font-semibold text-gray-900">
                      XXX-XX-{customer.ssn.slice(-4)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Information Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Personal Details */}
              <div className="bg-white border border-gray-200 rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <UserIcon className="h-5 w-5 text-gray-400 mr-2" />
                    Personal Details
                  </h3>
                </div>
                <div className="p-6">
                  <dl className="space-y-4">
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <dt className="text-sm font-medium text-gray-600 flex items-center">
                        <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
                        Date of Birth
                      </dt>
                      <dd className="text-sm font-semibold text-gray-900">
                        {format(new Date(customer.dateOfBirth), 'MMM d, yyyy')}
                      </dd>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <dt className="text-sm font-medium text-gray-600 flex items-center">
                        <MapPinIcon className="h-4 w-4 text-gray-400 mr-2" />
                        Address
                      </dt>
                      <dd className="text-sm font-semibold text-gray-900 text-right">
                        {customer.address?.street}<br />
                        {customer.address?.city}, {customer.address?.state} {customer.address?.zipCode}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              {/* Financial Profile */}
              <div className="bg-white border border-gray-200 rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <ChartBarIcon className="h-5 w-5 text-gray-400 mr-2" />
                    Financial Profile
                  </h3>
                </div>
                <div className="p-6">
                  <dl className="space-y-4">
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <dt className="text-sm font-medium text-gray-600 flex items-center">
                        <CurrencyDollarIcon className="h-4 w-4 text-gray-400 mr-2" />
                        Annual Income
                      </dt>
                      <dd className="text-sm font-semibold text-gray-900">
                        {customer.annualIncome ? LoanEngine.formatCurrency(toBig(customer.annualIncome)) : (
                          <span className="text-gray-400">Not provided</span>
                        )}
                      </dd>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <dt className="text-sm font-medium text-gray-600 flex items-center">
                        <BriefcaseIcon className="h-4 w-4 text-gray-400 mr-2" />
                        Employment Status
                      </dt>
                      <dd className="text-sm font-semibold text-gray-900">
                        {customer.employmentStatus ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                            {customer.employmentStatus}
                          </span>
                        ) : (
                          <span className="text-gray-400">Not provided</span>
                        )}
                      </dd>
                    </div>
                    <div className="flex justify-between py-2">
                      <dt className="text-sm font-medium text-gray-600 flex items-center">
                        <StarIcon className="h-4 w-4 text-gray-400 mr-2" />
                        Credit Score
                      </dt>
                      <dd className="text-sm font-semibold text-gray-900">
                        {customer.creditScore ? (
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            customer.creditScore >= 750 ? 'bg-green-100 text-green-800' :
                            customer.creditScore >= 650 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {customer.creditScore}
                          </span>
                        ) : (
                          <span className="text-gray-400">Not available</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-150">
                    <EnvelopeIcon className="h-4 w-4 mr-2" />
                    Send Email
                  </button>
                  <button className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-150">
                    <PhoneIcon className="h-4 w-4 mr-2" />
                    Call Customer
                  </button>
                  <button className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-150">
                    <DocumentTextIcon className="h-4 w-4 mr-2" />
                    View Documents
                  </button>
                </div>
              </div>
            </div>
          </Tab.Panel>

          <Tab.Panel>
            <PaymentHistory loanId={loan.id} onPaymentUpdate={refreshPayments} refreshTrigger={paymentRefreshTrigger} />
          </Tab.Panel>

          <Tab.Panel>
            <AmortizationScheduleViewer loan={loan} />
          </Tab.Panel>

          <Tab.Panel>
            <EnhancedModificationHistory 
              modifications={modifications} 
              loanId={loan.id} 
              onModificationUpdate={loadLoanDetails}
              onEditModification={handleEditModification}
              onCreateFromTemplate={handleCreateFromTemplate}
            />
          </Tab.Panel>

          <Tab.Panel>
            <AuditTrail entries={auditTrail} />
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>

      {/* Modals */}
      {showPaymentModal && (
        <DemoRecordPayment
          loan={loan}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            setShowPaymentModal(false);
            refreshPayments();
          }}
        />
      )}

      {showStatusModal && (
        <LoanStatusManager
          loan={loan}
          onClose={() => setShowStatusModal(false)}
          onSuccess={() => {
            setShowStatusModal(false);
            // In a real app, would reload loan data
          }}
        />
      )}

      {showModificationModal && (
        <EnhancedLoanModificationBuilder
          loan={loan}
          isOpen={showModificationModal}
          onClose={handleCloseModificationModal}
          onSuccess={() => {
            handleCloseModificationModal();
            loadLoanDetails();
          }}
          editingModification={editingModification}
          templateModification={templateModification}
          mode={modificationMode}
        />
      )}

      {showBalloonModal && (
        <BalloonPaymentManager
          loan={loan}
          isOpen={showBalloonModal}
          onClose={() => setShowBalloonModal(false)}
          onSuccess={() => {
            setShowBalloonModal(false);
            loadLoanDetails();
          }}
        />
      )}

      {showClosureModal && (
        <LoanClosureManager
          loan={loan}
          isOpen={showClosureModal}
          onClose={() => setShowClosureModal(false)}
          onSuccess={() => {
            setShowClosureModal(false);
            // In a real app, would redirect to loan list or update status
            navigate('/loans');
          }}
        />
      )}

      {showStatementModal && (
        <StatementGenerator
          loan={loan}
          isOpen={showStatementModal}
          onClose={() => setShowStatementModal(false)}
          onSuccess={() => {
            setShowStatementModal(false);
            // Statement generated successfully
          }}
        />
      )}
    </div>
  );
};