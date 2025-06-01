import { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  XMarkIcon,
  DocumentTextIcon,
  CalendarIcon,
  PrinterIcon,
  ArrowDownTrayIcon,
  CogIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  BanknotesIcon,
  ChartBarIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { LoanEngine } from '@lendpeak/engine';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import DatePicker from 'react-datepicker';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface StatementGeneratorProps {
  loan: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface StatementConfig {
  statementType: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'CUSTOM';
  startDate: Date;
  endDate: Date;
  includeTransactionHistory: boolean;
  includeAmortizationSchedule: boolean;
  includePaymentCoupons: boolean;
  includeAccountSummary: boolean;
  includeTaxInformation: boolean;
  format: 'PDF' | 'EMAIL' | 'PRINT';
  customMessage?: string;
}

interface StatementData {
  period: {
    startDate: Date;
    endDate: Date;
    daysInPeriod: number;
  };
  balances: {
    beginningBalance: number;
    endingBalance: number;
    principalPaid: number;
    interestPaid: number;
    totalPaid: number;
  };
  transactions: Array<{
    date: Date;
    type: string;
    description: string;
    amount: number;
    balance: number;
  }>;
  currentTerms: {
    interestRate: number;
    monthlyPayment: number;
    remainingTerm: number;
    nextPaymentDate: Date;
    payoffAmount: number;
  };
  yearToDate: {
    principalPaid: number;
    interestPaid: number;
    totalPaid: number;
    paymentsReceived: number;
  };
}

export const StatementGenerator = ({ loan, isOpen, onClose, onSuccess }: StatementGeneratorProps) => {
  const [config, setConfig] = useState<StatementConfig>({
    statementType: 'MONTHLY',
    startDate: startOfMonth(subMonths(new Date(), 1)),
    endDate: endOfMonth(subMonths(new Date(), 1)),
    includeTransactionHistory: true,
    includeAmortizationSchedule: false,
    includePaymentCoupons: true,
    includeAccountSummary: true,
    includeTaxInformation: false,
    format: 'PDF',
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [statementData, setStatementData] = useState<StatementData | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleStatementTypeChange = (type: StatementConfig['statementType']) => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (type) {
      case 'MONTHLY':
        startDate = startOfMonth(subMonths(now, 1));
        endDate = endOfMonth(subMonths(now, 1));
        break;
      case 'QUARTERLY':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 - 3, 1);
        startDate = quarterStart;
        endDate = endOfMonth(new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 2, 1));
        break;
      case 'ANNUAL':
        startDate = new Date(now.getFullYear() - 1, 0, 1);
        endDate = new Date(now.getFullYear() - 1, 11, 31);
        break;
      default:
        startDate = config.startDate;
        endDate = config.endDate;
    }

    setConfig({
      ...config,
      statementType: type,
      startDate,
      endDate,
    });
  };

  const generateStatementData = async (): Promise<StatementData> => {
    // Calculate current loan metrics
    const loanTerms = LoanEngine.createLoan(
      loan.loanParameters.principal,
      loan.loanParameters.interestRate,
      loan.loanParameters.termMonths,
      loan.loanParameters.startDate,
      { paymentFrequency: 'monthly', interestType: 'amortized' }
    );
    
    const payment = LoanEngine.calculatePayment(loanTerms);
    const currentBalance = loan.loanParameters.principal * 0.85; // Demo: 15% paid off
    
    // Generate demo transaction history for the period
    const transactions = [];
    const daysBetween = Math.floor((config.endDate.getTime() - config.startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Add monthly payments
    let transactionDate = new Date(config.startDate);
    let runningBalance = currentBalance + (payment.monthlyPayment.toNumber() * 2); // Starting balance
    
    while (transactionDate <= config.endDate) {
      if (transactionDate.getDate() === 1) { // Monthly payment on 1st
        const principalPortion = payment.monthlyPayment.toNumber() * 0.7; // Demo split
        const interestPortion = payment.monthlyPayment.toNumber() * 0.3;
        
        transactions.push({
          date: new Date(transactionDate),
          type: 'PAYMENT',
          description: 'Monthly Payment Received',
          amount: -payment.monthlyPayment.toNumber(),
          balance: runningBalance - payment.monthlyPayment.toNumber(),
        });
        
        runningBalance -= payment.monthlyPayment.toNumber();
      }
      
      transactionDate.setDate(transactionDate.getDate() + 1);
    }
    
    // Calculate period totals
    const periodPayments = transactions.filter(t => t.type === 'PAYMENT');
    const totalPaid = periodPayments.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const principalPaid = totalPaid * 0.7; // Demo calculation
    const interestPaid = totalPaid * 0.3;
    
    // Calculate YTD totals (demo)
    const yearStart = new Date(config.endDate.getFullYear(), 0, 1);
    const monthsThisYear = config.endDate.getMonth() + 1;
    const ytdTotal = payment.monthlyPayment.toNumber() * monthsThisYear;
    
    return {
      period: {
        startDate: config.startDate,
        endDate: config.endDate,
        daysInPeriod: daysBetween,
      },
      balances: {
        beginningBalance: runningBalance + totalPaid,
        endingBalance: runningBalance,
        principalPaid,
        interestPaid,
        totalPaid,
      },
      transactions,
      currentTerms: {
        interestRate: loan.loanParameters.interestRate,
        monthlyPayment: payment.monthlyPayment.toNumber(),
        remainingTerm: Math.floor(loan.loanParameters.termMonths * 0.85), // Demo
        nextPaymentDate: new Date(config.endDate.getFullYear(), config.endDate.getMonth() + 1, 1),
        payoffAmount: currentBalance,
      },
      yearToDate: {
        principalPaid: ytdTotal * 0.7,
        interestPaid: ytdTotal * 0.3,
        totalPaid: ytdTotal,
        paymentsReceived: monthsThisYear,
      },
    };
  };

  const generateStatement = async () => {
    setIsGenerating(true);
    try {
      const data = await generateStatementData();
      setStatementData(data);
      
      // Simulate statement generation process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      switch (config.format) {
        case 'PDF':
          generatePDF(data);
          break;
        case 'EMAIL':
          sendEmail(data);
          break;
        case 'PRINT':
          printStatement(data);
          break;
      }
      
      toast.success(`Statement ${config.format.toLowerCase()}ed successfully`);
      onSuccess();
    } catch (error) {
      console.error('Error generating statement:', error);
      toast.error('Failed to generate statement');
    } finally {
      setIsGenerating(false);
    }
  };

  const generatePDF = async (data: StatementData) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('LOAN STATEMENT', pageWidth / 2, 30, { align: 'center' });
    
    // Loan Information
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Loan ID: ${loan.id}`, 20, 50);
    doc.text(`Statement Period: ${format(data.period.startDate, 'MM/dd/yyyy')} - ${format(data.period.endDate, 'MM/dd/yyyy')}`, 20, 60);
    doc.text(`Borrower: ${loan.borrower?.name || 'N/A'}`, 20, 70);
    
    // Current Balance Summary
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('ACCOUNT SUMMARY', 20, 90);
    
    const summaryData = [
      ['Beginning Balance', formatCurrency(data.balances.beginningBalance)],
      ['Ending Balance', formatCurrency(data.balances.endingBalance)],
      ['Principal Paid (Period)', formatCurrency(data.balances.principalPaid)],
      ['Interest Paid (Period)', formatCurrency(data.balances.interestPaid)],
      ['Total Paid (Period)', formatCurrency(data.balances.totalPaid)],
    ];
    
    autoTable(doc, {
      startY: 95,
      head: [['Item', 'Amount']],
      body: summaryData,
      theme: 'striped',
      styles: { fontSize: 10 },
      columnStyles: { 1: { halign: 'right' } }
    });
    
    // Current Terms
    let finalY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('CURRENT LOAN TERMS', 20, finalY);
    
    const termsData = [
      ['Interest Rate', `${data.currentTerms.interestRate.toFixed(3)}%`],
      ['Monthly Payment', formatCurrency(data.currentTerms.monthlyPayment)],
      ['Remaining Term', `${data.currentTerms.remainingTerm} months`],
      ['Next Payment Date', format(data.currentTerms.nextPaymentDate, 'MM/dd/yyyy')],
      ['Payoff Amount', formatCurrency(data.currentTerms.payoffAmount)],
    ];
    
    autoTable(doc, {
      startY: finalY + 5,
      head: [['Term', 'Value']],
      body: termsData,
      theme: 'striped',
      styles: { fontSize: 10 },
      columnStyles: { 1: { halign: 'right' } }
    });
    
    // Transaction History (if included)
    if (config.includeTransactionHistory && data.transactions.length > 0) {
      finalY = (doc as any).lastAutoTable.finalY + 20;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('TRANSACTION HISTORY', 20, finalY);
      
      const transactionData = data.transactions.map(t => [
        format(t.date, 'MM/dd/yyyy'),
        t.type,
        t.description,
        formatCurrency(t.amount),
        formatCurrency(t.balance)
      ]);
      
      autoTable(doc, {
        startY: finalY + 5,
        head: [['Date', 'Type', 'Description', 'Amount', 'Balance']],
        body: transactionData,
        theme: 'striped',
        styles: { fontSize: 8 },
        columnStyles: { 
          3: { halign: 'right' },
          4: { halign: 'right' }
        }
      });
    }
    
    // Year to Date Summary
    finalY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 20 : finalY + 60;
    if (finalY > 250) {
      doc.addPage();
      finalY = 30;
    }
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('YEAR TO DATE SUMMARY', 20, finalY);
    
    const ytdData = [
      ['Principal Paid YTD', formatCurrency(data.yearToDate.principalPaid)],
      ['Interest Paid YTD', formatCurrency(data.yearToDate.interestPaid)],
      ['Total Paid YTD', formatCurrency(data.yearToDate.totalPaid)],
      ['Payments Received YTD', data.yearToDate.paymentsReceived.toString()],
    ];
    
    autoTable(doc, {
      startY: finalY + 5,
      head: [['Item', 'Amount']],
      body: ytdData,
      theme: 'striped',
      styles: { fontSize: 10 },
      columnStyles: { 1: { halign: 'right' } }
    });
    
    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated on ${format(new Date(), 'MM/dd/yyyy HH:mm')}`, 20, 285);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - 40, 285);
    }
    
    // Download
    doc.save(`loan-statement-${loan.id}-${format(config.endDate, 'yyyy-MM')}.pdf`);
  };
  
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const sendEmail = async (data: StatementData) => {
    // In a real app, this would send via email service
    console.log('Sending email statement:', data);
    toast.info('Statement email sent to borrower');
  };

  const printStatement = async (data: StatementData) => {
    // In a real app, this would format for printing
    console.log('Formatting for print:', data);
    toast.info('Statement formatted for printing');
  };


  const formatDate = (date: Date) => {
    return format(date, 'MMM d, yyyy');
  };

  return (
    <>
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-2xl transition-all sm:my-8 w-full max-w-5xl">
                <div className="bg-white">
                  <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 border border-blue-200">
                          <DocumentTextIcon className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <Dialog.Title as="h3" className="text-xl font-bold leading-6 text-gray-900">
                            Statement Generator
                          </Dialog.Title>
                          <p className="mt-1 text-sm text-gray-600 flex items-center space-x-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              {loan.id}
                            </span>
                            <span>•</span>
                            <span>Generate loan statements and reports</span>
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
                        {/* Statement Type */}
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900 mb-4">Statement Type</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[
                              { value: 'MONTHLY', label: 'Monthly Statement', desc: 'Last complete month' },
                              { value: 'QUARTERLY', label: 'Quarterly Statement', desc: 'Last complete quarter' },
                              { value: 'ANNUAL', label: 'Annual Statement', desc: 'Last complete year' },
                              { value: 'CUSTOM', label: 'Custom Period', desc: 'Choose date range' },
                            ].map((type) => (
                              <button
                                key={type.value}
                                onClick={() => handleStatementTypeChange(type.value as any)}
                                className={`p-4 border rounded-xl text-left transition-all duration-200 ${
                                  config.statementType === type.value
                                    ? 'border-blue-300 bg-blue-50 text-blue-900'
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                <div className="font-medium">{type.label}</div>
                                <div className="text-xs text-gray-500 mt-1">{type.desc}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Date Range */}
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900 mb-4">Statement Period</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Start Date
                              </label>
                              <DatePicker
                                selected={config.startDate}
                                onChange={(date) => setConfig({ ...config, startDate: date || new Date() })}
                                dateFormat="MM/dd/yyyy"
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                showMonthDropdown
                                showYearDropdown
                                dropdownMode="select"
                                disabled={config.statementType !== 'CUSTOM'}
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                End Date
                              </label>
                              <DatePicker
                                selected={config.endDate}
                                onChange={(date) => setConfig({ ...config, endDate: date || new Date() })}
                                dateFormat="MM/dd/yyyy"
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                showMonthDropdown
                                showYearDropdown
                                dropdownMode="select"
                                disabled={config.statementType !== 'CUSTOM'}
                                minDate={config.startDate}
                              />
                            </div>
                          </div>
                          <p className="mt-2 text-sm text-gray-500">
                            Period: {formatDate(config.startDate)} to {formatDate(config.endDate)}
                          </p>
                        </div>

                        {/* Content Options */}
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900 mb-4">Statement Content</h4>
                          <div className="space-y-3">
                            {[
                              { key: 'includeAccountSummary', label: 'Account Summary', desc: 'Current balance, payment info, terms' },
                              { key: 'includeTransactionHistory', label: 'Transaction History', desc: 'All payments and adjustments in period' },
                              { key: 'includeAmortizationSchedule', label: 'Amortization Schedule', desc: 'Upcoming payment breakdown' },
                              { key: 'includePaymentCoupons', label: 'Payment Coupons', desc: 'Detachable payment stubs' },
                              { key: 'includeTaxInformation', label: 'Tax Information', desc: 'Year-to-date interest paid' },
                            ].map((option) => (
                              <div key={option.key} className="flex items-start">
                                <input
                                  type="checkbox"
                                  checked={config[option.key as keyof StatementConfig] as boolean}
                                  onChange={(e) => setConfig({ ...config, [option.key]: e.target.checked })}
                                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-1"
                                />
                                <div className="ml-3">
                                  <label className="text-sm font-medium text-gray-700">
                                    {option.label}
                                  </label>
                                  <p className="text-xs text-gray-500">{option.desc}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Output Format */}
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900 mb-4">Output Format</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {[
                              { value: 'PDF', label: 'Download PDF', icon: ArrowDownTrayIcon },
                              { value: 'EMAIL', label: 'Email to Borrower', icon: DocumentTextIcon },
                              { value: 'PRINT', label: 'Print Ready', icon: PrinterIcon },
                            ].map((format) => {
                              const IconComponent = format.icon;
                              return (
                                <button
                                  key={format.value}
                                  onClick={() => setConfig({ ...config, format: format.value as any })}
                                  className={`p-4 border rounded-xl text-center transition-all duration-200 ${
                                    config.format === format.value
                                      ? 'border-blue-300 bg-blue-50 text-blue-900'
                                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                  }`}
                                >
                                  <IconComponent className="h-6 w-6 mx-auto mb-2" />
                                  <div className="font-medium text-sm">{format.label}</div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Custom Message */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Custom Message (Optional)
                          </label>
                          <textarea
                            value={config.customMessage || ''}
                            onChange={(e) => setConfig({ ...config, customMessage: e.target.value })}
                            rows={3}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            placeholder="Add a custom message to include in the statement..."
                          />
                        </div>
                      </div>

                      {/* Right Column - Preview/Summary */}
                      <div className="lg:col-span-1">
                        <div className="sticky top-0 space-y-4">
                          <h4 className="text-lg font-semibold text-gray-900">Statement Preview</h4>
                          
                          {isGenerating ? (
                            <div className="text-center py-8">
                              <CogIcon className="animate-spin h-8 w-8 text-gray-400 mx-auto" />
                              <p className="mt-2 text-sm text-gray-500">Generating statement...</p>
                            </div>
                          ) : statementData ? (
                            <div className="space-y-4">
                              {/* Statement Summary */}
                              <div className="bg-gray-50 rounded-lg p-4">
                                <h5 className="text-sm font-medium text-gray-900 mb-3">Statement Summary</h5>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Period:</span>
                                    <span className="font-medium">{formatDate(statementData.period.startDate)} - {formatDate(statementData.period.endDate)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Beginning Balance:</span>
                                    <span className="font-medium">{formatCurrency(statementData.balances.beginningBalance)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Ending Balance:</span>
                                    <span className="font-medium">{formatCurrency(statementData.balances.endingBalance)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Total Paid:</span>
                                    <span className="font-medium text-green-600">{formatCurrency(statementData.balances.totalPaid)}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Transaction Count */}
                              <div className="bg-blue-50 rounded-lg p-4">
                                <h5 className="text-sm font-medium text-blue-900 mb-2">Transactions</h5>
                                <div className="text-sm text-blue-700">
                                  {statementData.transactions.length} transaction{statementData.transactions.length !== 1 ? 's' : ''} in period
                                </div>
                              </div>

                              {/* Year to Date */}
                              <div className="bg-green-50 rounded-lg p-4">
                                <h5 className="text-sm font-medium text-green-900 mb-3">Year to Date</h5>
                                <div className="space-y-1 text-sm text-green-700">
                                  <div>Payments: {statementData.yearToDate.paymentsReceived}</div>
                                  <div>Total Paid: {formatCurrency(statementData.yearToDate.totalPaid)}</div>
                                  <div>Interest Paid: {formatCurrency(statementData.yearToDate.interestPaid)}</div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-8 bg-gray-50 rounded-lg">
                              <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                              <p className="mt-2 text-sm text-gray-500">
                                Configure options and generate statement
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
                      {statementData && (
                        <button
                          type="button"
                          onClick={() => setShowPreview(true)}
                          className="inline-flex justify-center rounded-md bg-gray-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-500"
                        >
                          <DocumentTextIcon className="h-5 w-5 mr-2" />
                          Preview
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={generateStatement}
                        disabled={isGenerating}
                        className="inline-flex justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isGenerating ? (
                          <>
                            <CogIcon className="animate-spin h-5 w-5 mr-2" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <CheckCircleIcon className="h-5 w-5 mr-2" />
                            Generate Statement
                          </>
                        )}
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

    {/* Statement Preview Modal */}
    {showPreview && statementData && (
      <StatementPreview
        data={statementData}
        config={config}
        loan={loan}
        onClose={() => setShowPreview(false)}
        onGenerate={() => {
          setShowPreview(false);
          generateStatement();
        }}
      />
    )}
    </>
  );
};

interface StatementPreviewProps {
  data: StatementData;
  config: StatementConfig;
  loan: any;
  onClose: () => void;
  onGenerate: () => void;
}

const StatementPreview = ({ data, config, loan, onClose, onGenerate }: StatementPreviewProps) => {
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <Transition.Root show={true} as={Fragment}>
      <Dialog as="div" className="relative z-[90]" onClose={onClose}>
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
              <Dialog.Panel className="relative transform rounded-xl bg-white text-left shadow-2xl transition-all sm:my-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="bg-white">
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 border border-blue-200">
                          <DocumentTextIcon className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <Dialog.Title as="h3" className="text-xl font-bold leading-6 text-gray-900">
                            Statement Preview
                          </Dialog.Title>
                          <p className="mt-1 text-sm text-gray-600">
                            {format(data.period.startDate, 'MMM dd, yyyy')} - {format(data.period.endDate, 'MMM dd, yyyy')}
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

                  {/* Statement Content */}
                  <div className="px-6 py-6">
                    {/* Statement Header */}
                    <div className="text-center mb-8">
                      <h1 className="text-2xl font-bold text-gray-900 mb-2">LOAN STATEMENT</h1>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>Loan ID: <span className="font-medium">{loan.id}</span></p>
                        <p>Borrower: <span className="font-medium">{loan.borrower?.name || 'N/A'}</span></p>
                        <p>Statement Period: <span className="font-medium">{format(data.period.startDate, 'MM/dd/yyyy')} - {format(data.period.endDate, 'MM/dd/yyyy')}</span></p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Account Summary */}
                      <div className="bg-blue-50 rounded-lg p-6">
                        <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
                          <BanknotesIcon className="h-5 w-5 mr-2" />
                          Account Summary
                        </h3>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-blue-700">Beginning Balance:</span>
                            <span className="font-medium text-blue-900">{formatCurrency(data.balances.beginningBalance)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-700">Ending Balance:</span>
                            <span className="font-medium text-blue-900">{formatCurrency(data.balances.endingBalance)}</span>
                          </div>
                          <div className="border-t border-blue-200 pt-3">
                            <div className="flex justify-between">
                              <span className="text-blue-700">Principal Paid:</span>
                              <span className="font-medium text-blue-900">{formatCurrency(data.balances.principalPaid)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-blue-700">Interest Paid:</span>
                              <span className="font-medium text-blue-900">{formatCurrency(data.balances.interestPaid)}</span>
                            </div>
                            <div className="flex justify-between font-bold">
                              <span className="text-blue-800">Total Paid:</span>
                              <span className="text-blue-900">{formatCurrency(data.balances.totalPaid)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Current Terms */}
                      <div className="bg-green-50 rounded-lg p-6">
                        <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center">
                          <ChartBarIcon className="h-5 w-5 mr-2" />
                          Current Loan Terms
                        </h3>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-green-700">Interest Rate:</span>
                            <span className="font-medium text-green-900">{data.currentTerms.interestRate.toFixed(3)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-green-700">Monthly Payment:</span>
                            <span className="font-medium text-green-900">{formatCurrency(data.currentTerms.monthlyPayment)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-green-700">Remaining Term:</span>
                            <span className="font-medium text-green-900">{data.currentTerms.remainingTerm} months</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-green-700">Next Payment Date:</span>
                            <span className="font-medium text-green-900">{format(data.currentTerms.nextPaymentDate, 'MM/dd/yyyy')}</span>
                          </div>
                          <div className="border-t border-green-200 pt-3">
                            <div className="flex justify-between font-bold">
                              <span className="text-green-800">Payoff Amount:</span>
                              <span className="text-green-900">{formatCurrency(data.currentTerms.payoffAmount)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Transaction History */}
                    {config.includeTransactionHistory && data.transactions.length > 0 && (
                      <div className="mt-8">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                          <ClockIcon className="h-5 w-5 mr-2" />
                          Transaction History
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {data.transactions.slice(0, 10).map((transaction, idx) => (
                                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {format(transaction.date, 'MM/dd/yyyy')}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {transaction.type}
                                  </td>
                                  <td className="px-6 py-4 text-sm text-gray-900">
                                    {transaction.description}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                    {formatCurrency(transaction.amount)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                    {formatCurrency(transaction.balance)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {data.transactions.length > 10 && (
                            <p className="mt-2 text-sm text-gray-500 text-center">
                              Showing first 10 transactions. Complete list will be included in generated statement.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Year to Date Summary */}
                    <div className="mt-8">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <CalendarIcon className="h-5 w-5 mr-2" />
                        Year to Date Summary
                      </h3>
                      <div className="bg-purple-50 rounded-lg p-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-purple-900">{formatCurrency(data.yearToDate.principalPaid)}</div>
                            <div className="text-sm text-purple-700">Principal Paid</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-purple-900">{formatCurrency(data.yearToDate.interestPaid)}</div>
                            <div className="text-sm text-purple-700">Interest Paid</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-purple-900">{formatCurrency(data.yearToDate.totalPaid)}</div>
                            <div className="text-sm text-purple-700">Total Paid</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-purple-900">{data.yearToDate.paymentsReceived}</div>
                            <div className="text-sm text-purple-700">Payments Received</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="bg-gray-50 px-6 py-4 flex justify-between items-center">
                    <div className="text-sm text-gray-500">
                      <p>Generated on {format(new Date(), 'MM/dd/yyyy HH:mm')}</p>
                      <p>Format: {config.format} • Type: {config.statementType}</p>
                    </div>
                    <div className="flex space-x-3">
                      <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                      >
                        Close Preview
                      </button>
                      <button
                        type="button"
                        onClick={onGenerate}
                        className="inline-flex justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
                      >
                        <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                        Generate {config.format}
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