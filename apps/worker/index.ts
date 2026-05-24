import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { env, logger } from '@ai-interviewer/shared';
import { processEvaluationJob } from './jobs/eval';
import { processNotificationJob } from './jobs/notification';
import { processCreditRefundJob } from './jobs/billing';

// Connection mapping IORedis with maxRetriesPerRequest: null as required by BullMQ workers
const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

const evalWorker = new Worker('eval-queue', async (job) => {
  if (job.name === 'evaluate-session') {
    await processEvaluationJob(job.data);
  }
}, { connection });

const billingWorker = new Worker('billing-queue', async (job) => {
  if (job.name === 'credit-refund') {
    await processCreditRefundJob(job.data);
  }
}, { connection });

evalWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Worker: Evaluation job completed successfully');
});

evalWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Worker: Evaluation job failed');
});

billingWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Worker: Billing refund job completed successfully');
});

billingWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Worker: Billing refund job failed');
});

logger.info('Worker: Asynchronous Background Job Workers running successfully.');
