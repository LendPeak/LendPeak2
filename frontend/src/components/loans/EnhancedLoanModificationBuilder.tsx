import { useState, useEffect } from 'react';
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  XMarkIcon,
  PlusIcon,
  TrashIcon,
  CalculatorIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  ChartBarIcon,
  CalendarIcon,
  ClockIcon,
  BanknotesIcon,
  CurrencyDollarIcon,
  PencilSquareIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { LoanEngine } from '@lendpeak/engine';
import type {
  ModificationType,
  LoanModification,
  ModificationCalculationResult,
  ModificationCalculationParams,
  ModificationValidationResult,
  ModificationValidationError,
  LoanTerms,
} from '@lendpeak/engine';
import { demoLoanStorage } from '../../services/demoLoanStorage';
import { format } from 'date-fns';
import DatePicker from 'react-datepicker';

interface ModificationItem {
  id: string;
  type: ModificationType;
  description: string;
  parameters: Record<string, any>;
  impact?: ModificationCalculationResult;
  isBeingEdited?: boolean;
  originalId?: string; // For tracking edits
  validation?: ModificationValidationResult;
  hasErrors?: boolean;
}

interface ModificationTemplate {
  id: string;
  type: ModificationType;
  description: string;
  parameters: Record<string, any>;
  reason: string;
  source: 'EXISTING' | 'TEMPLATE';
}

interface EnhancedLoanModificationBuilderProps {
  loan: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingModification?: any; // Existing modification to edit
  templateModification?: any; // Existing modification to use as template
  mode?: 'CREATE' | 'EDIT' | 'TEMPLATE';
}

const MODIFICATION_TYPES: Record<ModificationType, { label: string; description: string; icon: any; category: string; color: string }> = {
  'RATE_CHANGE': {
    label: 'Interest Rate Change',
    description: 'Modify the loan interest rate',
    icon: ChartBarIcon,
    category: 'Rate & Terms',
    color: 'bg-blue-50 text-blue-600 border-blue-200'
  },
  'TERM_EXTENSION': {
    label: 'Term Extension',
    description: 'Extend the loan term to reduce payments',
    icon: CalendarIcon,
    category: 'Rate & Terms',
    color: 'bg-blue-50 text-blue-600 border-blue-200'
  },
  'PAYMENT_REDUCTION_TEMPORARY': {
    label: 'Temporary Payment Reduction',
    description: 'Reduce payments for a specified period',
    icon: ClockIcon,
    category: 'Payment Relief',
    color: 'bg-green-50 text-green-600 border-green-200'
  },
  'PAYMENT_REDUCTION_PERMANENT': {
    label: 'Permanent Payment Reduction',
    description: 'Permanently reduce monthly payment amount',
    icon: BanknotesIcon,
    category: 'Payment Relief',
    color: 'bg-green-50 text-green-600 border-green-200'
  },
  'PRINCIPAL_REDUCTION': {
    label: 'Principal Reduction',
    description: 'Reduce the outstanding principal balance',
    icon: CurrencyDollarIcon,
    category: 'Principal Changes',
    color: 'bg-emerald-50 text-emerald-600 border-emerald-200'
  },
  'BALLOON_PAYMENT_ASSIGNMENT': {
    label: 'Balloon Payment Assignment',
    description: 'Add balloon payment with EMI reamortization',
    icon: ArrowPathIcon,
    category: 'Balloon Options',
    color: 'bg-purple-50 text-purple-600 border-purple-200'
  },
  'BALLOON_PAYMENT_REMOVAL': {
    label: 'Balloon Payment Removal',
    description: 'Remove existing balloon payment',
    icon: XMarkIcon,
    category: 'Balloon Options',
    color: 'bg-purple-50 text-purple-600 border-purple-200'
  },
  'FORBEARANCE': {
    label: 'Forbearance',
    description: 'Temporary payment pause or reduction',
    icon: ExclamationTriangleIcon,
    category: 'Hardship Options',
    color: 'bg-orange-50 text-orange-600 border-orange-200'
  },
  'DEFERMENT': {
    label: 'Deferment',
    description: 'Formal postponement of payments',
    icon: CheckCircleIcon,
    category: 'Hardship Options',
    color: 'bg-orange-50 text-orange-600 border-orange-200'
  },
  'REAMORTIZATION': {
    label: 'Loan Reamortization',
    description: 'Complete recalculation of payment schedule',
    icon: CalculatorIcon,
    category: 'Restructuring',
    color: 'bg-indigo-50 text-indigo-600 border-indigo-200'
  }
};

export const EnhancedLoanModificationBuilder = ({ 
  loan, 
  isOpen, 
  onClose, 
  onSuccess, 
  editingModification,
  templateModification,
  mode = 'CREATE'
}: EnhancedLoanModificationBuilderProps) => {
  const [modifications, setModifications] = useState<ModificationItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedType, setSelectedType] = useState<ModificationType | null>(null);
  const [reason, setReason] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date());
  const [isCalculating, setIsCalculating] = useState(false);
  const [projectedLoan, setProjectedLoan] = useState<any>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Initialize with existing modification data when editing or using template
  useEffect(() => {
    if (mode === 'EDIT' && editingModification) {
      initializeFromExisting(editingModification, true);
    } else if (mode === 'TEMPLATE' && templateModification) {
      initializeFromExisting(templateModification, false);
    }
  }, [mode, editingModification, templateModification]);

  const initializeFromExisting = (modification: any, isEdit: boolean) => {
    if (modification.type === 'RESTRUCTURE' && modification.changes?.modifications) {
      // Handle restructure package
      const modItems = modification.changes.modifications.map((mod: any, index: number) => ({
        id: isEdit ? `edit_${modification.id}_${index}` : `template_${Date.now()}_${index}`,
        type: mod.type,
        description: MODIFICATION_TYPES[mod.type as keyof typeof MODIFICATION_TYPES]?.label || mod.type,
        parameters: mod.parameters,
        originalId: isEdit ? modification.id : undefined,
        isBeingEdited: isEdit,
      }));
      setModifications(modItems);
      setReason(isEdit ? `Editing: ${modification.reason}` : modification.reason);
      setEffectiveDate(modification.changes.effectiveDate ? new Date(modification.changes.effectiveDate) : new Date());
    } else {
      // Handle single modification
      const modItem: ModificationItem = {
        id: isEdit ? `edit_${modification.id}` : `template_${Date.now()}`,
        type: modification.type,
        description: modification.description || MODIFICATION_TYPES[modification.type as keyof typeof MODIFICATION_TYPES]?.label || modification.type,
        parameters: extractParametersFromModification(modification),
        originalId: isEdit ? modification.id : undefined,
        isBeingEdited: isEdit,
      };
      setModifications([modItem]);
      setReason(isEdit ? `Editing: ${modification.reason}` : modification.reason);
      setEffectiveDate(modification.effectiveDate ? new Date(modification.effectiveDate) : new Date());
    }
  };

  const extractParametersFromModification = (modification: any): Record<string, any> => {
    // Extract parameters based on modification type and stored changes
    const params: Record<string, any> = {};
    
    switch (modification.type) {
      case 'RATE_CHANGE':
        if (modification.newValue) {
          params.newRate = parseFloat(modification.newValue.replace('%', ''));
        }
        break;
      case 'TERM_EXTENSION':
        if (modification.changes?.additionalMonths) {
          params.additionalMonths = modification.changes.additionalMonths;
        }
        break;
      case 'PRINCIPAL_REDUCTION':
        if (modification.changes?.reductionAmount) {
          params.reductionAmount = modification.changes.reductionAmount;
        }
        break;
      // Add more cases as needed
    }
    
    return params;
  };

  // Calculate the cumulative effect of all modifications
  useEffect(() => {
    if (modifications.length > 0) {
      calculateProjectedLoan();
    } else {
      setProjectedLoan(null);
    }
  }, [modifications]);

  const calculateProjectedLoan = async () => {
    setIsCalculating(true);
    try {
      // Start with current loan parameters
      const projectedParams = { ...loan.loanParameters };
      
      // Apply each modification in sequence
      modifications.forEach(mod => {
        switch (mod.type) {
          case 'RATE_CHANGE':
            projectedParams.interestRate = mod.parameters.newRate;
            break;
          case 'TERM_EXTENSION':
            projectedParams.termMonths += mod.parameters.additionalMonths;
            break;
          case 'PRINCIPAL_REDUCTION':
            projectedParams.principal -= mod.parameters.reductionAmount;
            break;
          case 'PAYMENT_REDUCTION_PERMANENT':
            if (mod.parameters.termAdjustment === 'EXTEND_TERM' && mod.parameters.newTermMonths) {
              projectedParams.termMonths = mod.parameters.newTermMonths;
            }
            if (mod.parameters.principalReduction) {
              projectedParams.principal -= mod.parameters.principalReduction;
            }
            break;
        }
      });

      // Calculate new metrics using stateless LoanEngine
      const currentLoanTerms = LoanEngine.createLoan(
        loan.loanParameters.principal,
        loan.loanParameters.interestRate,
        loan.loanParameters.termMonths,
        loan.loanParameters.startDate,
        { paymentFrequency: 'monthly', interestType: 'amortized' }
      );
      const projectedLoanTerms = LoanEngine.createLoan(
        projectedParams.principal,
        projectedParams.interestRate,
        projectedParams.termMonths,
        projectedParams.startDate,
        { paymentFrequency: 'monthly', interestType: 'amortized' }
      );
      
      const currentPayment = LoanEngine.calculatePayment(currentLoanTerms);
      const projectedPayment = LoanEngine.calculatePayment(projectedLoanTerms);

      const currentCalc = {
        monthlyPayment: currentPayment.monthlyPayment.toNumber(),
        totalInterest: currentPayment.totalInterest.toNumber(),
        totalPayment: currentPayment.totalPayments.toNumber(),
      };
      
      const projectedCalc = {
        monthlyPayment: projectedPayment.monthlyPayment.toNumber(),
        totalInterest: projectedPayment.totalInterest.toNumber(),
        totalPayment: projectedPayment.totalPayments.toNumber(),
      };

      setProjectedLoan({
        parameters: projectedParams,
        calculation: projectedCalc,
        changes: {
          monthlyPayment: projectedCalc.monthlyPayment - currentCalc.monthlyPayment,
          totalInterest: projectedCalc.totalInterest - currentCalc.totalInterest,
          totalPayment: projectedCalc.totalPayment - currentCalc.totalPayment,
        },
      });
    } catch (error) {
      console.error('Error calculating projected loan:', error);
      toast.error('Failed to calculate modification impact');
    } finally {
      setIsCalculating(false);
    }
  };

  const validateModification = async (type: ModificationType, parameters: Record<string, any>): Promise<ModificationValidationResult> => {
    try {
      // Create a simple validation based on basic checks
      const errors: ModificationValidationError[] = [];
      
      switch (type) {
        case 'RATE_CHANGE':
          if (!parameters.newRate || parameters.newRate <= 0) {
            errors.push({
              field: 'newRate',
              code: 'INVALID_RATE',
              message: 'Interest rate must be greater than zero',
              severity: 'ERROR'
            });
          }
          if (parameters.newRate > 50) {
            errors.push({
              field: 'newRate',
              code: 'RATE_TOO_HIGH',
              message: 'Interest rate seems unusually high',
              severity: 'WARNING'
            });
          }
          break;
          
        case 'PAYMENT_REDUCTION_PERMANENT':
          if (!parameters.newPaymentAmount || parameters.newPaymentAmount <= 0) {
            errors.push({
              field: 'newPaymentAmount',
              code: 'INVALID_PAYMENT',
              message: 'Payment amount must be greater than zero',
              severity: 'ERROR'
            });
          }
          break;
          
        case 'PAYMENT_REDUCTION_TEMPORARY':
          if (!parameters.reductionAmount || parameters.reductionAmount <= 0) {
            errors.push({
              field: 'reductionAmount',
              code: 'INVALID_REDUCTION',
              message: 'Reduction amount must be greater than zero',
              severity: 'ERROR'
            });
          }
          if (!parameters.reductionPeriodMonths || parameters.reductionPeriodMonths <= 0) {
            errors.push({
              field: 'reductionPeriodMonths',
              code: 'INVALID_PERIOD',
              message: 'Reduction period must be greater than zero',
              severity: 'ERROR'
            });
          }
          if (!parameters.newPaymentAmount || parameters.newPaymentAmount <= 0) {
            errors.push({
              field: 'newPaymentAmount',
              code: 'INVALID_PAYMENT',
              message: 'New payment amount must be greater than zero',
              severity: 'ERROR'
            });
          }
          break;
          
        case 'PRINCIPAL_REDUCTION':
          if (!parameters.reductionAmount || parameters.reductionAmount <= 0) {
            errors.push({
              field: 'reductionAmount',
              code: 'INVALID_REDUCTION',
              message: 'Reduction amount must be greater than zero',
              severity: 'ERROR'
            });
          }
          const currentBalance = loan.loanParameters.principal * 0.85; // Demo current balance
          if (parameters.reductionAmount >= currentBalance) {
            errors.push({
              field: 'reductionAmount',
              code: 'REDUCTION_TOO_LARGE',
              message: 'Reduction amount cannot be greater than or equal to current balance',
              severity: 'ERROR'
            });
          }
          break;
      }
      
      return {
        isValid: errors.filter(e => e.severity === 'ERROR').length === 0,
        errors,
        warnings: errors.filter(e => e.severity === 'WARNING')
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [{
          field: 'general',
          code: 'VALIDATION_ERROR',
          message: 'Unable to validate modification',
          severity: 'ERROR'
        }],
        warnings: []
      };
    }
  };

  const addModification = async (type: string, parameters: Record<string, any>) => {
    try {
      // Validate the modification first
      const validation = await validateModification(type as ModificationType, parameters);
      
      const modification: ModificationItem = {
        id: `mod_${Date.now()}`,
        type: type as any,
        description: MODIFICATION_TYPES[type as keyof typeof MODIFICATION_TYPES].label,
        parameters,
        validation,
        hasErrors: !validation.isValid,
      };

      setModifications(prev => [...prev, modification]);
      setShowAddModal(false);
      setSelectedType(null);
      
      // Show success message
      toast.success(`${MODIFICATION_TYPES[type as keyof typeof MODIFICATION_TYPES].label} added successfully`);
    } catch (error) {
      console.error('Error adding modification:', error);
      toast.error('Failed to add modification');
    }
  };

  const editModification = (id: string) => {
    setEditingItemId(id);
    const mod = modifications.find(m => m.id === id);
    if (mod) {
      setSelectedType(mod.type);
      setShowAddModal(true);
    }
  };

  const updateModification = (type: string, parameters: Record<string, any>) => {
    if (editingItemId) {
      setModifications(modifications.map(mod => 
        mod.id === editingItemId 
          ? { ...mod, type: type as any, parameters, description: MODIFICATION_TYPES[type as keyof typeof MODIFICATION_TYPES].label }
          : mod
      ));
      setEditingItemId(null);
      setShowAddModal(false);
      setSelectedType(null);
    }
  };

  const removeModification = (id: string) => {
    setModifications(modifications.filter(m => m.id !== id));
  };

  const commitModifications = async () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for the modifications');
      return;
    }

    try {
      if (mode === 'EDIT' && editingModification) {
        // Handle editing: first reverse the original, then create new
        await reverseOriginalModification(editingModification);
      }

      // Create a single modification record with all changes
      const modificationRecord = {
        loanId: loan.id,
        type: modifications.length === 1 ? modifications[0].type : 'RESTRUCTURE',
        date: new Date(),
        changes: modifications.length === 1 ? {
          ...modifications[0].parameters,
          effectiveDate: effectiveDate,
        } : {
          modifications: modifications.map(m => ({
            type: m.type,
            parameters: m.parameters,
          })),
          projectedParameters: projectedLoan?.parameters,
          effectiveDate: effectiveDate,
        },
        reason: mode === 'EDIT' ? reason.replace('Editing: ', '') : reason,
        approvedBy: 'Demo User',
        description: modifications.length === 1 ? modifications[0].description : 'Loan Restructuring Package',
        previousValue: extractPreviousValue(),
        newValue: extractNewValue(),
        impactSummary: projectedLoan ? {
          paymentChange: projectedLoan.changes.monthlyPayment,
          termChange: (projectedLoan.parameters.termMonths || 0) - loan.loanParameters.termMonths,
          interestChange: projectedLoan.changes.totalInterest,
          principalChange: (projectedLoan.parameters.principal || loan.loanParameters.principal) - loan.loanParameters.principal,
        } : undefined,
      };

      // Apply the modification
      await demoLoanStorage.addModification(modificationRecord);

      toast.success(`Loan ${mode === 'EDIT' ? 'modification updated' : 'restructuring completed'} successfully`);
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Failed to apply modifications');
    }
  };

  const reverseOriginalModification = async (original: any) => {
    const reversalRecord = {
      loanId: loan.id,
      type: 'REVERSAL',
      date: new Date(),
      changes: {
        originalModificationId: original.id,
        originalModificationType: original.type,
        originalChanges: original.changes,
        reversalReason: 'Automatically reversed due to modification edit',
      },
      reason: `Auto-reversal for editing: ${original.reason}`,
      approvedBy: 'Demo User',
    };

    await demoLoanStorage.addModification(reversalRecord);
  };

  const extractPreviousValue = () => {
    if (modifications.length === 1) {
      const mod = modifications[0];
      switch (mod.type) {
        case 'RATE_CHANGE':
          return `${loan.loanParameters.interestRate}%`;
        case 'TERM_EXTENSION':
          return `${loan.loanParameters.termMonths} months`;
        default:
          return undefined;
      }
    }
    return undefined;
  };

  const extractNewValue = () => {
    if (modifications.length === 1) {
      const mod = modifications[0];
      switch (mod.type) {
        case 'RATE_CHANGE':
          return `${mod.parameters.newRate}%`;
        case 'TERM_EXTENSION':
          return `${loan.loanParameters.termMonths + mod.parameters.additionalMonths} months`;
        default:
          return undefined;
      }
    }
    return undefined;
  };

  const getModalTitle = () => {
    switch (mode) {
      case 'EDIT':
        return 'Edit Loan Modification';
      case 'TEMPLATE':
        return 'Create from Template';
      default:
        return 'Loan Restructuring Builder';
    }
  };

  const getModalIcon = () => {
    switch (mode) {
      case 'EDIT':
        return PencilSquareIcon;
      case 'TEMPLATE':
        return ClipboardDocumentIcon;
      default:
        return ArrowPathIcon;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(3)}%`;
  };

  const renderModificationForm = () => {
    switch (selectedType) {
      case 'RATE_CHANGE':
        return <RateChangeForm 
          onAdd={editingItemId ? updateModification : addModification} 
          currentRate={loan.loanParameters.interestRate} 
          initialData={editingItemId ? modifications.find(m => m.id === editingItemId)?.parameters : undefined}
        />;
      case 'TERM_EXTENSION':
        return <TermExtensionForm 
          onAdd={editingItemId ? updateModification : addModification} 
          currentTerm={loan.loanParameters.termMonths}
          initialData={editingItemId ? modifications.find(m => m.id === editingItemId)?.parameters : undefined}
        />;
      case 'PRINCIPAL_REDUCTION':
        return <PrincipalReductionForm 
          onAdd={editingItemId ? updateModification : addModification} 
          currentPrincipal={loan.loanParameters.principal}
          initialData={editingItemId ? modifications.find(m => m.id === editingItemId)?.parameters : undefined}
        />;
      case 'PAYMENT_REDUCTION_TEMPORARY':
        return <TemporaryPaymentReductionForm 
          onAdd={editingItemId ? updateModification : addModification} 
          loan={loan}
          initialData={editingItemId ? modifications.find(m => m.id === editingItemId)?.parameters : undefined}
        />;
      case 'PAYMENT_REDUCTION_PERMANENT':
        return <PermanentPaymentReductionForm 
          onAdd={editingItemId ? updateModification : addModification} 
          loan={loan}
          initialData={editingItemId ? modifications.find(m => m.id === editingItemId)?.parameters : undefined}
        />;
      default:
        return (
          <div className="text-center py-8">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
              <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Form Coming Soon
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              The form for {MODIFICATION_TYPES[selectedType as keyof typeof MODIFICATION_TYPES]?.label} is being developed.
            </p>
            <button
              onClick={() => {
                setSelectedType(null);
                setEditingItemId(null);
              }}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
            >
              Close
            </button>
          </div>
        );
    }
  };

  return (
    <Fragment>
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[70]" static onClose={() => {}}>
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
              <Dialog.Panel className="relative transform rounded-xl bg-white text-left shadow-2xl transition-all sm:my-8 w-full max-w-7xl max-h-[85vh] overflow-y-auto">
                <div className="bg-white">
                  <div className={`px-6 py-5 border-b border-gray-200 ${
                    mode === 'EDIT' ? 'bg-gradient-to-r from-blue-50 to-indigo-50' :
                    mode === 'TEMPLATE' ? 'bg-gradient-to-r from-green-50 to-emerald-50' :
                    'bg-gradient-to-r from-primary-50 to-blue-50'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border ${
                          mode === 'EDIT' ? 'bg-blue-100 border-blue-200' :
                          mode === 'TEMPLATE' ? 'bg-green-100 border-green-200' :
                          'bg-primary-100 border-primary-200'
                        }`}>
                          {(() => {
                            const IconComponent = getModalIcon();
                            return <IconComponent className={`h-5 w-5 ${
                              mode === 'EDIT' ? 'text-blue-600' :
                              mode === 'TEMPLATE' ? 'text-green-600' :
                              'text-primary-600'
                            }`} />;
                          })()}
                        </div>
                        <div>
                          <Dialog.Title as="h3" className="text-xl font-bold leading-6 text-gray-900">
                            {getModalTitle()}
                          </Dialog.Title>
                          <p className="mt-1 text-sm text-gray-600 flex items-center space-x-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800">
                              {loan.id}
                            </span>
                            <span>•</span>
                            <span>
                              {mode === 'EDIT' ? 'Modify existing loan changes' :
                               mode === 'TEMPLATE' ? 'Create new modification from template' :
                               'Build a complete modification package before committing changes'}
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

                  <div className="px-6 py-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Left Column - Modifications List */}
                      <div className="lg:col-span-2">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-lg font-semibold text-gray-900">
                              {mode === 'EDIT' ? 'Editing Modifications' : 'Modification Package'}
                            </h4>
                            {!editingItemId && (
                              <button
                                onClick={() => setShowAddModal(true)}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 shadow-sm hover:shadow-md transition-all duration-200"
                              >
                                <PlusIcon className="h-4 w-4 mr-2" />
                                Add Modification
                              </button>
                            )}
                          </div>

                          {modifications.length === 0 ? (
                            <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-300">
                              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 mb-4">
                                <DocumentTextIcon className="h-8 w-8 text-primary-600" />
                              </div>
                              <h3 className="text-lg font-semibold text-gray-900 mb-2">No modifications added</h3>
                              <p className="text-sm text-gray-600 mb-6 max-w-sm mx-auto">
                                Start by adding modifications to build your comprehensive restructuring package
                              </p>
                              <div>
                                <button
                                  onClick={() => setShowAddModal(true)}
                                  className="inline-flex items-center px-6 py-3 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 transition-all duration-200"
                                >
                                  <PlusIcon className="h-5 w-5 mr-2" />
                                  Add First Modification
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {modifications.map((mod) => {
                                const modType = MODIFICATION_TYPES[mod.type];
                                const IconComponent = modType.icon;
                                return (
                                  <div key={mod.id} className={`bg-white border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200 ${
                                    mod.isBeingEdited ? 'border-blue-300 bg-blue-50/30' : 
                                    mod.hasErrors ? 'border-red-300 bg-red-50/30' :
                                    'border-gray-200'
                                  }`}>
                                    <div className="flex items-start justify-between">
                                      <div className="flex items-start space-x-4">
                                        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl border ${modType.color}`}>
                                          <IconComponent className="h-6 w-6" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center space-x-3 mb-2">
                                            <h5 className="text-base font-semibold text-gray-900">
                                              {mod.description}
                                            </h5>
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${modType.color}`}>
                                              {modType.category}
                                            </span>
                                            {mod.isBeingEdited && (
                                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                EDITING
                                              </span>
                                            )}
                                            {mod.hasErrors && (
                                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                HAS ERRORS
                                              </span>
                                            )}
                                            {mod.validation?.warnings && mod.validation.warnings.length > 0 && (
                                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                HAS WARNINGS
                                              </span>
                                            )}
                                          </div>
                                          <div className="text-sm text-gray-600 leading-relaxed">
                                            {renderModificationSummary(mod)}
                                          </div>
                                          
                                          {/* Validation Messages */}
                                          {mod.validation && (
                                            <div className="mt-3 space-y-2">
                                              {mod.validation.errors.filter(e => e.severity === 'ERROR').map((error, idx) => (
                                                <div key={idx} className="flex items-start space-x-2 p-2 bg-red-50 border border-red-200 rounded-md">
                                                  <ExclamationTriangleIcon className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                                                  <div className="text-xs text-red-700">
                                                    <span className="font-medium">{error.field}:</span> {error.message}
                                                  </div>
                                                </div>
                                              ))}
                                              {mod.validation.warnings.map((warning, idx) => (
                                                <div key={idx} className="flex items-start space-x-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                                                  <ExclamationTriangleIcon className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                                                  <div className="text-xs text-yellow-700">
                                                    <span className="font-medium">{warning.field}:</span> {warning.message}
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                          
                                          <div className="mt-3 flex items-center space-x-4 text-xs text-gray-500">
                                            <span className="flex items-center">
                                              <ClockIcon className="h-3 w-3 mr-1" />
                                              {mod.isBeingEdited ? 'From existing modification' : 'Added just now'}
                                            </span>
                                            <span className="flex items-center">
                                              {mod.hasErrors ? (
                                                <>
                                                  <XMarkIcon className="h-3 w-3 mr-1 text-red-500" />
                                                  <span className="text-red-600">Has validation errors</span>
                                                </>
                                              ) : (
                                                <>
                                                  <CheckCircleIcon className="h-3 w-3 mr-1" />
                                                  Ready to apply
                                                </>
                                              )}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center space-x-2 ml-4">
                                        <button
                                          onClick={() => editModification(mod.id)}
                                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors duration-200"
                                          title="Edit modification"
                                        >
                                          <PencilSquareIcon className="h-4 w-4" />
                                        </button>
                                        <button
                                          onClick={() => removeModification(mod.id)}
                                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors duration-200"
                                          title="Remove modification"
                                        >
                                          <TrashIcon className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Modification Details */}
                          {modifications.length > 0 && (
                            <div className="mt-6 space-y-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700">
                                  Reason for {mode === 'EDIT' ? 'Modification Update' : 'Restructuring'}
                                </label>
                                <textarea
                                  value={reason}
                                  onChange={(e) => setReason(e.target.value)}
                                  rows={3}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                                  placeholder={mode === 'EDIT' ? "Explain why this modification is being updated..." : "Explain why this restructuring is needed..."}
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700">
                                  Effective Date
                                </label>
                                <DatePicker
                                  selected={effectiveDate}
                                  onChange={(date) => setEffectiveDate(date || new Date())}
                                  dateFormat="MM/dd/yyyy"
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                                  placeholderText="Select effective date"
                                  showMonthDropdown
                                  showYearDropdown
                                  dropdownMode="select"
                                  minDate={new Date()}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Column - Impact Analysis */}
                      <div className="lg:col-span-1">
                        <div className="sticky top-0 space-y-4">
                          <h4 className="text-sm font-medium text-gray-900">Impact Analysis</h4>
                          
                          {isCalculating ? (
                            <div className="text-center py-8">
                              <ArrowPathIcon className="animate-spin h-8 w-8 text-gray-400 mx-auto" />
                              <p className="mt-2 text-sm text-gray-500">Calculating impact...</p>
                            </div>
                          ) : projectedLoan ? (
                            <div className="space-y-4">
                              {/* Current vs Projected */}
                              <div className="bg-gray-50 rounded-lg p-4">
                                <h5 className="text-sm font-medium text-gray-900 mb-3">Payment Comparison</h5>
                                <dl className="space-y-2">
                                  <div className="flex justify-between">
                                    <dt className="text-sm text-gray-500">Current Payment</dt>
                                    <dd className="text-sm font-medium text-gray-900">
                                      {(() => {
                                        const terms = LoanEngine.createLoan(
                                          loan.loanParameters.principal,
                                          loan.loanParameters.interestRate,
                                          loan.loanParameters.termMonths,
                                          loan.loanParameters.startDate,
                                          { paymentFrequency: 'monthly', interestType: 'amortized' }
                                        );
                                        const payment = LoanEngine.calculatePayment(terms);
                                        return formatCurrency(payment.monthlyPayment.toNumber());
                                      })()}
                                    </dd>
                                  </div>
                                  <div className="flex justify-between">
                                    <dt className="text-sm text-gray-500">New Payment</dt>
                                    <dd className="text-sm font-medium text-gray-900">
                                      {formatCurrency(projectedLoan.calculation.monthlyPayment)}
                                    </dd>
                                  </div>
                                  <div className="flex justify-between pt-2 border-t">
                                    <dt className="text-sm font-medium text-gray-700">Change</dt>
                                    <dd className={`text-sm font-medium ${projectedLoan.changes.monthlyPayment < 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {projectedLoan.changes.monthlyPayment < 0 ? '' : '+'}
                                      {formatCurrency(projectedLoan.changes.monthlyPayment)}
                                    </dd>
                                  </div>
                                </dl>
                              </div>

                              {/* Total Cost Impact */}
                              <div className="bg-blue-50 rounded-lg p-4">
                                <h5 className="text-sm font-medium text-blue-900 mb-3">Total Cost Impact</h5>
                                <dl className="space-y-2">
                                  <div className="flex justify-between">
                                    <dt className="text-sm text-blue-700">Total Interest Change</dt>
                                    <dd className={`text-sm font-medium ${projectedLoan.changes.totalInterest < 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {projectedLoan.changes.totalInterest < 0 ? '' : '+'}
                                      {formatCurrency(projectedLoan.changes.totalInterest)}
                                    </dd>
                                  </div>
                                  <div className="flex justify-between">
                                    <dt className="text-sm text-blue-700">Total Payment Change</dt>
                                    <dd className={`text-sm font-medium ${projectedLoan.changes.totalPayment < 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {projectedLoan.changes.totalPayment < 0 ? '' : '+'}
                                      {formatCurrency(projectedLoan.changes.totalPayment)}
                                    </dd>
                                  </div>
                                </dl>
                              </div>

                              {/* New Terms Summary */}
                              <div className="bg-gray-50 rounded-lg p-4">
                                <h5 className="text-sm font-medium text-gray-900 mb-3">New Terms</h5>
                                <dl className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <dt className="text-gray-500">Interest Rate</dt>
                                    <dd className="font-medium text-gray-900">
                                      {formatPercentage(projectedLoan.parameters.interestRate)}
                                    </dd>
                                  </div>
                                  <div className="flex justify-between">
                                    <dt className="text-gray-500">Term</dt>
                                    <dd className="font-medium text-gray-900">
                                      {projectedLoan.parameters.termMonths} months
                                    </dd>
                                  </div>
                                  <div className="flex justify-between">
                                    <dt className="text-gray-500">Principal</dt>
                                    <dd className="font-medium text-gray-900">
                                      {formatCurrency(projectedLoan.parameters.principal)}
                                    </dd>
                                  </div>
                                </dl>
                              </div>

                              {/* Before/After Comparison */}
                              {projectedLoan && (
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
                                  <h5 className="text-sm font-medium text-indigo-900 mb-3 flex items-center">
                                    <ChartBarIcon className="h-4 w-4 mr-2" />
                                    Before vs After Comparison
                                  </h5>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <div className="font-medium text-indigo-700 mb-2">BEFORE</div>
                                      <div className="space-y-1 text-indigo-600">
                                        <div>Payment: {(() => {
                                          const terms = LoanEngine.createLoan(
                                            loan.loanParameters.principal,
                                            loan.loanParameters.interestRate,
                                            loan.loanParameters.termMonths,
                                            loan.loanParameters.startDate,
                                            { paymentFrequency: 'monthly', interestType: 'amortized' }
                                          );
                                          const payment = LoanEngine.calculatePayment(terms);
                                          return formatCurrency(payment.monthlyPayment.toNumber());
                                        })()}</div>
                                        <div>Term: {loan.loanParameters.termMonths} months</div>
                                        <div>Rate: {formatPercentage(loan.loanParameters.interestRate)}</div>
                                        <div>Principal: {formatCurrency(loan.loanParameters.principal)}</div>
                                      </div>
                                    </div>
                                    <div>
                                      <div className="font-medium text-indigo-700 mb-2">AFTER</div>
                                      <div className="space-y-1 text-indigo-600">
                                        <div className={projectedLoan.changes.monthlyPayment < 0 ? 'text-green-600' : 'text-red-600'}>
                                          Payment: {formatCurrency(projectedLoan.calculation.monthlyPayment)}
                                          <span className="text-xs ml-1">
                                            ({projectedLoan.changes.monthlyPayment < 0 ? '' : '+'}{formatCurrency(projectedLoan.changes.monthlyPayment)})
                                          </span>
                                        </div>
                                        <div className={(projectedLoan.parameters.termMonths - loan.loanParameters.termMonths) > 0 ? 'text-red-600' : 'text-green-600'}>
                                          Term: {projectedLoan.parameters.termMonths} months
                                          <span className="text-xs ml-1">
                                            ({(projectedLoan.parameters.termMonths - loan.loanParameters.termMonths) > 0 ? '+' : ''}{projectedLoan.parameters.termMonths - loan.loanParameters.termMonths})
                                          </span>
                                        </div>
                                        <div className={(projectedLoan.parameters.interestRate - loan.loanParameters.interestRate) > 0 ? 'text-red-600' : 'text-green-600'}>
                                          Rate: {formatPercentage(projectedLoan.parameters.interestRate)}
                                          <span className="text-xs ml-1">
                                            ({(projectedLoan.parameters.interestRate - loan.loanParameters.interestRate) > 0 ? '+' : ''}{formatPercentage(projectedLoan.parameters.interestRate - loan.loanParameters.interestRate)})
                                          </span>
                                        </div>
                                        <div className={(projectedLoan.parameters.principal - loan.loanParameters.principal) < 0 ? 'text-green-600' : 'text-red-600'}>
                                          Principal: {formatCurrency(projectedLoan.parameters.principal)}
                                          <span className="text-xs ml-1">
                                            ({(projectedLoan.parameters.principal - loan.loanParameters.principal) < 0 ? '' : '+'}{formatCurrency(projectedLoan.parameters.principal - loan.loanParameters.principal)})
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Validation Summary */}
                              {modifications.some(m => m.hasErrors || (m.validation?.warnings && m.validation.warnings.length > 0)) && (
                                <div className="rounded-md bg-red-50 p-4">
                                  <div className="flex">
                                    <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                                    <div className="ml-3">
                                      <h3 className="text-sm font-medium text-red-800">Validation Issues</h3>
                                      <div className="mt-2 text-sm text-red-700">
                                        <p>
                                          {modifications.filter(m => m.hasErrors).length > 0 && (
                                            <span className="block">• {modifications.filter(m => m.hasErrors).length} modification(s) have validation errors that must be fixed.</span>
                                          )}
                                          {modifications.filter(m => m.validation?.warnings && m.validation.warnings.length > 0).length > 0 && (
                                            <span className="block">• {modifications.filter(m => m.validation?.warnings && m.validation.warnings.length > 0).length} modification(s) have warnings to review.</span>
                                          )}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Warning */}
                              <div className="rounded-md bg-yellow-50 p-4">
                                <div className="flex">
                                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
                                  <div className="ml-3">
                                    <h3 className="text-sm font-medium text-yellow-800">Important Notice</h3>
                                    <div className="mt-2 text-sm text-yellow-700">
                                      <p>
                                        {mode === 'EDIT' 
                                          ? 'This will update the existing modification. The original modification will be reversed and this new one will be applied.'
                                          : 'This restructuring will create a permanent modification to the loan terms. Ensure all changes are reviewed before committing.'
                                        }
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-8 bg-gray-50 rounded-lg">
                              <CalculatorIcon className="mx-auto h-12 w-12 text-gray-400" />
                              <p className="mt-2 text-sm text-gray-500">
                                Add modifications to see impact analysis
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 px-6 py-4 flex justify-between">
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowConfirmation(true)}
                      disabled={modifications.length === 0 || !reason.trim() || modifications.some(m => m.hasErrors)}
                      className="inline-flex justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckCircleIcon className="h-5 w-5 mr-2" />
                      {mode === 'EDIT' ? 'Update Modification' : 'Commit Restructuring'}
                    </button>
                  </div>
                </div>

                {/* Add Modification Modal moved outside main dialog */}

                {/* Confirmation Modal */}
                {showConfirmation && (
                  <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-[80]">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full">
                      <div className="text-center">
                        <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-yellow-400" />
                        <h3 className="mt-2 text-lg font-medium text-gray-900">
                          {mode === 'EDIT' ? 'Confirm Modification Update' : 'Confirm Restructuring'}
                        </h3>
                        <p className="mt-2 text-sm text-gray-500">
                          {mode === 'EDIT' 
                            ? `You are about to update this modification. The original will be reversed and a new modification will be created.`
                            : `You are about to commit ${modifications.length} modification${modifications.length > 1 ? 's' : ''} to this loan. This action cannot be undone.`
                          }
                        </p>
                        <div className="mt-6 flex justify-center space-x-3">
                          <button
                            onClick={commitModifications}
                            className="inline-flex justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500"
                          >
                            {mode === 'EDIT' ? 'Yes, Update Modification' : 'Yes, Commit Changes'}
                          </button>
                          <button
                            onClick={() => setShowConfirmation(false)}
                            className="inline-flex justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
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

    {/* Nested Modal - Rendered Outside Main Dialog to Avoid Height Constraints */}
    {selectedType && (
      <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[90] p-4"
           onClick={(e) => {
             // Prevent clicks on backdrop from bubbling
             if (e.target === e.currentTarget) {
               setSelectedType(null);
               setEditingItemId(null);
             }
           }}>
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              {editingItemId ? 'Edit ' : 'Add '}
              {MODIFICATION_TYPES[selectedType as keyof typeof MODIFICATION_TYPES].label}
            </h3>
            <button
              onClick={() => {
                setSelectedType(null);
                setEditingItemId(null);
              }}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          
          {/* Modal Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6">
            {renderModificationForm()}
          </div>
          
          {/* Modal Footer */}
          <div className="border-t border-gray-200 p-6">
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setSelectedType(null);
                  setEditingItemId(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Add Modification Modal - Rendered Outside to Avoid Height Constraints */}
    {showAddModal && (
      <ModificationTypeSelector
        onSelect={(type) => {
          setShowAddModal(false);
          setSelectedType(type);
        }}
        onClose={() => {
          setShowAddModal(false);
          setEditingItemId(null);
          setSelectedType(null);
        }}
      />
    )}
    </Fragment>
  );
};

// Rest of the component would include all the helper components and forms...
// Due to length constraints, I'll continue with the key form components

const ModificationTypeSelector = ({ onSelect, onClose }: { onSelect: (type: string) => void; onClose: () => void }) => {
  const groupedTypes = Object.entries(MODIFICATION_TYPES).reduce((acc, [key, value]) => {
    if (!acc[value.category]) {
      acc[value.category] = [];
    }
    acc[value.category].push({ key, ...value });
    return acc;
  }, {} as Record<string, Array<{ key: string; label: string; description: string; icon: any; color: string; category: string }>>);

  return (
    <div 
      className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-[80]"
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl p-6 max-w-4xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => {
          // Prevent clicks inside the modal from bubbling to backdrop
          e.stopPropagation();
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">Select Modification Type</h3>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        
        <div className="space-y-6">
          {Object.entries(groupedTypes).map(([category, types]) => (
            <div key={category}>
              <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">{category}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {types.map((type) => {
                  const IconComponent = type.icon;
                  return (
                    <button
                      key={type.key}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(type.key);
                      }}
                      className="group p-4 border border-gray-200 rounded-xl hover:border-primary-300 hover:bg-primary-50 text-left transition-all duration-200 hover:shadow-md"
                    >
                      <div className="flex items-start space-x-4">
                        <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg border group-hover:scale-110 transition-transform duration-200 ${type.color}`}>
                          <IconComponent className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-gray-900 group-hover:text-primary-900 transition-colors">
                            {type.label}
                          </h4>
                          <p className="mt-1 text-xs text-gray-500 group-hover:text-primary-700 transition-colors leading-relaxed">
                            {type.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-8 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// Individual form components with initial data support
const RateChangeForm = ({ onAdd, currentRate, initialData }: { 
  onAdd: Function; 
  currentRate: number; 
  initialData?: Record<string, any>;
}) => {
  const [newRate, setNewRate] = useState(initialData?.newRate || currentRate);
  
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Current Rate</label>
        <p className="mt-1 text-sm text-gray-900">{currentRate}%</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">New Rate (%)</label>
        <input
          type="number"
          step="0.01"
          value={newRate}
          onChange={(e) => setNewRate(parseFloat(e.target.value))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        />
      </div>
      <div className="flex justify-end">
        <button
          onClick={() => onAdd('RATE_CHANGE', { newRate })}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
        >
          {initialData ? 'Update Modification' : 'Add Modification'}
        </button>
      </div>
    </div>
  );
};

const TermExtensionForm = ({ onAdd, currentTerm, initialData }: { 
  onAdd: Function; 
  currentTerm: number; 
  initialData?: Record<string, any>;
}) => {
  const [additionalMonths, setAdditionalMonths] = useState(initialData?.additionalMonths || 12);
  
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Current Term</label>
        <p className="mt-1 text-sm text-gray-900">{currentTerm} months</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Additional Months</label>
        <input
          type="number"
          value={additionalMonths}
          onChange={(e) => setAdditionalMonths(parseInt(e.target.value))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        />
        <p className="mt-1 text-sm text-gray-500">New term will be {currentTerm + additionalMonths} months</p>
      </div>
      <div className="flex justify-end">
        <button
          onClick={() => onAdd('TERM_EXTENSION', { additionalMonths })}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
        >
          {initialData ? 'Update Modification' : 'Add Modification'}
        </button>
      </div>
    </div>
  );
};

const PrincipalReductionForm = ({ onAdd, currentPrincipal, initialData }: { 
  onAdd: Function; 
  currentPrincipal: number; 
  initialData?: Record<string, any>;
}) => {
  const [reductionAmount, setReductionAmount] = useState(initialData?.reductionAmount || 5000);
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };
  
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Current Principal</label>
        <p className="mt-1 text-sm text-gray-900">{formatCurrency(currentPrincipal)}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Reduction Amount</label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-500 sm:text-sm">$</span>
          </div>
          <input
            type="number"
            value={reductionAmount}
            onChange={(e) => setReductionAmount(parseFloat(e.target.value))}
            className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          New principal will be {formatCurrency(currentPrincipal - reductionAmount)}
        </p>
      </div>
      <div className="flex justify-end">
        <button
          onClick={() => onAdd('PRINCIPAL_REDUCTION', { reductionAmount })}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
        >
          {initialData ? 'Update Modification' : 'Add Modification'}
        </button>
      </div>
    </div>
  );
};

const TemporaryPaymentReductionForm = ({ onAdd, loan, initialData }: { 
  onAdd: Function; 
  loan: any; 
  initialData?: Record<string, any>;
}) => {
  const [reductionAmount, setReductionAmount] = useState(initialData?.reductionAmount || 200);
  const [reductionPeriodMonths, setReductionPeriodMonths] = useState(initialData?.reductionPeriodMonths || 6);
  const [startDate, setStartDate] = useState(initialData?.startDate ? new Date(initialData.startDate) : new Date());
  
  // Calculate current payment for reference
  const currentLoanTerms = LoanEngine.createLoan(
    loan.loanParameters.principal,
    loan.loanParameters.interestRate,
    loan.loanParameters.termMonths,
    loan.loanParameters.startDate,
    { paymentFrequency: 'monthly', interestType: 'amortized' }
  );
  const currentPayment = LoanEngine.calculatePayment(currentLoanTerms);
  const currentMonthlyPayment = currentPayment.monthlyPayment.toNumber();
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };
  
  const newPaymentAmount = currentMonthlyPayment - reductionAmount;
  
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Current Monthly Payment</label>
        <p className="mt-1 text-sm text-gray-900">{formatCurrency(currentMonthlyPayment)}</p>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700">Payment Reduction Amount</label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-500 sm:text-sm">$</span>
          </div>
          <input
            type="number"
            value={reductionAmount}
            onChange={(e) => setReductionAmount(parseFloat(e.target.value) || 0)}
            className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          New payment during reduction period: {formatCurrency(newPaymentAmount)}
        </p>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700">Reduction Period (Months)</label>
        <input
          type="number"
          value={reductionPeriodMonths}
          onChange={(e) => setReductionPeriodMonths(parseInt(e.target.value) || 1)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          min="1"
          max="60"
        />
        <p className="mt-1 text-sm text-gray-500">
          Temporary reduction for {reductionPeriodMonths} months
        </p>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700">Start Date</label>
        <DatePicker
          selected={startDate}
          onChange={(date) => setStartDate(date || new Date())}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          dateFormat="MM/dd/yyyy"
        />
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
        <h4 className="text-sm font-medium text-blue-800 mb-2">Modification Summary</h4>
        <div className="text-xs text-blue-700 space-y-1">
          <div>• Reduced payment: {formatCurrency(newPaymentAmount)} for {reductionPeriodMonths} months</div>
          <div>• Total payment reduction: {formatCurrency(reductionAmount * reductionPeriodMonths)}</div>
          <div>• Payment returns to {formatCurrency(currentMonthlyPayment)} afterward</div>
          <div>• Note: This may extend the loan term or require catch-up payments</div>
        </div>
      </div>
      
      <div className="flex justify-end">
        <button
          onClick={() => onAdd('PAYMENT_REDUCTION_TEMPORARY', { 
            reductionAmount, 
            reductionPeriodMonths, 
            startDate: startDate.toISOString(),
            newPaymentAmount 
          })}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          disabled={newPaymentAmount <= 0}
        >
          {initialData ? 'Update Modification' : 'Add Modification'}
        </button>
      </div>
    </div>
  );
};

const PermanentPaymentReductionForm = ({ onAdd, loan, initialData }: { 
  onAdd: Function; 
  loan: any; 
  initialData?: Record<string, any>;
}) => {
  const [newPaymentAmount, setNewPaymentAmount] = useState(initialData?.newPaymentAmount || 0);
  const [termAdjustment, setTermAdjustment] = useState<'EXTEND_TERM' | 'PRINCIPAL_REDUCTION'>(
    initialData?.termAdjustment || 'EXTEND_TERM'
  );
  const [maxTermMonths, setMaxTermMonths] = useState(initialData?.maxTermMonths || 480);
  
  // Calculate current payment and required adjustments
  const currentLoanTerms = LoanEngine.createLoan(
    loan.loanParameters.principal,
    loan.loanParameters.interestRate,
    loan.loanParameters.termMonths,
    loan.loanParameters.startDate,
    { paymentFrequency: 'monthly', interestType: 'amortized' }
  );
  const currentPayment = LoanEngine.calculatePayment(currentLoanTerms);
  const currentMonthlyPayment = currentPayment.monthlyPayment.toNumber();
  
  // Calculate what term would be needed for the new payment amount
  const calculateRequiredTerm = (paymentAmount: number) => {
    if (paymentAmount <= 0) return 0;
    
    const principal = loan.loanParameters.principal;
    const monthlyRate = loan.loanParameters.interestRate / 100 / 12;
    
    if (monthlyRate === 0) {
      return Math.ceil(principal / paymentAmount);
    }
    
    const numerator = Math.log(1 + (principal * monthlyRate) / paymentAmount);
    const denominator = Math.log(1 + monthlyRate);
    
    return Math.ceil(-numerator / denominator);
  };
  
  const requiredTermMonths = newPaymentAmount > 0 ? calculateRequiredTerm(newPaymentAmount) : 0;
  const termExtensionMonths = requiredTermMonths - loan.loanParameters.termMonths;
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };
  
  // Initialize new payment amount if not set
  useEffect(() => {
    if (!initialData && newPaymentAmount === 0) {
      setNewPaymentAmount(Math.round(currentMonthlyPayment * 0.8)); // Default to 80% of current payment
    }
  }, [currentMonthlyPayment, initialData, newPaymentAmount]);
  
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Current Monthly Payment</label>
        <p className="mt-1 text-sm text-gray-900">{formatCurrency(currentMonthlyPayment)}</p>
        <p className="mt-1 text-xs text-gray-500">Current term: {loan.loanParameters.termMonths} months</p>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700">New Monthly Payment Amount</label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-500 sm:text-sm">$</span>
          </div>
          <input
            type="number"
            value={newPaymentAmount}
            onChange={(e) => setNewPaymentAmount(parseFloat(e.target.value) || 0)}
            className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            min="50"
          />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Payment reduction: {formatCurrency(currentMonthlyPayment - newPaymentAmount)}
        </p>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700">Adjustment Method</label>
        <div className="mt-2 space-y-2">
          <label className="flex items-center">
            <input
              type="radio"
              name="termAdjustment"
              value="EXTEND_TERM"
              checked={termAdjustment === 'EXTEND_TERM'}
              onChange={(e) => setTermAdjustment(e.target.value as 'EXTEND_TERM')}
              className="focus:ring-primary-500 h-4 w-4 text-primary-600 border-gray-300"
            />
            <span className="ml-2 text-sm text-gray-700">Extend loan term</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="termAdjustment"
              value="PRINCIPAL_REDUCTION"
              checked={termAdjustment === 'PRINCIPAL_REDUCTION'}
              onChange={(e) => setTermAdjustment(e.target.value as 'PRINCIPAL_REDUCTION')}
              className="focus:ring-primary-500 h-4 w-4 text-primary-600 border-gray-300"
            />
            <span className="ml-2 text-sm text-gray-700">Reduce principal balance</span>
          </label>
        </div>
      </div>
      
      {termAdjustment === 'EXTEND_TERM' && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Maximum Term (Months)</label>
          <input
            type="number"
            value={maxTermMonths}
            onChange={(e) => setMaxTermMonths(parseInt(e.target.value) || 480)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            min="60"
            max="600"
          />
          <p className="mt-1 text-sm text-gray-500">
            Regulatory or policy limit on loan term extension
          </p>
        </div>
      )}
      
      {newPaymentAmount > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <h4 className="text-sm font-medium text-yellow-800 mb-2">Impact Analysis</h4>
          <div className="text-xs text-yellow-700 space-y-1">
            {termAdjustment === 'EXTEND_TERM' ? (
              <>
                <div>• Required term: {requiredTermMonths} months</div>
                <div>• Term extension: {termExtensionMonths} months</div>
                {requiredTermMonths > maxTermMonths && (
                  <div className="text-red-600">⚠ Required term exceeds maximum allowed ({maxTermMonths} months)</div>
                )}
                <div>• Additional interest over loan life (estimated)</div>
              </>
            ) : (
              <>
                <div>• Principal reduction required to achieve payment</div>
                <div>• Term remains at {loan.loanParameters.termMonths} months</div>
              </>
            )}
          </div>
        </div>
      )}
      
      <div className="flex justify-end">
        <button
          onClick={() => onAdd('PAYMENT_REDUCTION_PERMANENT', { 
            newPaymentAmount,
            termAdjustment,
            maxTermMonths,
            newTermMonths: termAdjustment === 'EXTEND_TERM' ? Math.min(requiredTermMonths, maxTermMonths) : loan.loanParameters.termMonths
          })}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          disabled={newPaymentAmount <= 0 || (termAdjustment === 'EXTEND_TERM' && requiredTermMonths > maxTermMonths)}
        >
          {initialData ? 'Update Modification' : 'Add Modification'}
        </button>
      </div>
    </div>
  );
};

const renderModificationSummary = (mod: ModificationItem) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  switch (mod.type) {
    case 'RATE_CHANGE':
      return (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">New Interest Rate:</span>
            <span className="font-medium text-gray-900">{mod.parameters.newRate}%</span>
          </div>
        </div>
      );
    case 'TERM_EXTENSION':
      return (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Extension Period:</span>
            <span className="font-medium text-gray-900">{mod.parameters.additionalMonths} months</span>
          </div>
        </div>
      );
    case 'PRINCIPAL_REDUCTION':
      return (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Reduction Amount:</span>
            <span className="font-medium text-gray-900">{formatCurrency(mod.parameters.reductionAmount)}</span>
          </div>
        </div>
      );
    case 'PAYMENT_REDUCTION_TEMPORARY':
      return (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">New Payment:</span>
            <span className="font-medium text-gray-900">{formatCurrency(mod.parameters.newPaymentAmount)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Duration:</span>
            <span className="font-medium text-gray-900">{mod.parameters.reductionPeriodMonths} months</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Reduction:</span>
            <span className="font-medium text-green-600">{formatCurrency(mod.parameters.reductionAmount)}</span>
          </div>
        </div>
      );
    case 'PAYMENT_REDUCTION_PERMANENT':
      return (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">New Payment:</span>
            <span className="font-medium text-gray-900">{formatCurrency(mod.parameters.newPaymentAmount)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Method:</span>
            <span className="font-medium text-gray-900">
              {mod.parameters.termAdjustment === 'EXTEND_TERM' ? 'Extend Term' : 'Principal Reduction'}
            </span>
          </div>
          {mod.parameters.newTermMonths && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500">New Term:</span>
              <span className="font-medium text-gray-900">{mod.parameters.newTermMonths} months</span>
            </div>
          )}
        </div>
      );
    default:
      return <span className="text-gray-500">Configuration pending...</span>;
  }
};