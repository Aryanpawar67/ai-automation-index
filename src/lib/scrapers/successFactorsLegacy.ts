import * as cheerio from "cheerio";
import { targetScrapeCount } from "../jdLimits";
import type { ScrapedJD }    from "../scraper";

// Legacy SAP SuccessFactors "career" servlet (e.g. career10.successfactors.com/
// career?company=<code>&career_ns=job_listing_summary). Unlike the modern Career
// Site Builder (JSON REST) and jobs2web tenants, this portal renders its job list
// client-side via DWR (Java RPC) and exposes no usable list API:
//   - /api/rest/listjobs → 404
//   - OData v2 → 401 (needs OAuth)
//   - DWR getInitialJobSearchData → 'not authorized' without a server-bound CSRF
//
// So we render the listing with Firecrawl, expanding the "items per page" dropdown
// to its max (100) so a single render returns every posting, then scrape the
// individual detail pages — which ARE server-rendered (description in
// .joqReqDescription). Postings with no description in the requested language show
// SF's "[Not translated in selected language]" placeholder and are skipped.

const FIRECRAWL_URL = "https://api.firecrawl.dev/v1/scrape";
const CONCURRENCY    = 5;
const UA             = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120";
const NOT_TRANSLATED = /not translated in selected language/i;

// Expand the per-page <select> to its largest option so one render lists all jobs.
const EXPAND_JS =
  "var sels = Array.from(document.querySelectorAll('select')).filter(function(s){" +
  "return Array.from(s.options).some(function(o){return o.value==='100';});});" +
  "sels.forEach(function(s){ s.value='100'; s.dispatchEvent(new Event('change',{bubbles:true})); });";

interface FirecrawlResp { success?: boolean; data?: { rawHtml?: string } }

/** True if a URL is the legacy SuccessFactors career servlet (DWR-rendered list). */
export function isSapLegacyCareerPortal(url: string): boolean {
  return /successfactors\.(com|eu)\/career\?/i.test(url) && /[?&]company=/i.test(url);
}

function countIds(html: string): number {
  return new Set([...html.matchAll(/career_job_req_id=(\d+)/gi)].map(m => m[1])).size;
}

/** Posting count from the listing ("79 Jobs matched your search"). 0 if unknown. */
export function extractPostingCount(html: string): number {
  const m = html.match(/(\d+)\s+Jobs?\b/i);
  return m ? Number(m[1]) : 0;
}

async function firecrawlRendered(url: string): Promise<string> {
  if (!process.env.FIRECRAWL_API_KEY) return "";
  // The heavy DWR page + page-expand actions make a single render flaky: Firecrawl
  // intermittently times out, and even on success it may capture before the
  // expanded list (per-page=100) finishes rendering — leaving only the first page
  // of 10 tiles. Retry until a render carries "enough" job links (the full list or
  // a comfortable buffer over the scrape target), keeping the best attempt as a
  // fallback.
  let best = "", bestIds = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(FIRECRAWL_URL, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${process.env.FIRECRAWL_API_KEY}`,
        },
        body: JSON.stringify({
          url,
          formats: ["rawHtml"],
          timeout: 90_000,
          waitFor: 4000,
          actions: [
            { type: "wait", milliseconds: 4000 },
            { type: "executeJavascript", script: EXPAND_JS },
            { type: "wait", milliseconds: 7000 },
          ],
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (res.ok) {
        const data    = await res.json() as FirecrawlResp;
        const rawHtml = data?.data?.rawHtml ?? "";
        const ids     = countIds(rawHtml);
        if (ids > bestIds) { best = rawHtml; bestIds = ids; }
        // Accept once we have the whole list, or a buffer (25) comfortably above
        // the 20 scrape target to absorb 'not translated' skips.
        const target = extractPostingCount(rawHtml);
        if (ids > 0 && (ids >= 25 || (target > 0 && ids >= target))) return rawHtml;
      }
    } catch { /* retry */ }
  }
  return best;
}

function buildDetailUrl(origin: string, company: string, site: string, id: string): string {
  const p = new URLSearchParams({
    career_ns:         "job_listing",
    company,
    navBarLevel:       "JOB_SEARCH",
    rcm_site_locale:   "en_US",
    site,
    career_job_req_id: id,
  });
  return `${origin}/career?${p.toString()}`;
}

function parseDetail(html: string): { title: string; rawText: string } | null {
  const $ = cheerio.load(html);
  $("script,style,noscript").remove();
  const rawText = $(".joqReqDescription").text().replace(/\s+/g, " ").trim();
  if (rawText.length < 100 || NOT_TRANSLATED.test(rawText)) return null;
  // <title> is "Career Opportunities: <Job Title> (<id>)"
  const m     = $("title").text().match(/career opportunities:\s*(.+?)\s*\(\d+\)\s*$/i);
  const title = (m?.[1] ?? $("h1").first().text() ?? "").trim() || "Untitled";
  return { title, rawText };
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

export async function scrapeSuccessFactorsLegacy(url: string): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  let origin = "", company = "", site = "";
  try {
    const u = new URL(url);
    origin  = u.origin;
    company = u.searchParams.get("company") ?? "";
    site    = u.searchParams.get("site")    ?? "";
  } catch { return { jds: [], totalAvailable: 0 }; }
  if (!company) return { jds: [], totalAvailable: 0 };

  const rawHtml = await firecrawlRendered(url);
  if (!rawHtml) return { jds: [], totalAvailable: 0 };

  const ids = [...new Set([...rawHtml.matchAll(/career_job_req_id=(\d+)/gi)].map(m => m[1]))];
  if (ids.length === 0) return { jds: [], totalAvailable: 0 };
  // Prefer the portal's own posting count — accurate even if the render captured
  // only the first page of tiles.
  const totalAvailable = Math.max(extractPostingCount(rawHtml), ids.length);

  // Fetch a generous buffer beyond the target: a sizable share of postings can be
  // 'not translated' / empty, so over-fetch (bounded) and keep the first `keep`
  // that yield a real description.
  const keep       = targetScrapeCount(totalAvailable);
  const candidates = ids.slice(0, Math.min(ids.length, keep * 3));

  const fetched = await mapWithConcurrency(candidates, CONCURRENCY, async (id) => {
    const detailUrl = buildDetailUrl(origin, company, site, id);
    try {
      const res = await fetch(detailUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12_000) });
      if (!res.ok) return null;
      const parsed = parseDetail(await res.text());
      if (!parsed) return null;
      return { title: parsed.title, rawText: parsed.rawText.slice(0, 12_000), sourceUrl: detailUrl } satisfies ScrapedJD;
    } catch { return null; }
  });

  const jds = fetched.filter((x): x is ScrapedJD => x !== null).slice(0, keep);
  return { jds, totalAvailable };
}
