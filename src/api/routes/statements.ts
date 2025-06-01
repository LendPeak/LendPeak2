import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { logger } from '../../utils/logger';
import { getEmailService } from '../../services/email.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const router = Router();

/**
 * POST /api/statements/email
 * Send loan statement via email
 */
router.post('/email', [
  body('borrowerEmail').isEmail().withMessage('Valid borrower email is required'),
  body('borrowerName').notEmpty().withMessage('Borrower name is required'),
  body('loanId').notEmpty().withMessage('Loan ID is required'),
  body('statementPeriod').notEmpty().withMessage('Statement period is required'),
  body('statementData').isObject().withMessage('Statement data is required'),
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      borrowerEmail,
      borrowerName,
      loanId,
      statementPeriod,
      customMessage,
      statementData
    } = req.body;

    logger.info('Processing statement email request', {
      borrowerEmail,
      loanId,
      statementPeriod
    });

    // Generate PDF for email attachment
    const pdfBuffer = await generateStatementPDF({
      loanId,
      borrowerName,
      statementPeriod,
      statementData
    });

    // Send email using the email service
    const emailService = getEmailService();
    const emailSent = await emailService.sendStatementEmail({
      borrowerEmail,
      borrowerName,
      loanId,
      statementPeriod,
      statementPdf: pdfBuffer,
      customMessage
    });

    if (emailSent) {
      logger.info('Statement email sent successfully', {
        borrowerEmail,
        loanId,
        statementPeriod
      });

      res.json({
        success: true,
        message: 'Statement email sent successfully',
        data: {
          borrowerEmail,
          loanId,
          statementPeriod,
          sentAt: new Date().toISOString()
        }
      });
    } else {
      throw new Error('Email service returned false');
    }
  } catch (error) {
    logger.error('Failed to send statement email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send statement email',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/statements/generate
 * Generate loan statement PDF (without sending email)
 */
router.post('/generate', [
  body('loanId').notEmpty().withMessage('Loan ID is required'),
  body('statementData').isObject().withMessage('Statement data is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { loanId, borrowerName, statementPeriod, statementData } = req.body;

    logger.info('Generating statement PDF', { loanId, statementPeriod });

    const pdfBuffer = await generateStatementPDF({
      loanId,
      borrowerName: borrowerName || 'Borrower',
      statementPeriod: statementPeriod || 'Current Period',
      statementData
    });

    // Set response headers for PDF download
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="loan-statement-${loanId}-${statementPeriod}.pdf"`,
      'Content-Length': pdfBuffer.length
    });

    res.send(pdfBuffer);
  } catch (error) {
    logger.error('Failed to generate statement PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate statement PDF',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

interface StatementPDFOptions {
  loanId: string;
  borrowerName: string;
  statementPeriod: string;
  statementData: any;
}

async function generateStatementPDF(options: StatementPDFOptions): Promise<Buffer> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  try {
    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('LOAN STATEMENT', pageWidth / 2, 30, { align: 'center' });
    
    // Loan Information
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Loan ID: ${options.loanId}`, 20, 50);
    doc.text(`Statement Period: ${options.statementPeriod}`, 20, 60);
    doc.text(`Borrower: ${options.borrowerName}`, 20, 70);
    
    // Current Balance Summary
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('ACCOUNT SUMMARY', 20, 90);
    
    const { balances } = options.statementData;
    const summaryData = [
      ['Beginning Balance', formatCurrency(balances?.beginningBalance || 0)],
      ['Ending Balance', formatCurrency(balances?.endingBalance || 0)],
      ['Principal Paid (Period)', formatCurrency(balances?.principalPaid || 0)],
      ['Interest Paid (Period)', formatCurrency(balances?.interestPaid || 0)],
      ['Total Paid (Period)', formatCurrency(balances?.totalPaid || 0)],
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
    
    const { currentTerms } = options.statementData;
    const termsData = [
      ['Interest Rate', `${(currentTerms?.interestRate || 0).toFixed(3)}%`],
      ['Monthly Payment', formatCurrency(currentTerms?.monthlyPayment || 0)],
      ['Remaining Term', `${currentTerms?.remainingTerm || 0} months`],
      ['Payoff Amount', formatCurrency(currentTerms?.payoffAmount || 0)],
    ];
    
    autoTable(doc, {
      startY: finalY + 5,
      head: [['Term', 'Value']],
      body: termsData,
      theme: 'striped',
      styles: { fontSize: 10 },
      columnStyles: { 1: { halign: 'right' } }
    });
    
    // Transaction History (if available)
    const { transactions } = options.statementData;
    if (transactions && transactions.length > 0) {
      finalY = (doc as any).lastAutoTable.finalY + 20;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('TRANSACTION HISTORY', 20, finalY);
      
      const transactionData = transactions.slice(0, 10).map((t: any) => [
        new Date(t.date).toLocaleDateString(),
        t.type,
        t.description || 'Transaction',
        formatCurrency(t.amount || 0),
        formatCurrency(t.balance || 0)
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
    
    const { yearToDate } = options.statementData;
    const ytdData = [
      ['Principal Paid YTD', formatCurrency(yearToDate?.principalPaid || 0)],
      ['Interest Paid YTD', formatCurrency(yearToDate?.interestPaid || 0)],
      ['Total Paid YTD', formatCurrency(yearToDate?.totalPaid || 0)],
      ['Payments Received YTD', (yearToDate?.paymentsReceived || 0).toString()],
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
      doc.text(`Generated on ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 20, 285);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - 40, 285);
    }
    
    // Return PDF as Buffer
    return Buffer.from(doc.output('arraybuffer'));
  } catch (error) {
    logger.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF document');
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export default router;