/**
 * Simple LoanEngine integration test to catch runtime errors
 */

import { describe, it, expect } from 'vitest';
import { LoanEngine } from '@lendpeak/engine';

describe('LoanEngine Simple Integration', () => {
  it('should calculate daily interest without errors', () => {
    const dailyInterest = LoanEngine.calculateDailyInterest(100000, 5.5);
    expect(dailyInterest.toNumber()).toBeGreaterThan(0);
    expect(dailyInterest.toNumber()).toBeCloseTo(15.28, 2);
  });
});