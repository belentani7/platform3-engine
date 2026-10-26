import { Worker } from 'bullmq';
import { enrichLead, QUEUE_NAME, redisConnection, type LeadInput, type LeadResult } from '../contract.js';

const worker = new Worker<LeadInput, LeadResult>(
  QUEUE_NAME,
  async (job) => enrichLead(job.data),
  {
    connection: redisConnection(process.env.REDIS_URL, process.env.ALLOW_REMOTE_REDIS === '1'),
    concurrency: 2,
  },
);

worker.on('completed', (job) => console.info('Completed job', job.id));
worker.on('failed', (job) => console.error('Failed job', job?.id ?? 'unknown'));
worker.on('error', () => console.error('Worker connection error (details withheld)'));

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { void worker.close().then(() => { process.exitCode = 0; }); });
}
