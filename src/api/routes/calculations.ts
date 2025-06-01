import { Router } from 'express';
import Big from 'big.js';

const router = Router();

// For now, we'll implement simple calculations directly since
// the @lendpeak/engine package has a different API than expected
// This is temporary until we can update the frontend to use the new API

// Calculate daily simple interest
router.post('/interest/daily', (req, res) => {
  try {
    const { principal, annualRate, days, calendar } = req.body;
    
    const p = new Big(principal);
    const r = new Big(annualRate).div(100);
    const d = new Big(days);
    
    // Calculate days in year based on calendar
    let daysInYear = new Big(365);
    if (calendar === 'ACTUAL/360') {
      daysInYear = new Big(360);
    } else if (calendar === '30/360') {
      daysInYear = new Big(360);
    }
    
    // Daily rate
    const dailyRate = r.div(daysInYear);
    
    // Interest = Principal * Daily Rate * Days
    const interest = p.times(dailyRate).times(d);
    
    res.json({
      interest: interest.toFixed(2),
      perDiem: p.times(dailyRate).toFixed(6),
      principal,
      annualRate,
      days,
      calendar: calendar || 'ACTUAL/365',
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// Calculate amortized payment
router.post('/payment/amortized', (req, res) => {
  try {
    const { principal, annualRate, termMonths } = req.body;
    
    const p = new Big(principal);
    const annualR = new Big(annualRate).div(100);
    const n = new Big(termMonths);
    
    // Monthly interest rate
    const r = annualR.div(12);
    
    // Calculate monthly payment using amortization formula
    // M = P * [r(1+r)^n] / [(1+r)^n - 1]
    let monthlyPayment: Big;
    
    if (r.eq(0)) {
      // If interest rate is 0, just divide principal by number of months
      monthlyPayment = p.div(n);
    } else {
      const onePlusR = r.plus(1);
      const onePlusRPowN = onePlusR.pow(n.toNumber());
      
      monthlyPayment = p
        .times(r)
        .times(onePlusRPowN)
        .div(onePlusRPowN.minus(1));
    }
    
    // Calculate total payment and interest
    const totalPayment = monthlyPayment.times(n);
    const totalInterest = totalPayment.minus(p);
    
    // Simple APR calculation (actual APR calculation is more complex)
    const apr = annualR.times(100);
    
    res.json({
      monthlyPayment: monthlyPayment.toFixed(2),
      totalInterest: totalInterest.toFixed(2),
      totalPayment: totalPayment.toFixed(2),
      apr: apr.toFixed(3),
      principal,
      annualRate,
      termMonths,
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// Generate amortization schedule
router.post('/payment/schedule', (req, res) => {
  try {
    const { principal, annualRate, termMonths, firstPaymentDate, calendar } = req.body;
    
    const p = new Big(principal);
    const annualR = new Big(annualRate).div(100);
    const n = Number(termMonths);
    
    // Monthly interest rate
    const r = annualR.div(12);
    
    // Calculate monthly payment
    let monthlyPayment: Big;
    
    if (r.eq(0)) {
      monthlyPayment = p.div(n);
    } else {
      const onePlusR = r.plus(1);
      const onePlusRPowN = onePlusR.pow(n);
      
      monthlyPayment = p
        .times(r)
        .times(onePlusRPowN)
        .div(onePlusRPowN.minus(1));
    }
    
    // Generate schedule
    const schedule = [];
    let balance = p;
    const startDate = firstPaymentDate ? new Date(firstPaymentDate) : new Date();
    
    for (let i = 1; i <= n; i++) {
      const paymentDate = new Date(startDate);
      paymentDate.setMonth(paymentDate.getMonth() + i - 1);
      
      const interestPayment = balance.times(r);
      const principalPayment = monthlyPayment.minus(interestPayment);
      
      balance = balance.minus(principalPayment);
      
      // Handle rounding errors in the last payment
      if (i === n && !balance.eq(0)) {
        const adjustment = balance;
        principalPayment.plus(adjustment);
        balance = new Big(0);
      }
      
      schedule.push({
        paymentNumber: i,
        paymentDate: paymentDate.toISOString(),
        scheduledPayment: monthlyPayment.toFixed(2),
        principal: principalPayment.toFixed(2),
        interest: interestPayment.toFixed(2),
        balance: balance.toFixed(2),
      });
    }
    
    res.json({
      monthlyPayment: monthlyPayment.toFixed(2),
      schedule,
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// Apply payment waterfall
router.post('/waterfall/apply', (req, res) => {
  try {
    const { payment, outstandingAmounts, waterfallConfig } = req.body;
    
    // Use Big.js for precise calculations
    const paymentAmount = new Big(payment);
    const outstanding = {
      fees: new Big(outstandingAmounts.fees || '0'),
      penalties: new Big(outstandingAmounts.penalties || '0'),
      interest: new Big(outstandingAmounts.interest || '0'),
      principal: new Big(outstandingAmounts.principal || '0'),
      escrow: new Big(outstandingAmounts.escrow || '0'),
    };
    
    // Initialize allocations
    const allocations = {
      fees: new Big(0),
      penalties: new Big(0),
      interest: new Big(0),
      principal: new Big(0),
      escrow: new Big(0),
    };
    
    let remainingPayment = paymentAmount;
    
    // Default waterfall order if no config provided
    const defaultOrder = ['fees', 'penalties', 'interest', 'principal', 'escrow'];
    
    // Use custom waterfall config if provided
    let order = defaultOrder;
    if (waterfallConfig && waterfallConfig.steps) {
      order = waterfallConfig.steps.map((step: any) => step.type.toLowerCase());
    }
    
    // Apply payments according to waterfall
    for (const category of order) {
      if (remainingPayment.lte(0)) break;
      
      const outstandingInCategory = outstanding[category as keyof typeof outstanding];
      const allocationAmount = remainingPayment.gt(outstandingInCategory) 
        ? outstandingInCategory 
        : remainingPayment;
      
      allocations[category as keyof typeof allocations] = allocationAmount;
      remainingPayment = remainingPayment.minus(allocationAmount);
    }
    
    res.json({
      payment: paymentAmount.toFixed(2),
      allocations: {
        interest: allocations.interest.toFixed(2),
        principal: allocations.principal.toFixed(2),
        fees: allocations.fees.toFixed(2),
        escrow: allocations.escrow.toFixed(2),
        penalties: allocations.penalties.toFixed(2),
      },
      remainingPayment: remainingPayment.toFixed(2),
      waterfall: waterfallConfig?.name || 'Default',
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

export default router;