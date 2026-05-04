import { targetScrapeCount } from "../jdLimits";
import type { ScrapedJD }    from "../scraper";

// Assurant (jobs.assurant.com) is on Happy Dance (recruitics.com career-site
// platform), fronted by Cloudflare. Direct curl gets 403; Firecrawl bypasses.
//
// URL pattern:
//   listing:  /en/jobs/?search=&location=&page=N        (20 results/page, 8 pages)
//   detail:   /en/jobs/job/{slug}-r-{id}/
// Listing markdown shows "Showing 1 to 20 of 147 matching jobs" then job cards.
// Detail markdown has H1 title, metadata block, and full description.

const FIRECRAWL_URL = "https://api.firecrawl.dev/v1/scrape";
const CONCURRENCY   = 5;
const LISTING_BASE  = "https://jobs.assurant.com/en/jobs/?search=&location=";

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
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) return null;
    return await res.json() as FirecrawlResp;
  } catch { return null; }
}

function extractTotal(md: string): number {
  // Markdown shows "Showing **1** to **20** of **147** matching jobs"
  // Bold markers (**) can appear around the number — strip them tolerantly.
  const m = md.match(/of\s+\**\s*(\d+)\s*\**\s+matching\s+jobs/i);
  return m ? Number(m[1]) : 0;
}

function extractJobLinks(md: string): Array<{ url: string; title: string }> {
  // Match markdown headings/links that point to /en/jobs/job/{slug}-r-{id}/
  const re   = /\[([^\]]{4,200})\]\((https:\/\/jobs\.assurant\.com\/en\/jobs\/job\/[^\)#]+-r-(\d+)\/)\)/g;
  const seen = new Set<string>();
  const out: Array<{ url: string; title: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    const url = m[2];
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ url, title: m[1].trim() });
  }
  return out;
}

function parseDetailMarkdown(md: string, fallbackTitle: string): { title: string; rawText: string } | null {
  const titleMatch = md.match(/^#\s+([^\n]+)/m);
  const title      = (titleMatch?.[1] ?? fallbackTitle).trim();

  // Strip the leading nav/banner up to and including the H1 line.
  // The actual description starts after the metadata block.
  let body = md;
  const h1Idx = body.indexOf(`# ${title}`);
  if (h1Idx >= 0) body = body.slice(h1Idx + title.length + 2);

  // Trim share / similar-jobs / related-jobs sections that come after description
  body = body
    .replace(/^Skip to main content[\s\S]*?$/im, "")
    .replace(/Job Scam Alert[\s\S]*?\.\s/g, "")
    .replace(/SaveSaved/g, "")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/!\[[^\]]*\]\([^\)]+\)/g, "")
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

export async function scrapeAssurant(): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  const listResp = await firecrawl(LISTING_BASE, 8000);
  const listMd   = listResp?.data?.markdown ?? "";
  if (!listMd) return { jds: [], totalAvailable: 0 };

  const links          = extractJobLinks(listMd);
  const totalAvailable = Math.max(extractTotal(listMd), links.length);
  if (links.length === 0) return { jds: [], totalAvailable };

  const keep    = targetScrapeCount(totalAvailable);
  const toFetch = links.slice(0, keep);

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
