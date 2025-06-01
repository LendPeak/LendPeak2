import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { EventEmitter } from 'events';
import { config } from '../config';
import { logger } from '../utils/logger';

interface AuthSocket extends Socket {
  userId?: string;
  userRole?: string;
}

interface NotificationData {
  type: string;
  title: string;
  message: string;
  data?: any;
  severity?: 'info' | 'warning' | 'error' | 'success';
}

interface LoanUpdateData {
  loanId: string;
  status: string;
  previousStatus?: string;
  updatedBy?: string;
}

interface PaymentReminderData {
  loanId: string;
  amount: number;
  dueDate: Date;
  daysUntilDue: number;
}

interface RateLimitData {
  count: number;
  resetTime: number;
}

export class SimpleWebSocketService extends EventEmitter {
  private io: SocketIOServer;
  private rateLimitMap: Map<string, RateLimitData>;
  private connectionStats: Map<string, Set<string>>;

  constructor(httpServer: HTTPServer) {
    super();
    
    this.rateLimitMap = new Map();
    this.connectionStats = new Map();

    // Initialize Socket.IO without Redis adapter
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.setupEventHandlers();
    this.startCleanupInterval();

    logger.info('WebSocket service initialized without Redis clustering');
  }

  private setupEventHandlers(): void {
    this.io.use(this.authenticateSocket.bind(this));

    this.io.on('connection', (socket: AuthSocket) => {
      logger.info(`Client connected: ${socket.id}, User: ${socket.userId}`);
      
      this.trackConnection(socket);
      this.setupSocketHandlers(socket);
    });
  }

  private async authenticateSocket(socket: AuthSocket, next: (err?: Error) => void): Promise<void> {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        logger.warn('WebSocket connection attempted without token');
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, config.auth.jwtSecret) as any;
      socket.userId = decoded.id || decoded.userId;
      socket.userRole = decoded.role;

      // Rate limiting check
      const rateLimitResult = this.checkRateLimit(socket.userId || 'anonymous');
      if (!rateLimitResult.allowed) {
        logger.warn(`Rate limit exceeded for user ${socket.userId}`);
        return next(new Error('Rate limit exceeded'));
      }

      next();
    } catch (error) {
      logger.error('WebSocket authentication failed:', error);
      next(new Error('Invalid token'));
    }
  }

  private setupSocketHandlers(socket: AuthSocket): void {
    // Join user-specific room
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
      this.emit('user_connected', { userId: socket.userId, socketId: socket.id });
    }

    // Handle loan subscription
    socket.on('subscribe_loan', (loanId: string) => {
      if (this.isValidLoanAccess(socket, loanId)) {
        socket.join(`loan:${loanId}`);
        logger.debug(`User ${socket.userId} subscribed to loan ${loanId}`);
      }
    });

    // Handle loan unsubscription
    socket.on('unsubscribe_loan', (loanId: string) => {
      socket.leave(`loan:${loanId}`);
      logger.debug(`User ${socket.userId} unsubscribed from loan ${loanId}`);
    });

    // Handle status updates
    socket.on('request_status', () => {
      this.sendSystemStatus(socket);
    });

    // Handle disconnection
    socket.on('disconnect', (reason: string) => {
      logger.info(`Client disconnected: ${socket.id}, User: ${socket.userId}, Reason: ${reason}`);
      this.untrackConnection(socket);
      this.emit('user_disconnected', { userId: socket.userId, socketId: socket.id, reason });
    });

    // Handle errors
    socket.on('error', (error: Error) => {
      logger.error(`Socket error for user ${socket.userId}:`, error);
    });
  }

  private isValidLoanAccess(socket: AuthSocket, loanId: string): boolean {
    // In a real implementation, check if user has access to this loan
    // For now, allow all authenticated users
    return !!socket.userId;
  }

  private trackConnection(socket: AuthSocket): void {
    if (!socket.userId) return;

    let userSockets = this.connectionStats.get(socket.userId);
    if (!userSockets) {
      userSockets = new Set();
      this.connectionStats.set(socket.userId, userSockets);
    }
    userSockets.add(socket.id);
  }

  private untrackConnection(socket: AuthSocket): void {
    if (!socket.userId) return;

    const userSockets = this.connectionStats.get(socket.userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        this.connectionStats.delete(socket.userId);
      }
    }
  }

  private checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = 100;
    
    const key = `ws_rate_limit:${userId}`;
    let rateLimitData = this.rateLimitMap.get(key);

    if (!rateLimitData || rateLimitData.resetTime <= now) {
      rateLimitData = {
        count: 1,
        resetTime: now + windowMs,
      };
    } else {
      rateLimitData.count += 1;
    }

    this.rateLimitMap.set(key, rateLimitData);

    const allowed = rateLimitData.count <= maxRequests;
    const remaining = Math.max(0, maxRequests - rateLimitData.count);

    return { allowed, remaining };
  }

  private sendSystemStatus(socket: AuthSocket): void {
    const status = {
      server: 'online',
      timestamp: new Date(),
      connections: this.io.engine.clientsCount,
      userConnections: this.connectionStats.size,
    };

    socket.emit('system_status', status);
  }

  private startCleanupInterval(): void {
    // Clean up expired rate limit entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, data] of this.rateLimitMap.entries()) {
        if (data.resetTime <= now) {
          this.rateLimitMap.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }

  // Public methods for sending notifications

  /**
   * Send notification to a specific user
   */
  sendNotificationToUser(userId: string, notification: NotificationData): void {
    this.io.to(`user:${userId}`).emit('notification', {
      ...notification,
      timestamp: new Date(),
    });

    logger.debug(`Sent notification to user ${userId}:`, notification.type);
  }

  /**
   * Send notification to all users subscribed to a loan
   */
  sendNotificationToLoan(loanId: string, notification: NotificationData): void {
    this.io.to(`loan:${loanId}`).emit('loan_notification', {
      ...notification,
      loanId,
      timestamp: new Date(),
    });

    logger.debug(`Sent loan notification to loan ${loanId}:`, notification.type);
  }

  /**
   * Broadcast system-wide notification
   */
  broadcastSystemNotification(notification: NotificationData): void {
    this.io.emit('system_notification', {
      ...notification,
      timestamp: new Date(),
    });

    logger.info(`Broadcasted system notification:`, notification.type);
  }

  /**
   * Send loan status update
   */
  sendLoanStatusUpdate(loanId: string, updateData: LoanUpdateData): void {
    this.io.to(`loan:${loanId}`).emit('loan_status_update', {
      ...updateData,
      timestamp: new Date(),
    });

    logger.debug(`Sent loan status update for loan ${loanId}:`, updateData.status);
  }

  /**
   * Send payment reminder
   */
  sendPaymentReminder(userId: string, reminderData: PaymentReminderData): void {
    this.sendNotificationToUser(userId, {
      type: 'payment_reminder',
      title: 'Payment Due Soon',
      message: `Your payment of $${reminderData.amount} is due in ${reminderData.daysUntilDue} days`,
      data: reminderData,
      severity: reminderData.daysUntilDue <= 1 ? 'error' : 'warning',
    });
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): { totalConnections: number; totalUsers: number; users: Record<string, number> } {
    const users: Record<string, number> = {};
    
    for (const [userId, sockets] of this.connectionStats.entries()) {
      users[userId] = sockets.size;
    }

    return {
      totalConnections: this.io.engine.clientsCount,
      totalUsers: this.connectionStats.size,
      users,
    };
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId: string): boolean {
    const userSockets = this.connectionStats.get(userId);
    return userSockets ? userSockets.size > 0 : false;
  }

  /**
   * Disconnect all sockets for a user
   */
  disconnectUser(userId: string, reason: string = 'Administrative disconnect'): void {
    const userSockets = this.connectionStats.get(userId);
    if (userSockets) {
      for (const socketId of userSockets) {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.disconnect(true);
        }
      }
      logger.info(`Disconnected all sockets for user ${userId}: ${reason}`);
    }
  }

  /**
   * Broadcast notification to all users with specific role
   */
  broadcastToRole(role: string, eventName: string, data: any): void {
    // Get all connected sockets and filter by role
    const sockets = this.io.sockets.sockets;
    for (const socket of sockets.values()) {
      const authSocket = socket as AuthSocket;
      if (authSocket.userRole === role) {
        socket.emit(eventName, {
          ...data,
          timestamp: new Date(),
        });
      }
    }
    
    logger.debug(`Broadcasted ${eventName} to role ${role}:`, data);
  }

  /**
   * Send loan update notification
   */
  sendLoanUpdate(loanId: string, updateData: any): void {
    this.io.to(`loan:${loanId}`).emit('loan_update', {
      ...updateData,
      loanId,
      timestamp: new Date(),
    });

    logger.debug(`Sent loan update for loan ${loanId}:`, updateData);
  }

  /**
   * Send general notification
   */
  sendNotification(userId: string, notification: any): void {
    this.sendNotificationToUser(userId, notification);
  }

  /**
   * Shutdown the websocket service
   */
  shutdown(): Promise<void> {
    return new Promise((resolve) => {
      logger.info('Shutting down WebSocket service...');
      this.io.close(() => {
        logger.info('WebSocket service shut down');
        resolve();
      });
    });
  }
}

// Export singleton instance (will be initialized when the HTTP server is available)
let webSocketService: SimpleWebSocketService | null = null;

export const initializeWebSocketService = (httpServer: HTTPServer): SimpleWebSocketService => {
  if (webSocketService) {
    throw new Error('WebSocket service already initialized');
  }
  
  webSocketService = new SimpleWebSocketService(httpServer);
  return webSocketService;
};

export const getWebSocketService = (): SimpleWebSocketService => {
  if (!webSocketService) {
    throw new Error('WebSocket service not initialized. Call initializeWebSocketService first.');
  }
  
  return webSocketService;
};