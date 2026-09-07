// Worker 3: dispara webhook a CRM con reintentos. Incluye plantilla de baja (LSSI/GDPR).
export async function webhookJob(job: { data: { webhookUrl: string; lead: any; userId: string } }) {
  const { webhookUrl, lead } = job.data;
  const r = await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ origen: "FIGURA Belentani", fecha: new Date().toISOString(), baja: "Responder BAJA para no recibir más comunicaciones (art. 21 LSSI).", lead }) });
  if (!r.ok) throw new Error("webhook " + r.status); // BullMQ reintenta con backoff
  return { status: r.status };
}
if (process.argv[1]?.endsWith("webhook.worker.ts")) {
  void import("../queues.js").then(({ makeWorker }) => makeWorker("webhook", webhookJob));
}
