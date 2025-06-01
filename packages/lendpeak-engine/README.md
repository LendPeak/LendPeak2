# @lendpeak/engine

A stateless, high-precision loan calculation engine for financial applications. Built with TypeScript, Big.js for decimal precision, and dayjs for robust date handling.

## Features

- 🎯 **Precise Calculations**: Uses Big.js to avoid floating-point errors in financial calculations
- 📅 **Flexible Date Handling**: Supports multiple day count conventions (30/360, actual/360, actual/365, actual/actual)
- 💰 **Comprehensive Loan Types**: Amortizing, interest-only, and balloon payment loans
- 🔄 **Payment Frequencies**: Monthly, semi-monthly, bi-weekly, weekly, quarterly, semi-annual, and annual
- 📊 **Full Amortization Schedules**: Generate complete payment breakdowns with principal/interest splits
- 🔧 **Loan Modifications**: Support for prepayments, rate changes, and term adjustments
- ✅ **Built-in Validation**: Comprehensive validation for all loan parameters
- 🌐 **Universal Compatibility**: Works in both Node.js and browser environments
- 📦 **Zero Dependencies**: Only depends on big.js and dayjs

## Installation

```bash
npm install @lendpeak/engine
```

## Quick Start

```typescript
import { LoanEngine } from '@lendpeak/engine';

// Create a simple mortgage loan
const loan = LoanEngine.createLoan(
  250000,    // Principal
  4.5,       // Annual interest rate (%)
  360,       // Term in months (30 years)
  '2024-01-01'  // Start date
);

// Calculate monthly payment
const payment = LoanEngine.calculatePayment(loan);
console.log(LoanEngine.formatCurrency(payment.monthlyPayment)); // $1,266.71

// Generate full amortization schedule
const schedule = LoanEngine.generateSchedule(loan);
console.log(`Total Interest: ${LoanEngine.formatCurrency(schedule.totalInterest)}`); // $206,016.78
```

## Usage Examples

### Basic Loan Calculation

```typescript
// Create a car loan with bi-weekly payments
const carLoan = LoanEngine.createLoan(
  35000,     // Principal
  6.5,       // Annual interest rate
  60,        // 5-year term
  '2024-01-01',
  {
    paymentFrequency: 'bi-weekly',
    firstPaymentDate: LoanEngine.parseDate('2024-01-15')
  }
);

const result = LoanEngine.calculatePayment(carLoan);
console.log(`Bi-weekly Payment: ${LoanEngine.formatCurrency(result.monthlyPayment)}`);
```

### Interest-Only Loan

```typescript
const interestOnlyLoan = LoanEngine.createLoan(
  500000,    // Principal
  5.0,       // Annual interest rate
  120,       // 10-year term
  '2024-01-01',
  {
    interestType: 'simple',  // Interest-only
    paymentFrequency: 'monthly'
  }
);

const schedule = LoanEngine.generateSchedule(interestOnlyLoan);
// Monthly payments will be interest-only until the final payment
```

### Balloon Payment Loan

```typescript
const balloonLoan = LoanEngine.createLoan(
  200000,    // Principal
  4.0,       // Annual interest rate
  84,        // 7-year term
  '2024-01-01',
  {
    balloonPayment: new Big(150000),  // Large final payment
    balloonPaymentDate: LoanEngine.parseDate('2031-01-01')
  }
);

const payment = LoanEngine.calculatePayment(balloonLoan);
// Lower monthly payments with large balloon at end
```

### Applying Prepayments

```typescript
// Generate original schedule
const originalSchedule = LoanEngine.generateSchedule(loan);

// Apply a $10,000 prepayment after 1 year
const withPrepayment = LoanEngine.applyPrepayment(
  originalSchedule,
  {
    amount: new Big(10000),
    date: LoanEngine.parseDate('2025-01-01'),
    applyToPrincipal: true
  }
);

console.log(`Interest Saved: ${
  LoanEngine.formatCurrency(
    originalSchedule.totalInterest.minus(withPrepayment.totalInterest)
  )
}`);
```

### APR Calculation (Including Fees)

```typescript
// Calculate APR including origination fees
const apr = LoanEngine.calculateAPR(
  100000,    // Loan amount
  599.55,    // Monthly payment
  360,       // Term in months
  2000       // Upfront fees
);

console.log(`APR: ${LoanEngine.formatPercentage(apr)}`); // Higher than note rate due to fees
```

### Interest Accrual Calculation

```typescript
// Calculate daily interest accrual
const dailyInterest = LoanEngine.calculateDailyInterest(
  100000,    // Outstanding balance
  5.0,       // Annual rate
  'actual/365',  // Day count convention
  '2024-03-01'   // Date
);

console.log(`Daily Interest: ${LoanEngine.formatCurrency(dailyInterest)}`);

// Calculate interest between specific dates
const accruedInterest = LoanEngine.calculateAccruedInterest(
  100000,    // Principal
  5.0,       // Annual rate
  '2024-01-01',  // Start date
  '2024-03-31',  // End date
  '30/360'   // Day count convention
);
```

### Loan Validation

```typescript
// Validate loan parameters
const errors = LoanEngine.validate(loan);
if (errors.length > 0) {
  errors.forEach(error => {
    console.error(`${error.field}: ${error.message}`);
  });
}

// Quick validation check
if (!LoanEngine.isValid(loan)) {
  console.error('Invalid loan parameters');
}
```

## API Reference

### Core Methods

#### `LoanEngine.createLoan(principal, rate, termMonths, startDate, options?)`
Creates a new loan with the specified parameters.

#### `LoanEngine.calculatePayment(loan)`
Calculates the payment amount and total interest for a loan.

#### `LoanEngine.generateSchedule(loan)`
Generates a complete amortization schedule with all payments.

#### `LoanEngine.calculateAPR(principal, payment, termMonths, fees)`
Calculates the Annual Percentage Rate including fees.

### Formatting Utilities

#### `LoanEngine.formatCurrency(value, symbol?, decimals?)`
Formats a number as currency with proper separators.

#### `LoanEngine.formatPercentage(value, decimals?)`
Formats a number as a percentage.

#### `LoanEngine.formatDate(date, format?)`
Formats a date using the specified format string.

### Date Utilities

#### `LoanEngine.parseDate(dateString, format?)`
Parses a date string into a Dayjs object.

#### `LoanEngine.getNextPaymentDate(currentDate, frequency)`
Calculates the next payment date based on frequency.

## TypeScript Support

Full TypeScript support with comprehensive type definitions:

```typescript
import { 
  LoanEngine, 
  LoanTerms, 
  AmortizationSchedule,
  Payment,
  PaymentFrequency 
} from '@lendpeak/engine';

// All types are fully typed
const loan: LoanTerms = LoanEngine.createLoan(100000, 5.0, 360, '2024-01-01');
const schedule: AmortizationSchedule = LoanEngine.generateSchedule(loan);
const payment: Payment = schedule.payments[0];
```

## Day Count Conventions

The engine supports multiple day count conventions used in different financial markets:

- **30/360**: Each month has 30 days, each year has 360 days
- **Actual/360**: Actual days in month, 360-day year
- **Actual/365**: Actual days in month, 365-day year
- **Actual/Actual**: Actual days in month, actual days in year (accounts for leap years)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Support

For bugs and feature requests, please [open an issue](https://github.com/lendpeak/lendpeak-engine/issues).