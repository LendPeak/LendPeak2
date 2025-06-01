# Balloon Payment Documentation

## Overview

A balloon payment is a large, lump-sum payment scheduled at the end of a loan term that is significantly larger than the regular periodic payments. In LendPeak2, balloon payments typically arise from loan modifications, payment deferrals, or interest-only payment periods rather than being directly configured at loan origination.

## What Constitutes a Balloon Payment

### Definition Thresholds

A payment is considered a "balloon payment" when it exceeds the regular periodic payment by a configurable threshold:

```typescript
interface BalloonPaymentConfig {
  // Percentage threshold above regular payment
  percentageThreshold: number; // Default: 50% (1.5x regular payment)
  
  // Absolute dollar threshold above regular payment
  absoluteThreshold: Big; // Default: $500
  
  // Use whichever threshold is lower
  thresholdLogic: 'AND' | 'OR'; // Default: 'OR'
}
```

### Examples

Given a loan with regular monthly payment (EMI) of $600:

1. **Not a Balloon**: Last payment of $650
   - Only 8.3% above regular payment
   - Only $50 above regular payment
   - Does not meet either threshold

2. **Balloon Payment**: Last payment of $1,200
   - 100% above regular payment (meets 50% threshold)
   - $600 above regular payment (meets $500 threshold)
   - Qualifies as balloon payment

3. **Edge Case**: Last payment of $950
   - 58.3% above regular payment (meets 50% threshold)
   - $350 above regular payment (does not meet $500 threshold)
   - With 'OR' logic: Qualifies as balloon
   - With 'AND' logic: Does not qualify

## Common Scenarios Creating Balloon Payments

### 1. Interest-Only Modifications

When a borrower struggles with payments, a loan might be modified to interest-only for a period:

```
Original loan: $200,000, 5%, 30 years
Regular payment: $1,073.64

Modification: Interest-only for 12 months
Interest-only payment: $833.33
Deferred principal per month: $240.31

Result: After 12 months, ~$2,884 in principal is deferred
This creates a balloon payment at loan maturity
```

### 2. Payment Deferrals

COVID-19 forbearance or natural disaster deferrals:

```
Scenario: 3-month payment deferral
Regular payment: $1,500
Deferred amount: $4,500

Options:
1. Add to final payment → $6,000 balloon payment
2. Spread over remaining term → Higher monthly payments
3. Extend loan term → Same payment, longer duration
```

### 3. Partial Payments Accumulation

When borrowers consistently pay less than required:

```
Required payment: $800
Actual payments: $600 (for 6 months)
Shortfall: $1,200

This shortfall must be resolved, often creating a balloon
```

### 4. Loan Restructuring

Combining multiple modifications:

```
Original: 15-year term, $1,200/month
Restructure: 10-year term to reduce total interest

Result: Final payment includes remaining principal
Creating potential balloon of $5,000-$10,000
```

## Balloon Payment Handling Strategies

### 1. Let It Balloon (Default)

The system allows the balloon payment to remain as scheduled:

```typescript
{
  strategy: 'ALLOW_BALLOON',
  // No additional configuration needed
  // Borrower must pay full balloon amount at maturity
}
```

**Use Case**: Borrower has confirmed ability to pay (refinancing planned, asset sale expected)

### 2. Split Across Multiple Payments

Distribute the balloon amount across the last several payments:

```typescript
{
  strategy: 'SPLIT_PAYMENTS',
  config: {
    numberOfPayments: 3, // Split across last 3 payments
    distributionMethod: 'EQUAL' | 'GRADUATED',
    maxPaymentIncrease: 0.5 // Max 50% increase per payment
  }
}
```

**Example**:
- Balloon amount: $3,000
- Regular payment: $1,000
- Split across 3 payments: $1,000 extra each
- Final 3 payments: $2,000 each

### 3. Contract Extension

Extend the loan term to amortize the balloon:

```typescript
{
  strategy: 'EXTEND_CONTRACT',
  config: {
    maxExtensionMonths: 12, // Maximum extension allowed
    targetPaymentIncrease: 0.1, // Try to keep payment within 10% of original
    requiresApproval: true // Needs underwriting approval
  }
}
```

**Example**:
- Balloon amount: $5,000
- Current payment: $1,200
- Extend by 6 months to keep payments near $1,200

### 4. Hybrid Approach

Combine strategies based on balloon size:

```typescript
{
  strategy: 'HYBRID',
  config: {
    smallBalloonThreshold: 2000, // Under $2k: split payments
    largeBalloonThreshold: 5000, // Over $5k: extend contract
    // Between $2k-$5k: offer borrower choice
  }
}
```

## Configuration Implementation

### Loan-Level Settings

Each loan can have its own balloon payment configuration:

```typescript
interface LoanBalloonConfig {
  // Detection settings
  detection: {
    enabled: boolean;
    percentageThreshold: number;
    absoluteThreshold: Big;
    thresholdLogic: 'AND' | 'OR';
  };
  
  // Handling strategy
  handling: {
    strategy: BalloonStrategy;
    config: BalloonStrategyConfig;
    notificationDays: number[]; // e.g., [180, 90, 30] days before
  };
  
  // Audit requirements
  audit: {
    requiresApproval: boolean;
    approvalLevel: 'AUTOMATIC' | 'SUPERVISOR' | 'UNDERWRITING';
    documentationRequired: string[];
  };
}
```

### System-Wide Defaults

Configure defaults at the system level:

```typescript
interface SystemBalloonDefaults {
  // Default detection thresholds
  defaultPercentageThreshold: 50; // 50% above regular payment
  defaultAbsoluteThreshold: 500; // $500 above regular payment
  
  // Default handling
  defaultStrategy: 'ALLOW_BALLOON';
  
  // Compliance limits
  maxBalloonPercentage: 200; // Max 200% of regular payment
  maxExtensionMonths: 24; // Max 2-year extension
  
  // State-specific overrides
  stateOverrides: {
    'CA': { maxBalloonPercentage: 150 },
    'NY': { requiresWrittenConsent: true }
  };
}
```

## Regulatory Compliance

### Federal Requirements

1. **TILA (Truth in Lending Act)**
   - Balloon payments must be clearly disclosed
   - APR calculations must include balloon effect
   - Requires special balloon payment disclosure

2. **RESPA (Real Estate Settlement Procedures Act)**
   - For mortgage loans, specific balloon disclosures required
   - Must provide notice 90-180 days before balloon due

### State-Specific Rules

Different states have different requirements:

```typescript
const stateCompliance = {
  'CA': {
    maxBalloonRatio: 1.5, // Max 150% of regular payment
    noticeRequired: 90, // 90 days notice
    coolingOffPeriod: 3 // 3-day right to cancel
  },
  'TX': {
    balloonProhibited: ['HOME_EQUITY'], // Prohibited for home equity
    maxTermWithBalloon: 84 // 7 years max with balloon
  },
  'NY': {
    writtenConsentRequired: true,
    separateDisclosure: true,
    maxBalloonAmount: 50000 // $50k max balloon
  }
};
```

## Notification Requirements

### Borrower Communications

```typescript
interface BalloonNotificationSchedule {
  // Initial notification when balloon detected
  detectionNotice: {
    timing: 'IMMEDIATE',
    channels: ['EMAIL', 'MAIL', 'PORTAL'],
    template: 'BALLOON_DETECTION_NOTICE'
  },
  
  // Reminder schedule
  reminders: [
    { daysBefore: 180, channel: 'MAIL', template: 'BALLOON_180_DAY' },
    { daysBefore: 90, channel: 'MAIL', template: 'BALLOON_90_DAY' },
    { daysBefore: 60, channel: 'EMAIL', template: 'BALLOON_60_DAY' },
    { daysBefore: 30, channel: 'ALL', template: 'BALLOON_30_DAY' },
    { daysBefore: 15, channel: 'ALL', template: 'BALLOON_URGENT' }
  ],
  
  // Options communication
  optionsPresentation: {
    daysBefore: 120,
    includeOptions: ['REFINANCE', 'EXTENSION', 'PAYMENT_PLAN'],
    requiresResponse: true
  }
}
```

## Implementation Workflow

### 1. Detection Process

```typescript
// Run during any loan modification or payment application
function detectBalloonPayment(loan: Loan): BalloonDetectionResult {
  const schedule = calculateAmortizationSchedule(loan);
  const regularPayment = loan.monthlyPayment;
  
  for (const payment of schedule) {
    const percentageIncrease = payment.amount.minus(regularPayment)
      .div(regularPayment)
      .times(100);
    
    const absoluteIncrease = payment.amount.minus(regularPayment);
    
    if (meetsBalloonThreshold(percentageIncrease, absoluteIncrease, loan.balloonConfig)) {
      return {
        detected: true,
        payment: payment,
        amount: payment.amount,
        date: payment.dueDate,
        exceedsRegularBy: {
          percentage: percentageIncrease,
          absolute: absoluteIncrease
        }
      };
    }
  }
  
  return { detected: false };
}
```

### 2. Strategy Selection

```typescript
async function selectBalloonStrategy(
  loan: Loan, 
  balloon: BalloonDetectionResult
): Promise<BalloonStrategy> {
  // Check loan-level configuration
  if (loan.balloonConfig?.handling?.strategy) {
    return loan.balloonConfig.handling.strategy;
  }
  
  // Apply business rules
  if (balloon.amount.gt(loan.originalPrincipal.times(0.2))) {
    // Large balloon (>20% of original): recommend extension
    return 'EXTEND_CONTRACT';
  }
  
  if (balloon.exceedsRegularBy.percentage.lt(100)) {
    // Moderate balloon (<100% increase): split payments
    return 'SPLIT_PAYMENTS';
  }
  
  // Default: allow balloon
  return 'ALLOW_BALLOON';
}
```

### 3. Modification Execution

```typescript
async function applyBalloonStrategy(
  loan: Loan,
  strategy: BalloonStrategy,
  config: BalloonStrategyConfig
): Promise<LoanModification> {
  const modification: LoanModification = {
    type: 'BALLOON_RESTRUCTURE',
    effectiveDate: new Date(),
    changes: {},
    audit: {
      performedBy: currentUser.id,
      reason: 'Balloon payment restructuring',
      previousState: loan.getCurrentState(),
    }
  };
  
  switch (strategy) {
    case 'SPLIT_PAYMENTS':
      modification.changes = calculateSplitPayments(loan, config);
      break;
      
    case 'EXTEND_CONTRACT':
      modification.changes = calculateExtension(loan, config);
      break;
      
    case 'ALLOW_BALLOON':
      // No changes, just record decision
      modification.changes = { balloonStrategy: 'ALLOWED' };
      break;
  }
  
  return await loan.applyModification(modification);
}
```

## Testing Scenarios

### Unit Test Cases

1. **Balloon Detection**
   - Regular payments with small final payment
   - Interest-only creating balloon
   - Multiple deferrals accumulating
   - Edge cases around thresholds

2. **Strategy Application**
   - Split payments evenly
   - Split with graduated increases
   - Extension calculations
   - Maximum limits enforcement

3. **Compliance Validation**
   - State-specific limits
   - Required notifications
   - Disclosure generation
   - Approval workflows

### Integration Test Scenarios

1. **Full Modification Flow**
   ```typescript
   test('should handle COVID forbearance creating balloon', async () => {
     const loan = createTestLoan({ amount: 200000, rate: 4.5, term: 360 });
     
     // Apply 6-month forbearance
     await loan.applyModification({
       type: 'FORBEARANCE',
       months: 6
     });
     
     // Detect balloon
     const detection = await detectBalloonPayment(loan);
     expect(detection.detected).toBe(true);
     expect(detection.amount).toBeGreaterThan(loan.monthlyPayment.times(1.5));
     
     // Apply strategy
     const result = await applyBalloonStrategy(loan, 'SPLIT_PAYMENTS', {
       numberOfPayments: 12
     });
     
     // Verify new schedule
     const newSchedule = await loan.getAmortizationSchedule();
     const lastPayments = newSchedule.slice(-12);
     
     // All last 12 payments should be elevated but manageable
     lastPayments.forEach(payment => {
       expect(payment.amount).toBeLessThan(loan.monthlyPayment.times(1.3));
     });
   });
   ```

## Monitoring and Reporting

### Key Metrics

```typescript
interface BalloonMetrics {
  // Portfolio metrics
  totalLoansWithBalloons: number;
  totalBalloonAmount: Big;
  averageBalloonSize: Big;
  
  // Risk metrics
  balloonsDueNext90Days: number;
  balloonDefaultRate: number;
  
  // Strategy effectiveness
  strategiesApplied: {
    ALLOW_BALLOON: number;
    SPLIT_PAYMENTS: number;
    EXTEND_CONTRACT: number;
  };
  
  // Compliance metrics
  notificationsSent: number;
  notificationDeliveryRate: number;
  regulatoryViolations: number;
}
```

### Dashboard Requirements

1. **Portfolio Overview**
   - Heatmap of balloon payments by maturity date
   - Distribution by size and strategy
   - Risk concentration analysis

2. **Individual Loan View**
   - Balloon payment details
   - Selected strategy and configuration
   - Notification history
   - Payment projections

3. **Compliance Dashboard**
   - Upcoming notification requirements
   - State-specific compliance status
   - Audit trail of all balloon-related decisions