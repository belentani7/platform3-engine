/** Local-first Figura pipeline contracts: no external enrichment charges. */
import { z } from "zod";
import { createHmac } from "node:crypto";

const id = z.string().trim().min(1).max(96).regex(/^[a-zA-Z0-9._-]+$/);
const label = z.string().trim().min(1).max(200);
export const leadInput = z.object({
  id,
  name: label,
  city: z.string().trim().max(120).optional(),
  website: z.string().url().max(2000).optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
}).strict();

export const searchInput = z.object({
  query: z.string().trim().min(2).max(200),
  candidates: z.array(leadInput).max(200),
}).strict();

export const webhookInput = z.object({
  eventId: id,
  eventType: z.enum(["lead.enriched", "search.completed"]),
  data: z.record(z.unknown()),
}).strict();

export type LeadInput = z.infer<typeof leadInput>;
export type SearchInput = z.infer<typeof searchInput>;
export type WebhookInput = z.infer<typeof webhookInput>;

function normalizeText(input: string): string {
  return input.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function enrichLead(untrusted: unknown) {
  const lead = leadInput.parse(untrusted);
  return {
    ...lead,
    name: normalizeText(lead.name),
    city: lead.city ? normalizeText(lead.city) : undefined,
    tags: [...new Set(lead.tags.map(x => normalizeText(x).toLowerCase()))],
    provenance: "provided-by-user" as const,
    verifiedExternally: false as const,
  };
}

export function searchLeads(untrusted: unknown) {
  const input = searchInput.parse(untrusted);
  const terms = normalizeText(input.query).toLowerCase().split(/\s+/).filter(Boolean);
  const ranked = input.candidates.map(item => {
    const lead = enrichLead(item);
    const text = [lead.name, lead.city || "", ...lead.tags].join(" ").toLowerCase();
    const score = terms.filter(term => text.includes(term)).length;
    return { lead, score };
  }).filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.lead.id.localeCompare(b.lead.id));
  return { query: input.query, total: ranked.length, matches: ranked };
}

export function buildSignedWebhook(untrusted: unknown, secret: string) {
  const payload = webhookInput.parse(untrusted);
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("WEBHOOK_SHARED_SECRET must have at least 32 characters");
  }
  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  return { body, signature: "sha256=" + signature };
}

/** Do not accept customer-supplied callback URLs; allow only operator config. */
export function validateWebhookTarget(target: string): URL {
  let url: URL;
  try { url = new URL(target); } catch { throw new Error("Invalid webhook target URL"); }
  if (url.protocol !== "https:" || url.username || url.password || url.hash) {
    throw new Error("Webhook target must be HTTPS without credentials or fragment");
  }
  // Public internet endpoint only; no direct loopback or private IP callbacks.
  if (/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?)/i.test(url.hostname)) {
    throw new Error("Webhook target cannot point to a local or private address");
  }
  return url;
}
