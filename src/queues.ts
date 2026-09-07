import { Queue, Worker, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import { z } from "zod";

export const conn = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", { maxRetriesPerRequest: null });
// Colas: search → enrich → webhook (pipeline por fases, reintentos con backoff)
export const searchQ = new Queue("search", { connection: conn });
export const enrichQ = new Queue("enrich", { connection: conn });
export const webhookQ = new Queue("webhook", { connection: conn });

export const JobIn = z.object({
  userId: z.string(), query: z.string(), location: z.string(),
  max: z.number().min(1).max(60).default(20),
  webhookUrl: z.string().url().optional(), costCapUsd: z.number().default(5),
});
export type JobIn = z.infer<typeof JobIn>;
export async function events(q: string) { return new QueueEvents(q, { connection: conn }); }
export function makeWorker(name: "search" | "enrich" | "webhook", fn: (j: any) => Promise<any>) {
  return new Worker(name, fn, { connection: conn, concurrency: 3 });
}
