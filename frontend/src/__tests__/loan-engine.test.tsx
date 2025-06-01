/**
 * Simple LoanEngine integration test to catch runtime errors
 */

import { describe, it, expect } from 'vitest';
import { LoanEngine } from '@lendpeak/engine';

describe('LoanEngine Integration', () => {
  it('should create a loan and calculate payment without errors', () => {
    const loanTerms = LoanEngine.createLoan(
      100000,
      5.5,
      360,
      new Date(),
      {
        paymentFrequency: 'monthly',
        interestType: 'amortized',
      }
    );
    
    const paymentResult = LoanEngine.calculatePayment(loanTerms);
    const schedule = LoanEngine.generateSchedule(loanTerms);
    
    expect(paymentResult.monthlyPayment.toNumber()).toBeGreaterThan(0);
    expect(schedule.payments.length).toBe(360);
  });

  it('should handle different loan scenarios', () => {
    const scenarios = [
      { principal: 50000, rate: 3.5, term: 180 },
      { principal: 250000, rate: 6.8, term: 360 },
      { principal: 15000, rate: 12.5, term: 60 },
    ];

    scenarios.forEach((scenario) => {
      const loanTerms = LoanEngine.createLoan(
        scenario.principal,
        scenario.rate,
        scenario.term,
        new Date(),
        {
          paymentFrequency: 'monthly',
          interestType: 'amortized',
        }
      );
      
      const paymentResult = LoanEngine.calculatePayment(loanTerms);
      
      expect(paymentResult.monthlyPayment.toNumber()).toBeGreaterThan(0);
    });
  });

  it('should calculate daily interest without errors', () => {
    const dailyInterest = LoanEngine.calculateDailyInterest(100000, 5.5);
    expect(dailyInterest.toNumber()).toBeGreaterThan(0);
  });
});