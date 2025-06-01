# LendPeak Demo Mode

## Overview

LendPeak can run in a **Demo Mode** where the entire loan calculation engine runs in the browser without requiring any backend services. This is perfect for:

- 🚀 Quick demonstrations
- 🧪 Testing loan calculations
- 📚 Learning the system
- 🔧 Frontend development without backend setup

## Features

### Browser-Based Loan Engine
- Complete loan calculation engine ported to TypeScript
- Supports Fixed, Variable, and Compound interest calculations
- Real-time payment schedule generation
- APR and effective interest rate calculations

### Demo Data
- Pre-configured customers with different credit profiles
- Sample loans across various categories (auto, personal, mortgage, etc.)
- Loan templates for quick calculations

### Static Authentication
- Demo user credentials displayed on login page
- No backend authentication required
- All features accessible in demo mode

## Running Demo Mode

### Quick Start

```bash
# Install dependencies
cd frontend
npm install

# Run in demo mode
npm run dev:demo
```

The application will start at http://localhost:5173/

### Demo Credentials

```
Email: demo@lendpeak.com
Password: demo123
```

These credentials are displayed on the login page for convenience.

## Demo Mode Configuration

### Environment Variables

Create a `.env.demo` file or set these environment variables:

```env
VITE_DEMO_MODE=true
VITE_API_URL=demo
```

### Build for Production

```bash
npm run build:demo
```

## Demo Features

### 1. Loan Calculator
- Real-time calculations as you type
- Support for different interest types
- Visual payment schedule
- Amortization charts

### 2. Pre-configured Templates
- Auto Loan (5.9% APR, 60 months)
- Personal Loan (9.5% APR, 36 months)
- Home Mortgage (6.5% APR, 360 months)
- Student Loan (4.5% APR, 120 months)
- Business Loan (7.5% APR, 60 months)

### 3. Sample Customers
- John Smith (Credit Score: 750)
- Sarah Johnson (Credit Score: 680)
- Michael Chen (Credit Score: 820)
- Emily Davis (Credit Score: 720)

### 4. Dashboard Analytics
- Portfolio overview
- Payment collection forecasts
- Loan status distribution
- Real-time calculations

## Technical Details

### Loan Engine API

```typescript
import { LoanEngine, LoanParameters } from './engine/LoanEngine';

// Create a loan
const params: LoanParameters = {
  principal: 25000,
  interestRate: 6.5,
  termMonths: 60,
  interestType: 'FIXED',
  paymentFrequency: 'MONTHLY',
  fees: {
    originationFee: 1.5,
    processingFee: 299
  }
};

// Calculate
const engine = new LoanEngine(params);
const result = engine.calculate();

console.log(result.monthlyPayment); // Monthly payment amount
console.log(result.apr); // Annual percentage rate
console.log(result.paymentSchedule); // Full amortization schedule
```

### Interest Types

1. **Fixed Interest**: Traditional amortizing loan
2. **Variable Interest**: Simulates rate changes every 6 months
3. **Compound Interest**: Calculates with specified compounding frequency

## Limitations

Since demo mode runs entirely in the browser:

- No data persistence (refreshing loses changes)
- No real backend integration
- No document uploads
- No email notifications
- No multi-user collaboration

## Development

### Adding New Demo Data

Edit `/frontend/src/demo/demoData.ts`:

```typescript
export const DEMO_LOANS: DemoLoan[] = [
  // Add new demo loans here
];

export const DEMO_CUSTOMERS: DemoCustomer[] = [
  // Add new demo customers here
];
```

### Extending the Engine

The loan engine is in `/frontend/src/engine/LoanEngine.ts`. You can:

- Add new interest calculation methods
- Implement additional fee structures
- Add new payment frequencies
- Create custom calculation scenarios

## Transitioning to Full Mode

To switch from demo to full mode:

1. Set up the backend (MongoDB, Redis, etc.)
2. Update environment variables:
   ```env
   VITE_DEMO_MODE=false
   VITE_API_URL=http://localhost:3000/api/v1
   ```
3. Run both frontend and backend:
   ```bash
   npm run dev:all
   ```

## Benefits

- ✅ No backend setup required
- ✅ Instant calculations
- ✅ Perfect for demos and testing
- ✅ Works offline
- ✅ Fast development cycle
- ✅ Showcases core functionality