import { logger } from '../utils/logger';

export interface EmailOptions {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
}

export class EmailService {
  constructor() {
    // In a real application, initialize your email provider (e.g., SendGrid, SES)
    logger.info('EmailService initialized');
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    // In a real application, use your email provider to send the email
    // For now, we'll just log it
    logger.info('Sending email:', {
      to: options.to,
      subject: options.subject,
      htmlBody: options.htmlBody,
      textBody: options.textBody,
    });

    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // You would typically return a promise from your email provider's send method
    // For example: return this.emailProvider.send(options);
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
