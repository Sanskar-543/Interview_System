import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '@ai-interviewer/shared';

// Create persistent Redis connection for BullMQ
export const redisConnection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const evalQueue = new Queue('eval-queue', { connection: redisConnection });
export const billingQueue = new Queue('billing-queue', { connection: redisConnection });

export async function enqueueEvaluation(sessionId: string, userId: string) {
  await evalQueue.add('evaluate-session', { sessionId, userId }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  });
}

export async function enqueueCreditRefund(sessionId: string, userId: string, reason: string) {
  await billingQueue.add('credit-refund', { sessionId, userId, reason }, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
  });
}
