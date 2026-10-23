/** Figura engine: submit validated jobs to Redis/BullMQ. */
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { leadInput, searchInput, webhookInput } from "./contracts.js";

export const QUEUES = ["enrich", "search", "webhook"] as const;
export type QueueName = (typeof QUEUES)[number];

export function openConnection(): IORedis {
  return new IORedis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}

export function validateJob(queueName: QueueName, input: unknown) {
  if (queueName === "enrich") return leadInput.parse(input);
  if (queueName === "search") return searchInput.parse(input);
  return webhookInput.parse(input);
}

export async function submit(queueName: QueueName, input: unknown) {
  const payload = validateJob(queueName, input);
  const connection = openConnection();
  const queue = new Queue(queueName, { connection, defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 500 },
  } });
  try {
    // Stable ids for enrich and outbound events prevent a retry from
    // duplicating a side effect. Searches are independent requests.
    const jobId = queueName === "enrich" ? "lead-" + (payload as { id: string }).id
      : queueName === "webhook" ? "event-" + (payload as { eventId: string }).eventId
      : "search-" + randomUUID();
    const job = await queue.add(queueName, payload, { jobId });
    return { queue: queueName, jobId: job.id };
  } finally {
    await queue.close();
    await connection.quit();
  }
}

async function main() {
  const [kind, data] = process.argv.slice(2);
  if (!QUEUES.includes(kind as QueueName) || !data) {
    console.error("Usage: npm run dev -- enrich|search|webhook '{\"id\":\"lead-1\",\"name\":\"Example\"}'");
    process.exitCode = 2;
    return;
  }
  try {
    const result = await submit(kind as QueueName, JSON.parse(data));
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error("Job rejected:", error instanceof Error ? error.message : "Unknown error");
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
