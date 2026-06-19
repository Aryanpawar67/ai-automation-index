import { stripHtml }         from "../stripHtml";
import { targetScrapeCount } from "../jdLimits";
import { looksNonEnglish, translateToEnglish } from "../translate";
import type { ScrapedJD }    from "../scraper";

// TurboHire career sites (e.g. tatamotors.turbohire.co). The SPA talks to a
// shared API host (thapi-stage2.azurewebsites.net) that requires a short-lived
// anonymous bearer token:
//   token:  GET  /api/token/noauth                       (needs a Referer header)
//           → { access_token }
//   list:   POST /api/careerpagev2/filteredjobs?orgId=&pageType=0   (Bearer)
//           → { Total, Result: [{ JobId, JobIdObfuscated, JobTitle, Department }] }
//           (the list's JobDescV2 is only a short excerpt)
//   detail: GET  /api/referraljobs?tkn={JobIdObfuscated}&fieldVisibility=CareerPage
//           → { JobTitle, JobDescription, RolesAndResponsibilities, Eligibility }
// orgId comes from the career-page URL's ?orgId=.

const API = "https://thapi-stage2.azurewebsites.net";
const UA  = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120";
const CONCURRENCY = 5;

/** orgId + referer origin from a *.turbohire.co career URL, or null. */
export function parseTurbohire(url: string): { orgId: string; referer: string } | null {
  try {
    const u = new URL(url);
    if (!/\.turbohire\.co$/i.test(u.hostname)) return null;
    const orgId = u.searchParams.get("orgId");
    if (!orgId) return null;
    return { orgId, referer: `${u.origin}/` };
  } catch { return null; }
}

async function getToken(referer: string): Promise<string> {
  try {
    const res = await fetch(`${API}/api/token/noauth`, {
      headers: { "Accept": "application/json", "User-Agent": UA, "Referer": referer },
      signal:  AbortSignal.timeout(12_000),
    });
    if (!res.ok) return "";
    const d = await res.json() as { access_token?: string };
    return d.access_token ?? "";
  } catch { return ""; }
}

interface TurboListItem { JobIdObfuscated?: string; JobTitle?: string; Department?: string }

async function listJobs(orgId: string, referer: string, token: string): Promise<TurboListItem[]> {
  try {
    const res = await fetch(`${API}/api/careerpagev2/filteredjobs?orgId=${orgId}&pageType=0`, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json", "Accept": "application/json",
        "Authorization": `Bearer ${token}`, "User-Agent": UA, "Referer": referer,
      },
      body:   JSON.stringify({ SortByV2: { Key: "PostedDate", Order: 2 }, Keyword: "", Department: "", CustomFields: {} }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const d = await res.json() as { Result?: TurboListItem[] };
    return d.Result ?? [];
  } catch { return []; }
}

async function jobDetail(obf: string, referer: string, token: string): Promise<{ title: string; rawText: string } | null> {
  try {
    const res = await fetch(`${API}/api/referraljobs?tkn=${encodeURIComponent(obf)}&fieldVisibility=CareerPage`, {
      headers: { "Accept": "application/json", "Authorization": `Bearer ${token}`, "User-Agent": UA, "Referer": referer },
      signal:  AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const d = Array.isArray(await res.clone().json().catch(() => null)) ? (await res.json())[0] : await res.json();
    const parts = [d?.JobDescription, d?.RolesAndResponsibilities, d?.Eligibility].filter(Boolean).join("\n\n");
    const rawText = stripHtml(parts);
    if (rawText.length < 100) return null;
    return { title: String(d?.JobTitle ?? "Untitled"), rawText };
  } catch { return null; }
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
    }),
  );
  return out;
}

export async function scrapeTurbohire(url: string): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  const parsed = parseTurbohire(url);
  if (!parsed) return { jds: [], totalAvailable: 0 };
  const { orgId, referer } = parsed;

  const token = await getToken(referer);
  if (!token) return { jds: [], totalAvailable: 0 };

  const items = (await listJobs(orgId, referer, token)).filter(j => j.JobIdObfuscated);
  if (items.length === 0) return { jds: [], totalAvailable: 0 };
  const totalAvailable = items.length;

  const keep    = targetScrapeCount(totalAvailable);
  const toFetch = items.slice(0, keep + 5);
  const fetched = await mapWithConcurrency(toFetch, CONCURRENCY, async (item) => {
    const d = await jobDetail(item.JobIdObfuscated!, referer, token);
    if (!d) return null;
    let title = d.title || item.JobTitle || "Untitled";
    let rawText = d.rawText;
    if (looksNonEnglish(rawText) || looksNonEnglish(title)) {
      const t = await translateToEnglish(title, rawText);
      title = t.title; rawText = t.rawText;
    }
    return {
      title,
      rawText:    rawText.slice(0, 12_000),
      sourceUrl:  `${referer}job/publicjobs/${item.JobIdObfuscated}`,
      department: item.Department,
    } satisfies ScrapedJD;
  });

  const jds = fetched.filter((x): x is ScrapedJD => x !== null).slice(0, keep);
  return { jds, totalAvailable };
}
