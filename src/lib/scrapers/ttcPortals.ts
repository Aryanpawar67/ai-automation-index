import { targetScrapeCount } from "../jdLimits";
import type { ScrapedJD }    from "../scraper";

// Generic scraper for TTC Portals career sites (lb.ttcportals.com / iCIMS Talent
// Cloud Portal). These sites are fronted by Cloudflare; direct HTTP requests
// get 403 challenges, so the scraper relies on Firecrawl to render the listing
// and detail pages.
//
// Known tenants on this platform:
//   - careers.amica.com         (Amica Insurance)
//   - careers.progressive.com   (Progressive Insurance)
//
// URL pattern (consistent across tenants):
//   listing: /search/jobs/                                         shows "Showing 1-N of M results"
//   detail:  https://{host}/jobs/{numericId}-{slug}/
// Detail markdown structure:
//   # {title}
//   Location: ..., {state}, {country}
//   Date Posted: ...
//   ...share links...
//   **Description**
//   {body content}

const FIRECRAWL_URL = "https://api.firecrawl.dev/v1/scrape";
const CONCURRENCY   = 5;

interface FirecrawlResp {
  data?: { markdown?: string; metadata?: { title?: string } };
}

async function firecrawl(url: string, waitFor: number): Promise<FirecrawlResp | null> {
  if (!process.env.FIRECRAWL_API_KEY) return null;
  try {
    const res = await fetch(FIRECRAWL_URL, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      },
      body:   JSON.stringify({ url, formats: ["markdown"], waitFor }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return null;
    return await res.json() as FirecrawlResp;
  } catch { return null; }
}

function extractJobLinks(md: string): Array<{ url: string; title: string; id: number }> {
  // Match markdown links to /jobs/{numericId}-{slug}/, but NOT /search/...
  const re   = /\[([^\]]{4,200})\]\((https:\/\/[^\/]+\/jobs\/(\d+)-[^\)#?]+)\)/g;
  const seen = new Set<number>();
  const out: Array<{ url: string; title: string; id: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    const id = Number(m[3]);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ url: m[2], title: m[1].trim(), id });
  }
  return out;
}

/**
 * Reduces a job title to a "role family" key for cross-listing dedup.
 * Tenants like Progressive post the same role 5+ times for different cities
 * with city/specialty appended after a dash. E.g.:
 *   "Insurance Defense Attorney -- Bodily Injury"      → "insurance defense attorney"
 *   "Claims Adjuster Senior - Litigation"              → "claims adjuster senior"
 *   "Claims Adjuster Senior - Injury"                  → "claims adjuster senior"
 *   "Senior or Lead Customer Strategist - Research & AI" → "senior or lead customer strategist"
 *
 * We strip everything after the first " - " or " -- " (dash-bounded suffix),
 * lowercase, and collapse whitespace. Conservative: keeps the role-family
 * name intact so genuinely-different roles ("Auto Damage Claims Adjuster"
 * vs "Field Claims Adjuster") stay distinct.
 */
function roleFamilyKey(title: string): string {
  return title
    .toLowerCase()
    .split(/\s+--?\s+/)[0]
    .replace(/\s+/g, " ")
    .trim();
}

function extractTotal(md: string): number {
  // Tolerant of bold markers, en-dash, and singular/plural "result(s)".
  const m = md.match(/Showing\s+\**\s*\d+\s*\**\s*[-–]\s*\**\s*\d+\s*\**\s+of\s+\**\s*(\d+)\s*\**\s+results?/i);
  return m ? Number(m[1]) : 0;
}

function parseDetailMarkdown(md: string, fallbackTitle: string): { title: string; rawText: string } | null {
  const titleMatch = md.match(/^#\s+([^\n]+)/m);
  const title      = (titleMatch?.[1] ?? fallbackTitle).trim();

  const descIdx = md.search(/\*\*Description\*\*/i);
  let body      = descIdx >= 0 ? md.slice(descIdx + 15) : md;

  body = body
    .replace(/Apply Now[\s\S]*?Save Job[A-Za-z]*/gi, "")
    .replace(/Share:\s*\[[^\n]*?\n/g, "")
    .replace(/(?:Share on (?:Twitter|Facebook|LinkedIn)|Share with Email)[^\n]*\n/gi, "")
    .replace(/^\[(Back to Search Results|Previous Opportunity|Next Opportunity)[^\n]*\n/gim, "")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/\s{3,}/g, "\n")
    .trim();

  if (body.length < 300) return null;
  return { title, rawText: body.slice(0, 12_000) };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx]  = await fn(items[idx]);
      }
    }),
  );
  return out;
}

/**
 * Build paginated listing URL: appends `?page=N` (or `&page=N` if URL already
 * has a query string). Page 1 is the bare URL.
 */
function pageUrl(listingUrl: string, page: number): string {
  if (page <= 1) return listingUrl;
  const sep = listingUrl.includes("?") ? "&" : "?";
  return `${listingUrl}${sep}page=${page}`;
}

const MAX_PAGES = 4;  // covers up to 100 listings (4 × 25/page)

/**
 * Scrape a TTC Portals career site.
 * @param listingUrl Full listing URL e.g. "https://careers.amica.com/search/jobs"
 *
 * Walks paginated listings until we have `LARGE_SCRAPE` (or `SMALL_SCRAPE`)
 * **distinct role families** — large tenants like Progressive post the same
 * role title across many cities, so a single page often yields only 12-15
 * unique role families.
 */
export async function scrapeTTCPortals(
  listingUrl: string,
): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  const seenFamilies = new Set<string>();
  const seenIds      = new Set<number>();
  const dedupedLinks: Array<{ url: string; title: string; id: number }> = [];
  let totalAvailable = 0;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const resp = await firecrawl(pageUrl(listingUrl, page), 8000);
    const md   = resp?.data?.markdown ?? "";
    if (!md) break;

    if (page === 1) {
      const links     = extractJobLinks(md);
      totalAvailable  = Math.max(extractTotal(md), links.length);
    } else {
      // Subsequent pages — total stays the same, just collect new links
    }

    const pageLinks = extractJobLinks(md);
    for (const link of pageLinks) {
      if (seenIds.has(link.id)) continue;
      const family = roleFamilyKey(link.title);
      if (seenFamilies.has(family)) continue;
      seenFamilies.add(family);
      seenIds.add(link.id);
      dedupedLinks.push(link);
    }

    const target = targetScrapeCount(totalAvailable || dedupedLinks.length);
    if (dedupedLinks.length >= target) break;
    // Hit end of listings (last page returned nothing new)
    if (pageLinks.length === 0) break;
  }

  if (dedupedLinks.length === 0) return { jds: [], totalAvailable };
  totalAvailable = totalAvailable || dedupedLinks.length;

  const keep    = targetScrapeCount(totalAvailable);
  const toFetch = dedupedLinks.slice(0, keep);

  const fetched = await mapWithConcurrency(toFetch, CONCURRENCY, async (link) => {
    const r  = await firecrawl(link.url, 5000);
    const md = r?.data?.markdown ?? "";
    if (!md) return null;
    const parsed = parseDetailMarkdown(md, link.title);
    if (!parsed) return null;
    return {
      title:     parsed.title,
      rawText:   parsed.rawText,
      sourceUrl: link.url,
    } satisfies ScrapedJD;
  });

  const jds = fetched.filter((x): x is NonNullable<typeof x> => x !== null);
  return { jds, totalAvailable };
}
