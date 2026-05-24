import { logger } from '@ai-interviewer/shared';

export interface NotificationJobData {
  sessionId: string;
  userId: string;
  reason?: string;
}

export async function processNotificationJob(data: NotificationJobData): Promise<void> {
  const { sessionId, userId, reason } = data;
  
  if (reason === 'credit-refund') {
    logger.info({ sessionId, userId }, 'Simulated Email: Sent refund confirmation email to candidate due to session degradation.');
    return;
  }

  logger.info({ sessionId, userId }, 'Simulated Email: Sent "Your Interview Score Report is Ready!" notification email to candidate.');
}
