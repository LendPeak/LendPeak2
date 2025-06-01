import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { 
  XMarkIcon, 
  ExclamationTriangleIcon, 
  CheckCircleIcon,
  ArrowRightIcon,
  InformationCircleIcon 
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import DatePicker from 'react-datepicker';
import { LoanEngine } from '@lendpeak/engine';
import type {
  LoanModification,
  ModificationType,
  ModificationCalculationResult,
  RateChangeModification,
  TermExtensionModification,
  TemporaryPaymentReductionModification,
  PermanentPaymentReductionModification,
  PrincipalReductionModification,
  BalloonPaymentAssignmentModification,
  BalloonPaymentRemovalModification,
  ForbearanceModification,
  DefermentModification,
  ReamortizationModification,
  LoanTerms,
  ModificationCalculationParams
} from '@lendpeak/engine';
import { demoLoanStorage } from '../../services/demoLoanStorage';
import { formatCurrency } from '../../utils/rounding';

interface ComprehensiveLoanModificationModalProps {
  loan: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Comprehensive modification types with enhanced options
const MODIFICATION_TYPES: Record<ModificationType, { label: string; description: string; category: string }> = {
  'RATE_CHANGE': {
    label: 'Interest Rate Change',
    description: 'Modify the loan interest rate',
    category: 'Rate & Terms'
  },
  'TERM_EXTENSION': {
    label: 'Term Extension',
    description: 'Extend the loan term to reduce payments',
    category: 'Rate & Terms'
  },
  'PAYMENT_REDUCTION_TEMPORARY': {
    label: 'Temporary Payment Reduction',
    description: 'Reduce payments for a specified period',
    category: 'Payment Relief'
  },
  'PAYMENT_REDUCTION_PERMANENT': {
    label: 'Permanent Payment Reduction', 
    description: 'Permanently reduce monthly payment amount',
    category: 'Payment Relief'
  },
  'PRINCIPAL_REDUCTION': {
    label: 'Principal Reduction',
    description: 'Reduce the outstanding principal balance',
    category: 'Principal Changes'
  },
  'BALLOON_PAYMENT_ASSIGNMENT': {
    label: 'Balloon Payment Assignment',
    description: 'Add balloon payment with EMI reamortization',
    category: 'Balloon Options'
  },
  'BALLOON_PAYMENT_REMOVAL': {
    label: 'Balloon Payment Removal',
    description: 'Remove existing balloon payment',
    category: 'Balloon Options'
  },
  'FORBEARANCE': {
    label: 'Forbearance',
    description: 'Temporary payment pause or reduction',
    category: 'Hardship Options'
  },
  'DEFERMENT': {
    label: 'Deferment',
    description: 'Formal postponement of payments',
    category: 'Hardship Options'
  },
  'REAMORTIZATION': {
    label: 'Loan Reamortization',
    description: 'Complete recalculation of payment schedule',
    category: 'Restructuring'
  }
};

// Dynamic schema based on modification type
const createValidationSchema = (modificationType: ModificationType) => {
  const baseSchema = {
    modificationType: yup.string().required('Modification type is required'),
    reason: yup.string().required('Reason is required').min(10, 'Please provide more details'),
    effectiveDate: yup.date().required('Effective date is required'),
    customerConsent: yup.boolean().oneOf([true], 'Customer consent is required'),
    complianceReview: yup.boolean().oneOf([true], 'Compliance review is required'),
  };

  const typeSpecificSchema: Record<string, any> = {};

  switch (modificationType) {
    case 'RATE_CHANGE':
      typeSpecificSchema.newRate = yup.number()
        .required('New rate is required')
        .min(0.01, 'Rate must be greater than 0')
        .max(50, 'Rate cannot exceed 50%');
      break;

    case 'TERM_EXTENSION':
      typeSpecificSchema.additionalMonths = yup.number()
        .required('Additional months is required')
        .min(1, 'Must extend by at least 1 month')
        .max(360, 'Cannot extend by more than 360 months');
      typeSpecificSchema.keepSamePayment = yup.boolean();
      break;

    case 'PAYMENT_REDUCTION_TEMPORARY':
      typeSpecificSchema.newPaymentAmount = yup.number()
        .required('New payment amount is required')
        .min(1, 'Payment must be greater than 0');
      typeSpecificSchema.numberOfTerms = yup.number()
        .required('Number of terms is required')
        .min(1, 'Must be at least 1 term')
        .max(60, 'Cannot exceed 60 terms');
      typeSpecificSchema.interestHandling = yup.string()
        .oneOf(['CAPITALIZE', 'DEFER', 'WAIVE'], 'Invalid interest handling option');
      break;

    case 'PAYMENT_REDUCTION_PERMANENT':
      typeSpecificSchema.newPaymentAmount = yup.number()
        .required('New payment amount is required')
        .min(1, 'Payment must be greater than 0');
      typeSpecificSchema.termAdjustment = yup.string()
        .oneOf(['EXTEND_TERM', 'REDUCE_PRINCIPAL', 'COMBINATION'], 'Invalid term adjustment');
      typeSpecificSchema.newTermMonths = yup.number().when('termAdjustment', {
        is: (val: string) => val === 'EXTEND_TERM' || val === 'COMBINATION',
        then: (schema) => schema.required('New term is required').min(1)
      });
      typeSpecificSchema.principalReduction = yup.number().when('termAdjustment', {
        is: (val: string) => val === 'REDUCE_PRINCIPAL' || val === 'COMBINATION',
        then: (schema) => schema.required('Principal reduction is required').min(1)
      });
      break;

    case 'PRINCIPAL_REDUCTION':
      typeSpecificSchema.reductionAmount = yup.number()
        .required('Reduction amount is required')
        .min(1, 'Reduction must be greater than 0');
      typeSpecificSchema.paymentRecalculation = yup.string()
        .oneOf(['KEEP_TERM', 'KEEP_PAYMENT', 'CUSTOM'], 'Invalid payment recalculation option');
      break;

    case 'BALLOON_PAYMENT_ASSIGNMENT':
      typeSpecificSchema.balloonAmount = yup.number()
        .required('Balloon amount is required')
        .min(1, 'Balloon amount must be greater than 0');
      typeSpecificSchema.balloonDueDate = yup.date()
        .required('Balloon due date is required');
      typeSpecificSchema.reamortizationStartType = yup.string()
        .oneOf(['CURRENT_TERM', 'NEXT_TERM', 'BEGINNING', 'CUSTOM'], 'Invalid reamortization start type');
      typeSpecificSchema.customStartTerm = yup.number().when('reamortizationStartType', {
        is: 'CUSTOM',
        then: (schema) => schema.required('Custom start term is required').min(1)
      });
      break;

    case 'BALLOON_PAYMENT_REMOVAL':
      typeSpecificSchema.reamortizationType = yup.string()
        .oneOf(['EXTEND_TERM', 'INCREASE_PAYMENT', 'CUSTOM'], 'Invalid reamortization type');
      typeSpecificSchema.newTermMonths = yup.number().when('reamortizationType', {
        is: 'EXTEND_TERM',
        then: (schema) => schema.required('New term is required').min(1)
      });
      typeSpecificSchema.newPaymentAmount = yup.number().when('reamortizationType', {
        is: (val: string) => val === 'INCREASE_PAYMENT' || val === 'CUSTOM',
        then: (schema) => schema.required('New payment amount is required').min(1)
      });
      break;

    case 'FORBEARANCE':
      typeSpecificSchema.durationMonths = yup.number()
        .required('Duration is required')
        .min(1, 'Duration must be at least 1 month')
        .max(12, 'Forbearance cannot exceed 12 months');
      typeSpecificSchema.forbearanceType = yup.string()
        .oneOf(['FULL_PAUSE', 'PARTIAL_REDUCTION'], 'Invalid forbearance type');
      typeSpecificSchema.reducedPaymentAmount = yup.number().when('forbearanceType', {
        is: 'PARTIAL_REDUCTION',
        then: (schema) => schema.required('Reduced payment amount is required').min(0)
      });
      break;

    case 'DEFERMENT':
      typeSpecificSchema.durationMonths = yup.number()
        .required('Duration is required')
        .min(1, 'Duration must be at least 1 month')
        .max(24, 'Deferment cannot exceed 24 months');
      typeSpecificSchema.interestSubsidy = yup.boolean();
      typeSpecificSchema.eligibilityReason = yup.string()
        .required('Eligibility reason is required');
      break;

    case 'REAMORTIZATION':
      typeSpecificSchema.newTermMonths = yup.number().min(1, 'Term must be at least 1 month');
      typeSpecificSchema.newInterestRate = yup.number().min(0.01, 'Rate must be greater than 0').max(50);
      typeSpecificSchema.reamortizationType = yup.string()
        .oneOf(['RESET_SCHEDULE', 'ADJUST_REMAINING', 'FULL_RECALC'], 'Invalid reamortization type');
      break;
  }

  return yup.object({ ...baseSchema, ...typeSpecificSchema });
};

type FormData = {
  modificationType: ModificationType;
  reason: string;
  effectiveDate: Date;
  customerConsent: boolean;
  complianceReview: boolean;
  // Type-specific fields
  newRate?: number;
  additionalMonths?: number;
  keepSamePayment?: boolean;
  newPaymentAmount?: number;
  numberOfTerms?: number;
  interestHandling?: 'CAPITALIZE' | 'DEFER' | 'WAIVE';
  termAdjustment?: 'EXTEND_TERM' | 'REDUCE_PRINCIPAL' | 'COMBINATION';
  newTermMonths?: number;
  principalReduction?: number;
  reductionAmount?: number;
  paymentRecalculation?: 'KEEP_TERM' | 'KEEP_PAYMENT' | 'CUSTOM';
  balloonAmount?: number;
  balloonDueDate?: Date;
  reamortizationStartType?: 'CURRENT_TERM' | 'NEXT_TERM' | 'BEGINNING' | 'CUSTOM';
  customStartTerm?: number;
  reamortizationType?: 'EXTEND_TERM' | 'INCREASE_PAYMENT' | 'CUSTOM' | 'RESET_SCHEDULE' | 'ADJUST_REMAINING' | 'FULL_RECALC';
  durationMonths?: number;
  forbearanceType?: 'FULL_PAUSE' | 'PARTIAL_REDUCTION';
  reducedPaymentAmount?: number;
  interestSubsidy?: boolean;
  eligibilityReason?: string;
  newInterestRate?: number;
};

export const ComprehensiveLoanModificationModal = ({ 
  loan, 
  isOpen, 
  onClose, 
  onSuccess 
}: ComprehensiveLoanModificationModalProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [modificationImpact, setModificationImpact] = useState<ModificationCalculationResult | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
    control,
    setValue,
  } = useForm<FormData>({
    resolver: yupResolver(createValidationSchema(watch('modificationType') || 'RATE_CHANGE')),
    defaultValues: {
      effectiveDate: new Date(),
      customerConsent: false,
      complianceReview: false,
    },
  });

  const selectedType = watch('modificationType');
  const watchedValues = watch();

  // Calculate modification impact when form values change
  useEffect(() => {
    if (selectedType && watchedValues.effectiveDate) {
      calculateModificationImpact();
    }
  }, [selectedType, watchedValues]);

  const calculateModificationImpact = async () => {
    try {
      // Create loan terms from current loan
      const loanTerms: LoanTerms = LoanEngine.createLoan(
        loan.loanParameters.principal,
        loan.loanParameters.interestRate,
        loan.loanParameters.termMonths,
        loan.loanParameters.startDate || new Date(),
        {
          paymentFrequency: 'monthly',
          interestType: 'amortized',
        }
      );

      // Calculate current balance (simplified for demo)
      const currentBalance = demoLoanStorage.calculateCurrentBalance(loan.id);
      const currentPaymentNumber = demoLoanStorage.getPayments(loan.id).length + 1;
      
      const params: ModificationCalculationParams = {
        currentBalance: LoanEngine.toBig(currentBalance),
        currentTermsRemaining: loan.loanParameters.termMonths - currentPaymentNumber + 1,
        currentPaymentNumber,
        asOfDate: LoanEngine.parseDate(new Date().toISOString()),
      };

      // Create modification object based on form data
      const modification = createModificationFromFormData(watchedValues);
      if (!modification) return;

      // Validate modification
      const validationResult = LoanEngine.validateModification(loanTerms, modification, params);
      if (!validationResult.isValid) {
        setValidationErrors(validationResult.errors.map(e => e.message));
        setModificationImpact(null);
        return;
      }
      
      setValidationErrors([]);

      // Calculate impact
      const impact = LoanEngine.calculateModificationImpact(loanTerms, modification, params);
      setModificationImpact(impact);

    } catch (error) {
      console.error('Error calculating modification impact:', error);
      setValidationErrors(['Unable to calculate modification impact']);
      setModificationImpact(null);
    }
  };

  const createModificationFromFormData = (data: FormData): LoanModification | null => {
    if (!data.modificationType || !data.effectiveDate) return null;

    const baseModification = {
      id: `mod-${Date.now()}`,
      effectiveDate: LoanEngine.parseDate(data.effectiveDate.toISOString()),
      reason: data.reason || 'Pending reason',
      createdBy: 'loan-officer',
      createdAt: LoanEngine.parseDate(new Date().toISOString()),
      status: 'PENDING' as const,
    };

    switch (data.modificationType) {
      case 'RATE_CHANGE':
        return {
          ...baseModification,
          type: 'RATE_CHANGE',
          newAnnualInterestRate: LoanEngine.toBig(data.newRate || 0),
          previousRate: LoanEngine.toBig(loan.loanParameters.interestRate),
          rateChangeReason: data.reason || '',
        } as RateChangeModification;

      case 'TERM_EXTENSION':
        return {
          ...baseModification,
          type: 'TERM_EXTENSION',
          additionalMonths: data.additionalMonths || 0,
          newTermMonths: (loan.loanParameters.termMonths || 360) + (data.additionalMonths || 0),
          previousTermMonths: loan.loanParameters.termMonths || 360,
          keepSamePayment: data.keepSamePayment || false,
        } as TermExtensionModification;

      case 'PAYMENT_REDUCTION_TEMPORARY':
        const autoRevertDate = new Date(data.effectiveDate);
        autoRevertDate.setMonth(autoRevertDate.getMonth() + (data.numberOfTerms || 1));
        return {
          ...baseModification,
          type: 'PAYMENT_REDUCTION_TEMPORARY',
          startDate: LoanEngine.parseDate(data.effectiveDate.toISOString()),
          numberOfTerms: data.numberOfTerms || 1,
          newPaymentAmount: LoanEngine.toBig(data.newPaymentAmount || 0),
          previousPaymentAmount: LoanEngine.toBig(1000), // Would get from loan calculation
          reductionAmount: LoanEngine.toBig(1000 - (data.newPaymentAmount || 0)),
          automaticReversionDate: LoanEngine.parseDate(autoRevertDate.toISOString()),
          interestHandling: data.interestHandling || 'CAPITALIZE',
        } as TemporaryPaymentReductionModification;

      case 'PAYMENT_REDUCTION_PERMANENT':
        return {
          ...baseModification,
          type: 'PAYMENT_REDUCTION_PERMANENT',
          newPaymentAmount: LoanEngine.toBig(data.newPaymentAmount || 0),
          previousPaymentAmount: LoanEngine.toBig(1000), // Would get from loan calculation
          reductionAmount: LoanEngine.toBig(1000 - (data.newPaymentAmount || 0)),
          termAdjustment: data.termAdjustment || 'EXTEND_TERM',
          newTermMonths: data.newTermMonths,
          principalReduction: data.principalReduction ? LoanEngine.toBig(data.principalReduction) : undefined,
        } as PermanentPaymentReductionModification;

      case 'PRINCIPAL_REDUCTION':
        const currentBalance = demoLoanStorage.calculateCurrentBalance(loan.id);
        return {
          ...baseModification,
          type: 'PRINCIPAL_REDUCTION',
          reductionAmount: LoanEngine.toBig(data.reductionAmount || 0),
          newPrincipalBalance: LoanEngine.toBig(currentBalance - (data.reductionAmount || 0)),
          previousPrincipalBalance: LoanEngine.toBig(currentBalance),
          paymentRecalculation: data.paymentRecalculation || 'KEEP_TERM',
          newTermMonths: data.newTermMonths,
        } as PrincipalReductionModification;

      case 'BALLOON_PAYMENT_ASSIGNMENT':
        return {
          ...baseModification,
          type: 'BALLOON_PAYMENT_ASSIGNMENT',
          balloonAmount: LoanEngine.toBig(data.balloonAmount || 0),
          balloonDueDate: LoanEngine.parseDate((data.balloonDueDate || new Date()).toISOString()),
          reamortization: {
            startFromTerm: data.customStartTerm || 1,
            startType: data.reamortizationStartType || 'CURRENT_TERM',
            customStartTerm: data.customStartTerm,
            recalculateFromStart: data.reamortizationStartType === 'BEGINNING',
          },
        } as BalloonPaymentAssignmentModification;

      case 'BALLOON_PAYMENT_REMOVAL':
        return {
          ...baseModification,
          type: 'BALLOON_PAYMENT_REMOVAL',
          removedBalloonAmount: LoanEngine.toBig(loan.balloonPayment || 0),
          removedBalloonDate: LoanEngine.parseDate((loan.balloonPaymentDate || new Date()).toISOString()),
          reamortizationType: (data.reamortizationType as any) || 'EXTEND_TERM',
          newTermMonths: data.newTermMonths,
          newPaymentAmount: data.newPaymentAmount ? LoanEngine.toBig(data.newPaymentAmount) : undefined,
        } as BalloonPaymentRemovalModification;

      // Add other modification types...
      default:
        return null;
    }
  };

  const onSubmit = async (data: FormData) => {
    setShowWarning(true);
  };

  const confirmModification = async () => {
    setIsSubmitting(true);
    try {
      const formData = watch();
      
      // Store modification in demo storage
      await demoLoanStorage.addModification({
        loanId: loan.id,
        type: formData.modificationType,
        date: new Date(),
        changes: {
          ...formData,
        },
        reason: formData.reason,
        approvedBy: 'Demo User',
      });

      toast.success('Loan modification submitted successfully');
      reset();
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Failed to submit modification');
    } finally {
      setIsSubmitting(false);
      setShowWarning(false);
    }
  };

  const renderTypeSpecificFields = () => {
    if (!selectedType) return null;

    switch (selectedType) {
      case 'RATE_CHANGE':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              New Interest Rate (%)
            </label>
            <input
              type="number"
              step="0.01"
              {...register('newRate', { valueAsNumber: true })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              placeholder="5.5"
            />
            <p className="mt-1 text-sm text-gray-500">
              Current rate: {loan.loanParameters.interestRate}%
            </p>
            {errors.newRate && (
              <p className="mt-1 text-sm text-red-600">{errors.newRate.message}</p>
            )}
          </div>
        );

      case 'TERM_EXTENSION':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Additional Months
              </label>
              <input
                type="number"
                {...register('additionalMonths', { valueAsNumber: true })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                placeholder="12"
              />
              {errors.additionalMonths && (
                <p className="mt-1 text-sm text-red-600">{errors.additionalMonths.message}</p>
              )}
            </div>
            <div className="flex items-start">
              <input
                type="checkbox"
                {...register('keepSamePayment')}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label className="ml-3 text-sm text-gray-700">
                Keep same payment amount (extend term only)
              </label>
            </div>
          </>
        );

      case 'PAYMENT_REDUCTION_TEMPORARY':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                New Payment Amount
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  {...register('newPaymentAmount', { valueAsNumber: true })}
                  className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  placeholder="800"
                />
              </div>
              {errors.newPaymentAmount && (
                <p className="mt-1 text-sm text-red-600">{errors.newPaymentAmount.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Number of Payment Terms
              </label>
              <input
                type="number"
                {...register('numberOfTerms', { valueAsNumber: true })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                placeholder="6"
              />
              <p className="mt-1 text-sm text-gray-500">
                Payments will automatically revert to original amount after this period
              </p>
              {errors.numberOfTerms && (
                <p className="mt-1 text-sm text-red-600">{errors.numberOfTerms.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Interest Handling
              </label>
              <select
                {...register('interestHandling')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              >
                <option value="CAPITALIZE">Capitalize unpaid interest</option>
                <option value="DEFER">Defer unpaid interest</option>
                <option value="WAIVE">Waive unpaid interest</option>
              </select>
              {errors.interestHandling && (
                <p className="mt-1 text-sm text-red-600">{errors.interestHandling.message}</p>
              )}
            </div>
          </>
        );

      case 'PAYMENT_REDUCTION_PERMANENT':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                New Payment Amount
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  {...register('newPaymentAmount', { valueAsNumber: true })}
                  className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  placeholder="1200"
                />
              </div>
              {errors.newPaymentAmount && (
                <p className="mt-1 text-sm text-red-600">{errors.newPaymentAmount.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Term Adjustment Strategy
              </label>
              <select
                {...register('termAdjustment')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              >
                <option value="EXTEND_TERM">Extend loan term</option>
                <option value="REDUCE_PRINCIPAL">Reduce principal balance</option>
                <option value="COMBINATION">Combination of both</option>
              </select>
              {errors.termAdjustment && (
                <p className="mt-1 text-sm text-red-600">{errors.termAdjustment.message}</p>
              )}
            </div>
            {(watchedValues.termAdjustment === 'EXTEND_TERM' || watchedValues.termAdjustment === 'COMBINATION') && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  New Term (Months)
                </label>
                <input
                  type="number"
                  {...register('newTermMonths', { valueAsNumber: true })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  placeholder="420"
                />
                {errors.newTermMonths && (
                  <p className="mt-1 text-sm text-red-600">{errors.newTermMonths.message}</p>
                )}
              </div>
            )}
            {(watchedValues.termAdjustment === 'REDUCE_PRINCIPAL' || watchedValues.termAdjustment === 'COMBINATION') && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Principal Reduction Amount
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    {...register('principalReduction', { valueAsNumber: true })}
                    className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    placeholder="25000"
                  />
                </div>
                {errors.principalReduction && (
                  <p className="mt-1 text-sm text-red-600">{errors.principalReduction.message}</p>
                )}
              </div>
            )}
          </>
        );

      case 'PRINCIPAL_REDUCTION':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Principal Reduction Amount
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  {...register('reductionAmount', { valueAsNumber: true })}
                  className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  placeholder="15000"
                />
              </div>
              {errors.reductionAmount && (
                <p className="mt-1 text-sm text-red-600">{errors.reductionAmount.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Payment Recalculation
              </label>
              <select
                {...register('paymentRecalculation')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              >
                <option value="KEEP_TERM">Keep same term, reduce payment</option>
                <option value="KEEP_PAYMENT">Keep same payment, reduce term</option>
                <option value="CUSTOM">Custom payment and term</option>
              </select>
              {errors.paymentRecalculation && (
                <p className="mt-1 text-sm text-red-600">{errors.paymentRecalculation.message}</p>
              )}
            </div>
          </>
        );

      case 'BALLOON_PAYMENT_ASSIGNMENT':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Balloon Payment Amount
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  {...register('balloonAmount', { valueAsNumber: true })}
                  className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  placeholder="75000"
                />
              </div>
              {errors.balloonAmount && (
                <p className="mt-1 text-sm text-red-600">{errors.balloonAmount.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Balloon Due Date
              </label>
              <Controller
                control={control}
                name="balloonDueDate"
                render={({ field }) => (
                  <DatePicker
                    selected={field.value}
                    onChange={field.onChange}
                    dateFormat="MM/dd/yyyy"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    placeholderText="Select balloon due date"
                    showMonthDropdown
                    showYearDropdown
                    dropdownMode="select"
                    minDate={new Date()}
                  />
                )}
              />
              {errors.balloonDueDate && (
                <p className="mt-1 text-sm text-red-600">{errors.balloonDueDate.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                EMI Reamortization Start Point
              </label>
              <select
                {...register('reamortizationStartType')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              >
                <option value="CURRENT_TERM">Current payment term (default)</option>
                <option value="NEXT_TERM">Next payment term</option>
                <option value="BEGINNING">From loan beginning</option>
                <option value="CUSTOM">Custom term number</option>
              </select>
              <p className="mt-1 text-sm text-gray-500">
                Choose when to start reamortizing payments with the balloon
              </p>
              {errors.reamortizationStartType && (
                <p className="mt-1 text-sm text-red-600">{errors.reamortizationStartType.message}</p>
              )}
            </div>
            {watchedValues.reamortizationStartType === 'CUSTOM' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Custom Start Term Number
                </label>
                <input
                  type="number"
                  {...register('customStartTerm', { valueAsNumber: true })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  placeholder="15"
                  min="1"
                />
                {errors.customStartTerm && (
                  <p className="mt-1 text-sm text-red-600">{errors.customStartTerm.message}</p>
                )}
              </div>
            )}
          </>
        );

      case 'BALLOON_PAYMENT_REMOVAL':
        return (
          <>
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
              <p className="text-sm text-yellow-800">
                <strong>Current Balloon:</strong> {formatCurrency(loan.balloonPayment || 0)} 
                {loan.balloonPaymentDate && ` due ${new Date(loan.balloonPaymentDate).toLocaleDateString()}`}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Reamortization Strategy
              </label>
              <select
                {...register('reamortizationType')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              >
                <option value="EXTEND_TERM">Extend term to reduce payment</option>
                <option value="INCREASE_PAYMENT">Increase payment, keep term</option>
                <option value="CUSTOM">Custom payment and term</option>
              </select>
              {errors.reamortizationType && (
                <p className="mt-1 text-sm text-red-600">{errors.reamortizationType.message}</p>
              )}
            </div>
            {watchedValues.reamortizationType === 'EXTEND_TERM' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  New Term (Months)
                </label>
                <input
                  type="number"
                  {...register('newTermMonths', { valueAsNumber: true })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  placeholder="420"
                />
                {errors.newTermMonths && (
                  <p className="mt-1 text-sm text-red-600">{errors.newTermMonths.message}</p>
                )}
              </div>
            )}
            {(watchedValues.reamortizationType === 'INCREASE_PAYMENT' || watchedValues.reamortizationType === 'CUSTOM') && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  New Payment Amount
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    {...register('newPaymentAmount', { valueAsNumber: true })}
                    className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    placeholder="1800"
                  />
                </div>
                {errors.newPaymentAmount && (
                  <p className="mt-1 text-sm text-red-600">{errors.newPaymentAmount.message}</p>
                )}
              </div>
            )}
          </>
        );

      // Add more cases for other modification types...
      default:
        return (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <p className="text-sm text-blue-800">
              <InformationCircleIcon className="h-4 w-4 inline mr-1" />
              Additional configuration options for {MODIFICATION_TYPES[selectedType]?.label} will be available in the next update.
            </p>
          </div>
        );
    }
  };

  const renderModificationImpact = () => {
    if (!modificationImpact) return null;

    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
        <h4 className="text-md font-medium text-blue-900 flex items-center">
          <CheckCircleIcon className="h-5 w-5 mr-2" />
          Modification Impact Preview
        </h4>
        
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="bg-white rounded p-3 border">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Payment Change</div>
            <div className="flex items-center mt-1">
              <span className="text-lg font-semibold text-gray-900">
                {formatCurrency(modificationImpact.originalPayment.toNumber())}
              </span>
              <ArrowRightIcon className="h-4 w-4 mx-2 text-gray-400" />
              <span className="text-lg font-semibold text-blue-600">
                {formatCurrency(modificationImpact.newPayment.toNumber())}
              </span>
            </div>
            <div className={`text-sm mt-1 ${
              modificationImpact.monthlyPaymentChangeAmount.lt(0) ? 'text-green-600' : 'text-red-600'
            }`}>
              {modificationImpact.monthlyPaymentChangeAmount.lt(0) ? 'Saves' : 'Increases'} {' '}
              {formatCurrency(Math.abs(modificationImpact.monthlyPaymentChangeAmount.toNumber()))} per month
            </div>
          </div>

          <div className="bg-white rounded p-3 border">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Term Change</div>
            <div className="flex items-center mt-1">
              <span className="text-lg font-semibold text-gray-900">
                {modificationImpact.originalTermMonths} months
              </span>
              <ArrowRightIcon className="h-4 w-4 mx-2 text-gray-400" />
              <span className="text-lg font-semibold text-blue-600">
                {modificationImpact.newTermMonths} months
              </span>
            </div>
            <div className={`text-sm mt-1 ${
              modificationImpact.newTermMonths > modificationImpact.originalTermMonths ? 'text-red-600' : 'text-green-600'
            }`}>
              {modificationImpact.newTermMonths > modificationImpact.originalTermMonths ? '+' : ''}
              {modificationImpact.newTermMonths - modificationImpact.originalTermMonths} months
            </div>
          </div>

          <div className="bg-white rounded p-3 border">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Total Interest</div>
            <div className="flex items-center mt-1">
              <span className="text-lg font-semibold text-gray-900">
                {formatCurrency(modificationImpact.originalTotalInterest.toNumber())}
              </span>
              <ArrowRightIcon className="h-4 w-4 mx-2 text-gray-400" />
              <span className="text-lg font-semibold text-blue-600">
                {formatCurrency(modificationImpact.newTotalInterest.toNumber())}
              </span>
            </div>
            <div className={`text-sm mt-1 ${
              modificationImpact.totalInterestChangeAmount.lt(0) ? 'text-green-600' : 'text-red-600'
            }`}>
              {modificationImpact.totalInterestChangeAmount.lt(0) ? 'Saves' : 'Costs'} {' '}
              {formatCurrency(Math.abs(modificationImpact.totalInterestChangeAmount.toNumber()))} total
            </div>
          </div>

          <div className="bg-white rounded p-3 border">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Effective Date</div>
            <div className="text-lg font-semibold text-blue-600 mt-1">
              {modificationImpact.effectiveDate.format('MMM DD, YYYY')}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Next payment: {modificationImpact.nextPaymentDate.format('MMM DD, YYYY')}
            </div>
          </div>
        </div>

        {modificationImpact.scheduleImpact.balloonPaymentAdded && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
            <div className="text-sm text-yellow-800">
              <strong>Balloon Payment Added:</strong> {formatCurrency(modificationImpact.scheduleImpact.balloonAmountChanged.toNumber())}
            </div>
          </div>
        )}
        
        {modificationImpact.scheduleImpact.balloonPaymentRemoved && (
          <div className="bg-green-50 border border-green-200 rounded p-3">
            <div className="text-sm text-green-800">
              <strong>Balloon Payment Removed:</strong> {formatCurrency(Math.abs(modificationImpact.scheduleImpact.balloonAmountChanged.toNumber()))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderValidationErrors = () => {
    if (validationErrors.length === 0) return null;

    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Validation Errors</h3>
            <div className="mt-2 text-sm text-red-700">
              <ul className="list-disc list-inside space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Group modification types by category for better organization
  const groupedTypes = Object.entries(MODIFICATION_TYPES).reduce((acc, [key, value]) => {
    if (!acc[value.category]) {
      acc[value.category] = [];
    }
    acc[value.category].push({ key: key as ModificationType, ...value });
    return acc;
  }, {} as Record<string, Array<{ key: ModificationType; label: string; description: string; category: string }>>);

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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl">
                <form onSubmit={handleSubmit(onSubmit)}>
                  <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                    <div className="flex items-center justify-between mb-5">
                      <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900">
                        Comprehensive Loan Modification - {loan.id}
                      </Dialog.Title>
                      <button
                        type="button"
                        className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                        onClick={onClose}
                      >
                        <XMarkIcon className="h-6 w-6" />
                      </button>
                    </div>

                    <div className="space-y-6">
                      {/* Modification Type Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          Modification Type
                        </label>
                        <div className="space-y-4">
                          {Object.entries(groupedTypes).map(([category, types]) => (
                            <div key={category}>
                              <h4 className="text-sm font-medium text-gray-500 mb-2">{category}</h4>
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {types.map((type) => (
                                  <label
                                    key={type.key}
                                    className={`relative flex cursor-pointer rounded-lg border p-4 focus:outline-none ${
                                      selectedType === type.key
                                        ? 'border-primary-600 bg-primary-50'
                                        : 'border-gray-300 bg-white hover:bg-gray-50'
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      value={type.key}
                                      {...register('modificationType')}
                                      className="sr-only"
                                    />
                                    <div className="flex w-full items-start">
                                      <div className="flex-1">
                                        <div className="font-medium text-gray-900">
                                          {type.label}
                                        </div>
                                        <div className="text-sm text-gray-500 mt-1">
                                          {type.description}
                                        </div>
                                      </div>
                                      {selectedType === type.key && (
                                        <CheckCircleIcon className="h-5 w-5 text-primary-600" />
                                      )}
                                    </div>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                        {errors.modificationType && (
                          <p className="mt-2 text-sm text-red-600">{errors.modificationType.message}</p>
                        )}
                      </div>

                      {/* Type-specific fields */}
                      {selectedType && (
                        <div className="space-y-4">
                          <h4 className="text-md font-medium text-gray-900 border-t pt-4">
                            {MODIFICATION_TYPES[selectedType]?.label} Configuration
                          </h4>
                          {renderTypeSpecificFields()}
                        </div>
                      )}

                      {/* Validation Errors */}
                      {renderValidationErrors()}

                      {/* Modification Impact */}
                      {renderModificationImpact()}

                      {/* Common Fields */}
                      <div className="border-t pt-4 space-y-4">
                        <h4 className="text-md font-medium text-gray-900">General Information</h4>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Reason for Modification
                          </label>
                          <textarea
                            {...register('reason')}
                            rows={3}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                            placeholder="Explain why this modification is needed..."
                          />
                          {errors.reason && (
                            <p className="mt-1 text-sm text-red-600">{errors.reason.message}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Effective Date
                          </label>
                          <Controller
                            control={control}
                            name="effectiveDate"
                            render={({ field }) => (
                              <DatePicker
                                selected={field.value}
                                onChange={field.onChange}
                                dateFormat="MM/dd/yyyy"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                                placeholderText="Select effective date"
                                showMonthDropdown
                                showYearDropdown
                                dropdownMode="select"
                                minDate={new Date()}
                              />
                            )}
                          />
                          {errors.effectiveDate && (
                            <p className="mt-1 text-sm text-red-600">{errors.effectiveDate.message}</p>
                          )}
                        </div>

                        {/* Compliance Checkboxes */}
                        <div className="space-y-3">
                          <div className="flex items-start">
                            <input
                              type="checkbox"
                              {...register('customerConsent')}
                              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <label className="ml-3 text-sm text-gray-700">
                              Customer has provided written consent for this modification
                            </label>
                          </div>
                          {errors.customerConsent && (
                            <p className="text-sm text-red-600">{errors.customerConsent.message}</p>
                          )}

                          <div className="flex items-start">
                            <input
                              type="checkbox"
                              {...register('complianceReview')}
                              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <label className="ml-3 text-sm text-gray-700">
                              This modification has been reviewed for regulatory compliance
                            </label>
                          </div>
                          {errors.complianceReview && (
                            <p className="text-sm text-red-600">{errors.complianceReview.message}</p>
                          )}
                        </div>
                      </div>

                      {/* Enhanced Warning Box */}
                      <div className="rounded-md bg-yellow-50 p-4">
                        <div className="flex">
                          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-yellow-800">Important Notice</h3>
                            <div className="mt-2 text-sm text-yellow-700">
                              <p>
                                Loan modifications may affect the borrower's credit score and future
                                borrowing ability. Ensure all regulatory requirements are met and
                                proper documentation is collected before proceeding.
                              </p>
                              {selectedType === 'BALLOON_PAYMENT_ASSIGNMENT' && (
                                <p className="mt-2">
                                  <strong>Balloon Payment Notice:</strong> Adding a balloon payment will reduce monthly payments but requires a large final payment. Ensure borrower understands the payment schedule change.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                    <button
                      type="submit"
                      disabled={isSubmitting || validationErrors.length > 0}
                      className="inline-flex w-full justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Processing...' : 'Submit Modification'}
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                    >
                      Cancel
                    </button>
                  </div>
                </form>

                {/* Enhanced Confirmation Dialog */}
                {showWarning && (
                  <div className="absolute inset-0 bg-white rounded-lg flex items-center justify-center">
                    <div className="text-center px-6 max-w-md">
                      <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-yellow-400" />
                      <h3 className="mt-2 text-lg font-medium text-gray-900">Confirm Modification</h3>
                      <p className="mt-2 text-sm text-gray-500">
                        Are you sure you want to proceed with this{' '}
                        <strong>{MODIFICATION_TYPES[selectedType]?.label}</strong>? This action
                        will permanently modify the loan terms and create an audit record.
                      </p>
                      {modificationImpact && (
                        <div className="mt-4 bg-gray-50 rounded-lg p-3">
                          <div className="text-sm text-gray-700">
                            <div>Payment: {formatCurrency(modificationImpact.originalPayment.toNumber())} → {formatCurrency(modificationImpact.newPayment.toNumber())}</div>
                            <div>Term: {modificationImpact.originalTermMonths} → {modificationImpact.newTermMonths} months</div>
                          </div>
                        </div>
                      )}
                      <div className="mt-6 flex justify-center space-x-3">
                        <button
                          onClick={confirmModification}
                          disabled={isSubmitting}
                          className="inline-flex justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 disabled:opacity-50"
                        >
                          {isSubmitting ? 'Processing...' : 'Yes, Proceed'}
                        </button>
                        <button
                          onClick={() => setShowWarning(false)}
                          className="inline-flex justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                        >
                          Cancel
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