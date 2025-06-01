import { getWebSocketService } from './websocket.service';
import { logger } from '../utils/logger';
import { IUser } from '../models/user.model';
import { ILoan } from '../models/loan.model';

export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  severity?: 'info' | 'warning' | 'error' | 'success';
}

export enum NotificationType {
  // Loan notifications
  LOAN_APPLICATION_SUBMITTED = 'loan:application:submitted',
  LOAN_APPLICATION_APPROVED = 'loan:application:approved',
  LOAN_APPLICATION_REJECTED = 'loan:application:rejected',
  LOAN_DISBURSED = 'loan:disbursed',
  LOAN_PAYMENT_DUE = 'loan:payment:due',
  LOAN_PAYMENT_OVERDUE = 'loan:payment:overdue',
  LOAN_PAYMENT_RECEIVED = 'loan:payment:received',
  LOAN_FULLY_PAID = 'loan:fully:paid',
  
  // User notifications
  USER_VERIFIED = 'user:verified',
  USER_PASSWORD_CHANGED = 'user:password:changed',
  USER_PROFILE_UPDATED = 'user:profile:updated',
  
  // System notifications
  SYSTEM_MAINTENANCE = 'system:maintenance',
  SYSTEM_UPDATE = 'system:update',
  SYSTEM_ANNOUNCEMENT = 'system:announcement',
}

export class NotificationService {
  private get wsService() {
    return getWebSocketService();
  }

  /**
   * Send notification for loan application submission
   */
  async notifyLoanApplicationSubmitted(application: any): Promise<void> {
    try {
      // Notify borrower
      await this.sendNotification({
        userId: application.borrowerId.toString(),
        type: NotificationType.LOAN_APPLICATION_SUBMITTED,
        title: 'Application Submitted',
        message: `Your loan application for $${application.requestedAmount} has been submitted successfully.`,
        data: {
          applicationId: application._id,
          amount: application.requestedAmount,
          submittedAt: application.createdAt,
        },
        severity: 'success',
      });

      // Notify admins
      this.wsService.broadcastToRole('admin', 'notification', {
        type: NotificationType.LOAN_APPLICATION_SUBMITTED,
        title: 'New Loan Application',
        message: `New loan application for $${application.requestedAmount} requires review.`,
        data: {
          applicationId: application._id,
          borrowerId: application.borrowerId,
          amount: application.requestedAmount,
        },
        severity: 'info',
      });

      logger.info('Loan application submission notifications sent', {
        applicationId: application._id,
        borrowerId: application.borrowerId,
      });
    } catch (error) {
      logger.error('Failed to send loan application submission notifications', error);
    }
  }

  /**
   * Send notification for loan approval
   */
  async notifyLoanApproved(loan: ILoan, user: IUser): Promise<void> {
    try {
      await this.sendNotification({
        userId: user._id.toString(),
        type: NotificationType.LOAN_APPLICATION_APPROVED,
        title: 'Loan Approved! 🎉',
        message: `Congratulations! Your loan for $${loan.principal} has been approved.`,
        data: {
          loanId: loan._id,
          amount: loan.principal,
          interestRate: loan.interestRate,
          term: loan.termMonths,
        },
        severity: 'success',
      });

      // Send loan status update via WebSocket
      this.wsService.sendLoanUpdate(user._id.toString(), {
        loanId: loan._id.toString(),
        status: 'approved',
        previousStatus: 'pending',
      });

      logger.info('Loan approval notifications sent', {
        loanId: loan._id,
        userId: user._id,
      });
    } catch (error) {
      logger.error('Failed to send loan approval notifications', error);
    }
  }

  /**
   * Send notification for loan rejection
   */
  async notifyLoanRejected(applicationId: string, userId: string, reason?: string): Promise<void> {
    try {
      await this.sendNotification({
        userId,
        type: NotificationType.LOAN_APPLICATION_REJECTED,
        title: 'Loan Application Update',
        message: reason || 'Unfortunately, your loan application was not approved at this time.',
        data: {
          applicationId,
          reason,
        },
        severity: 'error',
      });

      logger.info('Loan rejection notification sent', {
        applicationId,
        userId,
      });
    } catch (error) {
      logger.error('Failed to send loan rejection notification', error);
    }
  }

  /**
   * Send notification for loan disbursement
   */
  async notifyLoanDisbursed(loan: ILoan, user: IUser): Promise<void> {
    try {
      await this.sendNotification({
        userId: user._id.toString(),
        type: NotificationType.LOAN_DISBURSED,
        title: 'Funds Disbursed',
        message: `$${loan.principal} has been disbursed to your account.`,
        data: {
          loanId: loan._id,
          amount: loan.principal,
          disbursedAt: new Date(),
        },
        severity: 'success',
      });

      // Update loan status
      this.wsService.sendLoanUpdate(user._id.toString(), {
        loanId: loan._id.toString(),
        status: 'active',
        previousStatus: 'approved',
      });

      logger.info('Loan disbursement notification sent', {
        loanId: loan._id,
        userId: user._id,
      });
    } catch (error) {
      logger.error('Failed to send loan disbursement notification', error);
    }
  }

  /**
   * Send payment reminder
   */
  async notifyPaymentDue(loan: ILoan, user: IUser, daysUntilDue: number): Promise<void> {
    try {
      const nextPayment = (loan as any).schedule?.find((p: any) => p.status === 'pending');
      if (!nextPayment) return;

      await this.sendNotification({
        userId: user._id.toString(),
        type: NotificationType.LOAN_PAYMENT_DUE,
        title: 'Payment Reminder',
        message: `Your payment of $${nextPayment.amount} is due in ${daysUntilDue} days.`,
        data: {
          loanId: loan._id,
          paymentAmount: nextPayment.amount,
          dueDate: nextPayment.dueDate,
          daysUntilDue,
        },
        severity: 'warning',
      });

      // Send payment reminder via WebSocket
      this.wsService.sendPaymentReminder(user._id.toString(), {
        loanId: loan._id.toString(),
        amount: nextPayment.amount,
        dueDate: nextPayment.dueDate,
        daysUntilDue,
      });

      logger.info('Payment reminder sent', {
        loanId: loan._id,
        userId: user._id,
        daysUntilDue,
      });
    } catch (error) {
      logger.error('Failed to send payment reminder', error);
    }
  }

  /**
   * Send overdue payment notification
   */
  async notifyPaymentOverdue(loan: ILoan, user: IUser, daysOverdue: number): Promise<void> {
    try {
      const overduePayment = (loan as any).schedule?.find((p: any) => 
        p.status === 'pending' && new Date(p.dueDate) < new Date()
      );
      if (!overduePayment) return;

      await this.sendNotification({
        userId: user._id.toString(),
        type: NotificationType.LOAN_PAYMENT_OVERDUE,
        title: 'Payment Overdue',
        message: `Your payment of $${overduePayment.amount} is ${daysOverdue} days overdue. Please make payment immediately to avoid additional charges.`,
        data: {
          loanId: loan._id,
          paymentAmount: overduePayment.amount,
          dueDate: overduePayment.dueDate,
          daysOverdue,
        },
        severity: 'error',
      });

      logger.info('Overdue payment notification sent', {
        loanId: loan._id,
        userId: user._id,
        daysOverdue,
      });
    } catch (error) {
      logger.error('Failed to send overdue payment notification', error);
    }
  }

  /**
   * Send payment received notification
   */
  async notifyPaymentReceived(loan: ILoan, user: IUser, amount: number): Promise<void> {
    try {
      await this.sendNotification({
        userId: user._id.toString(),
        type: NotificationType.LOAN_PAYMENT_RECEIVED,
        title: 'Payment Received',
        message: `We've received your payment of $${amount}. Thank you!`,
        data: {
          loanId: loan._id,
          amount,
          receivedAt: new Date(),
          remainingBalance: Number(loan.currentBalance),
        },
        severity: 'success',
      });

      logger.info('Payment received notification sent', {
        loanId: loan._id,
        userId: user._id,
        amount,
      });
    } catch (error) {
      logger.error('Failed to send payment received notification', error);
    }
  }

  /**
   * Send loan fully paid notification
   */
  async notifyLoanFullyPaid(loan: ILoan, user: IUser): Promise<void> {
    try {
      await this.sendNotification({
        userId: user._id.toString(),
        type: NotificationType.LOAN_FULLY_PAID,
        title: 'Loan Paid in Full! 🎉',
        message: `Congratulations! You've successfully paid off your loan of $${loan.principal}.`,
        data: {
          loanId: loan._id,
          totalPaid: Number(loan.totalPrincipalPaid) + Number(loan.totalInterestPaid),
          completedAt: new Date(),
        },
        severity: 'success',
      });

      // Update loan status
      this.wsService.sendLoanUpdate(user._id.toString(), {
        loanId: loan._id.toString(),
        status: 'paid',
        previousStatus: 'active',
      });

      logger.info('Loan fully paid notification sent', {
        loanId: loan._id,
        userId: user._id,
      });
    } catch (error) {
      logger.error('Failed to send loan fully paid notification', error);
    }
  }

  /**
   * Send system maintenance notification
   */
  async notifySystemMaintenance(startTime: Date, duration: number): Promise<void> {
    try {
      const message = `System maintenance scheduled for ${startTime.toLocaleString()}. Expected duration: ${duration} minutes.`;
      
      // Broadcast to all users
      this.wsService.broadcastToRole('borrower', 'notification', {
        type: NotificationType.SYSTEM_MAINTENANCE,
        title: 'Scheduled Maintenance',
        message,
        data: {
          startTime,
          duration,
        },
        severity: 'warning',
      });

      this.wsService.broadcastToRole('admin', 'notification', {
        type: NotificationType.SYSTEM_MAINTENANCE,
        title: 'Scheduled Maintenance',
        message,
        data: {
          startTime,
          duration,
        },
        severity: 'warning',
      });

      logger.info('System maintenance notification sent', {
        startTime,
        duration,
      });
    } catch (error) {
      logger.error('Failed to send system maintenance notification', error);
    }
  }

  /**
   * Send custom notification
   */
  async sendNotification(payload: NotificationPayload): Promise<void> {
    try {
      this.wsService.sendNotification(payload.userId, {
        type: payload.type,
        title: payload.title,
        message: payload.message,
        data: payload.data,
        severity: payload.severity || 'info',
      });

      // Here you could also:
      // - Save notification to database
      // - Send email/SMS if user preferences allow
      // - Queue for batch processing

      logger.info('Notification sent', {
        userId: payload.userId,
        type: payload.type,
      });
    } catch (error) {
      logger.error('Failed to send notification', error);
      throw error;
    }
  }

  /**
   * Send bulk notifications
   */
  async sendBulkNotifications(userIds: string[], notification: Omit<NotificationPayload, 'userId'>): Promise<void> {
    try {
      const promises = userIds.map(userId => 
        this.sendNotification({
          ...notification,
          userId,
        })
      );

      await Promise.allSettled(promises);

      logger.info('Bulk notifications sent', {
        userCount: userIds.length,
        type: notification.type,
      });
    } catch (error) {
      logger.error('Failed to send bulk notifications', error);
      throw error;
    }
  }
}

// Export singleton instance
let _notificationService: NotificationService | null = null;
export const getNotificationService = () => {
  if (!_notificationService) {
    _notificationService = new NotificationService();
  }
  return _notificationService;
};