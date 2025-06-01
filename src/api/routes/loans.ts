import { Router } from 'express';
import { LoanRepository } from '../../repositories/loan.repository';
import { validateRequest } from '../middleware/validate-request';
import { authenticate } from '../middleware/authenticate';
import { createLoanSchema, updateLoanSchema, searchLoanSchema } from '../validators/loan.validator';
import { asyncHandler } from '../utils/async-handler';
import { config } from '../../config';
import { getNotificationService } from '../../services/notification.service';
import Big from 'big.js';

const router = Router();
const loanRepository = new LoanRepository();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @swagger
 * /loans:
 *   get:
 *     summary: List loans
 *     description: Retrieve a list of loans with pagination and filtering options
 *     tags: [Loans]
 *     parameters:
 *       - in: query
 *         name: borrowerId
 *         schema:
 *           type: string
 *         description: Filter by borrower ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, ACTIVE, DELINQUENT, DEFAULT, FORBEARANCE, DEFERMENT, CLOSED, CHARGED_OFF]
 *         description: Filter by loan status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Loan'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', validateRequest({ query: searchLoanSchema }), asyncHandler(async (req, res) => {
  const { 
    borrowerId,
    status,
    loanType,
    minBalance,
    maxBalance,
    isDelinquent,
    page = 1,
    limit = 20,
    sort = '-createdAt',
    asOfDate
  } = req.query;

  const criteria: any = {};
  
  if (borrowerId) criteria.borrowerId = borrowerId;
  if (status) criteria.status = status;
  if (loanType) criteria.loanType = loanType;
  if (minBalance) criteria.minBalance = new Big(minBalance as string);
  if (maxBalance) criteria.maxBalance = new Big(maxBalance as string);
  if (isDelinquent !== undefined) criteria.isDelinquent = isDelinquent === 'true';
  if (asOfDate) criteria.asOfDate = new Date(asOfDate as string);

  const loans = await loanRepository.search(criteria);
  
  // Simple pagination (would be more sophisticated in production)
  const startIndex = ((page as number) - 1) * (limit as number);
  const endIndex = startIndex + (limit as number);
  const paginatedLoans = loans.slice(startIndex, endIndex);

  res.json({
    data: paginatedLoans,
    meta: {
      total: loans.length,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(loans.length / (limit as number)),
      asOfDate: asOfDate ? new Date(asOfDate as string).toISOString() : null
    }
  });
}));

/**
 * GET /loans/statistics
 * Get loan portfolio statistics
 */
router.get('/statistics', asyncHandler(async (req, res) => {
  const { asOfDate } = req.query;
  const asOfDateObj = asOfDate ? new Date(asOfDate as string) : undefined;
  
  const stats = await loanRepository.getStatistics(asOfDateObj);
  
  res.json({
    data: {
      totalLoans: stats.totalLoans,
      activeLoans: stats.activeLoans,
      delinquentLoans: stats.delinquentLoans,
      totalOutstandingBalance: stats.totalOutstandingBalance.toString(),
      totalOriginalPrincipal: stats.totalOriginalPrincipal.toString(),
      averageInterestRate: stats.averageInterestRate.toString(),
      averageLoanAmount: stats.averageLoanAmount.toString(),
      delinquencyRate: stats.delinquencyRate,
      defaultRate: stats.defaultRate,
      asOfDate: asOfDateObj?.toISOString() || null
    }
  });
}));

/**
 * GET /loans/:id
 * Get loan by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const loan = await loanRepository.findById(req.params.id);
  
  if (!loan) {
    res.status(404).json({
      error: {
        code: 'LOAN_NOT_FOUND',
        message: 'Loan not found'
      }
    });
    return;
  }

  res.json({ data: loan });
}));

/**
 * GET /loans/:id/audit-trail
 * Get loan audit trail
 */
router.get('/:id/audit-trail', asyncHandler(async (req, res) => {
  const { limit = 100, asOfDate } = req.query;
  const asOfDateObj = asOfDate ? new Date(asOfDate as string) : undefined;
  
  const auditTrail = await loanRepository.getAuditTrail(
    req.params.id,
    Number(limit),
    asOfDateObj
  );

  res.json({ 
    data: auditTrail,
    meta: {
      loanId: req.params.id,
      count: auditTrail.length,
      asOfDate: asOfDateObj?.toISOString() || null
    }
  });
}));

/**
 * POST /loans
 * Create a new loan
 */
router.post('/', validateRequest({ body: createLoanSchema }), asyncHandler(async (req, res) => {
  const loanData = {
    ...req.body,
    principal: new Big(req.body.principal),
    currentBalance: new Big(req.body.currentBalance || req.body.principal),
    interestRate: new Big(req.body.interestRate),
    monthlyPayment: new Big(req.body.monthlyPayment),
    originationDate: new Date(req.body.originationDate),
    firstPaymentDate: new Date(req.body.firstPaymentDate),
    createdBy: req.user?.id || 'SYSTEM',
  };

  const loan = await loanRepository.create(loanData);

  res.status(201).json({
    data: loan,
    message: 'Loan created successfully'
  });
}));

/**
 * PATCH /loans/:id
 * Update loan details
 */
router.patch('/:id', validateRequest({ body: updateLoanSchema }), asyncHandler(async (req, res) => {
  const loan = await loanRepository.findById(req.params.id);
  
  if (!loan) {
    res.status(404).json({
      error: {
        code: 'LOAN_NOT_FOUND',
        message: 'Loan not found'
      }
    });
    return;
  }

  // Update allowed fields
  const allowedUpdates = ['metadata', 'tags', 'notes'];
  const updates: any = {};
  
  allowedUpdates.forEach(field => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  Object.assign(loan, updates);
  await loan.save();

  res.json({
    data: loan,
    message: 'Loan updated successfully'
  });
}));

/**
 * POST /loans/:id/payments
 * Record a payment
 */
router.post('/:id/payments', asyncHandler(async (req, res) => {
  const { amount, paymentDate, principalPaid, interestPaid, feesPaid } = req.body;

  // For testing, we'll skip transactions if not in production
  const processPayment = async (session?: any) => {
    const loan = await loanRepository.findById(req.params.id, session);
    
    if (!loan) {
      throw new Error('Loan not found');
    }

    const paymentAmount = new Big(amount);
    const principal = new Big(principalPaid);
    const interest = new Big(interestPaid);
    const fees = feesPaid ? new Big(feesPaid) : undefined;
    
    const updatedLoan = await loanRepository.updateBalance(
      req.params.id,
      loan.currentBalance.minus(principal),
      {
        paymentAmount,
        principalPaid: principal,
        interestPaid: interest,
        feesPaid: fees,
        paymentDate: new Date(paymentDate),
      },
      session
    );

    return updatedLoan;
  };

  let loan;
  if (config.isProduction) {
    loan = await loanRepository.executeInTransaction(processPayment);
  } else {
    loan = await processPayment();
  }

  // Send payment notification
  if (loan.borrowerId) {
    const user = { _id: loan.borrowerId.toString() };
    await getNotificationService().notifyPaymentReceived(loan, user as any, amount);
    
    // Check if loan is fully paid
    if (loan.currentBalance.eq(0)) {
      await getNotificationService().notifyLoanFullyPaid(loan, user as any);
    }
  }

  res.json({
    data: loan,
    message: 'Payment recorded successfully'
  });
}));

/**
 * POST /loans/:id/status
 * Update loan status
 */
router.post('/:id/status', asyncHandler(async (req, res) => {
  const { status, reason } = req.body;

  const loan = await loanRepository.updateStatus(
    req.params.id,
    status,
    reason,
    req.user?.id || 'SYSTEM'
  );

  // Send notifications based on status change
  if (loan.borrowerId) {
    const user = { _id: loan.borrowerId.toString() };
    
    switch (status) {
      case 'ACTIVE':
        await getNotificationService().notifyLoanDisbursed(loan, user as any);
        break;
      case 'CLOSED':
        await getNotificationService().notifyLoanFullyPaid(loan, user as any);
        break;
      case 'DELINQUENT':
        const daysOverdue = loan.lastPaymentDate 
          ? Math.floor((new Date().getTime() - loan.lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        await getNotificationService().notifyPaymentOverdue(loan, user as any, daysOverdue);
        break;
    }
  }

  res.json({
    data: loan,
    message: 'Loan status updated successfully'
  });
}));

/**
 * POST /loans/:id/modifications
 * Add a loan modification
 */
router.post('/:id/modifications', asyncHandler(async (req, res) => {
  const modification = {
    ...req.body,
    newRate: req.body.newRate ? new Big(req.body.newRate) : undefined,
    previousRate: req.body.previousRate ? new Big(req.body.previousRate) : undefined,
    newPayment: req.body.newPayment ? new Big(req.body.newPayment) : undefined,
    previousPayment: req.body.previousPayment ? new Big(req.body.previousPayment) : undefined,
    effectiveDate: new Date(req.body.effectiveDate),
  };

  const loan = await loanRepository.addModification(req.params.id, modification);

  res.json({
    data: loan,
    message: 'Loan modification added successfully'
  });
}));

export { router as loansRouter };