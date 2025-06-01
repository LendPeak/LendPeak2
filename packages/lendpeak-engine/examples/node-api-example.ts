import express from 'express';
import { LoanEngine, LoanTerms, ValidationError } from '@lendpeak/engine';

const app = express();
app.use(express.json());

// Calculate loan payment endpoint
app.post('/api/loans/calculate', (req, res) => {
  try {
    const { principal, rate, termMonths, startDate, paymentFrequency } = req.body;
    
    // Create loan with validation
    const loan = LoanEngine.createLoan(
      principal,
      rate,
      termMonths,
      startDate || new Date().toISOString().split('T')[0],
      {
        paymentFrequency: paymentFrequency || 'monthly',
      }
    );
    
    // Validate loan terms
    const errors = LoanEngine.validate(loan);
    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Invalid loan parameters',
        details: errors,
      });
    }
    
    // Calculate payment
    const payment = LoanEngine.calculatePayment(loan);
    
    res.json({
      monthlyPayment: payment.monthlyPayment.toString(),
      totalInterest: payment.totalInterest.toString(),
      totalPayments: payment.totalPayments.toString(),
      effectiveAPR: payment.effectiveInterestRate.toString(),
      formatted: {
        monthlyPayment: LoanEngine.formatCurrency(payment.monthlyPayment),
        totalInterest: LoanEngine.formatCurrency(payment.totalInterest),
        totalPayments: LoanEngine.formatCurrency(payment.totalPayments),
        effectiveAPR: LoanEngine.formatPercentage(payment.effectiveInterestRate),
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Calculation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Generate amortization schedule endpoint
app.post('/api/loans/schedule', (req, res) => {
  try {
    const { principal, rate, termMonths, startDate, limit = 12 } = req.body;
    
    const loan = LoanEngine.createLoan(principal, rate, termMonths, startDate);
    
    // Validate
    const errors = LoanEngine.validate(loan);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Invalid loan parameters', details: errors });
    }
    
    // Generate schedule
    const schedule = LoanEngine.generateSchedule(loan);
    
    res.json({
      summary: {
        totalInterest: schedule.totalInterest.toString(),
        totalPrincipal: schedule.totalPrincipal.toString(),
        totalPayments: schedule.totalPayments.toString(),
        numberOfPayments: schedule.payments.length,
        lastPaymentDate: LoanEngine.formatDate(schedule.lastPaymentDate),
      },
      payments: schedule.payments.slice(0, limit).map(payment => ({
        paymentNumber: payment.paymentNumber,
        dueDate: LoanEngine.formatDate(payment.dueDate, 'YYYY-MM-DD'),
        principal: payment.principal.toString(),
        interest: payment.interest.toString(),
        totalPayment: payment.totalPayment.toString(),
        remainingBalance: payment.remainingBalance.toString(),
        formatted: {
          dueDate: LoanEngine.formatDate(payment.dueDate, 'MMM D, YYYY'),
          principal: LoanEngine.formatCurrency(payment.principal),
          interest: LoanEngine.formatCurrency(payment.interest),
          totalPayment: LoanEngine.formatCurrency(payment.totalPayment),
          remainingBalance: LoanEngine.formatCurrency(payment.remainingBalance),
        },
      })),
    });
  } catch (error) {
    res.status(500).json({
      error: 'Schedule generation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Calculate APR including fees
app.post('/api/loans/apr', (req, res) => {
  try {
    const { principal, monthlyPayment, termMonths, fees = 0 } = req.body;
    
    const apr = LoanEngine.calculateAPR(principal, monthlyPayment, termMonths, fees);
    
    res.json({
      apr: apr.toString(),
      formatted: LoanEngine.formatPercentage(apr),
    });
  } catch (error) {
    res.status(500).json({
      error: 'APR calculation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Calculate payoff amount
app.post('/api/loans/payoff', (req, res) => {
  try {
    const { loan, payoffDate } = req.body;
    
    // Recreate loan from request
    const loanTerms = LoanEngine.createLoan(
      loan.principal,
      loan.rate,
      loan.termMonths,
      loan.startDate,
      loan
    );
    
    // Generate schedule and calculate payoff
    const schedule = LoanEngine.generateSchedule(loanTerms);
    const payoffAmount = LoanEngine.getPayoffAmount(schedule, payoffDate, true);
    
    res.json({
      payoffAmount: payoffAmount.toString(),
      formatted: LoanEngine.formatCurrency(payoffAmount),
      payoffDate: payoffDate,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Payoff calculation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Loan calculation API running on port ${PORT}`);
});

// Example requests:
/*
POST /api/loans/calculate
{
  "principal": 250000,
  "rate": 4.5,
  "termMonths": 360,
  "startDate": "2024-01-01"
}

POST /api/loans/schedule
{
  "principal": 100000,
  "rate": 5.0,
  "termMonths": 180,
  "startDate": "2024-01-01",
  "limit": 24
}

POST /api/loans/apr
{
  "principal": 100000,
  "monthlyPayment": 536.82,
  "termMonths": 360,
  "fees": 2000
}
*/