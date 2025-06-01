import { Server as HTTPServer } from 'http';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

// Mock WebSocket service for development without Redis
export class MockWebSocketService extends EventEmitter {
  constructor(httpServer: HTTPServer) {
    super();
    logger.info('Using mock WebSocket service (development mode)');
  }

  async disconnect(): Promise<void> {
    logger.info('Mock WebSocket service disconnected');
  }

  sendNotification(userId: string, data: any): void {
    logger.debug('Mock notification sent', { userId, data });
  }

  broadcastLoanUpdate(loanId: string, data: any): void {
    logger.debug('Mock loan update broadcast', { loanId, data });
  }

  sendPaymentReminder(userId: string, data: any): void {
    logger.debug('Mock payment reminder sent', { userId, data });
  }
}

export function initializeWebSocket(httpServer: HTTPServer): MockWebSocketService {
  return new MockWebSocketService(httpServer);
}