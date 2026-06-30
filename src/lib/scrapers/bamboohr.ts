import { stripHtml }         from "../stripHtml";
import { targetScrapeCount } from "../jdLimits";
import type { ScrapedJD }    from "../scraper";

// BambooHR hosts a public careers JSON API per tenant:
//   list:   GET https://<sub>.bamboohr.com/careers/list          → { result: [{ id, jobOpeningName, ... }] }
//   detail: GET https://<sub>.bamboohr.com/careers/<id>/detail   → { jobOpening: { jobOpeningName, description } }
// Companies often embed it on a vanity domain (e.g. volantetech.com/careers) via
// <sub>.bamboohr.com/js/embed.js — so the tenant subdomain can be recovered from
// the career page HTML when the URL itself isn't a bamboohr.com host.
//
// The JSON detail endpoint aggressively rate-limits (returns 200 with an empty
// jobOpening once tripped), so when it comes back empty we fall back to rendering
// the JS detail page with Firecrawl.

const UA            = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120";
const FIRECRAWL_URL = "https://api.firecrawl.dev/v1/scrape";
const DETAIL_CONCURRENCY = 4;

interface BambooList { result?: Array<{ id: string | number; jobOpeningName?: string; departmentLabel?: string | null }> }
interface BambooDetail { jobOpening?: { jobOpeningName?: string; description?: string } }

/** Tenant subdomain from a bamboohr.com URL, or null. */
export function extractBamboohrSubdomain(url: string): string | null {
  const m = url.match(/https?:\/\/([a-z0-9-]+)\.bamboohr\.com/i);
  return m ? m[1] : null;
}

/** Fetch a custom-domain career page and recover the embedded BambooHR tenant. */
export async function findBamboohrSubdomain(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/([a-z0-9-]+)\.bamboohr\.com/i);
    return m ? m[1] : null;
  } catch { return null; }
}

/** JSON detail endpoint — returns "" when rate-limited (empty jobOpening). */
async function detailViaApi(subdomain: string, id: string | number): Promise<string> {
  try {
    const res = await fetch(`https://${subdomain}.bamboohr.com/careers/${id}/detail`, {
      headers: { "Accept": "application/json", "User-Agent": UA },
      signal:  AbortSignal.timeout(10_000),
    });
    if (!res.ok) return "";
    const detail = await res.json() as BambooDetail;
    return stripHtml(detail.jobOpening?.description ?? "");
  } catch { return ""; }
}

/** Render the JS detail page with Firecrawl and extract the description body. */
async function detailViaFirecrawl(detailUrl: string): Promise<string> {
  if (!process.env.FIRECRAWL_API_KEY) return "";
  try {
    const res = await fetch(FIRECRAWL_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.FIRECRAWL_API_KEY}` },
      body:    JSON.stringify({ url: detailUrl, formats: ["markdown"], timeout: 90_000, waitFor: 7000 }),
      signal:  AbortSignal.timeout(120_000),
    });
    if (!res.ok) return "";
    const data = await res.json() as { data?: { markdown?: string } };
    const md   = data?.data?.markdown ?? "";
    if (!md) return "";
    // The page chrome (logo, Privacy Policy, Job Openings, title, location) precedes
    // the first horizontal rule; the description follows it.
    const afterRule = md.includes("* * *") ? md.slice(md.indexOf("* * *") + 5) : md;
    return afterRule
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")   // images
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links → text
      .replace(/\s{3,}/g, "\n")
      .trim();
  } catch { return ""; }
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

export async function scrapeBamboohr(subdomain: string): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  let list: BambooList;
  try {
    const res = await fetch(`https://${subdomain}.bamboohr.com/careers/list`, {
      headers: { "Accept": "application/json", "User-Agent": UA },
      signal:  AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { jds: [], totalAvailable: 0 };
    list = await res.json() as BambooList;
  } catch { return { jds: [], totalAvailable: 0 }; }

  const openings = list.result ?? [];
  if (openings.length === 0) return { jds: [], totalAvailable: 0 };
  const totalAvailable = openings.length;
  const keep = targetScrapeCount(totalAvailable);

  const fetched = await mapWithConcurrency(openings.slice(0, keep), DETAIL_CONCURRENCY, async (job) => {
    const sourceUrl = `https://${subdomain}.bamboohr.com/careers/${job.id}`;
    let rawText = await detailViaApi(subdomain, job.id);
    if (rawText.length < 100) rawText = await detailViaFirecrawl(sourceUrl);
    if (rawText.length < 100) return null;
    return {
      title:      job.jobOpeningName ?? "Untitled",
      rawText:    rawText.slice(0, 12_000),
      sourceUrl,
      department: job.departmentLabel ?? undefined,
    } satisfies ScrapedJD;
  });

  const jds = fetched.filter((x): x is NonNullable<typeof x> => x !== null) as ScrapedJD[];
  return { jds, totalAvailable };
}
