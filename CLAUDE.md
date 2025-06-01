# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## IMPORTANT: Documentation Reference

**Before making any implementation decisions or answering questions about requirements:**
1. **ALWAYS check `documents/MAIN.md`** for detailed business requirements and specifications
2. **ALWAYS check `documents/WORK.md`** for current task status and progression
3. **Update `documents/WORK.md`** as tasks are completed by checking off completed items
4. These documents are the source of truth for all feature requirements and implementation details

## Project Overview

LendPeak2 is a comprehensive loan management system designed to handle complex financial calculations, regulatory compliance, and multi-party loan structures. The system is being built to support millions of loans with high-precision calculations and extensive modification capabilities.

## CRITICAL ARCHITECTURE DECISION

### LendPeak Engine - Standalone Stateless Package

**MANDATORY**: The LendPeak Engine (`@lendpeak/engine`) is a **SEPARATE, STATELESS NPM PACKAGE** that:

1. **Lives in**: `packages/lendpeak-engine/`
2. **Published as**: `@lendpeak/engine` on npm
3. **Used by**: Both frontend and backend via `import { LoanEngine } from '@lendpeak/engine'`
4. **External usage**: Can be installed by third-party developers via `npm install @lendpeak/engine`

#### Key Characteristics:
- **NO database connections** - Pure calculation functions
- **NO API calls** - Takes inputs, returns outputs
- **NO side effects** - Completely stateless
- **NO frontend/backend dependencies** - Standalone package
- **Uses Big.js** for decimal precision
- **Uses dayjs** for date handling
- **Universal** - Works in Node.js and browsers

#### Example Usage:
```typescript
// In frontend
import { LoanEngine } from '@lendpeak/engine';
const payment = LoanEngine.calculatePayment(loanParams);

// In backend
import { LoanEngine } from '@lendpeak/engine';
const schedule = LoanEngine.generateSchedule(loanParams);

// External developers
npm install @lendpeak/engine
import { LoanEngine } from '@lendpeak/engine';
```

## Architecture Overview

### Core Components

1. **Stateless Loan Calculation Engine**
   - Uses Big.js for decimal precision in financial calculations
   - Supports multiple calculation methods: Daily Simple Interest (DSI), amortization, and blended modes
   - Implements configurable payment waterfalls for flexible payment allocation
   - Handles prepayments, curtailments, and complex restructuring scenarios

2. **Data Persistence Layer**
   - MongoDB-based architecture with document storage pattern
   - Each loan stored as a complete document for single-query access
   - Event sourcing for audit trails and CQRS for read/write separation
   - ACID compliance through MongoDB transactions

3. **Multi-Portal Architecture**
   - Borrower Portal: Self-service interface for payments and account management
   - Servicing Portal: Agent interface for loan modifications and customer service
   - Investor Portal: Real-time access to loan performance and reporting

4. **Compliance Engine**
   - Federal compliance: TILA, RESPA, FCRA, SCRA
   - State-specific APR caps and collection restrictions
   - Automated disclosure generation and regulatory reporting

## Development Commands

Since this is a new project without existing build infrastructure, the following commands will need to be established:

### Backend (Node.js/TypeScript expected)
```bash
# Development server (to be implemented)
npm run dev

# Run tests (to be implemented)
npm test
npm run test:watch

# Linting and type checking (to be implemented)
npm run lint
npm run typecheck

# Build for production (to be implemented)
npm run build
```

### Database
```bash
# MongoDB operations (to be implemented)
npm run db:seed      # Seed development data
npm run db:migrate   # Run migrations
```

## Key Technical Decisions

1. **Big.js for Financial Calculations**: Chosen for simplicity (6KB) and precision without complexity overhead
2. **MongoDB for Data Storage**: Document-based storage optimized for loan data with sharding support
3. **AWS Cognito for Authentication**: Supports SSO, MFA, and WebAuthn/Passkeys
4. **Stripe as Primary Payment Processor**: Superior webhook monitoring and retry logic for loan payments
5. **React with TypeScript**: Frontend framework for building scalable user interfaces
6. **Material-UI**: Component library with financial-appropriate styling

## Time Travel Mode (As-Of Date Analysis) - KEY FEATURE

The system includes comprehensive time travel functionality allowing analysis of loan data at any point in time:

### Implementation Requirements:
- Global as-of date selector in the UI header
- All calculations must respect the as-of date parameter
- Transactions after the as-of date are excluded
- Future projections are supported for "what-if" analysis
- API endpoints accept optional `asOfDate` parameter

### Key Use Cases:
- Regulatory audits requiring point-in-time loan states
- Customer dispute resolution with historical data
- Testing loan aging and calculations over time
- Financial reporting for specific dates
- Future cash flow projections

### Technical Considerations:
- Performance optimization for historical queries
- Clear visual indicators when viewing non-current dates
- Consistent date filtering across all services
- Integration with the loan calculation engine

## Infrastructure & DevOps Decisions

1. **Cloud Provider**: AWS for all infrastructure
2. **Infrastructure as Code**: AWS CDK for managing infrastructure
3. **CI/CD**: GitHub Actions for build and deployment pipelines
4. **Version Control**: Git with GitHub (remote repo to be provided)
5. **Container Registry**: Amazon ECR for Docker images
6. **Orchestration**: Amazon ECS or EKS (to be decided)
7. **Monitoring**: CloudWatch for logs and metrics

## Critical Implementation Notes

### Financial Calculations
- All monetary calculations must use Big.js to avoid floating-point errors
- APR calculations must achieve ±0.125% accuracy for TILA compliance
- Payment waterfalls must be configurable per loan with proper allocation tracking

### Compliance Requirements
- Every loan modification requires audit trail entries
- State APR caps must be checked in real-time (varies from 6% to no limit)
- Military status checks required for SCRA compliance (6% rate cap)

### Performance Targets
- API response time < 200ms (p95)
- Support 10,000+ loan applications per hour
- Sub-second loan calculation response times

### Security Considerations
- PCI DSS Level 1 compliance required for payment processing
- All sensitive data must be encrypted at rest and in transit
- Implement proper access controls for multi-tenant architecture

## Development Phases

The project follows a phased approach as outlined in documents/WORK.md:
1. **Phase 1**: Core loan engine and basic calculations
2. **Phase 2**: Advanced calculations and compliance
3. **Phase 3**: Restructuring and modifications
4. **Phase 4**: Bankruptcy and collateral management
5. **Phase 5**: Investor management
6. **Phase 6**: Delinquency and collections
7. **Phase 7**: Payment processing integration
8. **Phase 8**: User interfaces
9. **Phase 9**: Advanced AI/ML features
10. **Phase 10**: Operations and DevOps

### Working with Project Documentation

#### Requirements Lookup Process
1. **Question about business logic?** → Check `documents/MAIN.md`
2. **Question about feature details?** → Check `documents/MAIN.md` 
3. **Question about task status?** → Check `documents/WORK.md`
4. **Starting a new feature?** → Read both documents first

#### Task Management Process
1. **Before starting work**: Check `documents/WORK.md` for task details
2. **During development**: Refer to `documents/MAIN.md` for requirements
3. **After completing a task**: Update `documents/WORK.md` checkbox
4. **When blocked**: Document blockers in `documents/WORK.md`

#### Example Workflow
```bash
# Starting work on payment waterfalls
1. Check WORK.md → Find "[ ] Configurable payment waterfall system"
2. Check MAIN.md → Read "Payment allocation requires configurable waterfall hierarchies..."
3. Write tests based on MAIN.md requirements
4. Implement feature following TDD
5. Update WORK.md → "[x] Configurable payment waterfall system"
```

## Testing Strategy - MANDATORY TDD APPROACH

**IMPORTANT: All development MUST follow Test-Driven Development (TDD) principles. Write tests FIRST, then implementation.**

### TDD Process for Every Feature
1. **Red Phase**: Write failing tests that define the expected behavior
2. **Green Phase**: Write minimal code to make tests pass
3. **Refactor Phase**: Improve code while keeping tests green

### Test Categories Required

#### 1. Unit Tests
- Test individual functions and methods in isolation
- Mock external dependencies
- Focus on edge cases and boundary conditions
- Minimum 90% code coverage for business logic
- 100% coverage for financial calculations

#### 2. Functional Tests
- Test complete workflows end-to-end
- Use realistic loan scenarios from demo library
- Verify business rules and compliance requirements
- Test error handling and rollback scenarios

#### 3. Scenario-Based Tests
Each feature must include tests for:
- **Happy Path**: Standard successful workflow
- **Edge Cases**: Boundary conditions, maximum/minimum values
- **Error Cases**: Invalid inputs, system failures
- **Compliance Cases**: Regulatory limit checks
- **Concurrency Cases**: Multiple simultaneous operations

### Required Test Scenarios by Feature Type

#### Financial Calculations
- Test with exact decimal values using Big.js
- Verify penny-perfect accuracy over 30-year periods
- Test all calendar types (30/360, Actual/365, Actual/360)
- Verify interest accrual for leap years
- Test payment allocation waterfalls
- Verify APR calculations within ±0.125% tolerance

#### Payment Processing
- Test successful payment flows
- Test NSF and reversal scenarios
- Test partial and overpayment handling
- Test payment retry logic
- Verify idempotency with duplicate requests
- Test webhook processing and reconciliation

#### Loan Modifications
- Test each modification type independently
- Test modification combinations
- Verify before/after loan states
- Test modification rollback scenarios
- Verify audit trail completeness
- Test regulatory compliance limits

#### Compliance Features
- Test state-specific APR caps
- Test military rate reductions (SCRA)
- Test disclosure generation accuracy
- Test collection time restrictions
- Verify all required notices generated

### Test Data Management
- Use demo loan library for consistent test scenarios
- Create test fixtures for each scenario type
- Implement test data builders for complex objects
- Use snapshot testing for disclosure documents
- Maintain separate test databases per environment

### Performance Testing Requirements
- Load tests for 10,000+ concurrent users
- Stress tests for 1M+ loan calculations
- API response time < 200ms under load
- Database query optimization tests
- Memory leak detection tests

### Test Organization
```
tests/
├── unit/           # Isolated unit tests
├── functional/     # End-to-end workflow tests
├── scenarios/      # Business scenario tests
├── compliance/     # Regulatory compliance tests
├── performance/    # Load and stress tests
├── fixtures/       # Test data and mocks
└── utils/          # Test helpers and builders
```

## Common Development Tasks - TDD Approach

### Adding a New Loan Calculation Feature
1. **FIRST: Write failing tests**
   - Unit tests for calculation accuracy
   - Functional tests for complete workflow
   - Edge case tests (zero values, maximums)
   - Compliance limit tests
2. **THEN: Implement calculation logic** using Big.js
3. **Verify all tests pass**
4. **Refactor for clarity** while keeping tests green
5. Update loan document schema if needed
6. Create API endpoints with validation tests first
7. Add audit trail entries with tests for compliance

### Implementing a Compliance Requirement
1. **FIRST: Write compliance test suite**
   - Test for specific regulatory limits
   - Test required disclosures generated
   - Test state-specific variations
2. Research specific federal/state requirements
3. **Implement validation logic** to pass tests
4. Create disclosure templates with snapshot tests
5. Document regulatory references in code comments
6. **Run full compliance test suite** before committing

### Adding Payment Processing Integration
1. **FIRST: Write integration tests**
   - Mock payment gateway responses
   - Test success and failure scenarios
   - Test idempotency behavior
   - Test webhook processing
2. Implement payment gateway adapter pattern
3. Add idempotency keys with duplicate tests
4. Implement retry logic with failure tests
5. Create webhook handlers with security tests
6. Add reconciliation logic with mismatch tests

### TDD Workflow Example
```typescript
// Step 1: Write failing test
describe('Loan APR Calculation', () => {
  it('should calculate APR within TILA tolerance', () => {
    const loan = createTestLoan({
      principal: 200000,
      rate: 4.5,
      term: 360,
      fees: 2500
    });
    
    const apr = calculateAPR(loan);
    
    // TILA requires ±0.125% accuracy
    expect(apr).toBeCloseTo(4.625, 3);
  });
});

// Step 2: Implement minimum code to pass
function calculateAPR(loan: Loan): number {
  // Implementation using Big.js
}

// Step 3: Add more test cases
it('should handle zero fees correctly', () => {
  // Test edge cases
});

// Step 4: Refactor implementation
// Improve code structure while tests stay green
```

### Test-First Development Rules
1. **No production code without a failing test**
2. **Write minimal code to pass tests**
3. **Refactor only when tests are green**
4. **Each bug fix starts with a failing test**
5. **Tests are documentation** - they show intended behavior

### Scenario Testing Requirements
For each major feature, create scenario tests:
- **Origination**: Test loan creation with all product types
- **Servicing**: Test full payment lifecycle scenarios
- **Modifications**: Test complex modification chains
- **Delinquency**: Test progression through buckets
- **Bankruptcy**: Test automatic stay compliance
- **Investor**: Test multi-party payment distributions

## Key Reminders for Development

1. **Documentation is Truth**: Always check `documents/MAIN.md` for requirements before implementing
2. **Track Progress**: Update `documents/WORK.md` checkboxes as you complete tasks
3. **TDD Always**: Write tests first, implementation second
4. **Big.js for Money**: All financial calculations must use Big.js
5. **Compliance First**: Check regulatory requirements in MAIN.md before coding
6. **Test Scenarios**: Use demo library scenarios from WORK.md Phase 10.3-10.4

### Quick Reference Paths
- **Requirements**: `/Users/winfinit/workspace/lendpeak2/documents/MAIN.md`
- **Task Tracking**: `/Users/winfinit/workspace/lendpeak2/documents/WORK.md`
- **This Guide**: `/Users/winfinit/workspace/lendpeak2/CLAUDE.md`

## Critical Git Commit Guidelines

### MANDATORY: Regular Commits for Backup and Recovery

**IMPORTANT: Commit your changes frequently to prevent data loss and enable recovery from mistakes.**

#### When to Commit:
1. **After completing each major feature or fix**
2. **Before starting any risky refactoring**
3. **At the end of each work session**
4. **After writing new tests**
5. **Before making breaking changes**
6. **After successful integration of new packages**

#### Commit Process:
```bash
# Check what has changed
git status
git diff

# Stage and commit with descriptive message
git add .
git commit -m "feat: add standalone lendpeak-engine package with Big.js and dayjs

- Created stateless loan calculation engine
- Added comprehensive test suite (83 tests)
- Implemented precise decimal handling with Big.js
- Added robust date handling with dayjs
- Supports all loan types and payment frequencies

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

#### Commit Message Format:
- **feat**: New feature
- **fix**: Bug fix
- **refactor**: Code restructuring
- **test**: Adding tests
- **docs**: Documentation changes
- **chore**: Maintenance tasks

#### Recovery Strategy:
If something goes wrong:
```bash
# View commit history
git log --oneline -10

# Revert to previous commit (safe)
git revert HEAD

# Reset to previous commit (destructive)
git reset --hard HEAD~1

# Create a backup branch before risky changes
git checkout -b backup/before-major-refactor
```

#### IMPORTANT: Commit After Major Work
After completing significant work like:
- Creating the lendpeak-engine package
- Major refactoring
- Adding new features
- Fixing critical bugs

**ALWAYS COMMIT IMMEDIATELY!**

## Additional Development Guidelines

### Git Workflow & Conventions
1. **Branch Naming**: `feature/phase-X-feature-name`, `fix/issue-description`, `chore/task-name`
2. **Commit Messages**: Use conventional commits (feat:, fix:, test:, docs:, refactor:)
3. **PR Process**: All code requires PR review before merging
4. **Branch Protection**: Main branch requires passing tests and approval

### Error Handling Patterns
```typescript
// Financial operations MUST use Result pattern
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

// Example:
function calculateInterest(loan: Loan): Result<Big, CalculationError> {
  try {
    // Calculation logic
    return { ok: true, value: interest };
  } catch (error) {
    return { ok: false, error: new CalculationError(error) };
  }
}
```

### Logging Requirements
1. **Structured Logging**: Use JSON format with correlation IDs
2. **Log Levels**: ERROR (failures), WARN (issues), INFO (business events), DEBUG (development)
3. **Audit Logs**: All financial operations must create immutable audit entries
4. **PII Protection**: Never log sensitive data (SSN, account numbers)

### API Design Standards
1. **RESTful Conventions**: Use proper HTTP methods and status codes
2. **Versioning**: API version in URL path `/api/v1/`
3. **Pagination**: Use cursor-based pagination for large datasets
4. **Rate Limiting**: Implement per-user and per-IP limits
5. **Idempotency**: All POST/PUT operations must be idempotent

### Database Migration Strategy
1. **Forward-Only**: Migrations must be reversible but never run reverse in production
2. **Version Control**: All migrations in `migrations/` folder with timestamps
3. **Testing**: Run migrations against test database before production
4. **Zero-Downtime**: Design migrations for rolling deployments

### Environment Management
```bash
# Environment hierarchy
.env.local       # Local development (gitignored)
.env.test        # Test environment
.env.staging     # Staging environment
.env.production  # Production (stored in AWS Secrets Manager)
```

### Security & Secret Management
1. **AWS Secrets Manager**: All production secrets
2. **Environment Variables**: Non-sensitive configuration only
3. **Encryption**: All data encrypted at rest and in transit
4. **Key Rotation**: Automated rotation every 90 days
5. **Access Control**: Principle of least privilege

### Performance Guidelines
1. **Database Queries**: Max 50ms for single loan operations
2. **Batch Operations**: Process in chunks of 1000 records
3. **Caching Strategy**: Redis for frequently accessed data
4. **Connection Pooling**: Configure based on load testing
5. **API Response**: Target < 200ms p95

### Deployment Checklist
- [ ] All tests passing (unit, functional, integration)
- [ ] Database migrations tested
- [ ] Performance benchmarks met
- [ ] Security scan completed
- [ ] Documentation updated
- [ ] WORK.md tasks checked off
- [ ] Monitoring alerts configured
- [ ] Rollback plan documented

### Code Review Checklist
- [ ] Tests written first (TDD)
- [ ] Big.js used for all monetary calculations
- [ ] Error handling follows Result pattern
- [ ] Audit logs created for financial operations
- [ ] No hardcoded values or secrets
- [ ] Documentation comments for public APIs
- [ ] Performance impact considered
- [ ] Compliance requirements verified

## Advanced Operational Guidelines

### Monitoring & Alerting Strategy
1. **Business Metrics Dashboards**
   - Loan origination volume and approval rates
   - Delinquency rates by bucket (30/60/90+ days)
   - Payment success/failure rates
   - Average processing times
   - Portfolio health indicators

2. **Technical Alerts**
   ```yaml
   Critical:
     - Payment processing failure rate > 5%
     - API response time > 1000ms (p99)
     - Database connection pool exhausted
     - Calculation engine errors > 0.01%
   
   Warning:
     - Delinquency rate increase > 2% week-over-week
     - API response time > 500ms (p95)
     - Background job queue depth > 10000
     - Memory usage > 80%
   ```

3. **Custom CloudWatch Metrics**
   - Loan calculation accuracy metrics
   - Compliance check pass rates
   - Payment waterfall execution times
   - Modification success rates

### Background Job Processing
1. **Daily Jobs**
   ```typescript
   // AWS Lambda functions triggered by EventBridge
   - Interest accrual calculation (midnight UTC)
   - Late fee assessment (configurable time)
   - Delinquency bucket progression
   - Automated payment retry attempts
   ```

2. **Job Architecture**
   - AWS SQS for job queues with DLQ
   - Lambda for job processors
   - Step Functions for complex workflows
   - EventBridge for scheduling

3. **Job Monitoring**
   - Track job execution times
   - Alert on failed jobs after retries
   - Monitor queue depths
   - Log job outcomes for audit

### Webhook Management
1. **Inbound Webhooks (Payment Processors)**
   ```typescript
   interface WebhookConfig {
     maxRetries: 5;
     backoffMultiplier: 2;
     signatureValidation: true;
     deduplicationWindow: '24h';
     deadLetterQueue: 'webhook-dlq';
   }
   ```

2. **Webhook Security**
   - Verify signatures before processing
   - IP allowlisting where supported
   - Request replay protection
   - Webhook secret rotation

3. **Outbound Webhooks (to Partners)**
   - Exponential backoff retry strategy
   - Circuit breaker pattern
   - Webhook event log retention
   - Partner-specific retry policies

### Disaster Recovery & Business Continuity
1. **Recovery Targets**
   - **RTO** (Recovery Time Objective): 4 hours
   - **RPO** (Recovery Point Objective): 1 hour
   - **Service Availability**: 99.9% (8.76 hours/year downtime)

2. **Multi-Region Strategy**
   ```yaml
   Primary: us-east-1
   Secondary: us-west-2
   
   Replication:
     - MongoDB: Cross-region replica sets
     - S3: Cross-region replication
     - Secrets: Multi-region secrets
   ```

3. **Runbooks**
   - Database failover procedures
   - Payment processor fallback
   - Communication templates
   - Rollback procedures

### Feature Flag Management
1. **Implementation Strategy**
   ```typescript
   // Use AWS AppConfig or LaunchDarkly
   interface FeatureFlag {
     name: string;
     defaultValue: boolean;
     rolloutPercentage: number;
     userSegments?: string[];
     killSwitch: boolean;
   }
   ```

2. **Critical Feature Flags**
   - New calculation engine rollout
   - Payment gateway switching
   - Compliance rule updates
   - UI feature releases

3. **Flag Lifecycle**
   - Create with 0% rollout
   - Gradual increase (1% → 10% → 50% → 100%)
   - Monitor metrics at each stage
   - Remove flag after full rollout

### Regulatory Reporting Automation
1. **Report Types & Schedules**
   ```yaml
   HMDA:
     frequency: Annual
     deadline: March 1
     format: HMDA LAR
   
   Call Report:
     frequency: Quarterly
     deadline: 30 days after quarter end
   
   State Reports:
     varies_by_state: true
     automated_generation: true
   ```

2. **Report Generation Process**
   - Scheduled Lambda functions
   - Data validation before submission
   - Automated reconciliation
   - Submission confirmation tracking

3. **Compliance Calendar**
   - Automated reminders for deadlines
   - Pre-submission validation runs
   - Historical report archive
   - Audit trail for all submissions

### Customer Support Integration
1. **Admin Tools**
   ```typescript
   // Required admin capabilities
   - View customer loan details (with audit)
   - Process manual payments
   - Adjust payment dates
   - Waive fees (with approval workflow)
   - Generate statements
   - View audit history
   ```

2. **Impersonation Framework**
   - Require elevated permissions
   - Log all actions during impersonation
   - Time-limited sessions (max 1 hour)
   - Notification to customer optional

3. **Support Metrics**
   - Average handle time by issue type
   - First call resolution rate
   - Escalation patterns
   - Common issue tracking

### Data Governance
1. **Data Classification**
   ```yaml
   Highly Sensitive:
     - SSN, Tax ID
     - Bank account numbers
     - Income information
     retention: 7 years after loan closure
   
   Sensitive:
     - Name, address, phone
     - Loan balances
     - Payment history
     retention: 7 years after loan closure
   
   Internal:
     - Calculation logs
     - System metrics
     retention: 1 year
   ```

2. **Retention Policies**
   - Automated data purging jobs
   - Legal hold capabilities
   - Archival to cold storage
   - Deletion verification

3. **Privacy Compliance**
   - CCPA/GDPR data export tools
   - Right to deletion workflows
   - Consent management
   - Data minimization practices

4. **Data Access Controls**
   - Role-based data visibility
   - Field-level encryption for PII
   - Audit all data access
   - Regular access reviews

### Production Readiness Checklist
Before deploying any feature to production:
- [ ] Load testing completed (10x expected volume)
- [ ] Chaos engineering tests passed
- [ ] Security penetration testing done
- [ ] Compliance review approved
- [ ] Monitoring dashboards created
- [ ] Runbooks documented
- [ ] Feature flags configured
- [ ] Rollback plan tested
- [ ] Data migration validated
- [ ] Performance benchmarks met