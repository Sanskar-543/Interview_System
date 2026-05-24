import { db, sessions, users } from '@ai-interviewer/db';
import { eq, sql } from 'drizzle-orm';
import { logger } from '@ai-interviewer/shared';
import { processNotificationJob } from './notification';

export interface CreditRefundJobData {
  sessionId: string;
  userId: string;
  reason: string;
}

export async function processCreditRefundJob(data: CreditRefundJobData): Promise<void> {
  const { sessionId, userId, reason } = data;
  logger.info({ sessionId, userId, reason }, 'Worker Billing: Initiating session failed credit refund...');

  try {
    // 1. Fetch the session permanent state
    const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);

    // MANDATORY CORRECTION 3: Verify session failure state
    if (!session) {
      logger.warn({ sessionId }, 'Worker Billing Warning: Session was not found. Skipping credit refund.');
      return;
    }

    if (session.status !== 'failed') {
      logger.warn(
        { sessionId, status: session.status }, 
        'Worker Billing Warning: Session status is not failed. Refund request rejected.'
      );
      return;
    }

    // 2. Fetch the target user
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      logger.warn({ userId }, 'Worker Billing Warning: User was not found for credit refund. Skipping.');
      return;
    }

    if (user.plan === 'free') {
      logger.info({ userId, previousCount: user.sessionCount }, 'Worker Billing: Decrementing free tier session count');
      
      // MANDATORY CORRECTION 3: Use SQL GREATEST to guarantee safety at the database level
      await db.update(users)
        .set({
          sessionCount: sql`GREATEST(session_count - 1, 0)`,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));

      logger.info({ userId }, 'Worker Billing: Session credit successfully refunded to candidate account.');
    } else {
      logger.info({ userId }, 'Worker Billing: User is on Pro plan. Session credit restoration is skipped.');
    }

    // 3. Dispatch notification alert to candidate
    await processNotificationJob({
      sessionId,
      userId,
      reason: `Refund processed successfully: ${reason}`
    });

  } catch (error) {
    logger.error({ error, sessionId, userId }, 'Worker Billing: Critical error processing credit refund job');
    throw error;
  }
}
