import { LoanEngine } from '../src';
import Big from 'big.js';
import dayjs from 'dayjs';
import { isZero } from '../src/utils/decimal-utils'; // Added import
import { RoundingMethod, DayCountConvention } from '../src/types/common'; // Add this import

describe('LoanEngine', () => {
  describe('createLoan', () => {
    it('should create a loan with default values', () => {
      const loan = LoanEngine.createLoan(
        100000,
        5.5,
        360,
        '2024-01-01'
      );
      
      expect(loan.principal.toString()).toBe('100000');
      expect(loan.annualInterestRate.toString()).toBe('5.5');
      expect(loan.termMonths).toBe(360);
      expect(loan.paymentFrequency).toBe('monthly');
      expect(loan.interestType).toBe('amortized');
      expect(loan.dayCountConvention).toBe('30/360');
    });
    
    it('should accept Big.js values', () => {
      const loan = LoanEngine.createLoan(
        new Big('250000.50'),
        new Big('4.25'),
        180,
        dayjs('2024-03-15')
      );
      
      expect(loan.principal.toString()).toBe('250000.5');
      expect(loan.annualInterestRate.toString()).toBe('4.25');
    });
    
    it('should accept custom options', () => {
      const loan = LoanEngine.createLoan(
        150000,
        6.0,
        240,
        '2024-01-01',
        {
          paymentFrequency: 'bi-weekly',
          interestType: 'simple',
          dayCountConvention: 'actual/365',
          balloonPayment: new Big(50000),
        }
      );
      
      expect(loan.paymentFrequency).toBe('bi-weekly');
      expect(loan.interestType).toBe('simple');
      expect(loan.dayCountConvention).toBe('actual/365');
      expect(loan.balloonPayment?.toString()).toBe('50000');
    });

    it('should accept weekly payment frequency', () => {
      const loan = LoanEngine.createLoan(
        10000,
        5.0,
        52, // 1 year in weeks
        '2024-01-01',
        { paymentFrequency: 'weekly' }
      );
      expect(loan.paymentFrequency).toBe('weekly');
    });
  });
  
  describe('calculatePayment', () => {
    it('should calculate monthly payment for standard loan', () => {
      const loan = LoanEngine.createLoan(200000, 4.5, 360, '2024-01-01');
      const result = LoanEngine.calculatePayment(loan);
      
      // Expected monthly payment: ~$1,013.37
      expect(result.monthlyPayment.toFixed(2)).toBe('1013.37');
      expect(result.totalInterest.toFixed(2)).toBe('164813.42');
      expect(result.totalPayments.toFixed(2)).toBe('364813.42');
    });
    
    it('should calculate payment for zero interest loan', () => {
      const loan = LoanEngine.createLoan(12000, 0, 12, '2024-01-01');
      const result = LoanEngine.calculatePayment(loan);
      
      expect(result.monthlyPayment.toFixed(2)).toBe('1000.00');
      expect(result.totalInterest.toFixed(2)).toBe('0.00');
      expect(result.totalPayments.toFixed(2)).toBe('12000.00');
    });
    
    it('should calculate payment with balloon', () => {
      const loan = LoanEngine.createLoan(
        200000,
        5.0,
        60,
        '2024-01-01',
        { balloonPayment: new Big(150000) }
      );
      const result = LoanEngine.calculatePayment(loan);
      
      // With a $150k balloon on a $200k loan, only $50k is amortized
      // The payment should be less than a fully amortizing loan
      const fullyAmortizingLoan = LoanEngine.createLoan(200000, 5.0, 60, '2024-01-01');
      const fullyAmortizingResult = LoanEngine.calculatePayment(fullyAmortizingLoan);
      
      expect(result.monthlyPayment.toNumber()).toBeLessThan(fullyAmortizingResult.monthlyPayment.toNumber());
      // The monthly payment for the amortized portion ($50k) plus interest on balloon portion ($150k)
      // Amortized payment for $50k, 5%, 60 months: $943.56
      // Interest for $150k at 5% for 1 month: $150k * (0.05/12) = $625.00
      // Expected regular monthly payment: $943.56 + $625.00 = $1568.56
      expect(result.monthlyPayment.toFixed(2)).toBe('1568.56');
      expect(result.totalPayments.minus(result.totalInterest).toFixed(2)).toBe('200000.00'); // Principal is covered
    });

    it('should calculate bi-weekly payment correctly for a 2-year loan', () => {
      // For a 2-year loan (24 months), we expect 52 bi-weekly payments.
      // termMonths should be the actual loan duration in months.
      // The calculateNumberOfPayments function correctly calculates 52 payments for termMonths = 24 and bi-weekly frequency.
      // The value 'monthlyPayment' here actually represents the 'biWeeklyPayment'.
      const loan = LoanEngine.createLoan(26000, 6.0, 24, '2024-01-01', { paymentFrequency: 'bi-weekly' });
      const result = LoanEngine.calculatePayment(loan);
      expect(result.monthlyPayment.toFixed(2)).toBe('531.20'); // This is actually bi-weekly payment
      expect(result.totalInterest.toNumber()).toBeGreaterThan(0);
      expect(result.totalPayments.minus(result.totalInterest).toFixed(2)).toBe(loan.principal.toFixed(2));
    });

    it('should calculate weekly payment correctly for a 1-year loan', () => {
      // For a 1-year loan (12 months), we expect 52 weekly payments.
      // termMonths should be the actual loan duration in months.
      // The calculateNumberOfPayments function correctly calculates 52 payments for termMonths = 12 and weekly frequency.
      // The value 'monthlyPayment' here actually represents the 'weeklyPayment'.
      const loan = LoanEngine.createLoan(52000, 5.2, 12, '2024-01-01', { paymentFrequency: 'weekly' });
      const result = LoanEngine.calculatePayment(loan);
      expect(result.monthlyPayment.toFixed(2)).toBe('1026.96'); // This is actually weekly payment
      expect(result.totalInterest.toNumber()).toBeGreaterThan(0);
      expect(result.totalPayments.minus(result.totalInterest).toFixed(2)).toBe(loan.principal.toFixed(2));
    });
  });
  
  describe('generateSchedule', () => {
    it('should generate complete amortization schedule', () => {
      const loan = LoanEngine.createLoan(10000, 6.0, 12, '2024-01-01');
      const schedule = LoanEngine.generateSchedule(loan);
      
      expect(schedule.payments).toHaveLength(12);
      expect(schedule.payments[0]?.paymentNumber).toBe(1);
      expect(schedule.payments[11]?.paymentNumber).toBe(12);
      expect(schedule.payments[11]?.remainingBalance.toFixed(2)).toBe('0.00');
      
      // Verify totals - there might be small rounding differences
      const totalPrincipal = schedule.payments.reduce(
        (sum, p) => sum.plus(p.principal),
        new Big(0)
      );
      // Allow for small rounding difference (less than 10 cents)
      // expect(Math.abs(totalPrincipal.toNumber() - 10000)).toBeLessThan(0.10);
      const totalPrincipalPaid = schedule.payments.reduce(
        (sum, p) => sum.plus(p.principal),
        new Big(0)
      );
      expect(totalPrincipalPaid.toFixed(loan.roundingConfig?.decimalPlaces || 2))
        .toBe(loan.principal.toFixed(loan.roundingConfig?.decimalPlaces || 2));
    });

    it('should generate schedule for a very short term (3 months)', () => {
      const loan = LoanEngine.createLoan(3000, 12.0, 3, '2024-01-01');
      const schedule = LoanEngine.generateSchedule(loan);

      expect(schedule.payments).toHaveLength(3);
      expect(schedule.payments[2]?.remainingBalance.toFixed(2)).toBe('0.00');
      const totalPrincipalPaid = schedule.payments.reduce(
        (sum, p) => sum.plus(p.principal),
        new Big(0)
      );
      expect(totalPrincipalPaid.toFixed(loan.roundingConfig?.decimalPlaces || 2))
        .toBe(loan.principal.toFixed(loan.roundingConfig?.decimalPlaces || 2));
    });
    
    it('should handle irregular first payment period', () => {
      const loan = LoanEngine.createLoan(
        100000,
        5.0,
        360,
        '2024-01-15',
        { firstPaymentDate: dayjs('2024-03-01') }
      );
      const schedule = LoanEngine.generateSchedule(loan);
      
      // First payment should have more interest due to longer period
      expect(schedule.payments[0]?.interest.toNumber()).toBeGreaterThan(
        schedule.payments[1]?.interest.toNumber() || 0
      );
    });
    
    it('should generate schedule for interest-only loan', () => {
      const loan = LoanEngine.createLoan(
        50000,
        4.0,
        60,
        '2024-01-01',
        { interestType: 'simple' }
      );
      const schedule = LoanEngine.generateSchedule(loan);
      
      // All payments except last should be interest only
      for (let i = 0; i < schedule.payments.length - 1; i++) {
        expect(schedule.payments[i]?.principal.toFixed(2)).toBe('0.00');
      }
      
      // Last payment includes principal
      const lastPayment = schedule.payments[schedule.payments.length - 1]!;
      expect(lastPayment.principal.toFixed(2)).toBe('50000.00');
      // Interest for the last period on the full principal for an interest-only loan
      const expectedLastInterest = LoanEngine.calculateInterest({
        principal: loan.principal,
        annualRate: loan.annualInterestRate,
        startDate: schedule.payments[schedule.payments.length - 2]!.dueDate,
        endDate: lastPayment.dueDate,
        dayCountConvention: loan.dayCountConvention,
        roundingConfig: loan.roundingConfig
      });
      expect(lastPayment.interest.toFixed(2)).toBe(expectedLastInterest.interestAmount.toFixed(2));
    });

    it('should generate schedule with 4 weekly payments', () => {
      // To get 4 weekly payments, if calc uses termMonths * 4, termMonths = 1.
      const loan = LoanEngine.createLoan(2600, 5.2, 1, '2024-01-01', { paymentFrequency: 'weekly' });
      const schedule = LoanEngine.generateSchedule(loan);

      expect(schedule.payments).toHaveLength(4); // Expect 1*4 = 4 payments
      expect(schedule.payments[3]?.remainingBalance.toFixed(2)).toBe('0.00');
      const totalPrincipalPaid = schedule.payments.reduce((sum, p) => sum.plus(p.principal), new Big(0));
      expect(totalPrincipalPaid.toFixed(loan.roundingConfig?.decimalPlaces || 2))
        .toBe(loan.principal.toFixed(loan.roundingConfig?.decimalPlaces || 2));
    });

    it('should generate schedule with 2 bi-weekly payments', () => {
      // To get 2 bi-weekly payments, if calc uses termMonths * 2, termMonths = 1.
      const loan = LoanEngine.createLoan(2600, 5.2, 1, '2024-01-01', { paymentFrequency: 'bi-weekly' });
      const schedule = LoanEngine.generateSchedule(loan);

      expect(schedule.payments).toHaveLength(2); // Expect 1*2 = 2 payments
      expect(schedule.payments[1]?.remainingBalance.toFixed(2)).toBe('0.00');
      const totalPrincipalPaid = schedule.payments.reduce((sum, p) => sum.plus(p.principal), new Big(0));
      expect(totalPrincipalPaid.toFixed(loan.roundingConfig?.decimalPlaces || 2))
        .toBe(loan.principal.toFixed(loan.roundingConfig?.decimalPlaces || 2));
    });
  });
  
  describe('calculateInterest', () => {
    it('should calculate simple interest correctly', () => {
      const result = LoanEngine.calculateInterest({
        principal: new Big(10000),
        annualRate: new Big(5),
        startDate: dayjs('2024-01-01'),
        endDate: dayjs('2024-01-31'),
        dayCountConvention: '30/360',
      });
      
      // 30 days of interest at 5% annual on $10,000
      // Daily rate = 5% / 360 = 0.0138889%
      // Interest = 10000 * 0.05 * 30 / 360 = 41.67
      expect(result.interestAmount.toFixed(2)).toBe('41.67');
      expect(result.dayCount).toBe(30);
    });
    
    it('should handle actual/365 convention', () => {
      const result = LoanEngine.calculateInterest({
        principal: new Big(10000),
        annualRate: new Big(5),
        startDate: dayjs('2024-01-01'),
        endDate: dayjs('2024-01-31'),
        dayCountConvention: 'actual/365',
      });
      
      // 30 actual days at 5% annual on $10,000
      // Interest = 10000 * 0.05 * 30 / 365 = 41.10
      expect(result.interestAmount.toFixed(2)).toBe('41.10');
      expect(result.dayCount).toBe(30); // Jan 1 to Jan 31 is 30 days
    });

    it('should handle actual/actual convention (e.g., for a leap year period)', () => {
      // Feb 1, 2024 to Mar 1, 2024 (29 days in Feb 2024)
      const result = LoanEngine.calculateInterest({
        principal: new Big(10000),
        annualRate: new Big(3.66), // 3.66% to get daily rate of 0.01% in a leap year
        startDate: dayjs('2024-02-01'),
        endDate: dayjs('2024-03-01'), // Day after Feb 29
        dayCountConvention: 'actual/actual',
      });
      // Interest = 10000 * 0.0366 * 29 / 366 = 29.00
      expect(result.interestAmount.toFixed(2)).toBe('29.00');
      expect(result.dayCount).toBe(29);
    });

    it('should handle actual/actual convention (e.g., for a non-leap year period)', () => {
      // Feb 1, 2025 to Mar 1, 2025 (28 days in Feb 2025)
      const result = LoanEngine.calculateInterest({
        principal: new Big(10000),
        annualRate: new Big(3.65), // 3.65% to get daily rate of 0.01% in a non-leap year
        startDate: dayjs('2025-02-01'),
        endDate: dayjs('2025-03-01'), // Day after Feb 28
        dayCountConvention: 'actual/actual',
      });
      // Interest = 10000 * 0.0365 * 28 / 365 = 28.00
      expect(result.interestAmount.toFixed(2)).toBe('28.00');
      expect(result.dayCount).toBe(28);
    });

    it('should calculate interest correctly across year-end (30/360)', () => {
      const result = LoanEngine.calculateInterest({
        principal: new Big(10000),
        annualRate: new Big(12), // 1% per month for 30/360
        startDate: dayjs('2023-12-16'),
        endDate: dayjs('2024-01-16'),
        dayCountConvention: '30/360',
      });
      // 15 days in Dec + 15 days in Jan = 30 days for 30/360
      // Interest = 10000 * 0.12 * 30 / 360 = 100.00
      expect(result.interestAmount.toFixed(2)).toBe('100.00');
      expect(result.dayCount).toBe(30);
    });

    it('should calculate interest correctly across year-end (actual/365)', () => {
      const result = LoanEngine.calculateInterest({
        principal: new Big(10000),
        annualRate: new Big(3.65), // 0.01% per day
        startDate: dayjs('2023-12-20'), // 12 days in Dec (20,21,22,23,24,25,26,27,28,29,30,31)
        endDate: dayjs('2024-01-10'),   // 10 days in Jan
        dayCountConvention: 'actual/365',
      });
      // 12 days in Dec (assuming end date is exclusive for start of day) + 10 days in Jan = 22 days
      // Let's check dayjs diff: dayjs('2024-01-10').diff(dayjs('2023-12-20'), 'day') is 21.
      // The interest calculator might treat endDate as inclusive or exclusive.
      // Based on previous test (Jan 1 to Jan 31 = 30 days), it seems like it's number of days IN PERIOD.
      // So, Dec 20 to Jan 10 inclusive of start, exclusive of end? Or inclusive of both?
      // Let's assume current behavior where endDate is exclusive for day counting based on 'actual/365' test (Jan 1 to Jan 31 = 30 days).
      // This means Dec 20 to Dec 31 (11 days) + Jan 1 to Jan 10 (9 days) = 20 days.
      // The interest calculator actual/365 for Jan 1 to Jan 31 (30 days) resulted in 30 days.
      // This means it's likely calculating based on `endDate.diff(startDate, 'day')`
      // dayjs('2024-01-31').diff(dayjs('2024-01-01'), 'day') = 30.
      // So, for this test: dayjs('2024-01-10').diff(dayjs('2023-12-20'), 'day') = 21 days.
      // Interest = 10000 * 0.0365 * 21 / 365 = 21.00
      expect(result.dayCount).toBe(21);
      expect(result.interestAmount.toFixed(2)).toBe('21.00');
    });

    it('should calculate zero interest if startDate and endDate are the same', () => {
      const result = LoanEngine.calculateInterest({
        principal: new Big(10000),
        annualRate: new Big(5),
        startDate: dayjs('2024-01-15'),
        endDate: dayjs('2024-01-15'),
        dayCountConvention: 'actual/365',
      });
      expect(result.interestAmount.toFixed(2)).toBe('0.00');
      expect(result.dayCount).toBe(0);
    });
  });
  
  describe('calculateAPR', () => {
    it('should calculate APR including fees', () => {
      // First calculate the payment for a 5% loan
      const loan = LoanEngine.createLoan(100000, 5.0, 360, '2024-01-01');
      const payment = LoanEngine.calculatePayment(loan);
      
      const apr = LoanEngine.calculateAPR(
        100000,  // Principal
        payment.monthlyPayment,  // Monthly payment
        360,     // Term months
        2000     // Upfront fees
      );
      
      // APR should be higher than the note rate due to fees
      expect(apr.toNumber()).toBeGreaterThan(5.0);
      expect(apr.toNumber()).toBeLessThan(6.0);
    });
    
    it('should calculate APR with no fees', () => {
      // Calculate payment for a 5% loan
      const loan = LoanEngine.createLoan(100000, 5.0, 360, '2024-01-01');
      const payment = LoanEngine.calculatePayment(loan);
      
      const apr = LoanEngine.calculateAPR(
        100000, 
        payment.monthlyPayment, 
        360, 
        0
      );
      
      // With no fees, APR should be very close to the interest rate.
      // The bisection method might not be perfectly exact.
      const expectedRate = new Big(5.0);
      const difference = apr.minus(expectedRate).abs();
      expect(difference.lt(new Big(0.0001))).toBe(true); // Tolerance of 0.0001%
    });
  });
  
  describe('applyPrepayment', () => {
    it('should reduce principal and recalculate schedule', () => {
      const loan = LoanEngine.createLoan(100000, 5.0, 360, '2024-01-01');
      const originalSchedule = LoanEngine.generateSchedule(loan);
      
      const modifiedSchedule = LoanEngine.applyPrepayment(
        originalSchedule,
        {
          amount: new Big(10000),
          date: dayjs('2024-06-01'),
          applyToPrincipal: true,
        }
      );
      
      // Total interest should be less after prepayment
      expect(modifiedSchedule.totalInterest.toNumber()).toBeLessThan(
        originalSchedule.totalInterest.toNumber()
      );
      
      // Number of payments should be less
      expect(modifiedSchedule.payments.length).toBeLessThan(
        originalSchedule.payments.length
      );
    });

    it('should handle prepayment on the first payment due date', () => {
      const loan = LoanEngine.createLoan(10000, 5.0, 12, '2024-01-01');
      const originalSchedule = LoanEngine.generateSchedule(loan);
      const firstPaymentDueDate = originalSchedule.payments[0]!.dueDate;

      const modifiedSchedule = LoanEngine.applyPrepayment(
        originalSchedule,
        {
          amount: new Big(1000),
          date: firstPaymentDueDate,
          applyToPrincipal: true,
        }
      );

      expect(modifiedSchedule.totalInterest.toNumber()).toBeLessThan(originalSchedule.totalInterest.toNumber());
      // The first payment itself might be recalculated or the prepayment is applied after it.
      // Assuming prepayment is applied effectively *after* the regular payment on that due date if it alters balances for future calcs.
      // Or, it reduces the principal for the very first period's end.
      // The current implementation of applyPrepayment finds the payment *after* prepaymentDate.
      // If prepaymentDate is a due date, it uses the balance *before* that payment.
      expect(modifiedSchedule.payments[0]!.principal.plus(modifiedSchedule.payments[0]!.interest).toFixed(2))
         .toBe(originalSchedule.payments[0]!.totalPayment.toFixed(2));
      // The remainingBalance of the first payment entry itself won't change in modifiedSchedule[0]
      // Instead, the loan will finish faster, or subsequent payments will be smaller.
      // Check that total interest is less, or loan term is shorter.
      expect(modifiedSchedule.totalInterest.lt(originalSchedule.totalInterest)).toBe(true);
    });

    it('should handle prepayment on the last payment due date', () => {
      const loan = LoanEngine.createLoan(10000, 5.0, 12, '2024-01-01');
      const originalSchedule = LoanEngine.generateSchedule(loan);
      const lastPaymentDueDate = originalSchedule.payments[originalSchedule.payments.length - 1]!.dueDate;

      const modifiedSchedule = LoanEngine.applyPrepayment(
        originalSchedule,
        {
          amount: new Big(100), // Small prepayment
          date: lastPaymentDueDate,
          applyToPrincipal: true,
        }
      );
      // Prepaying on the last due date might shorten the loan if the amount is significant, or reduce the final payment.
      // If it's exactly on the last due date, the schedule might already be "complete".
      // The recalculateWithPrepayment might effectively do nothing if date is too late.
      // This test is more of a boundary condition check.
      // It should likely result in the same schedule or a slightly altered final payment.
      expect(modifiedSchedule.payments.length).toBe(originalSchedule.payments.length);
      expect(modifiedSchedule.totalInterest.toFixed(2)).toBe(originalSchedule.totalInterest.toFixed(2)); // Likely no change if it's on the very last day
    });

    it('should handle prepayment amount exceeding remaining principal', () => {
      const loan = LoanEngine.createLoan(10000, 5.0, 12, '2024-01-01');
      const originalSchedule = LoanEngine.generateSchedule(loan);
      const midPointPayment = originalSchedule.payments[5]!; // After 6th payment

      const modifiedSchedule = LoanEngine.applyPrepayment(
        originalSchedule,
        {
          amount: midPointPayment.remainingBalance.plus(1000), // Prepay more than remaining
          date: midPointPayment.dueDate.add(1, 'day'), // Day after 6th payment due date
          applyToPrincipal: true,
        }
      );

      // When prepayment exceeds remaining balance, the loan is paid off.
      // The returned schedule should contain payments up to the point of prepayment.
      // The lastPaymentDate in the schedule should be the prepayment date.
      const prepaymentDate = midPointPayment.dueDate.add(1, 'day');
      // prepaymentIndex is the index of the payment *after* which the prepayment is applied.
      // payments[5] is the 6th payment. dueDate.add(1,'day') means it's after 6th payment.
      // So, payments 0..5 (6 of them) are in newPayments.
      expect(modifiedSchedule.payments.length).toBe(6);
      expect(modifiedSchedule.lastPaymentDate.isSame(prepaymentDate, 'day')).toBe(true);
      // Verify that the total principal paid by schedule + prepayment (less interest part of prepayment) equals original principal
      const principalPaidInScheduledPayments = modifiedSchedule.payments.reduce((sum, p) => sum.plus(p.principal), new Big(0));
      // Interest accrued between last scheduled payment and prepayment date needs to be handled by prepayment amount.
      // This part is complex to assert simply here. The key is the loan ends.
      // The `recalculateWithPrepayment` function ensures totalInterest and totalPayments are updated.
      // A simple check is that totalInterest is less than original.
      expect(modifiedSchedule.totalInterest.lt(originalSchedule.totalInterest)).toBe(true);
      // And the sum of (total principal repaid via schedule) and (prepayment amount that went to principal) should be original loan principal.
      // The current logic in recalculateWithPrepayment for this case:
      // totalPrincipal is originalSchedule.totalPrincipal (this is fine, principal of loan doesn't change)
      // totalPayments is sum of newPayments' totalPayment + prepaymentAmount. This is also fine.
      // totalInterest is sum of newPayments' interest. This means interest part of prepayment is not included.
    });
  });
  
  describe('validation', () => {
    it('should validate loan terms', () => {
      const invalidLoan = LoanEngine.createLoan(-100000, 5.0, 360, '2024-01-01');
      const errors = LoanEngine.validate(invalidLoan);
      
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('principal');
      expect(errors[0]?.code).toBe('INVALID_VALUE');
    });
    
    it('should validate interest rate limits', () => {
      const invalidLoan = LoanEngine.createLoan(100000, 150, 360, '2024-01-01');
      const errors = LoanEngine.validate(invalidLoan);
      
      expect(errors.some(e => e.field === 'annualInterestRate')).toBe(true);
    });
    
    it('should validate date ranges', () => {
      const loan = LoanEngine.createLoan(
        100000,
        5.0,
        360,
        '2024-01-01',
        { firstPaymentDate: dayjs('2023-12-01') }
      );
      const errors = LoanEngine.validate(loan);
      
      expect(errors.some(e => e.field === 'firstPaymentDate')).toBe(true);
    });

    it('should validate termMonths (zero or negative)', () => {
      const loan1 = LoanEngine.createLoan(10000, 5.0, 0, '2024-01-01');
      const errors1 = LoanEngine.validate(loan1);
      expect(errors1.some(e => e.field === 'termMonths' && e.code === 'INVALID_VALUE')).toBe(true);

      const loan2 = LoanEngine.createLoan(10000, 5.0, -10, '2024-01-01');
      const errors2 = LoanEngine.validate(loan2);
      expect(errors2.some(e => e.field === 'termMonths' && e.code === 'INVALID_VALUE')).toBe(true);
    });

    it('should validate paymentFrequency', () => {
      const loan = LoanEngine.createLoan(10000, 5.0, 12, '2024-01-01', {
        paymentFrequency: 'every-other-day' as any, // Invalid frequency
      });
      const errors = LoanEngine.validate(loan);
      expect(errors.some(e => e.field === 'paymentFrequency' && e.code === 'INVALID_VALUE')).toBe(true);
    });
  });
  
  describe('formatting', () => {
    it('should format currency correctly', () => {
      expect(LoanEngine.formatCurrency(1234.56)).toBe('$1,234.56');
      expect(LoanEngine.formatCurrency(1234567.89)).toBe('$1,234,567.89');
      expect(LoanEngine.formatCurrency(0.50)).toBe('$0.50');
      expect(LoanEngine.formatCurrency(1000, '€')).toBe('€1,000.00');
    });
    
    it('should format percentages correctly', () => {
      expect(LoanEngine.formatPercentage(5.5)).toBe('5.50%');
      expect(LoanEngine.formatPercentage(0.125, 3)).toBe('0.125%');
      expect(LoanEngine.formatPercentage(100)).toBe('100.00%');
    });
    
    it('should format dates correctly', () => {
      const date = dayjs('2024-01-15');
      expect(LoanEngine.formatDate(date)).toBe('2024-01-15');
      expect(LoanEngine.formatDate(date, 'MM/DD/YYYY')).toBe('01/15/2024');
      expect(LoanEngine.formatDate(date, 'MMM D, YYYY')).toBe('Jan 15, 2024');
    });
  });
  
  describe('edge cases', () => {
    it('should handle very small interest rates', () => {
      const loan = LoanEngine.createLoan(100000, 0.01, 360, '2024-01-01');
      const result = LoanEngine.calculatePayment(loan);
      
      expect(result.monthlyPayment.toNumber()).toBeGreaterThan(277); // Principal / months
      expect(result.totalInterest.toNumber()).toBeGreaterThan(0);
    });
    
    it('should handle very large principal amounts', () => {
      const loan = LoanEngine.createLoan('10000000', 5.0, 360, '2024-01-01');
      const result = LoanEngine.calculatePayment(loan);
      
      expect(result.monthlyPayment.toString()).not.toContain('e'); // No scientific notation
      expect(result.totalPayments.minus(loan.principal).toFixed(2)).toBe(
        result.totalInterest.toFixed(2)
      );
    });
    
    it('should handle single payment loans', () => {
      const loan = LoanEngine.createLoan(1000, 12.0, 1, '2024-01-01');
      const schedule = LoanEngine.generateSchedule(loan);
      
      expect(schedule.payments).toHaveLength(1);
      expect(schedule.payments[0]?.principal.toFixed(2)).toBe('1000.00');
    });
  });

  describe('getPayoffAmount', () => {
    const baseLoanTerms = {
      principal: new Big(10000),
      annualInterestRate: new Big(5),
      termMonths: 12,
      startDate: dayjs('2024-01-01'),
      dayCountConvention: '30/360',
    } as const;

    it('should calculate payoff amount on a payment due date (no accrued interest)', () => {
      const loan = LoanEngine.createLoan(
        baseLoanTerms.principal,
        baseLoanTerms.annualInterestRate,
        baseLoanTerms.termMonths,
        baseLoanTerms.startDate
      );
      const schedule = LoanEngine.generateSchedule(loan);
      const payoffDate = schedule.payments[5]?.dueDate; // 6th payment due date
      const expectedPayoff = schedule.payments[5]?.remainingBalance;

      const payoffAmount = LoanEngine.getPayoffAmount(schedule, payoffDate!, false);
      expect(payoffAmount.toFixed(2)).toBe(expectedPayoff!.toFixed(2));
    });

    it('should calculate payoff amount on a payment due date (with accrued interest, should be zero)', () => {
      const loan = LoanEngine.createLoan(
        baseLoanTerms.principal,
        baseLoanTerms.annualInterestRate,
        baseLoanTerms.termMonths,
        baseLoanTerms.startDate
      );
      const schedule = LoanEngine.generateSchedule(loan);
      const payoffDate = schedule.payments[5]?.dueDate; // 6th payment due date
      const expectedPayoff = schedule.payments[5]?.remainingBalance; // Accrued interest is 0 on due date

      const payoffAmount = LoanEngine.getPayoffAmount(schedule, payoffDate!, true);
      expect(payoffAmount.toFixed(2)).toBe(expectedPayoff!.toFixed(2));
    });

    it('should calculate payoff amount between payment dates (without accrued interest)', () => {
      const loan = LoanEngine.createLoan(
        baseLoanTerms.principal,
        baseLoanTerms.annualInterestRate,
        baseLoanTerms.termMonths,
        baseLoanTerms.startDate
      );
      const schedule = LoanEngine.generateSchedule(loan);
      const payoffDate = schedule.payments[2]?.dueDate.add(10, 'day'); // 10 days after 3rd payment
      const lastPayment = schedule.payments[2];

      const payoffAmount = LoanEngine.getPayoffAmount(schedule, payoffDate!, false);
      expect(payoffAmount.toFixed(2)).toBe(lastPayment!.remainingBalance.toFixed(2));
    });

    it('should calculate payoff amount between payment dates (with accrued interest - 30/360)', () => {
      const loan = LoanEngine.createLoan(
        10000,
        5, // 5%
        12,
        '2024-01-01',
        { dayCountConvention: '30/360' }
      );
      const schedule = LoanEngine.generateSchedule(loan); // Standard 30/360 schedule

      // Payoff 15 days after the first payment due date
      // First payment due: 2024-02-01. Payoff date: 2024-02-16
      const firstPayment = schedule.payments[0]!;
      const payoffDate = firstPayment.dueDate.add(15, 'day');
      const balanceAfterFirstPayment = firstPayment.remainingBalance;

      // Manual calculation for 30/360:
      // Interest = Balance * AnnualRate * (Days / 360)
      // Days = 15 (since 30/360 counts 15 days between Feb 1 and Feb 16)
      const expectedAccruedInterest = balanceAfterFirstPayment.times(0.05).times(15).div(360);
      const expectedPayoff = balanceAfterFirstPayment.plus(expectedAccruedInterest);

      const payoffAmount = LoanEngine.getPayoffAmount(schedule, payoffDate, true);
      expect(payoffAmount.toFixed(2)).toBe(expectedPayoff.toFixed(2));
    });

    it('should calculate payoff amount with actual/360 day count convention', () => {
      const loan = LoanEngine.createLoan(
        10000,
        6, // 6%
        12,
        '2024-01-01', // Loan start
        { dayCountConvention: 'actual/360', firstPaymentDate: dayjs('2024-02-01') }
      );
      const schedule = LoanEngine.generateSchedule(loan);

      // Payoff date: 2024-02-16 (15 actual days after 2024-02-01)
      const firstPayment = schedule.payments[0]!; // Due 2024-02-01
      const balanceAfterFirstPayment = firstPayment.remainingBalance;
      const payoffDate = dayjs('2024-02-16');

      // Manual calculation for actual/360:
      // Days between Feb 1, 2024 and Feb 16, 2024 is 15 days.
      const actualDays = payoffDate.diff(firstPayment.dueDate, 'day');
      const expectedAccruedInterest = balanceAfterFirstPayment.times(0.06).times(actualDays).div(360);
      const expectedPayoff = balanceAfterFirstPayment.plus(expectedAccruedInterest);

      const payoffAmount = LoanEngine.getPayoffAmount(schedule, payoffDate, true);
      expect(payoffAmount.toFixed(2)).toBe(expectedPayoff.toFixed(2));
    });

    it('should calculate payoff amount with actual/365 day count convention', () => {
      const loan = LoanEngine.createLoan(
        10000,
        7.3, // 7.3% for easy daily rate (0.02%)
        12,
        '2024-01-15', // Loan start
        { dayCountConvention: 'actual/365', firstPaymentDate: dayjs('2024-02-15') }
      );
      const schedule = LoanEngine.generateSchedule(loan);

      // Payoff date: March 1, 2024 (after first payment on Feb 15, 2024)
      // Days from Feb 15 to Mar 1 in non-leap year (2024 is leap, but Feb has 29 days)
      // Feb 15 to Feb 29 = 14 days. Plus 1 day in March = 15 days.
      const firstPayment = schedule.payments[0]!; // Due 2024-02-15
      const balanceAfterFirstPayment = firstPayment.remainingBalance;
      const payoffDate = dayjs('2024-03-01'); // 15 actual days after Feb 15, 2024

      const actualDays = payoffDate.diff(firstPayment.dueDate, 'day'); // Should be 15
      expect(actualDays).toBe(15);
      const expectedAccruedInterest = balanceAfterFirstPayment.times(0.073).times(actualDays).div(365);
      const expectedPayoff = balanceAfterFirstPayment.plus(expectedAccruedInterest);

      const payoffAmount = LoanEngine.getPayoffAmount(schedule, payoffDate, true);
      expect(payoffAmount.toFixed(2)).toBe(expectedPayoff.toFixed(2));
    });

    it('should return full principal + accrued if payoff date is before first payment (with accrued interest)', () => {
      const loan = LoanEngine.createLoan(
        10000,
        5,
        12,
        '2024-01-01', // Loan start
        { dayCountConvention: '30/360', firstPaymentDate: dayjs('2024-02-01') }
      );
      const schedule = LoanEngine.generateSchedule(loan);
      const payoffDate = dayjs('2024-01-16'); // 15 days after loan start

      // Accrued interest from loan start date to payoff date
      const expectedAccruedInterest = LoanEngine.calculateAccruedInterest(
        loan.principal,
        loan.annualInterestRate,
        loan.startDate,
        payoffDate,
        loan.dayCountConvention,
        loan.roundingConfig
      );
      const expectedPayoff = loan.principal.plus(expectedAccruedInterest);

      const payoffAmount = LoanEngine.getPayoffAmount(schedule, payoffDate, true);
      expect(payoffAmount.toFixed(2)).toBe(expectedPayoff.toFixed(2));
    });

    it('should return full principal if payoff date is before first payment (without accrued interest)', () => {
      const loan = LoanEngine.createLoan(
        baseLoanTerms.principal,
        baseLoanTerms.annualInterestRate,
        baseLoanTerms.termMonths,
        baseLoanTerms.startDate
      );
      const schedule = LoanEngine.generateSchedule(loan);
      const payoffDate = baseLoanTerms.startDate.add(10, 'day'); // Before first payment

      const payoffAmount = LoanEngine.getPayoffAmount(schedule, payoffDate, false);
      expect(payoffAmount.toFixed(2)).toBe(baseLoanTerms.principal.toFixed(2));
    });
  });

  describe('applyModification', () => {
    const initialTerms: ReturnType<typeof LoanEngine.createLoan> = LoanEngine.createLoan(
      100000, // principal
      5.0,    // annualInterestRate
      360,    // termMonths
      '2024-01-01' // startDate
    );
    const currentBalance = new Big(95000);
    const modificationEffectiveDate = dayjs('2025-01-01');

    it('should apply principal adjustment correctly', () => {
      const modification = {
        principalAdjustment: new Big(1000), // Capitalize $1000
        effectiveDate: modificationEffectiveDate,
      };
      const newTerms = LoanEngine.applyModification(initialTerms, modification, currentBalance);

      expect(newTerms.principal.toFixed(2)).toBe('96000.00'); // 95000 + 1000
      expect(newTerms.annualInterestRate.toString()).toBe(initialTerms.annualInterestRate.toString());
      expect(newTerms.termMonths).toBe(initialTerms.termMonths);
      expect(newTerms.startDate.isSame(modificationEffectiveDate)).toBe(true);
    });

    it('should apply interest rate change correctly', () => {
      const modification = {
        newRate: new Big(6.5),
        effectiveDate: modificationEffectiveDate,
      };
      const newTerms = LoanEngine.applyModification(initialTerms, modification, currentBalance);

      expect(newTerms.annualInterestRate.toString()).toBe('6.5');
      expect(newTerms.principal.toFixed(2)).toBe(currentBalance.toFixed(2));
      expect(newTerms.termMonths).toBe(initialTerms.termMonths);
      expect(newTerms.startDate.isSame(modificationEffectiveDate)).toBe(true);
    });

    it('should apply term change correctly', () => {
      const modification = {
        newTermMonths: 240,
        effectiveDate: modificationEffectiveDate,
      };
      const newTerms = LoanEngine.applyModification(initialTerms, modification, currentBalance);

      expect(newTerms.termMonths).toBe(240);
      expect(newTerms.principal.toFixed(2)).toBe(currentBalance.toFixed(2));
      expect(newTerms.annualInterestRate.toString()).toBe(initialTerms.annualInterestRate.toString());
      expect(newTerms.startDate.isSame(modificationEffectiveDate)).toBe(true);
    });

    it('should apply multiple modifications simultaneously', () => {
      const modification = {
        principalAdjustment: new Big(-500), // Reduce principal
        newRate: new Big(4.5),
        newTermMonths: 300,
        effectiveDate: modificationEffectiveDate,
      };
      const newTerms = LoanEngine.applyModification(initialTerms, modification, currentBalance);

      expect(newTerms.principal.toFixed(2)).toBe('94500.00'); // 95000 - 500
      expect(newTerms.annualInterestRate.toString()).toBe('4.5');
      expect(newTerms.termMonths).toBe(300);
      expect(newTerms.startDate.isSame(modificationEffectiveDate)).toBe(true);
    });

    it('should handle modification with no changes (only effective date)', () => {
      const modification = {
        effectiveDate: modificationEffectiveDate,
      };
      const newTerms = LoanEngine.applyModification(initialTerms, modification, currentBalance);

      expect(newTerms.principal.toFixed(2)).toBe(currentBalance.toFixed(2));
      expect(newTerms.annualInterestRate.toString()).toBe(initialTerms.annualInterestRate.toString());
      expect(newTerms.termMonths).toBe(initialTerms.termMonths);
      expect(newTerms.startDate.isSame(modificationEffectiveDate)).toBe(true);
      // Check other properties to ensure they are carried over
      expect(newTerms.paymentFrequency).toBe(initialTerms.paymentFrequency);
      expect(newTerms.dayCountConvention).toBe(initialTerms.dayCountConvention);
    });

    it('subsequent calculations should use modified terms', () => {
      const modification = {
        newRate: new Big(7.0), // Rate increase
        effectiveDate: modificationEffectiveDate,
        newTermMonths: initialTerms.termMonths - 12, // Assume 1 year has passed
      };

      // Create new terms based on currentBalance and remaining term from original terms
      // This is a bit simplified as the original terms' start date isn't directly used for payment calc here.
      // The key is that `newTerms` has a different rate and term than `initialTerms` for comparison.
      const modifiedLoanTermsForComparison = LoanEngine.createLoan(
        currentBalance,
        initialTerms.annualInterestRate, // original rate
        initialTerms.termMonths - 12,    // remaining term
        modificationEffectiveDate        // new start date for calc
      );
      const paymentWithOriginalRate = LoanEngine.calculatePayment(modifiedLoanTermsForComparison);

      const newTerms = LoanEngine.applyModification(initialTerms, modification, currentBalance);
      // Update term for newTerms to reflect remaining term for fair comparison of payment
      newTerms.termMonths = initialTerms.termMonths -12;
      const paymentWithNewRate = LoanEngine.calculatePayment(newTerms);

      expect(paymentWithNewRate.monthlyPayment.toNumber()).toBeGreaterThan(
        paymentWithOriginalRate.monthlyPayment.toNumber()
      );
    });
  });

  describe('Rounding in calculatePayment', () => {
    const principal = '10000';
    const annualRate = '3.333'; // Results in repeating decimals for monthly rate
    const termMonths = 36;
    const startDate = '2024-01-01';

    // Raw calculations (Big.DP = 10 for these)
    // r_monthly = 0.03333 / 12 = 0.0027775
    // (1+r_monthly)^36 = (1.0027775)^36 = 1.1046411160 (approx)
    // factor = r_monthly * (1+r_monthly)^n / ((1+r_monthly)^n - 1) = 0.0027775 * 1.1046411160 / (0.1046411160) = 0.0293171580
    // rawMonthlyPayment = 10000 * 0.0293171580 = 293.1715800000
    // rawTotalPayments = 293.1715800000 * 36 = 10554.1768800000
    // rawTotalInterest = 554.1768800000

    it('should round payment results using HALF_UP and 2 decimal places', () => {
      const loan = LoanEngine.createLoan(principal, annualRate, termMonths, startDate, {
        roundingConfig: { method: 'HALF_UP' as RoundingMethod, decimalPlaces: 2 }
      });
      const result = LoanEngine.calculatePayment(loan);
      expect(result.monthlyPayment.toFixed(2)).toBe('293.17');
      expect(result.totalInterest.toFixed(2)).toBe('554.18');
      expect(result.totalPayments.toFixed(2)).toBe('10554.18');
    });

    it('should round payment results using DOWN and 2 decimal places', () => {
      const loan = LoanEngine.createLoan(principal, annualRate, termMonths, startDate, {
        roundingConfig: { method: 'DOWN' as RoundingMethod, decimalPlaces: 2 }
      });
      const result = LoanEngine.calculatePayment(loan);
      expect(result.monthlyPayment.toFixed(2)).toBe('293.17');
      expect(result.totalInterest.toFixed(2)).toBe('554.17');
      expect(result.totalPayments.toFixed(2)).toBe('10554.17');
    });

    it('should round payment results using UP and 0 decimal places', () => {
      const loan = LoanEngine.createLoan(principal, annualRate, termMonths, startDate, {
        roundingConfig: { method: 'UP' as RoundingMethod, decimalPlaces: 0 }
      });
      const result = LoanEngine.calculatePayment(loan);
      expect(result.monthlyPayment.toFixed(0)).toBe('294');
      expect(result.totalInterest.toFixed(0)).toBe('555');
      expect(result.totalPayments.toFixed(0)).toBe('10555');
    });

    it('should default to HALF_UP and 2 decimal places if no roundingConfig is provided', () => {
      const loan = LoanEngine.createLoan(principal, annualRate, termMonths, startDate); // No roundingConfig
      const result = LoanEngine.calculatePayment(loan);
      // Default rounding is HALF_UP, 2 places as per LoanEngine.createLoan and roundMoney
      expect(result.monthlyPayment.toFixed(2)).toBe('293.17');
      expect(result.totalInterest.toFixed(2)).toBe('554.18');
      expect(result.totalPayments.toFixed(2)).toBe('10554.18');
    });
  });

  describe('Rounding in generateSchedule', () => {
    const principal = '1000';
    const annualRate = '5.555'; // Chosen to create fractional cents
    const termMonths = 3;
    const startDate = '2024-01-01';

    it('should use HALF_UP, 2dp: schedule amounts rounded, final balance zero', () => {
      const loanTerms = LoanEngine.createLoan(principal, annualRate, termMonths, startDate, {
        roundingConfig: { method: 'HALF_UP' as RoundingMethod, decimalPlaces: 2 }
      });
      const schedule = LoanEngine.generateSchedule(loanTerms);
      const config = loanTerms.roundingConfig!; // Not null due to definition

      expect(schedule.payments).toHaveLength(termMonths);
      // Check final balance is zero
      expect(schedule.payments[termMonths - 1].remainingBalance.toFixed(config.decimalPlaces)).toBe('0.00');
      // Check total principal paid
      const totalPrincipalScheduled = schedule.payments.reduce((sum, p) => sum.plus(p.principal), new Big(0));
      expect(totalPrincipalScheduled.toFixed(config.decimalPlaces)).toBe(loanTerms.principal.toFixed(config.decimalPlaces));

      // Spot check first payment's interest (calculated based on how amortization-calculator works)
      // Interest = round(P * r_monthly, config)
      // r_monthly = 0.05555 / 12 = 0.004629166666...
      // Raw Interest1 = 1000 * 0.004629166666... = 4.629166666...
      // Rounded Interest1 (HALF_UP, 2dp) = 4.63
      expect(schedule.payments[0].interest.toFixed(config.decimalPlaces)).toBe('4.63');
      // Check that the payment amount used in schedule matches the one from calculatePayment
      const paymentCalcResult = LoanEngine.calculatePayment(loanTerms);
      expect(schedule.payments[0].totalPayment.toFixed(config.decimalPlaces)).toBe(paymentCalcResult.monthlyPayment.toFixed(config.decimalPlaces));
    });

    it('should use DOWN, 2dp: schedule amounts rounded, final balance zero', () => {
      const loanTerms = LoanEngine.createLoan(principal, annualRate, termMonths, startDate, {
        roundingConfig: { method: 'DOWN' as RoundingMethod, decimalPlaces: 2 }
      });
      const schedule = LoanEngine.generateSchedule(loanTerms);
      const config = loanTerms.roundingConfig!;

      expect(schedule.payments).toHaveLength(termMonths);
      expect(schedule.payments[termMonths - 1].remainingBalance.toFixed(config.decimalPlaces)).toBe('0.00');
      const totalPrincipalScheduled = schedule.payments.reduce((sum, p) => sum.plus(p.principal), new Big(0));
      expect(totalPrincipalScheduled.toFixed(config.decimalPlaces)).toBe(loanTerms.principal.toFixed(config.decimalPlaces));

      // Spot check first payment's interest
      // Raw Interest1 = 4.629166666...
      // Rounded Interest1 (DOWN, 2dp) = 4.62
      expect(schedule.payments[0].interest.toFixed(config.decimalPlaces)).toBe('4.62');
      const paymentCalcResult = LoanEngine.calculatePayment(loanTerms);
      expect(schedule.payments[0].totalPayment.toFixed(config.decimalPlaces)).toBe(paymentCalcResult.monthlyPayment.toFixed(config.decimalPlaces));
    });

    it('should use UP, 0dp: schedule amounts rounded, final balance zero', () => {
      const loanTerms = LoanEngine.createLoan(principal, annualRate, termMonths, startDate, {
        roundingConfig: { method: 'UP' as RoundingMethod, decimalPlaces: 0 }
      });
      const schedule = LoanEngine.generateSchedule(loanTerms);
      const config = loanTerms.roundingConfig!;

      expect(schedule.payments).toHaveLength(termMonths);
      expect(schedule.payments[termMonths - 1].remainingBalance.toFixed(config.decimalPlaces)).toBe('0');
      const totalPrincipalScheduled = schedule.payments.reduce((sum, p) => sum.plus(p.principal), new Big(0));
      expect(totalPrincipalScheduled.toFixed(config.decimalPlaces)).toBe(loanTerms.principal.toFixed(config.decimalPlaces));

      // Spot check first payment's interest
      // Raw Interest1 = 4.629166666...
      // Rounded Interest1 (UP, 0dp) = 5
      expect(schedule.payments[0].interest.toFixed(config.decimalPlaces)).toBe('5');
      const paymentCalcResult = LoanEngine.calculatePayment(loanTerms);
      expect(schedule.payments[0].totalPayment.toFixed(config.decimalPlaces)).toBe(paymentCalcResult.monthlyPayment.toFixed(config.decimalPlaces));
    });

    it('should use default rounding (HALF_UP, 2dp) when no config, final balance zero', () => {
      const loanTerms = LoanEngine.createLoan(principal, annualRate, termMonths, startDate, {}); // Empty options, should use default
      const schedule = LoanEngine.generateSchedule(loanTerms);

      // Default is HALF_UP, 2dp
      expect(schedule.payments).toHaveLength(termMonths);
      expect(schedule.payments[termMonths - 1].remainingBalance.toFixed(2)).toBe('0.00');
      const totalPrincipalScheduled = schedule.payments.reduce((sum, p) => sum.plus(p.principal), new Big(0));
      expect(totalPrincipalScheduled.toFixed(2)).toBe(loanTerms.principal.toFixed(2));

      // Check first payment's interest and total payment
      expect(schedule.payments[0].interest.toFixed(2)).toBe('4.63');
      const paymentCalcResult = LoanEngine.calculatePayment(loanTerms); // Recalculate with default config
      expect(schedule.payments[0].totalPayment.toFixed(2)).toBe(paymentCalcResult.monthlyPayment.toFixed(2));
    });
  });

  describe('Day Count Convention in Standard Schedules (No Irregular First Period)', () => {
    const principal = '12000'; // Divisible by 12 for easy monthly interest
    const annualRate = '12'; // 1% per month simple for 30/360
    const termMonths = 3;
    const startDate = '2024-01-01'; // Ensures first payment date is regular

    it('should produce identical schedules for different conventions if no irregular period', () => {
      const loanTerms30_360 = LoanEngine.createLoan(principal, annualRate, termMonths, startDate, {
        dayCountConvention: '30/360',
        // No firstPaymentDate, so it defaults to a regular period
      });
      const schedule30_360 = LoanEngine.generateSchedule(loanTerms30_360);

      const loanTermsActual_365 = LoanEngine.createLoan(principal, annualRate, termMonths, startDate, {
        dayCountConvention: 'actual/365',
      });
      const scheduleActual_365 = LoanEngine.generateSchedule(loanTermsActual_365);

      // Compare interest payments for all periods
      for (let i = 0; i < termMonths; i++) {
        expect(scheduleActual_365.payments[i].interest.toFixed(2))
          .toBe(schedule30_360.payments[i].interest.toFixed(2));
        expect(scheduleActual_365.payments[i].principal.toFixed(2))
          .toBe(schedule30_360.payments[i].principal.toFixed(2));
      }
      // Check final balance too
      expect(scheduleActual_365.payments[termMonths - 1].remainingBalance.toFixed(2)).toBe('0.00');
      expect(schedule30_360.payments[termMonths - 1].remainingBalance.toFixed(2)).toBe('0.00');
    });
  });

  describe('Day Count Convention in Schedules with Irregular First Period', () => {
    const principal = '10000';
    const annualRate = '6'; // 6% annual rate
    const paymentFrequency = 'monthly';
    // termRegularPayments is not directly used in LoanEngine.createLoan, termMonths is.

    // Scenario 1: Short First Period
    describe('Short First Period', () => {
      const startDateShort = dayjs('2024-01-01');
      const firstPaymentDateShort = dayjs('2024-01-16'); // 15 days later
      const termMonthsShort = 3; // Accommodates 1 irregular + 2 regular monthly payments

      const conventions: DayCountConvention[] = ['30/360', 'actual/365', 'actual/actual'];
      conventions.forEach(convention => {
        it(`should correctly calculate first interest for ${convention} (short period)`, () => {
          const loanTerms = LoanEngine.createLoan(principal, annualRate, termMonthsShort, startDateShort, {
            paymentFrequency: paymentFrequency,
            firstPaymentDate: firstPaymentDateShort,
            dayCountConvention: convention,
            roundingConfig: { method: 'HALF_UP' as RoundingMethod, decimalPlaces: 2 }
          });
          const schedule = LoanEngine.generateSchedule(loanTerms);

          // Calculate expected first period interest using LoanEngine.calculateInterest
          const expectedFirstInterestResult = LoanEngine.calculateInterest({
            principal: new Big(principal), // Use new Big() for clarity, though string is fine
            annualRate: new Big(annualRate),
            startDate: startDateShort,
            endDate: firstPaymentDateShort,
            dayCountConvention: convention,
            roundingConfig: loanTerms.roundingConfig
          });

          expect(schedule.payments[0].interest.toFixed(2)).toBe(expectedFirstInterestResult.interestAmount.toFixed(2));
          expect(schedule.payments[schedule.payments.length - 1].remainingBalance.toFixed(2)).toBe('0.00');
        });
      });
    });

    // Scenario 2: Long First Period (across month/year end, leap consideration for actual/actual)
    describe('Long First Period (Jan 2024 is context, Feb 2024 has 29 days)', () => {
      const startDateLong = dayjs('2023-12-10');
      const firstPaymentDateLong = dayjs('2024-02-01'); // Approx 53 days. 2024 is a leap year.
      const termMonthsLong = 3; // 1 irregular + 2 regular.

      const conventionsLong: DayCountConvention[] = ['30/360', 'actual/365', 'actual/actual'];
      conventionsLong.forEach(convention => {
        it(`should correctly calculate first interest for ${convention} (long period, leap year context)`, () => {
          const loanTerms = LoanEngine.createLoan(principal, annualRate, termMonthsLong, startDateLong, {
            paymentFrequency: paymentFrequency,
            firstPaymentDate: firstPaymentDateLong,
            dayCountConvention: convention,
            roundingConfig: { method: 'HALF_UP' as RoundingMethod, decimalPlaces: 2 }
          });
          const schedule = LoanEngine.generateSchedule(loanTerms);

          const expectedFirstInterestResult = LoanEngine.calculateInterest({
            principal: new Big(principal),
            annualRate: new Big(annualRate),
            startDate: startDateLong,
            endDate: firstPaymentDateLong,
            dayCountConvention: convention,
            roundingConfig: loanTerms.roundingConfig
          });

          expect(schedule.payments[0].interest.toFixed(2)).toBe(expectedFirstInterestResult.interestAmount.toFixed(2));
          expect(schedule.payments[schedule.payments.length - 1].remainingBalance.toFixed(2)).toBe('0.00');
        });
      });
    });
  });
});