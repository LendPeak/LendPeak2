import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../index';
import { approvalWorkflowService } from '../../../services/approval-workflow.service';
import { loanRepository } from '../../../repositories/loan.repository';
import { userRepository } from '../../../repositories/user.repository';
import { config } from '../../../config';

// Mock dependencies
jest.mock('../../../services/approval-workflow.service');
jest.mock('../../../repositories/loan.repository');
jest.mock('../../../repositories/user.repository');
jest.mock('../../../services/websocket.service');
jest.mock('../../../services/notification.service');

describe('Approval Workflow Routes', () => {
  let adminToken: string;
  let userToken: string;

  beforeEach(() => {
    // Generate test tokens
    adminToken = jwt.sign({
      id: 'admin123',
      email: 'admin@example.com',
      roles: ['ADMIN'],
      permissions: [],
    }, config.auth.jwtSecret, { expiresIn: '1h' });

    userToken = jwt.sign({
      id: 'user123',
      email: 'user@example.com',
      roles: ['BORROWER'],
      permissions: [],
    }, config.auth.jwtSecret, { expiresIn: '1h' });

    jest.clearAllMocks();
  });

  describe('POST /approval-workflow/process/:loanId', () => {
    const mockLoan = {
      _id: 'loan123',
      borrowerId: 'user123',
      amount: 25000,
      status: 'pending',
    };

    const mockUser = {
      _id: 'user123',
      email: 'test@example.com',
      creditScore: 720,
    };

    const mockApprovalResult = {
      decision: 'approved',
      confidence: 85,
      riskScore: 75,
      reasons: ['High approval score (75.0/100)'],
      nextSteps: ['Loan approved automatically'],
      timestamp: new Date(),
    };

    beforeEach(() => {
      (loanRepository.findById as jest.Mock).mockResolvedValue(mockLoan);
      (userRepository.findById as jest.Mock).mockResolvedValue(mockUser);
      (approvalWorkflowService.processLoanApplication as jest.Mock).mockResolvedValue(mockApprovalResult);
      (loanRepository.updateById as jest.Mock).mockResolvedValue(mockLoan);
    });

    it('should process loan application successfully', async () => {
      const response = await request(app)
        .post('/api/v1/approval-workflow/process/loan123')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(200);

      expect(response.body.data.decision).toBe('approved');
      expect(response.body.data.confidence).toBe(85);
      expect(response.body.data.riskScore).toBe(75);

      expect(approvalWorkflowService.processLoanApplication).toHaveBeenCalledWith(
        mockLoan,
        mockUser,
        { skipManualReview: false }
      );

      expect(loanRepository.updateById).toHaveBeenCalledWith(
        'loan123',
        expect.objectContaining({
          status: 'approved',
          approvalResult: mockApprovalResult,
        })
      );
    });

    it('should handle skipManualReview option', async () => {
      await request(app)
        .post('/api/v1/approval-workflow/process/loan123')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ skipManualReview: true })
        .expect(200);

      expect(approvalWorkflowService.processLoanApplication).toHaveBeenCalledWith(
        mockLoan,
        mockUser,
        { skipManualReview: true }
      );
    });

    it('should return 404 for non-existent loan', async () => {
      (loanRepository.findById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/approval-workflow/process/loan999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(404);

      expect(response.body.error.code).toBe('LOAN_NOT_FOUND');
    });

    it('should return 400 for invalid loan status', async () => {
      (loanRepository.findById as jest.Mock).mockResolvedValue({
        ...mockLoan,
        status: 'approved',
      });

      const response = await request(app)
        .post('/api/v1/approval-workflow/process/loan123')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_LOAN_STATUS');
    });

    it('should require admin authorization', async () => {
      await request(app)
        .post('/api/v1/approval-workflow/process/loan123')
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(403);
    });
  });

  describe('POST /approval-workflow/batch-process', () => {
    const mockLoans = [
      { _id: 'loan1', borrowerId: 'user1', status: 'pending' },
      { _id: 'loan2', borrowerId: 'user2', status: 'pending' },
    ];

    const mockUsers = [
      { _id: 'user1', email: 'user1@example.com' },
      { _id: 'user2', email: 'user2@example.com' },
    ];

    beforeEach(() => {
      (loanRepository.findById as jest.Mock)
        .mockResolvedValueOnce(mockLoans[0])
        .mockResolvedValueOnce(mockLoans[1]);
      
      (userRepository.findById as jest.Mock)
        .mockResolvedValueOnce(mockUsers[0])
        .mockResolvedValueOnce(mockUsers[1]);

      (approvalWorkflowService.processLoanApplication as jest.Mock)
        .mockResolvedValue({
          decision: 'approved',
          confidence: 80,
          riskScore: 70,
        });

      (loanRepository.updateById as jest.Mock).mockResolvedValue({});
    });

    it('should process multiple loans in batch', async () => {
      const response = await request(app)
        .post('/api/v1/approval-workflow/batch-process')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          loanIds: ['loan1', 'loan2'],
        })
        .expect(200);

      expect(response.body.data.processed).toBe(2);
      expect(response.body.data.total).toBe(2);
      expect(response.body.data.results).toHaveLength(2);
      expect(response.body.data.errors).toHaveLength(0);
    });

    it('should handle errors in batch processing', async () => {
      (loanRepository.findById as jest.Mock)
        .mockResolvedValueOnce(mockLoans[0])
        .mockResolvedValueOnce(null); // Second loan not found

      const response = await request(app)
        .post('/api/v1/approval-workflow/batch-process')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          loanIds: ['loan1', 'loan2'],
        })
        .expect(200);

      expect(response.body.data.processed).toBe(1);
      expect(response.body.data.errors).toHaveLength(1);
      expect(response.body.data.errors[0].loanId).toBe('loan2');
    });

    it('should validate input', async () => {
      await request(app)
        .post('/api/v1/approval-workflow/batch-process')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          loanIds: [], // Empty array
        })
        .expect(400);
    });
  });

  describe('GET /approval-workflow/config', () => {
    const mockConfig = {
      autoApprovalThreshold: 80,
      autoRejectionThreshold: 40,
      maxLoanAmount: 100000,
      enableMachineLearning: true,
    };

    beforeEach(() => {
      (approvalWorkflowService.getConfig as jest.Mock).mockReturnValue(mockConfig);
    });

    it('should return current configuration', async () => {
      const response = await request(app)
        .get('/api/v1/approval-workflow/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toEqual(mockConfig);
    });

    it('should allow loan officers to view config', async () => {
      const officerToken = jwt.sign({
        id: 'officer123',
        email: 'officer@example.com',
        roles: ['LOAN_OFFICER'],
        permissions: [],
      }, config.auth.jwtSecret, { expiresIn: '1h' });

      await request(app)
        .get('/api/v1/approval-workflow/config')
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(200);
    });
  });

  describe('PUT /approval-workflow/config', () => {
    beforeEach(() => {
      (approvalWorkflowService.updateConfig as jest.Mock).mockImplementation(() => {});
      (approvalWorkflowService.getConfig as jest.Mock).mockReturnValue({
        autoApprovalThreshold: 85,
        autoRejectionThreshold: 40,
      });
    });

    it('should update configuration', async () => {
      const newConfig = {
        autoApprovalThreshold: 85,
        maxLoanAmount: 150000,
      };

      const response = await request(app)
        .put('/api/v1/approval-workflow/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newConfig)
        .expect(200);

      expect(approvalWorkflowService.updateConfig).toHaveBeenCalledWith(newConfig);
      expect(response.body.data.autoApprovalThreshold).toBe(85);
    });

    it('should validate threshold logic', async () => {
      const invalidConfig = {
        autoApprovalThreshold: 30, // Lower than rejection threshold
        autoRejectionThreshold: 40,
      };

      const response = await request(app)
        .put('/api/v1/approval-workflow/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidConfig)
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_THRESHOLDS');
    });

    it('should require admin authorization', async () => {
      const officerToken = jwt.sign({
        id: 'officer123',
        email: 'officer@example.com',
        roles: ['LOAN_OFFICER'],
        permissions: [],
      }, config.auth.jwtSecret, { expiresIn: '1h' });

      await request(app)
        .put('/api/v1/approval-workflow/config')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ autoApprovalThreshold: 85 })
        .expect(403);
    });
  });

  describe('GET /approval-workflow/rules', () => {
    const mockRules = [
      {
        id: 'credit-score-excellent',
        name: 'Excellent Credit Score',
        description: 'User has excellent credit score (750+)',
        category: 'credit',
        weight: 25,
      },
      {
        id: 'high-income',
        name: 'High Income Verification',
        description: 'User has high verified income (75k+)',
        category: 'income',
        weight: 20,
      },
    ];

    beforeEach(() => {
      (approvalWorkflowService.getRules as jest.Mock).mockReturnValue(
        mockRules.map(rule => ({ ...rule, condition: () => true }))
      );
    });

    it('should return approval rules', async () => {
      const response = await request(app)
        .get('/api/v1/approval-workflow/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].id).toBe('credit-score-excellent');
      expect(response.body.data[0]).not.toHaveProperty('condition'); // Should not expose condition function
    });
  });

  describe('POST /approval-workflow/simulate', () => {
    const mockSimulationResult = {
      decision: 'approved',
      confidence: 85,
      riskScore: 75,
      reasons: ['High approval score'],
      timestamp: new Date(),
    };

    beforeEach(() => {
      (approvalWorkflowService.processLoanApplication as jest.Mock).mockResolvedValue(mockSimulationResult);
    });

    it('should simulate approval workflow', async () => {
      const simulationData = {
        loanData: {
          amount: 25000,
          duration: 36,
          interestRate: 6.5,
          purpose: 'debt_consolidation',
        },
        userData: {
          creditScore: 720,
          annualIncome: 75000,
          employmentDuration: 36,
          monthlyDebtPayments: 1500,
        },
      };

      const response = await request(app)
        .post('/api/v1/approval-workflow/simulate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(simulationData)
        .expect(200);

      expect(response.body.data.simulation).toBe(true);
      expect(response.body.data.decision).toBe('approved');
      expect(response.body.data.confidence).toBe(85);
    });

    it('should validate simulation input', async () => {
      const invalidData = {
        loanData: {
          amount: -1000, // Invalid negative amount
        },
        userData: {},
      };

      await request(app)
        .post('/api/v1/approval-workflow/simulate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData)
        .expect(400);
    });
  });

  describe('GET /approval-workflow/statistics', () => {
    it('should return approval statistics', async () => {
      const response = await request(app)
        .get('/api/v1/approval-workflow/statistics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.statistics).toBeDefined();
      expect(response.body.data.statistics.totalApplications).toBeDefined();
      expect(response.body.data.statistics.approvalRate).toBeDefined();
    });

    it('should accept period parameter', async () => {
      const response = await request(app)
        .get('/api/v1/approval-workflow/statistics?period=last_7_days')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.period).toBe('last_7_days');
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for all routes', async () => {
      await request(app)
        .get('/api/v1/approval-workflow/config')
        .expect(401);

      await request(app)
        .post('/api/v1/approval-workflow/process/loan123')
        .expect(401);
    });

    it('should enforce role-based authorization', async () => {
      // Borrower should not access admin-only routes
      await request(app)
        .put('/api/v1/approval-workflow/config')
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(403);

      await request(app)
        .post('/api/v1/approval-workflow/batch-process')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ loanIds: ['loan1'] })
        .expect(403);
    });
  });
});