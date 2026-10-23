import { Worker } from "bullmq";
import { enrichLead } from "../contracts.js";
import { openConnection } from "../queues.js";

const connection = openConnection();
const worker = new Worker("enrich", async (job) => enrichLead(job.data), {
  connection,
  concurrency: 4,
});
worker.on("completed", (job) => console.log("[enrich] completed", job.id));
worker.on("failed", (job, error) => console.error("[enrich] failed", job?.id, error.message));

async function shutdown() {
  await worker.close();
  await connection.quit();
}
process.once("SIGTERM", () => { void shutdown(); });
process.once("SIGINT", () => { void shutdown(); });
console.log("[enrich] worker listening to queue 'enrich'");
