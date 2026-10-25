/** Pure, offline normalization contract. No scraping, paid API calls or HTTP fetches. */
export type LeadInput = {
  sourceId: string;
  name: string;
  city?: string;
  website?: string;
};

export type LeadResult = LeadInput & {
  status: "normalized-offline";
};

export const QUEUE_NAME = "platform3-enrichment";

function normalizedText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") throw new Error(`${label} must be text`);
  const result = value.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (!result || result.length > maxLength || /[\u0000-\u001F\u007F]/u.test(result)) {
    throw new Error(`${label} has invalid length or characters`);
  }
  return result;
}

export function normalizeLead(value: unknown): LeadInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Lead must be a JSON object");
  }
  const input = value as Record<string, unknown>;
  const allowed = new Set(["sourceId", "name", "city", "website"]);
  if (Object.keys(input).some((key) => !allowed.has(key))) {
    throw new Error("Unexpected lead field");
  }
  const sourceId = normalizedText(input.sourceId, "sourceId", 64);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(sourceId)) {
    throw new Error("sourceId must be an opaque ASCII identifier");
  }
  const name = normalizedText(input.name, "name", 120);
  const result: LeadInput = { sourceId, name };
  if (input.city !== undefined) result.city = normalizedText(input.city, "city", 80);
  if (input.website !== undefined) {
    const website = normalizedText(input.website, "website", 2048);
    let url: URL;
    try { url = new URL(website); } catch { throw new Error("website must be a valid HTTPS URL"); }
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) {
      throw new Error("website must be HTTPS without embedded credentials");
    }
    result.website = url.href;
  }
  return result;
}

export function enrichLead(value: unknown): LeadResult {
  return { ...normalizeLead(value), status: "normalized-offline" };
}

export function redisConnection(raw: string | undefined, allowRemote = false): {
  host: string;
  port: number;
  username?: string;
  password?: string;
  tls?: Record<string, never>;
} {
  let url: URL;
  try { url = new URL(raw || "redis://127.0.0.1:6379"); }
  catch { throw new Error("Invalid REDIS_URL"); }
  if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
    throw new Error("REDIS_URL must use redis or rediss");
  }
  if (!new Set(["localhost", "127.0.0.1", "[::1]"]).has(url.hostname) && !allowRemote) {
    throw new Error("Remote Redis requires explicit ALLOW_REMOTE_REDIS=1");
  }
  const port = url.port ? Number(url.port) : 6379;
  if (!Number.isInteger(port) || port < 1 || port > 65535 || (url.pathname !== "" && url.pathname !== "/" && url.pathname !== "/0")) {
    throw new Error("Unsupported Redis URL port or database");
  }
  return {
    host: url.hostname,
    port,
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
  };
}
