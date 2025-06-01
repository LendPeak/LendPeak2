import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import Big from 'big.js';
import { LoanRepository } from '../../../src/repositories/loan.repository';
import { ILoan, LoanStatus, LoanType } from '../../../src/models/loan.model';
// Calendar types from @lendpeak/engine
const LoanCalendar = {
  ACTUAL_365: 'ACTUAL/365',
  ACTUAL_360: 'ACTUAL/360',
  THIRTY_360: '30/360'
};

describe('LoanRepository', () => {
  let mongoServer: MongoMemoryServer;
  let loanRepository: LoanRepository;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
    loanRepository = new LoanRepository();
  });

  describe('Create Loan', () => {
    it('should create a new loan with all required fields', async () => {
      // Given: Valid loan data
      const loanData: Partial<ILoan> = {
        loanNumber: 'LN-2024-001',
        borrowerId: 'BORR-001',
        principal: new Big('250000'),
        currentBalance: new Big('250000'),
        interestRate: new Big('0.045'),
        termMonths: 360,
        originationDate: new Date('2025-06-01'),
        firstPaymentDate: new Date('2025-07-01'),
        monthlyPayment: new Big('1266.71'),
        loanType: LoanType.AMORTIZED,
        status: LoanStatus.ACTIVE,
        calendar: LoanCalendar.ACTUAL_360,
        metadata: {
          propertyAddress: '123 Main St',
          loanPurpose: 'Purchase',
        },
      };

      // When: Create the loan
      const createdLoan = await loanRepository.create(loanData);

      // Then: Loan should be created with correct data
      expect(createdLoan.id).toBeDefined();
      expect(createdLoan.loanNumber).toBe('LN-2024-001');
      expect(createdLoan.principal.toString()).toBe('250000');
      expect(createdLoan.interestRate.toString()).toBe('0.045');
      expect(createdLoan.status).toBe(LoanStatus.ACTIVE);
      expect(createdLoan.createdAt).toBeDefined();
      expect(createdLoan.updatedAt).toBeDefined();
    });

    it('should generate loan number if not provided', async () => {
      // Given: Loan data without loan number
      const loanData: Partial<ILoan> = {
        borrowerId: 'BORR-001',
        principal: new Big('100000'),
        currentBalance: new Big('100000'),
        interestRate: new Big('0.05'),
        termMonths: 180,
        originationDate: new Date('2025-06-01'),
        firstPaymentDate: new Date('2025-07-01'),
        monthlyPayment: new Big('790.79'),
        loanType: LoanType.AMORTIZED,
        status: LoanStatus.ACTIVE,
        calendar: LoanCalendar.ACTUAL_365,
      };

      // When: Create the loan
      const createdLoan = await loanRepository.create(loanData);

      // Then: Loan number should be generated
      expect(createdLoan.loanNumber).toMatch(/^LN-\d{4}-\d{6}$/);
    });

    it('should validate required fields', async () => {
      // Given: Invalid loan data (missing required fields)
      const invalidData: any = {
        borrowerId: 'BORR-001',
        // Missing principal and other required fields
      };

      // When/Then: Should throw validation error
      await expect(loanRepository.create(invalidData)).rejects.toThrow();
    });
  });

  describe('Find Operations', () => {
    let testLoan: ILoan;

    beforeEach(async () => {
      // Create a test loan for find operations
      testLoan = await loanRepository.create({
        loanNumber: 'LN-TEST-001',
        borrowerId: 'BORR-001',
        principal: new Big('150000'),
        currentBalance: new Big('145000'),
        interestRate: new Big('0.04'),
        termMonths: 240,
        originationDate: new Date('2025-06-01'),
        firstPaymentDate: new Date('2025-07-01'),
        monthlyPayment: new Big('909.66'),
        loanType: LoanType.AMORTIZED,
        status: LoanStatus.ACTIVE,
        calendar: LoanCalendar.THIRTY_360,
      });
    });

    it('should find loan by ID', async () => {
      // When: Find by ID
      const foundLoan = await loanRepository.findById(testLoan.id);

      // Then: Should return the correct loan
      expect(foundLoan).toBeDefined();
      expect(foundLoan?.loanNumber).toBe('LN-TEST-001');
      expect(foundLoan?.principal.toString()).toBe('150000');
    });

    it('should find loan by loan number', async () => {
      // When: Find by loan number
      const foundLoan = await loanRepository.findByLoanNumber('LN-TEST-001');

      // Then: Should return the correct loan
      expect(foundLoan).toBeDefined();
      expect(foundLoan?.id).toBe(testLoan.id);
    });

    it('should find loans by borrower ID', async () => {
      // Given: Create another loan for the same borrower
      await loanRepository.create({
        loanNumber: 'LN-TEST-002',
        borrowerId: 'BORR-001',
        principal: new Big('50000'),
        currentBalance: new Big('48000'),
        interestRate: new Big('0.06'),
        termMonths: 60,
        originationDate: new Date('2025-06-15'),
        firstPaymentDate: new Date('2025-07-15'),
        monthlyPayment: new Big('966.64'),
        loanType: LoanType.AMORTIZED,
        status: LoanStatus.ACTIVE,
        calendar: LoanCalendar.ACTUAL_365,
      });

      // When: Find by borrower ID
      const loans = await loanRepository.findByBorrowerId('BORR-001');

      // Then: Should return both loans
      expect(loans).toHaveLength(2);
      expect(loans[0].borrowerId).toBe('BORR-001');
      expect(loans[1].borrowerId).toBe('BORR-001');
    });

    it('should find active loans', async () => {
      // Given: Create a closed loan
      await loanRepository.create({
        loanNumber: 'LN-TEST-003',
        borrowerId: 'BORR-002',
        principal: new Big('75000'),
        currentBalance: new Big('0'),
        interestRate: new Big('0.035'),
        termMonths: 120,
        originationDate: new Date('2020-01-01'),
        firstPaymentDate: new Date('2020-02-01'),
        monthlyPayment: new Big('742.15'),
        loanType: LoanType.AMORTIZED,
        status: LoanStatus.CLOSED,
        calendar: LoanCalendar.ACTUAL_360,
      });

      // When: Find active loans
      const activeLoans = await loanRepository.findActiveLoans();

      // Then: Should only return active loans
      expect(activeLoans).toHaveLength(1);
      expect(activeLoans[0].status).toBe(LoanStatus.ACTIVE);
    });
  });

  describe('Update Operations', () => {
    let testLoan: ILoan;

    beforeEach(async () => {
      testLoan = await loanRepository.create({
        loanNumber: 'LN-UPDATE-001',
        borrowerId: 'BORR-001',
        principal: new Big('200000'),
        currentBalance: new Big('195000'),
        interestRate: new Big('0.05'),
        termMonths: 360,
        originationDate: new Date('2025-06-01'),
        firstPaymentDate: new Date('2025-07-01'),
        monthlyPayment: new Big('1073.64'),
        loanType: LoanType.AMORTIZED,
        status: LoanStatus.ACTIVE,
        calendar: LoanCalendar.ACTUAL_365,
      });
    });

    it('should update loan balance after payment', async () => {
      // Given: Payment amount
      const paymentAmount = new Big('1073.64');
      const principalPaid = new Big('261.14');
      const newBalance = testLoan.currentBalance.minus(principalPaid);

      // When: Update balance
      const updatedLoan = await loanRepository.updateBalance(
        testLoan.id,
        newBalance,
        {
          paymentAmount,
          principalPaid,
          interestPaid: new Big('812.50'),
          paymentDate: new Date('2024-02-01'),
        },
      );

      // Then: Balance should be updated
      expect(updatedLoan.currentBalance.toString()).toBe(newBalance.toString());
      expect(updatedLoan.lastPaymentDate).toBeDefined();
      expect(updatedLoan.totalInterestPaid.toString()).toBe('812.5');
      expect(updatedLoan.totalPrincipalPaid.toString()).toBe('261.14');
    });

    it('should update loan status', async () => {
      // When: Update status to delinquent
      const updatedLoan = await loanRepository.updateStatus(
        testLoan.id,
        LoanStatus.DELINQUENT,
        'Missed payment',
      );

      // Then: Status should be updated
      expect(updatedLoan.status).toBe(LoanStatus.DELINQUENT);
      // May have additional history entries from pre-save hooks
      const lastHistoryEntry = updatedLoan.statusHistory[updatedLoan.statusHistory.length - 1];
      expect(lastHistoryEntry.status).toBe(LoanStatus.DELINQUENT);
      expect(lastHistoryEntry.reason).toBe('Missed payment');
    });

    it('should add modification to loan', async () => {
      // Given: Modification details
      const modification = {
        type: 'RATE_REDUCTION',
        previousRate: testLoan.interestRate,
        newRate: new Big('0.04'),
        effectiveDate: new Date('2024-03-01'),
        reason: 'Financial hardship',
      };

      // When: Add modification
      const updatedLoan = await loanRepository.addModification(
        testLoan.id,
        modification,
      );

      // Then: Modification should be recorded
      expect(updatedLoan.modifications).toHaveLength(1);
      expect(updatedLoan.modifications[0].type).toBe('RATE_REDUCTION');
      expect(updatedLoan.modifications[0].newRate?.toString()).toBe('0.04');
      expect(updatedLoan.interestRate.toString()).toBe('0.04');
    });
  });

  describe('Transaction Support', () => {
    it('should support atomic updates within transaction', async () => {
      // Given: Two loans to update
      const loan1 = await loanRepository.create({
        loanNumber: 'LN-TXN-001',
        borrowerId: 'BORR-001',
        principal: new Big('100000'),
        currentBalance: new Big('100000'),
        interestRate: new Big('0.05'),
        termMonths: 180,
        originationDate: new Date('2025-06-01'),
        firstPaymentDate: new Date('2025-07-01'),
        monthlyPayment: new Big('790.79'),
        loanType: LoanType.AMORTIZED,
        status: LoanStatus.ACTIVE,
        calendar: LoanCalendar.ACTUAL_365,
      });

      const loan2 = await loanRepository.create({
        loanNumber: 'LN-TXN-002',
        borrowerId: 'BORR-002',
        principal: new Big('50000'),
        currentBalance: new Big('50000'),
        interestRate: new Big('0.04'),
        termMonths: 120,
        originationDate: new Date('2025-06-01'),
        firstPaymentDate: new Date('2025-07-01'),
        monthlyPayment: new Big('506.69'),
        loanType: LoanType.AMORTIZED,
        status: LoanStatus.ACTIVE,
        calendar: LoanCalendar.ACTUAL_365,
      });

      // When: Perform transaction that should fail
      try {
        await loanRepository.executeInTransaction(async (session) => {
          // Update first loan
          await loanRepository.updateBalance(
            loan1.id,
            loan1.currentBalance.minus(500),
            {
              paymentAmount: new Big('790.79'),
              principalPaid: new Big('500'),
              interestPaid: new Big('290.79'),
              paymentDate: new Date(),
            },
            session,
          );

          // Force an error
          throw new Error('Transaction failed');
        });
      } catch (error) {
        // Expected error
      }

      // Then: First loan should not be updated (rollback)
      const unchangedLoan = await loanRepository.findById(loan1.id);
      expect(unchangedLoan?.currentBalance.toString()).toBe('100000');
    });
  });

  describe('Audit Trail', () => {
    it('should create audit entries for all changes', async () => {
      // Given: Create a loan
      const loan = await loanRepository.create({
        loanNumber: 'LN-AUDIT-001',
        borrowerId: 'BORR-001',
        principal: new Big('100000'),
        currentBalance: new Big('100000'),
        interestRate: new Big('0.05'),
        termMonths: 180,
        originationDate: new Date('2025-06-01'),
        firstPaymentDate: new Date('2025-07-01'),
        monthlyPayment: new Big('790.79'),
        loanType: LoanType.AMORTIZED,
        status: LoanStatus.ACTIVE,
        calendar: LoanCalendar.ACTUAL_365,
      });

      // When: Make changes
      await loanRepository.updateBalance(
        loan.id,
        new Big('99500'),
        {
          paymentAmount: new Big('790.79'),
          principalPaid: new Big('500'),
          interestPaid: new Big('290.79'),
          paymentDate: new Date(),
        },
      );

      // Then: Audit trail should exist
      const auditEntries = await loanRepository.getAuditTrail(loan.id);
      expect(auditEntries.length).toBeGreaterThan(0);
      expect(auditEntries[0].action).toBeDefined();
      expect(auditEntries[0].changes).toBeDefined();
      expect(auditEntries[0].performedBy).toBeDefined();
      expect(auditEntries[0].performedAt).toBeDefined();
    });
  });
});