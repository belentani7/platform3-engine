import { JobIn, enrichQ, searchQ } from "../queues.js";
const KEY = process.env.GOOGLE_PLACES_KEY!;
const FM = "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.primaryType,places.internationalPhoneNumber,places.websiteUri";
// Worker 1: Text Search oficial con paginación (máx 60) + tope de coste. Sin scraping.
export async function searchJob(job: { data: JobIn }) {
  const j = JobIn.parse(job.data);
  const est = Math.ceil(j.max / 20) * 0.64; // $32/1000 por página
  if (est > j.costCapUsd) throw new Error(`coste ${est}$ supera tope ${j.costCapUsd}$`);
  let out: any[] = [], token: string | undefined;
  do {
    const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": FM },
      body: JSON.stringify({ textQuery: `${j.query} en ${j.location}`, pageSize: Math.min(20, j.max - out.length), ...(token ? { pageToken: token } : {}) }),
    });
    if (!r.ok) throw new Error("places " + r.status);
    const d = await r.json(); out = out.concat(d.places || []); token = d.nextPageToken;
    if (token) await new Promise((s) => setTimeout(s, 2100));
  } while (token && out.length < j.max);
  const leads = out.map((p: any) => ({ id: p.id, name: p.displayName?.text, addr: p.formattedAddress, cat: p.primaryType, rating: p.rating, nrev: p.userRatingCount, tel: p.internationalPhoneNumber, web: p.websiteUri, origen: "Places API", fecha: new Date().toISOString().slice(0, 10) }));
  for (const l of leads) if (l.web) await enrichQ.add("enrich", { userId: j.userId, lead: l, webhookUrl: j.webhookUrl });
  return { n: leads.length, enrichQueued: leads.filter((l) => l.web).length };
}
if (process.argv[1]?.endsWith("search.worker.ts")) {
  void import("../queues.js").then(({ makeWorker }) => makeWorker("search", searchJob));
}
