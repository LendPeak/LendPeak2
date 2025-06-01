import { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  CalculatorIcon,
  BanknotesIcon,
  ClockIcon,
  PrinterIcon,
  ArrowDownTrayIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { LoanEngine } from '@lendpeak/engine';
import { format } from 'date-fns';
import DatePicker from 'react-datepicker';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { demoLoanStorage } from '../../services/demoLoanStorage';

interface LoanClosureManagerProps {
  loan: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ClosureCalculation {
  principalBalance: number;
  accruedInterest: number;
  lateFees: number;
  prepaymentPenalty: number;
  totalPayoffAmount: number;
  goodThroughDate: Date;
  perDiemRate: number;
}

export const LoanClosureManager = ({ loan, isOpen, onClose, onSuccess }: LoanClosureManagerProps) => {
  const [payoffDate, setPayoffDate] = useState(new Date());
  const [closureType, setClosureType] = useState<'FULL_PAYOFF' | 'REFINANCE' | 'SALE' | 'DEFAULT'>('FULL_PAYOFF');
  const [paymentMethod, setPaymentMethod] = useState<'WIRE' | 'CHECK' | 'ACH' | 'CASH'>('WIRE');
  const [reason, setReason] = useState('');
  const [isCalculating, setIsCalculating] = useState(false);
  const [payoffCalculation, setPayoffCalculation] = useState<ClosureCalculation | null>(null);
  const [includePayoffStatement, setIncludePayoffStatement] = useState(true);
  const [includeClosureNotice, setIncludeClosureNotice] = useState(true);
  const [includeDischargeDocuments, setIncludeDischargeDocuments] = useState(true);

  // Calculate payoff amount when date changes
  useEffect(() => {
    if (payoffDate) {
      calculatePayoffAmount();
    }
  }, [payoffDate, loan]);

  const calculatePayoffAmount = async () => {
    setIsCalculating(true);
    try {
      // Use LoanEngine for accurate payoff calculation
      const loanTerms = LoanEngine.createLoan(
        loan.loanParameters.principal,
        loan.loanParameters.interestRate,
        loan.loanParameters.termMonths,
        loan.loanParameters.startDate,
        { paymentFrequency: 'monthly', interestType: 'amortized' }
      );
      
      // Demo: 15% paid off - calculate current balance
      const paymentAmount = LoanEngine.calculatePayment(loanTerms);
      const currentBalance = loan.loanParameters.principal * 0.85;
      
      // Calculate daily interest rate and per diem
      const dailyInterestRate = (loan.loanParameters.interestRate / 100) / 365;
      const daysSinceLastPayment = Math.floor((payoffDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      
      // Calculate accrued interest since last payment
      const accruedInterest = Math.max(0, currentBalance * dailyInterestRate * Math.max(0, daysSinceLastPayment));
      
      // Demo late fees and prepayment penalties
      const lateFees = 0; // Demo: no late fees
      const prepaymentPenalty = closureType === 'REFINANCE' ? currentBalance * 0.01 : 0; // 1% penalty for refinance
      
      const calculation: ClosureCalculation = {
        principalBalance: currentBalance,
        accruedInterest,
        lateFees,
        prepaymentPenalty,
        totalPayoffAmount: currentBalance + accruedInterest + lateFees + prepaymentPenalty,
        goodThroughDate: new Date(payoffDate.getTime() + 10 * 24 * 60 * 60 * 1000), // 10 days good through
        perDiemRate: currentBalance * dailyInterestRate,
      };

      setPayoffCalculation(calculation);
    } catch (error) {
      console.error('Error calculating payoff:', error);
      toast.error('Failed to calculate payoff amount');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for the loan closure');
      return;
    }

    if (!payoffCalculation) {
      toast.error('Please calculate the payoff amount first');
      return;
    }

    try {
      const closureRecord = {
        loanId: loan.id,
        type: 'LOAN_CLOSURE',
        date: new Date(),
        changes: {
          closureType,
          payoffDate,
          paymentMethod,
          payoffCalculation,
          documentsGenerated: {
            payoffStatement: includePayoffStatement,
            closureNotice: includeClosureNotice,
            dischargeDocuments: includeDischargeDocuments,
          },
        },
        reason,
        approvedBy: 'Demo User',
        description: `Loan closure via ${closureType.replace('_', ' ').toLowerCase()}`,
      };

      // Save closure record to demo storage
      await demoLoanStorage.addModification(closureRecord);
      
      // Update loan status to CLOSED
      await demoLoanStorage.updateLoanStatus(loan.id, 'CLOSED');
      
      // Generate documents if requested
      if (includePayoffStatement) {
        await generatePayoffStatementPDF();
      }
      if (includeClosureNotice) {
        await generateClosureNoticePDF();
      }
      if (includeDischargeDocuments) {
        await generateDischargeDocumentsPDF();
      }

      toast.success('Loan closure processed successfully');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Failed to process loan closure');
    }
  };

  const generatePayoffStatementPDF = async () => {
    if (!payoffCalculation) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('LOAN PAYOFF STATEMENT', pageWidth / 2, 30, { align: 'center' });
    
    // Loan Information
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Loan ID: ${loan.id}`, 20, 50);
    doc.text(`Borrower: ${loan.borrower?.name || 'N/A'}`, 20, 60);
    doc.text(`Payoff Date: ${format(payoffDate, 'MM/dd/yyyy')}`, 20, 70);
    doc.text(`Good Through: ${format(payoffCalculation.goodThroughDate, 'MM/dd/yyyy')}`, 20, 80);
    
    // Payoff Calculation
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('PAYOFF CALCULATION', 20, 100);
    
    const payoffData = [
      ['Principal Balance', formatCurrency(payoffCalculation.principalBalance)],
      ['Accrued Interest', formatCurrency(payoffCalculation.accruedInterest)],
      ['Late Fees', formatCurrency(payoffCalculation.lateFees)],
      ['Prepayment Penalty', formatCurrency(payoffCalculation.prepaymentPenalty)],
      ['Total Payoff Amount', formatCurrency(payoffCalculation.totalPayoffAmount)],
    ];
    
    autoTable(doc, {
      startY: 105,
      head: [['Description', 'Amount']],
      body: payoffData,
      theme: 'striped',
      styles: { fontSize: 10 },
      columnStyles: { 1: { halign: 'right' } },
      headStyles: { fillColor: [59, 130, 246] }
    });
    
    // Per Diem Information
    let finalY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('PER DIEM INFORMATION', 20, finalY);
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Daily Interest Rate: ${formatCurrency(payoffCalculation.perDiemRate)}`, 20, finalY + 10);
    doc.text(`Note: If payment is received after ${format(payoffCalculation.goodThroughDate, 'MM/dd/yyyy')},`, 20, finalY + 20);
    doc.text(`additional per diem interest will be calculated and added to the payoff amount.`, 20, finalY + 30);
    
    // Payment Instructions
    finalY += 50;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('PAYMENT INSTRUCTIONS', 20, finalY);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    finalY += 10;
    
    if (paymentMethod === 'WIRE') {
      doc.text('Wire Transfer Instructions:', 20, finalY);
      doc.text('Bank: Demo Bank', 20, finalY + 10);
      doc.text('Routing Number: 123456789', 20, finalY + 20);
      doc.text('Account Number: 987654321', 20, finalY + 30);
      doc.text('Reference: Loan Payoff - ' + loan.id, 20, finalY + 40);
    } else if (paymentMethod === 'CHECK') {
      doc.text('Check Payment Instructions:', 20, finalY);
      doc.text('Make check payable to: Demo Lending Company', 20, finalY + 10);
      doc.text('Mail to: 123 Main St, Demo City, ST 12345', 20, finalY + 20);
      doc.text('Reference: Loan Payoff - ' + loan.id, 20, finalY + 30);
    } else if (paymentMethod === 'ACH') {
      doc.text('ACH Payment Instructions:', 20, finalY);
      doc.text('Contact customer service to set up ACH payment', 20, finalY + 10);
      doc.text('Phone: (555) 123-4567', 20, finalY + 20);
      doc.text('Reference: Loan Payoff - ' + loan.id, 20, finalY + 30);
    }
    
    // Footer
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated on ${format(new Date(), 'MM/dd/yyyy HH:mm')}`, 20, 280);
    doc.text('Page 1 of 1', pageWidth - 40, 280);
    
    // Download
    doc.save(`payoff-statement-${loan.id}-${format(payoffDate, 'yyyy-MM-dd')}.pdf`);
    toast.success('Payoff statement downloaded successfully');
  };
  
  const generateClosureNoticePDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('LOAN CLOSURE NOTICE', pageWidth / 2, 30, { align: 'center' });
    
    // Content
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${format(new Date(), 'MM/dd/yyyy')}`, 20, 60);
    doc.text(`Loan ID: ${loan.id}`, 20, 70);
    doc.text(`Borrower: ${loan.borrower?.name || 'N/A'}`, 20, 80);
    
    const noticeText = [
      'Dear Borrower,',
      '',
      `This letter serves as official notice that loan ${loan.id} has been`,
      `closed as of ${format(payoffDate, 'MM/dd/yyyy')} via ${closureType.replace('_', ' ').toLowerCase()}.`,
      '',
      'The final payoff amount has been satisfied and all obligations',
      'under the loan agreement have been fulfilled.',
      '',
      'Please retain this notice for your records.',
      '',
      'Sincerely,',
      'Demo Lending Company'
    ];
    
    let yPosition = 100;
    noticeText.forEach(line => {
      doc.text(line, 20, yPosition);
      yPosition += 15;
    });
    
    doc.save(`closure-notice-${loan.id}-${format(payoffDate, 'yyyy-MM-dd')}.pdf`);
    toast.success('Closure notice downloaded successfully');
  };
  
  const generateDischargeDocumentsPDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('DISCHARGE OF LOAN OBLIGATION', pageWidth / 2, 30, { align: 'center' });
    
    // Content
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    
    const dischargeText = [
      `TO WHOM IT MAY CONCERN:`,
      '',
      `This document serves as official discharge and release of all`,
      `obligations under Loan Agreement ${loan.id}.`,
      '',
      `Borrower: ${loan.borrower?.name || 'N/A'}`,
      `Original Loan Amount: ${formatCurrency(loan.loanParameters.principal)}`,
      `Closure Date: ${format(payoffDate, 'MM/dd/yyyy')}`,
      `Closure Type: ${closureType.replace('_', ' ')}`,
      '',
      'The borrower has satisfied all payment obligations and is',
      'hereby released from all further liability under this loan.',
      '',
      'This discharge is effective as of the closure date shown above.',
      '',
      'Demo Lending Company',
      `Authorized Representative`,
      '',
      `Date: ${format(new Date(), 'MM/dd/yyyy')}`
    ];
    
    let yPosition = 60;
    dischargeText.forEach(line => {
      doc.text(line, 20, yPosition);
      yPosition += 12;
    });
    
    doc.save(`discharge-documents-${loan.id}-${format(payoffDate, 'yyyy-MM-dd')}.pdf`);
    toast.success('Discharge documents downloaded successfully');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return format(date, 'MMM d, yyyy');
  };

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
              <Dialog.Panel className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-2xl transition-all sm:my-8 w-full max-w-4xl">
                <div className="bg-white">
                  <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-red-50 to-orange-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-red-100 border border-red-200">
                          <CheckCircleIcon className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                          <Dialog.Title as="h3" className="text-xl font-bold leading-6 text-gray-900">
                            Loan Closure Manager
                          </Dialog.Title>
                          <p className="mt-1 text-sm text-gray-600 flex items-center space-x-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                              {loan.id}
                            </span>
                            <span>•</span>
                            <span>Process loan payoff and closure</span>
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
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Left Column - Configuration */}
                      <div className="lg:col-span-2 space-y-6">
                        {/* Closure Type */}
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900 mb-4">Closure Type</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[
                              { value: 'FULL_PAYOFF', label: 'Full Payoff', desc: 'Complete loan payoff' },
                              { value: 'REFINANCE', label: 'Refinance', desc: 'Payoff for refinancing' },
                              { value: 'SALE', label: 'Property Sale', desc: 'Payoff due to sale' },
                              { value: 'DEFAULT', label: 'Default', desc: 'Default resolution' },
                            ].map((type) => (
                              <button
                                key={type.value}
                                onClick={() => setClosureType(type.value as any)}
                                className={`p-4 border rounded-xl text-left transition-all duration-200 ${
                                  closureType === type.value
                                    ? 'border-red-300 bg-red-50 text-red-900'
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                <div className="font-medium">{type.label}</div>
                                <div className="text-xs text-gray-500 mt-1">{type.desc}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Payoff Date */}
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900 mb-4">Payoff Configuration</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Payoff Date
                              </label>
                              <DatePicker
                                selected={payoffDate}
                                onChange={(date) => setPayoffDate(date || new Date())}
                                dateFormat="MM/dd/yyyy"
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                                showMonthDropdown
                                showYearDropdown
                                dropdownMode="select"
                                minDate={new Date()}
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Payment Method
                              </label>
                              <select
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value as any)}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                              >
                                <option value="WIRE">Wire Transfer</option>
                                <option value="CHECK">Certified Check</option>
                                <option value="ACH">ACH Transfer</option>
                                <option value="CASH">Cash Payment</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Documents to Generate */}
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900 mb-4">Documents to Generate</h4>
                          <div className="space-y-3">
                            {[
                              { key: 'payoffStatement', label: 'Payoff Statement', desc: 'Detailed breakdown of payoff amount', state: includePayoffStatement, setter: setIncludePayoffStatement },
                              { key: 'closureNotice', label: 'Closure Notice', desc: 'Official loan closure notification', state: includeClosureNotice, setter: setIncludeClosureNotice },
                              { key: 'dischargeDocuments', label: 'Discharge Documents', desc: 'Lien release and discharge papers', state: includeDischargeDocuments, setter: setIncludeDischargeDocuments },
                            ].map((doc) => (
                              <div key={doc.key} className="flex items-start">
                                <input
                                  type="checkbox"
                                  checked={doc.state}
                                  onChange={(e) => doc.setter(e.target.checked)}
                                  className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500 mt-1"
                                />
                                <div className="ml-3">
                                  <label className="text-sm font-medium text-gray-700">
                                    {doc.label}
                                  </label>
                                  <p className="text-xs text-gray-500">{doc.desc}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Reason */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Reason for Closure
                          </label>
                          <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                            placeholder="Explain the reason for loan closure..."
                          />
                        </div>
                      </div>

                      {/* Right Column - Payoff Calculation */}
                      <div className="lg:col-span-1">
                        <div className="sticky top-0 space-y-4">
                          <h4 className="text-lg font-semibold text-gray-900">Payoff Calculation</h4>
                          
                          {isCalculating ? (
                            <div className="text-center py-8">
                              <CalculatorIcon className="animate-spin h-8 w-8 text-gray-400 mx-auto" />
                              <p className="mt-2 text-sm text-gray-500">Calculating payoff...</p>
                            </div>
                          ) : payoffCalculation ? (
                            <div className="space-y-4">
                              {/* Payoff Breakdown */}
                              <div className="bg-gray-50 rounded-lg p-4">
                                <h5 className="text-sm font-medium text-gray-900 mb-3">Payoff Breakdown</h5>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Principal Balance:</span>
                                    <span className="font-medium">{formatCurrency(payoffCalculation.principalBalance)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Accrued Interest:</span>
                                    <span className="font-medium">{formatCurrency(payoffCalculation.accruedInterest)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Late Fees:</span>
                                    <span className="font-medium">{formatCurrency(payoffCalculation.lateFees)}</span>
                                  </div>
                                  {payoffCalculation.prepaymentPenalty > 0 && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Prepayment Penalty:</span>
                                      <span className="font-medium text-red-600">{formatCurrency(payoffCalculation.prepaymentPenalty)}</span>
                                    </div>
                                  )}
                                  <div className="border-t pt-2 mt-3">
                                    <div className="flex justify-between">
                                      <span className="font-semibold text-gray-900">Total Payoff:</span>
                                      <span className="font-bold text-lg text-red-600">{formatCurrency(payoffCalculation.totalPayoffAmount)}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Payoff Details */}
                              <div className="bg-blue-50 rounded-lg p-4">
                                <h5 className="text-sm font-medium text-blue-900 mb-3">Payoff Details</h5>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-blue-700">Payoff Date:</span>
                                    <span className="font-medium text-blue-900">{formatDate(payoffDate)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-blue-700">Good Through:</span>
                                    <span className="font-medium text-blue-900">{formatDate(payoffCalculation.goodThroughDate)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-blue-700">Per Diem Rate:</span>
                                    <span className="font-medium text-blue-900">{formatCurrency(payoffCalculation.perDiemRate)}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Quick Actions */}
                              <div className="space-y-2">
                                <button
                                  onClick={generatePayoffStatement}
                                  className="w-full inline-flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                                >
                                  <PrinterIcon className="h-4 w-4 mr-2" />
                                  Generate Statement
                                </button>
                                <button
                                  onClick={() => toast.info('Download feature coming soon')}
                                  className="w-full inline-flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                                >
                                  <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                                  Download PDF
                                </button>
                              </div>

                              {/* Important Notice */}
                              <div className="rounded-md bg-yellow-50 p-4">
                                <div className="flex">
                                  <InformationCircleIcon className="h-5 w-5 text-yellow-400" />
                                  <div className="ml-3">
                                    <h3 className="text-sm font-medium text-yellow-800">Important</h3>
                                    <div className="mt-2 text-sm text-yellow-700">
                                      <p>
                                        Payoff amount is valid through {formatDate(payoffCalculation.goodThroughDate)}. 
                                        After this date, additional per diem interest will accrue.
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
                                Select payoff date to calculate amount
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
                    <div className="flex space-x-3">
                      {payoffCalculation && (
                        <button
                          type="button"
                          onClick={generatePayoffStatementPDF}
                          className="inline-flex justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
                        >
                          <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                          Download Payoff Statement
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!reason.trim() || !payoffCalculation}
                        className="inline-flex justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <CheckCircleIcon className="h-5 w-5 mr-2" />
                        Process Closure
                      </button>
                    </div>
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