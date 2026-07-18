import http from 'http';
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

// Create a dummy HTTP server for Render's health checks and to allow waking up the service
const port = process.env.PORT || 8000;
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', message: 'Worker is active and polling queues' }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(port, () => {
  logger.info(`Worker HTTP server listening on port ${port} for Render health checks and wakeups`);
});
