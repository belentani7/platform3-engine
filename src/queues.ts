import { enrichLead, normalizeLead, QUEUE_NAME, redisConnection, type LeadInput } from './contract.js';

const args = process.argv.slice(2);
const jsonAt = args.indexOf('--json');
const enqueue = args.includes('--enqueue');

if (jsonAt < 0 || jsonAt + 1 >= args.length || args.some((arg, i) => arg.startsWith('--') && arg !== '--json' && arg !== '--dry-run' && arg !== '--enqueue')) {
  console.error('Usage: npm run dev -- --dry-run --json \'{"sourceId":"demo-1","name":"Example"}\'');
  console.error('To write to local Redis: npm run enqueue -- --json \'{...}\'');
  process.exitCode = 2;
} else {
  try {
    const input: unknown = JSON.parse(args[jsonAt + 1]);
    const lead = normalizeLead(input);
    if (!enqueue) {
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
