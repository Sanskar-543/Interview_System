import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env, logger } from '@ai-interviewer/shared';

// Create persistent Redis connection for BullMQ
export const redisConnection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const evalQueue = new Queue('eval-queue', { connection: redisConnection });
export const billingQueue = new Queue('billing-queue', { connection: redisConnection });

async function wakeWorker() {
  if (env.WORKER_URL) {
    const wakeUrl = `${env.WORKER_URL.replace(/\/$/, '')}/ping`;
    logger.info({ wakeUrl }, 'Queue: Sending wake-up ping to worker Render URL');
    fetch(wakeUrl)
      .then((res) => {
        if (!res.ok) {
          logger.warn({ status: res.status }, 'Queue: Wake-up ping returned non-OK status');
        }
      })
      .catch((err) => {
        logger.error({ err }, 'Queue: Failed to send wake-up ping to worker');
      });
  }
}

export async function enqueueEvaluation(sessionId: string, userId: string) {
  await evalQueue.add('evaluate-session', { sessionId, userId }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  });
  wakeWorker();
}

export async function enqueueCreditRefund(sessionId: string, userId: string, reason: string) {
  await billingQueue.add('credit-refund', { sessionId, userId, reason }, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
  });
  wakeWorker();
}
