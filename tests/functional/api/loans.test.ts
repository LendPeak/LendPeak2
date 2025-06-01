import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import { app } from '../../../src/api';
import { config } from '../../../src/config';
import { LoanModel } from '../../../src/schemas/loan.schema';
import Big from 'big.js';
import { LoanStatus, LoanType } from '../../../src/models/loan.model';
// Calendar types from @lendpeak/engine
const LoanCalendar = {
  ACTUAL_365: 'ACTUAL/365',
  ACTUAL_360: 'ACTUAL/360',
  THIRTY_360: '30/360'
};

describe('Loans API', () => {
  let mongoServer: MongoMemoryServer;
  let authToken: string;

  beforeAll(async () => {
    // Set up in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Generate auth token
    authToken = jwt.sign(
      { id: 'test-user', email: 'test@example.com', roles: ['admin'] },
      config.auth.jwtSecret
    );
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
  });

  describe('GET /api/v1/loans', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/loans')
        .expect(401);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return empty array when no loans exist', async () => {
      const response = await request(app)
        .get('/api/v1/loans')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.meta.total).toBe(0);
    });

    it('should return loans with pagination', async () => {
      // Create test loans
      for (let i = 0; i < 25; i++) {
        await LoanModel.create({
          loanNumber: `LN-TEST-${i.toString().padStart(3, '0')}`,
          borrowerId: 'BORR-001',
          principal: '100000',
          currentBalance: '95000',
          interestRate: '0.05',
          termMonths: 360,
          originationDate: new Date('2025-06-01'),
          firstPaymentDate: new Date('2025-07-01'),
          monthlyPayment: '536.82',
          loanType: LoanType.AMORTIZED,
          status: LoanStatus.ACTIVE,
          calendar: LoanCalendar.ACTUAL_360,
        });
      }

      const response = await request(app)
        .get('/api/v1/loans?page=2&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(10);
      expect(response.body.meta.total).toBe(25);
      expect(response.body.meta.page).toBe(2);
      expect(response.body.meta.pages).toBe(3);
    });
  });

  describe('POST /api/v1/loans', () => {
    it('should create a new loan', async () => {
      const loanData = {
        borrowerId: 'BORR-001',
        principal: '250000',
        interestRate: '0.045',
        termMonths: 360,
        monthlyPayment: '1266.71',
        originationDate: '2025-06-01',
        firstPaymentDate: '2025-07-01',
        loanType: LoanType.AMORTIZED,
        calendar: LoanCalendar.ACTUAL_360,
      };

      const response = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${authToken}`)
        .send(loanData)
        .expect(201);

      expect(response.body.data.loanNumber).toMatch(/^LN-\d{4}-\d{6}$/);
      expect(response.body.data.principal).toBe('250000');
      expect(response.body.data.status).toBe(LoanStatus.ACTIVE);
    });

    it('should validate required fields', async () => {
      const invalidData = {
        borrowerId: 'BORR-001',
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/v1/loans/:id', () => {
    it('should return loan by ID', async () => {
      const loan = await LoanModel.create({
        loanNumber: 'LN-TEST-001',
        borrowerId: 'BORR-001',
        principal: '100000',
        currentBalance: '95000',
        interestRate: '0.05',
        termMonths: 360,
        originationDate: new Date('2025-06-01'),
        firstPaymentDate: new Date('2025-07-01'),
        monthlyPayment: '536.82',
        loanType: LoanType.AMORTIZED,
        status: LoanStatus.ACTIVE,
        calendar: LoanCalendar.ACTUAL_360,
      });

      const response = await request(app)
        .get(`/api/v1/loans/${loan._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.loanNumber).toBe('LN-TEST-001');
    });

    it('should return 404 for non-existent loan', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .get(`/api/v1/loans/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error.code).toBe('LOAN_NOT_FOUND');
    });
  });

  describe('POST /api/v1/loans/:id/payments', () => {
    it('should record a payment', async () => {
      const loan = await LoanModel.create({
        loanNumber: 'LN-TEST-001',
        borrowerId: 'BORR-001',
        principal: '100000',
        currentBalance: '95000',
        interestRate: '0.05',
        termMonths: 360,
        originationDate: new Date('2025-06-01'),
        firstPaymentDate: new Date('2025-07-01'),
        monthlyPayment: '536.82',
        loanType: LoanType.AMORTIZED,
        status: LoanStatus.ACTIVE,
        calendar: LoanCalendar.ACTUAL_360,
      });

      const paymentData = {
        amount: '536.82',
        paymentDate: '2025-07-01',
        principalPaid: '140.49',
        interestPaid: '396.33',
      };

      const response = await request(app)
        .post(`/api/v1/loans/${loan._id}/payments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(200);

      expect(response.body.message).toBe('Payment recorded successfully');
      
      // Verify balance was updated
      const updatedLoan = await LoanModel.findById(loan._id);
      expect(updatedLoan?.currentBalance.toString()).toBe('94859.51');
    });
  });

  describe('GET /api/v1/loans/statistics', () => {
    it('should return portfolio statistics', async () => {
      // Create test loans
      await LoanModel.create([
        {
          loanNumber: 'LN-TEST-001',
          borrowerId: 'BORR-001',
          principal: '100000',
          currentBalance: '95000',
          interestRate: '0.05',
          termMonths: 360,
          originationDate: new Date('2025-06-01'),
          firstPaymentDate: new Date('2025-07-01'),
          monthlyPayment: '536.82',
          loanType: LoanType.AMORTIZED,
          status: LoanStatus.ACTIVE,
          calendar: LoanCalendar.ACTUAL_360,
        },
        {
          loanNumber: 'LN-TEST-002',
          borrowerId: 'BORR-002',
          principal: '200000',
          currentBalance: '0',
          interestRate: '0.045',
          termMonths: 360,
          originationDate: new Date('2020-01-01'),
          firstPaymentDate: new Date('2020-02-01'),
          monthlyPayment: '1013.37',
          loanType: LoanType.AMORTIZED,
          status: LoanStatus.CLOSED,
          calendar: LoanCalendar.ACTUAL_360,
        },
      ]);

      const response = await request(app)
        .get('/api/v1/loans/statistics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.totalLoans).toBe(2);
      expect(response.body.data.activeLoans).toBe(1);
      expect(response.body.data.totalOutstandingBalance).toBe('95000');
    });
  });
});