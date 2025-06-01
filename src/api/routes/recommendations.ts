import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validateRequest } from '../middleware/validate-request';
import { asyncHandler } from '../utils/async-handler';
import { recommendationService } from '../../services/recommendation.service';
import * as yup from 'yup';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Validation schemas
const userProfileSchema = yup.object({
  creditScore: yup.number().min(300).max(850).required(),
  annualIncome: yup.number().min(0).required(),
  employmentYears: yup.number().min(0).required(),
  existingDebt: yup.number().min(0).required(),
  purpose: yup.string().oneOf([
    'debt_consolidation',
    'home_improvement',
    'auto',
    'personal',
    'business',
    'medical',
    'vacation',
    'other'
  ]).required(),
  homeOwnership: yup.string().oneOf(['own', 'rent', 'mortgage']),
  monthlyIncome: yup.number().min(0),
  monthlyExpenses: yup.number().min(0),
});

const affordabilitySchema = yup.object({
  monthlyIncome: yup.number().min(0).required(),
  monthlyExpenses: yup.number().min(0).required(),
  existingDebtPayments: yup.number().min(0).required(),
  creditScore: yup.number().min(300).max(850).required(),
});

const loanApplicationSchema = yup.object({
  requestedAmount: yup.number().min(1000).max(1000000).required(),
  purpose: yup.string().required(),
  term: yup.number().min(6).max(84).required(),
  creditScore: yup.number().min(300).max(850).required(),
  annualIncome: yup.number().min(0).required(),
  employmentYears: yup.number().min(0).required(),
  homeOwnership: yup.string().oneOf(['own', 'rent', 'mortgage']),
});

const refinanceSchema = yup.object({
  loanId: yup.string().required(),
  currentBalance: yup.number().min(0).required(),
  currentRate: yup.number().min(0).max(1).required(),
  remainingTerm: yup.number().min(1).max(480).required(),
  paymentHistory: yup.string().oneOf(['excellent', 'good', 'fair', 'poor']).required(),
  creditScoreImprovement: yup.number().min(0).max(200),
});

/**
 * POST /recommendations/loan-products
 * Get loan product recommendations based on user profile
 */
router.post('/loan-products',
  validateRequest({ body: userProfileSchema }),
  asyncHandler(async (req, res) => {
    const profile = {
      ...req.body,
      userId: req.user?.id,
    };

    const recommendations = await recommendationService.recommendLoanProducts(profile);

    res.json({
      data: recommendations,
      profile: {
        creditScore: profile.creditScore,
        purpose: profile.purpose,
        requestedAnalysis: new Date(),
      },
    });
  })
);

/**
 * POST /recommendations/affordability
 * Calculate loan affordability based on financial profile
 */
router.post('/affordability',
  validateRequest({ body: affordabilitySchema }),
  asyncHandler(async (req, res) => {
    const affordability = await recommendationService.calculateLoanAffordability(req.body);

    res.json({
      data: affordability,
      calculatedAt: new Date(),
    });
  })
);

/**
 * POST /recommendations/predict-success
 * Predict loan success probability
 */
router.post('/predict-success',
  validateRequest({ body: loanApplicationSchema }),
  asyncHandler(async (req, res) => {
    const application = {
      ...req.body,
      userId: req.user?.id,
    };

    const prediction = await recommendationService.predictLoanSuccess(application);

    res.json({
      data: prediction,
      application: {
        amount: application.requestedAmount,
        purpose: application.purpose,
        term: application.term,
      },
      predictedAt: new Date(),
    });
  })
);

/**
 * GET /recommendations/similar-loans
 * Find similar successful loans
 */
router.get('/similar-loans',
  asyncHandler(async (req, res) => {
    const { creditScore, loanAmount, purpose } = req.query;

    if (!creditScore || !loanAmount || !purpose) {
      res.status(400).json({
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'creditScore, loanAmount, and purpose are required',
        },
      });
      return;
    }

    const profile = {
      creditScore: Number(creditScore),
      loanAmount: Number(loanAmount),
      purpose: purpose as string,
    };

    const similarLoans = await recommendationService.getSimilarLoans(profile);

    res.json({
      data: similarLoans.map(loan => ({
        amount: loan.principal?.toString(),
        rate: loan.interestRate?.times(100).toFixed(2) + '%',
        term: loan.term,
        status: loan.status,
        purpose: loan.purpose,
      })),
      criteria: profile,
      found: similarLoans.length,
    });
  })
);

/**
 * POST /recommendations/refinance
 * Get refinance recommendations for existing loan
 */
router.post('/refinance',
  validateRequest({ body: refinanceSchema }),
  asyncHandler(async (req, res) => {
    const refinanceOptions = await recommendationService.recommendRefinanceOptions(req.body);

    res.json({
      data: refinanceOptions,
      currentLoan: {
        loanId: req.body.loanId,
        currentBalance: req.body.currentBalance,
        currentRate: req.body.currentRate,
      },
      analyzedAt: new Date(),
    });
  })
);

/**
 * GET /recommendations/tips
 * Get personalized financial tips
 */
router.get('/tips',
  asyncHandler(async (req, res) => {
    const { 
      creditScore, 
      debtToIncomeRatio, 
      paymentHistory, 
      savingsBalance 
    } = req.query;

    const profile = {
      userId: req.user?.id,
      creditScore: creditScore ? Number(creditScore) : undefined,
      debtToIncomeRatio: debtToIncomeRatio ? Number(debtToIncomeRatio) : undefined,
      paymentHistory: paymentHistory as string,
      savingsBalance: savingsBalance ? Number(savingsBalance) : undefined,
    };

    const tips = await recommendationService.getPersonalizedTips(profile);

    res.json({
      data: tips,
      profile: {
        creditScore: profile.creditScore,
        analyzed: tips.length > 0,
      },
      generatedAt: new Date(),
    });
  })
);

/**
 * POST /recommendations/train-model
 * Train the recommendation model (admin only)
 */
router.post('/train-model',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (req, res) => {
    await recommendationService.trainModel();

    res.json({
      message: 'Model training initiated',
      status: 'success',
      trainedAt: new Date(),
    });
  })
);

/**
 * GET /recommendations/loan-match
 * Find best loan match for user requirements
 */
router.get('/loan-match',
  asyncHandler(async (req, res) => {
    const {
      preferredAmount,
      maxMonthlyPayment,
      preferredTerm,
      creditScore,
      purpose,
    } = req.query;

    if (!preferredAmount || !creditScore || !purpose) {
      res.status(400).json({
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'preferredAmount, creditScore, and purpose are required',
        },
      });
      return;
    }

    const profile = {
      userId: req.user?.id,
      creditScore: Number(creditScore),
      annualIncome: 0, // Would be fetched from user profile
      employmentYears: 0,
      existingDebt: 0,
      purpose: purpose as string,
    };

    const recommendations = await recommendationService.recommendLoanProducts(profile);

    // Filter based on preferences
    const filteredRecommendations = recommendations.filter(rec => {
      const matchesAmount = !preferredAmount || 
        Math.abs(Number(rec.recommendedAmount) - Number(preferredAmount)) < Number(preferredAmount) * 0.2;
      
      const matchesPayment = !maxMonthlyPayment || 
        Number(rec.monthlyPayment) <= Number(maxMonthlyPayment);
      
      const matchesTerm = !preferredTerm || 
        Math.abs(rec.term - Number(preferredTerm)) <= 12;

      return matchesAmount && matchesPayment && matchesTerm;
    });

    res.json({
      data: filteredRecommendations,
      preferences: {
        amount: preferredAmount,
        maxPayment: maxMonthlyPayment,
        term: preferredTerm,
      },
      matches: filteredRecommendations.length,
    });
  })
);

/**
 * GET /recommendations/market-rates
 * Get current market rates for comparison
 */
router.get('/market-rates',
  asyncHandler(async (req, res) => {
    // Mock market rates - in production, this would fetch from external APIs
    const marketRates = {
      personalLoans: {
        excellent: { min: 3.5, max: 6.0, avg: 4.5 },
        good: { min: 5.5, max: 10.0, avg: 7.5 },
        fair: { min: 8.5, max: 18.0, avg: 12.5 },
      },
      autoLoans: {
        new: { min: 2.5, max: 5.0, avg: 3.5 },
        used: { min: 3.0, max: 8.0, avg: 5.0 },
      },
      mortgages: {
        fixed30: { min: 6.5, max: 8.0, avg: 7.2 },
        fixed15: { min: 6.0, max: 7.5, avg: 6.8 },
      },
      lastUpdated: new Date(),
    };

    res.json({
      data: marketRates,
      disclaimer: 'Rates are estimates and may vary based on individual qualifications',
    });
  })
);

export { router as recommendationsRouter };