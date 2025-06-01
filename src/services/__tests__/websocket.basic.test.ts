import { WebSocketService } from '../websocket.service';
import { createServer } from 'http';

describe('WebSocketService Basic Tests', () => {
  let httpServer: any;
  let wsService: WebSocketService;

  beforeAll((done) => {
    httpServer = createServer();
    wsService = new WebSocketService(httpServer);
    httpServer.listen(0, done);
  });

  afterAll((done) => {
    wsService.disconnect().then(() => {
      httpServer.close(done);
    });
  });

  it('should initialize WebSocket service', () => {
    expect(wsService).toBeDefined();
    expect(wsService.getIO()).toBeDefined();
  });

  it('should track active connections', () => {
    const connections = wsService.getActiveConnections();
    expect(connections).toBe(0);
  });

  it('should get connection stats', () => {
    const stats = wsService.getConnectionStats();
    expect(stats).toHaveProperty('totalConnections');
    expect(stats).toHaveProperty('uniqueUsers');
    expect(stats).toHaveProperty('connectionsByRole');
    expect(stats).toHaveProperty('activeRooms');
  });

  it('should send notification without throwing', () => {
    expect(() => {
      wsService.sendNotification('user123', {
        type: 'test',
        title: 'Test Notification',
        message: 'This is a test',
      });
    }).not.toThrow();
  });

  it('should send loan update without throwing', () => {
    expect(() => {
      wsService.sendLoanUpdate('user123', {
        loanId: 'loan123',
        status: 'approved',
      });
    }).not.toThrow();
  });

  it('should send payment reminder without throwing', () => {
    expect(() => {
      wsService.sendPaymentReminder('user123', {
        loanId: 'loan123',
        amount: 1000,
        dueDate: new Date(),
        daysUntilDue: 3,
      });
    }).not.toThrow();
  });

  it('should broadcast to role without throwing', () => {
    expect(() => {
      wsService.broadcastToRole('admin', 'test:event', { data: 'test' });
    }).not.toThrow();
  });

  it('should broadcast analytics without throwing', () => {
    expect(() => {
      wsService.broadcastAnalytics({
        activeLoans: 100,
        totalDisbursed: 100000,
      });
    }).not.toThrow();
  });
});