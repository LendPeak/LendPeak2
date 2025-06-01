import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { WebSocketService } from '../websocket.service';
import { IUser } from '../../models/user.model';
import jwt from 'jsonwebtoken';
import { config } from '../../config';

describe('WebSocketService', () => {
  let httpServer: HTTPServer;
  let wsService: WebSocketService;
  let clientSocket: ClientSocket;
  let serverSocket: SocketIOServer;

  const testUser: Partial<IUser> = {
    _id: 'user123',
    email: 'test@example.com',
    role: 'borrower',
  };

  const validToken = jwt.sign(
    { userId: testUser._id, role: testUser.role },
    config.jwt.secret
  );

  beforeAll((done) => {
    httpServer = require('http').createServer();
    wsService = new WebSocketService(httpServer);
    serverSocket = wsService.getIO();
    httpServer.listen(() => {
      const port = (httpServer.address() as any).port;
      done();
    });
  });

  afterAll(() => {
    httpServer.close();
  });

  beforeEach((done) => {
    const port = (httpServer.address() as any).port;
    clientSocket = ioClient(`http://localhost:${port}`, {
      auth: { token: validToken },
    });
    clientSocket.on('connect', done);
  });

  afterEach(() => {
    clientSocket.close();
  });

  describe('Connection', () => {
    it('should authenticate valid token', (done) => {
      clientSocket.on('authenticated', (data) => {
        expect(data.userId).toBe(testUser._id);
        done();
      });
    });

    it('should reject invalid token', (done) => {
      const invalidClient = ioClient(
        `http://localhost:${(httpServer.address() as any).port}`,
        { auth: { token: 'invalid-token' } }
      );

      invalidClient.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication failed');
        invalidClient.close();
        done();
      });
    });

    it('should handle missing token', (done) => {
      const noAuthClient = ioClient(
        `http://localhost:${(httpServer.address() as any).port}`,
        { auth: {} }
      );

      noAuthClient.on('connect_error', (error) => {
        expect(error.message).toContain('No token provided');
        noAuthClient.close();
        done();
      });
    });
  });

  describe('User Rooms', () => {
    it('should join user to their personal room on connection', (done) => {
      wsService.on('user:joined', (userId) => {
        expect(userId).toBe(testUser._id);
        done();
      });
    });

    it('should join user to role-based room', (done) => {
      wsService.on('role:joined', (data) => {
        expect(data.userId).toBe(testUser._id);
        expect(data.role).toBe(testUser.role);
        done();
      });
    });
  });

  describe('Notifications', () => {
    it('should send notification to specific user', (done) => {
      const notification = {
        type: 'loan:approved',
        title: 'Loan Approved',
        message: 'Your loan has been approved',
        data: { loanId: 'loan123' },
      };

      clientSocket.on('notification', (data) => {
        expect(data).toMatchObject(notification);
        expect(data.id).toBeDefined();
        expect(data.timestamp).toBeDefined();
        expect(data.read).toBe(false);
        done();
      });

      wsService.sendNotification(testUser._id as string, notification);
    });

    it('should broadcast to role', (done) => {
      const announcement = {
        type: 'system:announcement',
        title: 'System Update',
        message: 'New features available',
      };

      clientSocket.on('notification', (data) => {
        expect(data).toMatchObject(announcement);
        done();
      });

      wsService.broadcastToRole('borrower', 'notification', announcement);
    });

    it('should mark notification as read', (done) => {
      const notificationId = 'notif123';

      clientSocket.on('notification:read', (data) => {
        expect(data.notificationId).toBe(notificationId);
        expect(data.readAt).toBeDefined();
        done();
      });

      clientSocket.emit('notification:markRead', { notificationId });
    });
  });

  describe('Loan Updates', () => {
    it('should send loan status update', (done) => {
      const update = {
        loanId: 'loan123',
        status: 'approved',
        previousStatus: 'pending',
        updatedBy: 'admin123',
      };

      clientSocket.on('loan:statusUpdate', (data) => {
        expect(data).toMatchObject(update);
        expect(data.timestamp).toBeDefined();
        done();
      });

      wsService.sendLoanUpdate(testUser._id as string, update);
    });

    it('should send payment reminder', (done) => {
      const reminder = {
        loanId: 'loan123',
        amount: 1000,
        dueDate: new Date('2024-02-01'),
        daysUntilDue: 3,
      };

      clientSocket.on('loan:paymentReminder', (data) => {
        expect(data).toMatchObject(reminder);
        done();
      });

      wsService.sendPaymentReminder(testUser._id as string, reminder);
    });
  });

  describe('Real-time Analytics', () => {
    it('should subscribe to analytics updates', (done) => {
      clientSocket.emit('analytics:subscribe', { 
        metrics: ['activeLoans', 'totalDisbursed'] 
      });

      clientSocket.on('analytics:subscribed', (data) => {
        expect(data.metrics).toEqual(['activeLoans', 'totalDisbursed']);
        done();
      });
    });

    it('should receive analytics updates', (done) => {
      const analyticsData = {
        activeLoans: 150,
        totalDisbursed: 1500000,
        timestamp: new Date(),
      };

      clientSocket.on('analytics:update', (data) => {
        expect(data).toMatchObject(analyticsData);
        done();
      });

      // First subscribe
      clientSocket.emit('analytics:subscribe', { 
        metrics: ['activeLoans', 'totalDisbursed'] 
      });

      // Then send update
      setTimeout(() => {
        wsService.broadcastAnalytics(analyticsData);
      }, 100);
    });

    it('should unsubscribe from analytics', (done) => {
      clientSocket.emit('analytics:unsubscribe');

      clientSocket.on('analytics:unsubscribed', () => {
        done();
      });
    });
  });

  describe('Connection Management', () => {
    it('should track active connections', () => {
      const connections = wsService.getActiveConnections();
      expect(connections).toBeGreaterThan(0);
    });

    it('should get user connections', () => {
      const userConnections = wsService.getUserConnections(testUser._id as string);
      expect(userConnections).toBeGreaterThan(0);
    });

    it('should handle disconnect', (done) => {
      wsService.on('user:disconnected', (userId) => {
        expect(userId).toBe(testUser._id);
        done();
      });

      clientSocket.disconnect();
    });

    it('should handle reconnection', (done) => {
      clientSocket.disconnect();

      clientSocket.on('disconnect', () => {
        clientSocket.connect();
      });

      clientSocket.on('authenticated', () => {
        done();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid event data', (done) => {
      clientSocket.on('error', (error) => {
        expect(error.message).toContain('Invalid data');
        done();
      });

      clientSocket.emit('notification:markRead', null);
    });

    it('should rate limit events', (done) => {
      let errorCount = 0;

      clientSocket.on('error', (error) => {
        if (error.message.includes('Rate limit exceeded')) {
          errorCount++;
          if (errorCount === 1) {
            done();
          }
        }
      });

      // Send many requests rapidly
      for (let i = 0; i < 20; i++) {
        clientSocket.emit('notification:markRead', { notificationId: `id${i}` });
      }
    });
  });

  describe('Admin Features', () => {
    let adminSocket: ClientSocket;
    const adminUser = {
      _id: 'admin123',
      email: 'admin@example.com',
      role: 'admin',
    };

    const adminToken = jwt.sign(
      { userId: adminUser._id, role: adminUser.role },
      config.jwt.secret
    );

    beforeEach((done) => {
      const port = (httpServer.address() as any).port;
      adminSocket = ioClient(`http://localhost:${port}`, {
        auth: { token: adminToken },
      });
      adminSocket.on('connect', done);
    });

    afterEach(() => {
      adminSocket.close();
    });

    it('should allow admin to broadcast system message', (done) => {
      const systemMessage = {
        type: 'system:maintenance',
        title: 'Scheduled Maintenance',
        message: 'System will be down for maintenance',
        severity: 'warning',
      };

      clientSocket.on('system:broadcast', (data) => {
        expect(data).toMatchObject(systemMessage);
        done();
      });

      adminSocket.emit('admin:broadcast', systemMessage);
    });

    it('should allow admin to get connection stats', (done) => {
      adminSocket.emit('admin:getStats');

      adminSocket.on('admin:stats', (stats) => {
        expect(stats.totalConnections).toBeGreaterThan(0);
        expect(stats.connectionsByRole).toBeDefined();
        expect(stats.activeRooms).toBeDefined();
        done();
      });
    });

    it('should prevent non-admin from using admin features', (done) => {
      clientSocket.on('error', (error) => {
        expect(error.message).toContain('Unauthorized');
        done();
      });

      clientSocket.emit('admin:broadcast', { message: 'test' });
    });
  });
});