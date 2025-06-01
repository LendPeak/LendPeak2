import { useState, useRef, useCallback } from 'react';
import {
  DocumentArrowUpIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  PlayIcon,
  PauseIcon,
  ArrowPathIcon,
  CloudArrowDownIcon,
  ClockIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  ChartBarIcon,
  EyeIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';

interface BulkPaymentRecord {
  id: string;
  loanNumber: string;
  paymentAmount: number;
  paymentDate: string;
  paymentMethod: 'ACH' | 'WIRE' | 'CHECK' | 'CARD';
  accountNumber?: string;
  routingNumber?: string;
  customerReference?: string;
  status: 'PENDING' | 'VALIDATING' | 'VALIDATED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REJECTED';
  validationErrors: string[];
  processingResult?: {
    transactionId?: string;
    appliedAmount?: number;
    principalApplied?: number;
    interestApplied?: number;
    feesApplied?: number;
    remainingBalance?: number;
  };
}

interface BulkPaymentBatch {
  id: string;
  fileName: string;
  uploadDate: Date;
  recordCount: number;
  totalAmount: number;
  status: 'UPLOADED' | 'VALIDATING' | 'VALIDATED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  validRecords: number;
  invalidRecords: number;
  processedRecords: number;
  records: BulkPaymentRecord[];
  validationSummary: {
    duplicateLoans: number;
    invalidAmounts: number;
    invalidDates: number;
    invalidPaymentMethods: number;
    missingRequiredFields: number;
    loanNotFound: number;
  };
  processingStats?: {
    successfulPayments: number;
    failedPayments: number;
    totalAmountProcessed: number;
    avgProcessingTime: number;
  };
}

interface BulkPaymentProcessorProps {
  onBatchComplete?: (batch: BulkPaymentBatch) => void;
}

export const BulkPaymentProcessor = ({ onBatchComplete }: BulkPaymentProcessorProps) => {
  const [currentBatch, setCurrentBatch] = useState<BulkPaymentBatch | null>(null);
  const [batches, setBatches] = useState<BulkPaymentBatch[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'ALL' | 'VALID' | 'INVALID' | 'PROCESSING'>('ALL');
  const [showUploader, setShowUploader] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Simulate file parsing and validation
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const lines = content.split('\n').filter(line => line.trim());
        const records = parseCSVContent(lines, file.name);
        
        const batch: BulkPaymentBatch = {
          id: `batch-${Date.now()}`,
          fileName: file.name,
          uploadDate: new Date(),
          recordCount: records.length,
          totalAmount: records.reduce((sum, r) => sum + r.paymentAmount, 0),
          status: 'UPLOADED',
          validRecords: 0,
          invalidRecords: 0,
          processedRecords: 0,
          records,
          validationSummary: {
            duplicateLoans: 0,
            invalidAmounts: 0,
            invalidDates: 0,
            invalidPaymentMethods: 0,
            missingRequiredFields: 0,
            loanNotFound: 0,
          },
        };

        setCurrentBatch(batch);
        setBatches(prev => [batch, ...prev]);
        setShowUploader(false);
        
        // Start validation
        validateBatch(batch);
      } catch (error) {
        alert('Error parsing file. Please ensure it\'s a valid CSV format.');
      }
    };
    
    reader.readAsText(file);
    event.target.value = '';
  }, []);

  const parseCSVContent = (lines: string[], fileName: string): BulkPaymentRecord[] => {
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    const records: BulkPaymentRecord[] = [];
    
    const requiredFields = ['loan_number', 'payment_amount', 'payment_date', 'payment_method'];
    const missingHeaders = requiredFields.filter(field => 
      !headers.some(h => h.includes(field.replace('_', '')))
    );
    
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
    }

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      
      if (values.length < headers.length) continue;
      
      const record: BulkPaymentRecord = {
        id: `record-${i}`,
        loanNumber: values[headers.indexOf('loan_number')] || values[headers.indexOf('loannumber')] || '',
        paymentAmount: parseFloat(values[headers.indexOf('payment_amount')] || values[headers.indexOf('paymentamount')] || '0'),
        paymentDate: values[headers.indexOf('payment_date')] || values[headers.indexOf('paymentdate')] || '',
        paymentMethod: (values[headers.indexOf('payment_method')] || values[headers.indexOf('paymentmethod')] || 'ACH').toUpperCase() as any,
        accountNumber: values[headers.indexOf('account_number')] || values[headers.indexOf('accountnumber')] || '',
        routingNumber: values[headers.indexOf('routing_number')] || values[headers.indexOf('routingnumber')] || '',
        customerReference: values[headers.indexOf('customer_reference')] || values[headers.indexOf('customerreference')] || '',
        status: 'PENDING',
        validationErrors: [],
      };
      
      records.push(record);
    }
    
    return records;
  };

  const validateBatch = async (batch: BulkPaymentBatch) => {
    setBatches(prev => prev.map(b => 
      b.id === batch.id ? { ...b, status: 'VALIDATING' } : b
    ));

    // Simulate validation process
    const validatedRecords = batch.records.map(record => {
      const errors: string[] = [];
      
      // Validate loan number
      if (!record.loanNumber || record.loanNumber.length < 5) {
        errors.push('Invalid loan number');
      }
      
      // Validate payment amount
      if (!record.paymentAmount || record.paymentAmount <= 0 || record.paymentAmount > 1000000) {
        errors.push('Invalid payment amount');
      }
      
      // Validate payment date
      const paymentDate = new Date(record.paymentDate);
      if (isNaN(paymentDate.getTime()) || paymentDate > new Date()) {
        errors.push('Invalid payment date');
      }
      
      // Validate payment method
      if (!['ACH', 'WIRE', 'CHECK', 'CARD'].includes(record.paymentMethod)) {
        errors.push('Invalid payment method');
      }
      
      // Validate account details for ACH/WIRE
      if (['ACH', 'WIRE'].includes(record.paymentMethod)) {
        if (!record.accountNumber || record.accountNumber.length < 4) {
          errors.push('Account number required for ACH/WIRE');
        }
        if (!record.routingNumber || record.routingNumber.length !== 9) {
          errors.push('Valid routing number required for ACH/WIRE');
        }
      }
      
      // Simulate loan lookup validation (random failures)
      if (Math.random() < 0.1) {
        errors.push('Loan not found in system');
      }
      
      return {
        ...record,
        validationErrors: errors,
        status: errors.length > 0 ? 'REJECTED' : 'VALIDATED' as any,
      };
    });

    const validationSummary = {
      duplicateLoans: findDuplicateLoans(validatedRecords).length,
      invalidAmounts: validatedRecords.filter(r => r.validationErrors.some(e => e.includes('amount'))).length,
      invalidDates: validatedRecords.filter(r => r.validationErrors.some(e => e.includes('date'))).length,
      invalidPaymentMethods: validatedRecords.filter(r => r.validationErrors.some(e => e.includes('method'))).length,
      missingRequiredFields: validatedRecords.filter(r => r.validationErrors.some(e => e.includes('required'))).length,
      loanNotFound: validatedRecords.filter(r => r.validationErrors.some(e => e.includes('not found'))).length,
    };

    const validRecords = validatedRecords.filter(r => r.status === 'VALIDATED').length;
    const invalidRecords = validatedRecords.length - validRecords;

    const updatedBatch = {
      ...batch,
      records: validatedRecords,
      status: 'VALIDATED' as const,
      validRecords,
      invalidRecords,
      validationSummary,
    };

    setBatches(prev => prev.map(b => 
      b.id === batch.id ? updatedBatch : b
    ));
    setCurrentBatch(updatedBatch);
  };

  const findDuplicateLoans = (records: BulkPaymentRecord[]): string[] => {
    const loanCounts = new Map<string, number>();
    records.forEach(r => {
      loanCounts.set(r.loanNumber, (loanCounts.get(r.loanNumber) || 0) + 1);
    });
    
    return Array.from(loanCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([loan]) => loan);
  };

  const startProcessing = async () => {
    if (!currentBatch || currentBatch.validRecords === 0) return;
    
    setIsProcessing(true);
    setIsPaused(false);
    
    const validRecords = currentBatch.records.filter(r => r.status === 'VALIDATED');
    let processedCount = 0;
    let successCount = 0;
    let totalProcessed = 0;
    const startTime = Date.now();

    for (const record of validRecords) {
      if (isPaused) break;
      
      // Update record status
      setBatches(prev => prev.map(batch => 
        batch.id === currentBatch.id ? {
          ...batch,
          records: batch.records.map(r => 
            r.id === record.id ? { ...r, status: 'PROCESSING' } : r
          )
        } : batch
      ));

      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
      
      const isSuccess = Math.random() > 0.05; // 95% success rate
      const processingResult = isSuccess ? {
        transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        appliedAmount: record.paymentAmount,
        principalApplied: record.paymentAmount * 0.7,
        interestApplied: record.paymentAmount * 0.25,
        feesApplied: record.paymentAmount * 0.05,
        remainingBalance: Math.max(0, 250000 - (record.paymentAmount * 0.7)),
      } : undefined;

      setBatches(prev => prev.map(batch => 
        batch.id === currentBatch.id ? {
          ...batch,
          records: batch.records.map(r => 
            r.id === record.id ? { 
              ...r, 
              status: isSuccess ? 'COMPLETED' : 'FAILED',
              processingResult,
              validationErrors: isSuccess ? [] : [...r.validationErrors, 'Payment processing failed']
            } : r
          ),
          processedRecords: ++processedCount,
        } : batch
      ));

      if (isSuccess) {
        successCount++;
        totalProcessed += record.paymentAmount;
      }
    }

    const endTime = Date.now();
    const processingStats = {
      successfulPayments: successCount,
      failedPayments: processedCount - successCount,
      totalAmountProcessed: totalProcessed,
      avgProcessingTime: (endTime - startTime) / processedCount,
    };

    const finalBatch = {
      ...currentBatch,
      status: 'COMPLETED' as const,
      processingStats,
    };

    setBatches(prev => prev.map(b => 
      b.id === currentBatch.id ? finalBatch : b
    ));
    setCurrentBatch(finalBatch);
    setIsProcessing(false);

    if (onBatchComplete) {
      onBatchComplete(finalBatch);
    }
  };

  const toggleRecordSelection = (recordId: string) => {
    setSelectedRecords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(recordId)) {
        newSet.delete(recordId);
      } else {
        newSet.add(recordId);
      }
      return newSet;
    });
  };

  const selectAllVisible = () => {
    const visibleRecords = getFilteredRecords();
    const allSelected = visibleRecords.every(r => selectedRecords.has(r.id));
    
    if (allSelected) {
      setSelectedRecords(new Set());
    } else {
      setSelectedRecords(new Set(visibleRecords.map(r => r.id)));
    }
  };

  const getFilteredRecords = () => {
    if (!currentBatch) return [];
    
    switch (viewMode) {
      case 'VALID':
        return currentBatch.records.filter(r => r.status === 'VALIDATED' || r.status === 'COMPLETED');
      case 'INVALID':
        return currentBatch.records.filter(r => r.status === 'REJECTED' || r.status === 'FAILED');
      case 'PROCESSING':
        return currentBatch.records.filter(r => ['PROCESSING', 'VALIDATING'].includes(r.status));
      default:
        return currentBatch.records;
    }
  };

  const exportResults = (format: 'CSV' | 'EXCEL') => {
    if (!currentBatch) return;
    
    console.log(`Exporting ${format} results for batch:`, currentBatch);
    alert(`${format} export would be generated with processing results`);
  };

  const downloadTemplate = () => {
    const template = `loan_number,payment_amount,payment_date,payment_method,account_number,routing_number,customer_reference
LN123456,1500.00,2024-03-15,ACH,1234567890,021000021,REF001
LN789012,2500.00,2024-03-15,WIRE,9876543210,031000503,REF002`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk_payment_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const getStatusIcon = (status: BulkPaymentRecord['status']) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'FAILED':
      case 'REJECTED':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'PROCESSING':
      case 'VALIDATING':
        return <ClockIcon className="h-5 w-5 text-yellow-500 animate-spin" />;
      case 'VALIDATED':
        return <CheckCircleIcon className="h-5 w-5 text-blue-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: BulkPaymentRecord['status']) => {
    switch (status) {
      case 'COMPLETED':
        return 'text-green-600 bg-green-50';
      case 'FAILED':
      case 'REJECTED':
        return 'text-red-600 bg-red-50';
      case 'PROCESSING':
      case 'VALIDATING':
        return 'text-yellow-600 bg-yellow-50';
      case 'VALIDATED':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Bulk Payment Processing</h2>
          <p className="mt-1 text-sm text-gray-600">
            Upload and process payments in bulk with validation and monitoring
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={downloadTemplate}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <CloudArrowDownIcon className="h-4 w-4 mr-2" />
            Download Template
          </button>
          <button
            onClick={() => setShowUploader(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <DocumentArrowUpIcon className="h-4 w-4 mr-2" />
            New Batch
          </button>
        </div>
      </div>

      {/* File Upload Section */}
      {showUploader && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Upload Payment File</h3>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
            <div className="text-center">
              <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
              <div className="mt-4">
                <label htmlFor="file-upload" className="cursor-pointer">
                  <span className="mt-2 block text-sm font-medium text-gray-900">
                    Upload CSV file with payment data
                  </span>
                  <input
                    id="file-upload"
                    ref={fileInputRef}
                    type="file"
                    className="sr-only"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                  />
                  <span className="mt-1 block text-sm text-gray-600">
                    CSV files up to 10MB. Click to browse or drag and drop.
                  </span>
                </label>
              </div>
            </div>
          </div>
          
          <div className="mt-4 text-sm text-gray-600">
            <p className="font-medium mb-2">Required columns:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>loan_number - Unique identifier for the loan</li>
              <li>payment_amount - Payment amount in dollars</li>
              <li>payment_date - Payment date (YYYY-MM-DD format)</li>
              <li>payment_method - ACH, WIRE, CHECK, or CARD</li>
              <li>account_number - Required for ACH/WIRE payments</li>
              <li>routing_number - Required for ACH/WIRE payments</li>
              <li>customer_reference - Optional reference number</li>
            </ul>
          </div>
        </div>
      )}

      {/* Current Batch Summary */}
      {currentBatch && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Current Batch: {currentBatch.fileName}
            </h3>
            <div className="flex items-center space-x-2">
              {currentBatch.status === 'VALIDATED' && currentBatch.validRecords > 0 && !isProcessing && (
                <button
                  onClick={startProcessing}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                >
                  <PlayIcon className="h-4 w-4 mr-2" />
                  Start Processing
                </button>
              )}
              {isProcessing && (
                <button
                  onClick={() => setIsPaused(!isPaused)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  {isPaused ? <PlayIcon className="h-4 w-4 mr-2" /> : <PauseIcon className="h-4 w-4 mr-2" />}
                  {isPaused ? 'Resume' : 'Pause'}
                </button>
              )}
              <button
                onClick={() => exportResults('EXCEL')}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <DocumentTextIcon className="h-4 w-4 mr-2" />
                Export Results
              </button>
            </div>
          </div>

          {/* Batch Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center">
                <DocumentTextIcon className="h-6 w-6 text-gray-600 mr-2" />
                <div>
                  <div className="text-lg font-semibold text-gray-900">{currentBatch.recordCount}</div>
                  <div className="text-sm text-gray-600">Total Records</div>
                </div>
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center">
                <CheckCircleIcon className="h-6 w-6 text-green-600 mr-2" />
                <div>
                  <div className="text-lg font-semibold text-green-900">{currentBatch.validRecords}</div>
                  <div className="text-sm text-green-600">Valid Records</div>
                </div>
              </div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="flex items-center">
                <XCircleIcon className="h-6 w-6 text-red-600 mr-2" />
                <div>
                  <div className="text-lg font-semibold text-red-900">{currentBatch.invalidRecords}</div>
                  <div className="text-sm text-red-600">Invalid Records</div>
                </div>
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center">
                <CurrencyDollarIcon className="h-6 w-6 text-blue-600 mr-2" />
                <div>
                  <div className="text-lg font-semibold text-blue-900">{formatCurrency(currentBatch.totalAmount)}</div>
                  <div className="text-sm text-blue-600">Total Amount</div>
                </div>
              </div>
            </div>
          </div>

          {/* Processing Progress */}
          {(isProcessing || currentBatch.status === 'COMPLETED') && (
            <div className="mb-6">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Processing Progress</span>
                <span>{currentBatch.processedRecords} / {currentBatch.validRecords}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ 
                    width: `${currentBatch.validRecords > 0 ? (currentBatch.processedRecords / currentBatch.validRecords) * 100 : 0}%` 
                  }}
                />
              </div>
              {currentBatch.processingStats && (
                <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Success Rate: </span>
                    <span className="font-medium text-green-600">
                      {((currentBatch.processingStats.successfulPayments / currentBatch.processedRecords) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Amount Processed: </span>
                    <span className="font-medium">{formatCurrency(currentBatch.processingStats.totalAmountProcessed)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Avg Time: </span>
                    <span className="font-medium">{currentBatch.processingStats.avgProcessingTime.toFixed(0)}ms</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Failed: </span>
                    <span className="font-medium text-red-600">{currentBatch.processingStats.failedPayments}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Validation Summary */}
          {currentBatch.status !== 'UPLOADED' && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Validation Summary</h4>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Duplicate Loans:</span>
                  <span className="font-medium">{currentBatch.validationSummary.duplicateLoans}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Invalid Amounts:</span>
                  <span className="font-medium">{currentBatch.validationSummary.invalidAmounts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Invalid Dates:</span>
                  <span className="font-medium">{currentBatch.validationSummary.invalidDates}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Invalid Methods:</span>
                  <span className="font-medium">{currentBatch.validationSummary.invalidPaymentMethods}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Missing Fields:</span>
                  <span className="font-medium">{currentBatch.validationSummary.missingRequiredFields}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Loan Not Found:</span>
                  <span className="font-medium">{currentBatch.validationSummary.loanNotFound}</span>
                </div>
              </div>
            </div>
          )}

          {/* View Filter */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex space-x-1">
              {(['ALL', 'VALID', 'INVALID', 'PROCESSING'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-2 text-sm font-medium rounded-md ${
                    viewMode === mode
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={selectAllVisible}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {getFilteredRecords().every(r => selectedRecords.has(r.id)) ? 'Deselect All' : 'Select All'}
              </button>
              <span className="text-sm text-gray-500">
                {selectedRecords.size} selected
              </span>
            </div>
          </div>

          {/* Records Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={getFilteredRecords().length > 0 && getFilteredRecords().every(r => selectedRecords.has(r.id))}
                      onChange={selectAllVisible}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Loan Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Errors/Results
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getFilteredRecords().map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedRecords.has(record.id)}
                        onChange={() => toggleRecordSelection(record.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(record.status)}
                        <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(record.status)}`}>
                          {record.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {record.loanNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(record.paymentAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.paymentDate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.paymentMethod}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {record.validationErrors.length > 0 ? (
                        <div className="space-y-1">
                          {record.validationErrors.map((error, index) => (
                            <div key={index} className="text-red-600 text-xs">
                              {error}
                            </div>
                          ))}
                        </div>
                      ) : record.processingResult ? (
                        <div className="text-xs space-y-1">
                          <div>TXN: {record.processingResult.transactionId?.substring(0, 12)}...</div>
                          <div>Applied: {formatCurrency(record.processingResult.appliedAmount || 0)}</div>
                        </div>
                      ) : (
                        <span className="text-green-600 text-xs">Valid</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button className="text-blue-600 hover:text-blue-900">
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        {record.status === 'REJECTED' && (
                          <button className="text-red-600 hover:text-red-900">
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Batch History */}
      {batches.length > 1 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Batches</h3>
          <div className="space-y-3">
            {batches.slice(1, 6).map((batch) => (
              <div key={batch.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-3">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{batch.fileName}</div>
                    <div className="text-xs text-gray-500">
                      {format(batch.uploadDate, 'MMM dd, yyyy HH:mm')} • {batch.recordCount} records
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right text-sm">
                    <div className="font-medium">{formatCurrency(batch.totalAmount)}</div>
                    <div className="text-xs text-gray-500">
                      {batch.validRecords} valid, {batch.invalidRecords} invalid
                    </div>
                  </div>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    batch.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                    batch.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {batch.status}
                  </span>
                  <button
                    onClick={() => setCurrentBatch(batch)}
                    className="text-blue-600 hover:text-blue-900 text-sm"
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};