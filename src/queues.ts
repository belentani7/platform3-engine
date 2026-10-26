import { enrichLead, normalizeLead, QUEUE_NAME, redisConnection, parseCliArgs, type LeadInput } from './contract.js';

let options: ReturnType<typeof parseCliArgs> | undefined;
try {
  options = parseCliArgs(process.argv.slice(2));
} catch {
  console.error('Usage: npm run dev -- --dry-run --json \'{"sourceId":"demo-1","name":"Example"}\'');
  console.error('To write to local Redis: npm run enqueue -- --json \'{...}\'');
  process.exitCode = 2;
}

if (options) {
  try {
    const input: unknown = JSON.parse(options.json);
    const lead = normalizeLead(input);
    if (!options.enqueue) {
      console.log(JSON.stringify(enrichLead(lead)));
    } else {
      const { Queue } = await import('bullmq');
      const queue = new Queue<LeadInput>(QUEUE_NAME, {
        connection: redisConnection(process.env.REDIS_URL, process.env.ALLOW_REMOTE_REDIS === '1'),
      });
      try {
        const job = await queue.add('normalize', lead, {
          jobId: lead.sourceId,
          attempts: 2,
          backoff: { type: 'fixed', delay: 1000 },
          removeOnComplete: false,
          removeOnFail: false,
        });
        console.log(JSON.stringify({ status: 'queued', jobId: job.id }));
      } finally {
        await queue.close();
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Invalid input');
    process.exitCode = 1;
  }
}
