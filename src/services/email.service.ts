import { logger } from '../utils/logger';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  htmlBody: string;
  textBody?: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType: string;
  encoding?: string;
}

export interface StatementEmailOptions {
  borrowerEmail: string;
  borrowerName: string;
  loanId: string;
  statementPeriod: string;
  statementPdf?: Buffer;
  customMessage?: string;
}

export interface NotificationEmailOptions {
  to: string | string[];
  type: 'PAYMENT_RECEIVED' | 'PAYMENT_DUE' | 'LOAN_APPROVED' | 'LOAN_CLOSED' | 'DELINQUENCY_NOTICE';
  borrowerName: string;
  loanId: string;
  data: Record<string, any>;
}

export class EmailService {
  private emailProvider: string;
  private isInitialized: boolean;

  constructor() {
    this.emailProvider = process.env.EMAIL_PROVIDER || 'DEMO';
    this.isInitialized = this.initializeProvider();
    logger.info('EmailService initialized', { provider: this.emailProvider });
  }

  private initializeProvider(): boolean {
    // In a real application, initialize your email provider
    switch (this.emailProvider) {
      case 'AWS_SES':
        // Initialize AWS SES
        // return this.initializeAWSSES();
        logger.info('AWS SES provider would be initialized here');
        return true;
      case 'SENDGRID':
        // Initialize SendGrid
        // return this.initializeSendGrid();
        logger.info('SendGrid provider would be initialized here');
        return true;
      case 'DEMO':
      default:
        logger.info('Demo email provider initialized');
        return true;
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.isInitialized) {
      throw new Error('Email service not properly initialized');
    }

    try {
      // Validate email options
      this.validateEmailOptions(options);

      // Log email details for demo/development
      logger.info('Sending email:', {
        to: options.to,
        subject: options.subject,
        hasAttachments: options.attachments?.length > 0,
        provider: this.emailProvider
      });

      // Simulate email sending based on provider
      await this.sendViaProvider(options);

      logger.info('Email sent successfully', { to: options.to, subject: options.subject });
      return true;
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw error;
    }
  }

  async sendStatementEmail(options: StatementEmailOptions): Promise<boolean> {
    const emailOptions: EmailOptions = {
      to: options.borrowerEmail,
      subject: `Loan Statement - ${options.loanId} (${options.statementPeriod})`,
      htmlBody: this.generateStatementEmailHTML(options),
      textBody: this.generateStatementEmailText(options),
      attachments: options.statementPdf ? [{
        filename: `loan-statement-${options.loanId}-${options.statementPeriod}.pdf`,
        content: options.statementPdf,
        contentType: 'application/pdf'
      }] : undefined
    };

    return this.sendEmail(emailOptions);
  }

  async sendNotificationEmail(options: NotificationEmailOptions): Promise<boolean> {
    const emailOptions: EmailOptions = {
      to: options.to,
      subject: this.generateNotificationSubject(options),
      htmlBody: this.generateNotificationEmailHTML(options),
      textBody: this.generateNotificationEmailText(options)
    };

    return this.sendEmail(emailOptions);
  }

  private validateEmailOptions(options: EmailOptions): void {
    if (!options.to || (Array.isArray(options.to) && options.to.length === 0)) {
      throw new Error('Email recipient is required');
    }
    if (!options.subject) {
      throw new Error('Email subject is required');
    }
    if (!options.htmlBody) {
      throw new Error('Email body is required');
    }
  }

  private async sendViaProvider(options: EmailOptions): Promise<void> {
    // Simulate sending delay
    await new Promise(resolve => setTimeout(resolve, 500));

    switch (this.emailProvider) {
      case 'AWS_SES':
        return this.sendViaAWSSES(options);
      case 'SENDGRID':
        return this.sendViaSendGrid(options);
      case 'DEMO':
      default:
        return this.sendViaDemo(options);
    }
  }

  private async sendViaDemo(options: EmailOptions): Promise<void> {
    // Demo implementation - just log the email
    logger.info('DEMO EMAIL SENT:', {
      to: options.to,
      subject: options.subject,
      bodyLength: options.htmlBody.length,
      hasAttachments: options.attachments?.length > 0
    });

    // In development, you might save to a local file or send to a test email
    if (process.env.NODE_ENV === 'development' && process.env.DEV_EMAIL) {
      logger.info(`Email would be redirected to dev email: ${process.env.DEV_EMAIL}`);
    }
  }

  private async sendViaAWSSES(options: EmailOptions): Promise<void> {
    // AWS SES implementation would go here
    // const ses = new AWS.SES();
    // await ses.sendEmail({...}).promise();
    logger.info('AWS SES email sending not implemented yet');
    throw new Error('AWS SES integration not implemented');
  }

  private async sendViaSendGrid(options: EmailOptions): Promise<void> {
    // SendGrid implementation would go here
    // const sgMail = require('@sendgrid/mail');
    // await sgMail.send({...});
    logger.info('SendGrid email sending not implemented yet');
    throw new Error('SendGrid integration not implemented');
  }

  private generateStatementEmailHTML(options: StatementEmailOptions): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .header { background-color: #f8f9fa; padding: 20px; text-align: center; }
              .content { padding: 20px; }
              .footer { background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; }
              .loan-info { background-color: #e9ecef; padding: 15px; margin: 15px 0; border-radius: 5px; }
          </style>
      </head>
      <body>
          <div class="header">
              <h1>Your Loan Statement is Ready</h1>
          </div>
          <div class="content">
              <p>Dear ${options.borrowerName},</p>
              
              <p>Your loan statement for the period ${options.statementPeriod} is now available.</p>
              
              <div class="loan-info">
                  <strong>Loan ID:</strong> ${options.loanId}<br>
                  <strong>Statement Period:</strong> ${options.statementPeriod}
              </div>
              
              ${options.customMessage ? `
              <div style="margin: 20px 0; padding: 15px; background-color: #fff3cd; border-radius: 5px;">
                  <strong>Special Message:</strong><br>
                  ${options.customMessage}
              </div>
              ` : ''}
              
              <p>Please review your statement carefully. If you have any questions or concerns, please contact our customer service team.</p>
              
              <p>Thank you for your business.</p>
              
              <p>Best regards,<br>
              LendPeak Customer Service Team</p>
          </div>
          <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
              <p>© ${new Date().getFullYear()} LendPeak. All rights reserved.</p>
          </div>
      </body>
      </html>
    `;
  }

  private generateStatementEmailText(options: StatementEmailOptions): string {
    return `
Dear ${options.borrowerName},

Your loan statement for the period ${options.statementPeriod} is now available.

Loan ID: ${options.loanId}
Statement Period: ${options.statementPeriod}

${options.customMessage ? `Special Message: ${options.customMessage}\n\n` : ''}

Please review your statement carefully. If you have any questions or concerns, please contact our customer service team.

Thank you for your business.

Best regards,
LendPeak Customer Service Team

---
This is an automated message. Please do not reply to this email.
© ${new Date().getFullYear()} LendPeak. All rights reserved.
    `.trim();
  }

  private generateNotificationSubject(options: NotificationEmailOptions): string {
    switch (options.type) {
      case 'PAYMENT_RECEIVED':
        return `Payment Received - Loan ${options.loanId}`;
      case 'PAYMENT_DUE':
        return `Payment Due Reminder - Loan ${options.loanId}`;
      case 'LOAN_APPROVED':
        return `Loan Approved - ${options.loanId}`;
      case 'LOAN_CLOSED':
        return `Loan Closed - ${options.loanId}`;
      case 'DELINQUENCY_NOTICE':
        return `Important: Delinquency Notice - Loan ${options.loanId}`;
      default:
        return `Loan Notification - ${options.loanId}`;
    }
  }

  private generateNotificationEmailHTML(options: NotificationEmailOptions): string {
    // This would be expanded with specific templates for each notification type
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .header { background-color: #f8f9fa; padding: 20px; text-align: center; }
              .content { padding: 20px; }
              .footer { background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; }
          </style>
      </head>
      <body>
          <div class="header">
              <h1>Loan Notification</h1>
          </div>
          <div class="content">
              <p>Dear ${options.borrowerName},</p>
              <p>This is a notification regarding your loan ${options.loanId}.</p>
              <!-- Specific content based on notification type would go here -->
          </div>
          <div class="footer">
              <p>© ${new Date().getFullYear()} LendPeak. All rights reserved.</p>
          </div>
      </body>
      </html>
    `;
  }

  private generateNotificationEmailText(options: NotificationEmailOptions): string {
    return `
Dear ${options.borrowerName},

This is a notification regarding your loan ${options.loanId}.

Best regards,
LendPeak Team
    `.trim();
  }
}

// Export singleton instance
let _emailService: EmailService | null = null;
export const getEmailService = () => {
  if (!_emailService) {
    _emailService = new EmailService();
  }
  return _emailService;
};
