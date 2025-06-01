import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { asyncHandler } from '../utils/async-handler';
import { approvalWorkflowService, ApprovalRule } from '../../services/approval-workflow.service';
import { loanRepository } from '../../repositories/loan.repository';
import { userRepository } from '../../repositories/user.repository';
import * as yup from 'yup';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * POST /approval-workflow/process/:loanId
 * Process loan application through approval workflow
 */
router.post('/process/:loanId', 
  authorize(['ADMIN', 'SUPER_ADMIN', 'LOAN_OFFICER']),
  asyncHandler(async (req, res) => {
    const { loanId } = req.params;
    const { skipManualReview = false } = req.body;

    // Find loan and user
    const loan = await loanRepository.findById(loanId);
    if (!loan) {
      res.status(404).json({
        error: {
          code: 'LOAN_NOT_FOUND',
          message: 'Loan not found',
        },
      });
      return;
    }

    const user = await userRepository.findById(loan.borrowerId);
    if (!user) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
      return;
    }

    // Check if loan is in correct status
    if (loan.status !== 'pending') {
      res.status(400).json({
        error: {
          code: 'INVALID_LOAN_STATUS',
          message: 'Loan must be in pending status for approval processing',
          currentStatus: loan.status,
        },
      });
      return;
    }

    // Process through approval workflow
    const result = await approvalWorkflowService.processLoanApplication(
      loan,
      user,
      { skipManualReview }
    );

    // Update loan status based on decision
    let newStatus: string;
    switch (result.decision) {
      case 'approved':
        newStatus = 'approved';
        break;
      case 'rejected':
        newStatus = 'rejected';
        break;
      case 'manual_review':
        newStatus = 'under_review';
        break;
    }

    await loanRepository.updateById(loanId, { 
      status: newStatus,
      approvalResult: result,
      reviewedBy: req.user?.id,
      reviewedAt: new Date(),
    });

    res.json({
      data: {
        loanId,
        decision: result.decision,
        confidence: result.confidence,
        riskScore: result.riskScore,
        reasons: result.reasons,
        recommendedTerms: result.recommendedTerms,
        conditions: result.conditions,
        nextSteps: result.nextSteps,
        reviewedBy: req.user?.id,
        reviewedAt: new Date(),
      },
    });
  })
);

/**
 * POST /approval-workflow/batch-process
 * Process multiple loan applications in batch
 */
router.post('/batch-process',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (req, res) => {
    const schema = yup.object({
      loanIds: yup.array().of(yup.string().required()).min(1).max(50).required(),
      skipManualReview: yup.boolean().default(false),
    });

    const { loanIds, skipManualReview } = await schema.validate(req.body);

    const results = [];
    const errors = [];

    for (const loanId of loanIds) {
      try {
        const loan = await loanRepository.findById(loanId);
        if (!loan) {
          errors.push({ loanId, error: 'Loan not found' });
          continue;
        }

        if (loan.status !== 'pending') {
          errors.push({ loanId, error: `Invalid status: ${loan.status}` });
          continue;
        }

        const user = await userRepository.findById(loan.borrowerId);
        if (!user) {
          errors.push({ loanId, error: 'User not found' });
          continue;
        }

        const result = await approvalWorkflowService.processLoanApplication(
          loan,
          user,
          { skipManualReview }
        );

        // Update loan status
        let newStatus: string;
        switch (result.decision) {
          case 'approved':
            newStatus = 'approved';
            break;
          case 'rejected':
            newStatus = 'rejected';
            break;
          case 'manual_review':
            newStatus = 'under_review';
            break;
        }

        await loanRepository.updateById(loanId, { 
          status: newStatus,
          approvalResult: result,
          reviewedBy: req.user?.id,
          reviewedAt: new Date(),
        });

        results.push({
          loanId,
          decision: result.decision,
          confidence: result.confidence,
          riskScore: result.riskScore,
        });
      } catch (error) {
        errors.push({ loanId, error: (error as Error).message });
      }
    }

    res.json({
      data: {
        processed: results.length,
        total: loanIds.length,
        results,
        errors,
        processedBy: req.user?.id,
        processedAt: new Date(),
      },
    });
  })
);

/**
 * GET /approval-workflow/config
 * Get current approval workflow configuration
 */
router.get('/config',
  authorize(['ADMIN', 'SUPER_ADMIN', 'LOAN_OFFICER']),
  asyncHandler(async (req, res) => {
    const config = approvalWorkflowService.getConfig();
    
    res.json({
      data: config,
    });
  })
);

/**
 * PUT /approval-workflow/config
 * Update approval workflow configuration
 */
router.put('/config',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (req, res) => {
    const schema = yup.object({
      autoApprovalThreshold: yup.number().min(0).max(100),
      autoRejectionThreshold: yup.number().min(0).max(100),
      maxLoanAmount: yup.number().min(0),
      minCreditScore: yup.number().min(300).max(850),
      maxDebtToIncomeRatio: yup.number().min(0).max(1),
      enableMachineLearning: yup.boolean(),
      requireManualReview: yup.boolean(),
      notificationEnabled: yup.boolean(),
    });

    const config = await schema.validate(req.body);

    // Validate that auto approval threshold is higher than rejection threshold
    if (config.autoApprovalThreshold && config.autoRejectionThreshold &&
        config.autoApprovalThreshold <= config.autoRejectionThreshold) {
      res.status(400).json({
        error: {
          code: 'INVALID_THRESHOLDS',
          message: 'Auto approval threshold must be higher than auto rejection threshold',
        },
      });
      return;
    }

    approvalWorkflowService.updateConfig(config);

    res.json({
      data: approvalWorkflowService.getConfig(),
      updatedBy: req.user?.id,
      updatedAt: new Date(),
    });
  })
);

/**
 * GET /approval-workflow/rules
 * Get all approval rules
 */
router.get('/rules',
  authorize(['ADMIN', 'SUPER_ADMIN', 'LOAN_OFFICER']),
  asyncHandler(async (req, res) => {
    const rules = approvalWorkflowService.getRules();
    
    res.json({
      data: rules.map(rule => ({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        category: rule.category,
        weight: rule.weight,
      })),
    });
  })
);

/**
 * POST /approval-workflow/rules
 * Add or update approval rule
 */
router.post('/rules',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (req, res) => {
    const schema = yup.object({
      id: yup.string().required(),
      name: yup.string().required(),
      description: yup.string().required(),
      category: yup.string().oneOf(['credit', 'income', 'risk', 'history', 'compliance']).required(),
      weight: yup.number().required(),
      conditionCode: yup.string().required(), // JavaScript code for the condition
    });

    const { id, name, description, category, weight, conditionCode } = await schema.validate(req.body);

    // Create condition function from code (in a real system, this would be more secure)
    let condition: (loan: any, user: any) => boolean;
    try {
      // Simplified function creation - in production, use a safer approach
      condition = new Function('loan', 'user', `return (${conditionCode});`) as any;
    } catch (error) {
      res.status(400).json({
        error: {
          code: 'INVALID_CONDITION_CODE',
          message: 'Invalid condition code provided',
          details: (error as Error).message,
        },
      });
      return;
    }

    const rule: ApprovalRule = {
      id,
      name,
      description,
      category,
      weight,
      condition,
    };

    approvalWorkflowService.addRule(rule);

    res.json({
      data: {
        id,
        name,
        description,
        category,
        weight,
        message: 'Rule added/updated successfully',
      },
      addedBy: req.user?.id,
      addedAt: new Date(),
    });
  })
);

/**
 * DELETE /approval-workflow/rules/:ruleId
 * Remove approval rule
 */
router.delete('/rules/:ruleId',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (req, res) => {
    const { ruleId } = req.params;

    const existingRules = approvalWorkflowService.getRules();
    const ruleExists = existingRules.find(r => r.id === ruleId);

    if (!ruleExists) {
      res.status(404).json({
        error: {
          code: 'RULE_NOT_FOUND',
          message: 'Approval rule not found',
        },
      });
      return;
    }

    approvalWorkflowService.removeRule(ruleId);

    res.json({
      data: {
        ruleId,
        message: 'Rule removed successfully',
      },
      removedBy: req.user?.id,
      removedAt: new Date(),
    });
  })
);

/**
 * POST /approval-workflow/simulate
 * Simulate approval workflow for testing
 */
router.post('/simulate',
  authorize(['ADMIN', 'SUPER_ADMIN', 'LOAN_OFFICER']),
  asyncHandler(async (req, res) => {
    const schema = yup.object({
      loanData: yup.object({
        amount: yup.number().positive().required(),
        duration: yup.number().positive().required(),
        interestRate: yup.number().positive().required(),
        purpose: yup.string().required(),
      }).required(),
      userData: yup.object({
        creditScore: yup.number().min(300).max(850),
        annualIncome: yup.number().positive(),
        employmentDuration: yup.number().min(0),
        monthlyDebtPayments: yup.number().min(0),
        hasRecentDefaults: yup.boolean(),
        identityVerified: yup.boolean(),
        kycComplete: yup.boolean(),
        amlClear: yup.boolean(),
        isExistingCustomer: yup.boolean(),
        paymentHistoryScore: yup.number().min(0).max(100),
      }).required(),
      skipManualReview: yup.boolean().default(false),
    });

    const { loanData, userData, skipManualReview } = await schema.validate(req.body);

    // Create mock loan and user objects
    const mockLoan = {
      _id: 'simulation',
      ...loanData,
      borrowerId: 'simulation',
      status: 'pending',
      createdAt: new Date(),
    } as any;

    const mockUser = {
      _id: 'simulation',
      email: 'simulation@example.com',
      name: 'Simulation User',
      role: 'BORROWER',
      ...userData,
    } as any;

    // Run simulation (without saving to database)
    const result = await approvalWorkflowService.processLoanApplication(
      mockLoan,
      mockUser,
      { skipManualReview }
    );

    res.json({
      data: {
        simulation: true,
        decision: result.decision,
        confidence: result.confidence,
        riskScore: result.riskScore,
        reasons: result.reasons,
        recommendedTerms: result.recommendedTerms,
        conditions: result.conditions,
        nextSteps: result.nextSteps,
        simulatedBy: req.user?.id,
        simulatedAt: new Date(),
      },
    });
  })
);

/**
 * GET /approval-workflow/statistics
 * Get approval workflow statistics
 */
router.get('/statistics',
  authorize(['ADMIN', 'SUPER_ADMIN', 'LOAN_OFFICER']),
  asyncHandler(async (req, res) => {
    const { period = 'last_30_days' } = req.query;

    // In a real system, this would query the database for actual statistics
    // For now, we'll return mock data
    const mockStats = {
      totalApplications: 1247,
      autoApproved: 523,
      autoRejected: 312,
      manualReview: 412,
      approvalRate: 65.8,
      averageProcessingTime: 4.2, // hours
      averageRiskScore: 67.3,
      topRejectionReasons: [
        { reason: 'Poor credit score', count: 156 },
        { reason: 'High debt-to-income ratio', count: 98 },
        { reason: 'Insufficient income verification', count: 87 },
      ],
      riskScoreDistribution: [
        { range: '0-20', count: 45 },
        { range: '21-40', count: 123 },
        { range: '41-60', count: 298 },
        { range: '61-80', count: 445 },
        { range: '81-100', count: 336 },
      ],
    };

    res.json({
      data: {
        period,
        statistics: mockStats,
        generatedAt: new Date(),
      },
    });
  })
);

export { router as approvalWorkflowRouter };