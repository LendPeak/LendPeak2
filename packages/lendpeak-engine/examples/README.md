# LendPeak Engine Examples

This directory contains examples of how to use the @lendpeak/engine package in your applications.

## Running the Examples

1. First, build the package:
   ```bash
   npm run build
   ```

2. Run any example:
   ```bash
   node examples/basic-usage.js
   ```

## Examples

- **basic-usage.ts** - Common loan calculation scenarios
- **react-example.tsx** - Using the engine in a React application
- **node-api-example.ts** - Using the engine in a Node.js API

## Integration Guide

### Browser (ES Modules)
```javascript
import { LoanEngine } from '@lendpeak/engine';

const loan = LoanEngine.createLoan(100000, 5.0, 360, '2024-01-01');
const payment = LoanEngine.calculatePayment(loan);
```

### Node.js (CommonJS)
```javascript
const { LoanEngine } = require('@lendpeak/engine');

const loan = LoanEngine.createLoan(100000, 5.0, 360, '2024-01-01');
const payment = LoanEngine.calculatePayment(loan);
```

### TypeScript
```typescript
import { LoanEngine, LoanTerms, AmortizationSchedule } from '@lendpeak/engine';

const loan: LoanTerms = LoanEngine.createLoan(100000, 5.0, 360, '2024-01-01');
const schedule: AmortizationSchedule = LoanEngine.generateSchedule(loan);
```