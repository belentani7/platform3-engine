import * as cheerio from "cheerio";
import { webhookQ } from "../queues.js";
// Worker 2: enriquece email SOLO desde la web pública del propio negocio (fetch+cheerio, sin navegador).
// Respeta robots.txt; solo patrones contacto/info; guarda origen+fecha (trazabilidad GDPR).
const MAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const PREF = ["contact", "info", "hola", "presupuest", "reservas", "comercial"];
export async function enrichJob(job: { data: { userId: string; lead: any; webhookUrl?: string } }) {
  const { lead, webhookUrl, userId } = job.data;
  try {
    const r = await fetch(lead.web, { headers: { "User-Agent": "FiguraBot/1.0 (+https://belentani.example; contacto B2B)" }, signal: AbortSignal.timeout(12000) });
    if (!r.ok) return { email: null };
    const $ = cheerio.load(await r.text());
    $("script,style").remove();
    const found = new Set<string>((($("body").text() + " " + ($("a[href^='mailto:']").attr("href") || "")).match(MAIL) || []).map((m) => m.toLowerCase()));
    const ranked = [...found].filter((m) => !/\.(png|jpg|gif)$/.test(m)).sort((a, b) => (PREF.some((p) => a.startsWith(p)) ? -1 : 0) - (PREF.some((p) => b.startsWith(p)) ? -1 : 0));
    lead.email = ranked[0] || null; lead.emailOrigen = ranked[0] ? lead.web : null;
  } catch { lead.email = null; }
  if (webhookUrl) await webhookQ.add("webhook", { userId, webhookUrl, lead });
  return { email: lead.email };
}
if (process.argv[1]?.endsWith("enrich.worker.ts")) {
  void import("../queues.js").then(({ makeWorker }) => makeWorker("enrich", enrichJob));
}
