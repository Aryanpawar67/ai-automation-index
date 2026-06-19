import { targetScrapeCount } from "../jdLimits";
import { looksNonEnglish, translateToEnglish } from "../translate";
import type { ScrapedJD }    from "../scraper";

// Hilti (careers.hilti.group) — an Umbraco-fronted careers site over an Avature
// ATS, behind Cloudflare (plain requests get 403). Both the listing and the
// detail pages are JS-rendered, so use Firecrawl:
//   listing: /en/jobs/?search=&country=&page=N  → anchors /en/jobs/{id}-en/{slug}/
//   detail:  /en/jobs/{id}-en/{slug}/           → H1 title + description body
// The listing exposes no total count, so totalAvailable is the number of unique
// postings collected across the paged listings.

const ORIGIN        = "https://careers.hilti.group";
const FIRECRAWL_URL = "https://api.firecrawl.dev/v1/scrape";
const LIST_BASE     = `${ORIGIN}/en/jobs/?search=&country=`;
const MAX_PAGES     = 5;
const CONCURRENCY   = 4;

interface FirecrawlResp { success?: boolean; data?: { markdown?: string; rawHtml?: string } }

async function firecrawl(url: string, format: "markdown" | "rawHtml"): Promise<string> {
  if (!process.env.FIRECRAWL_API_KEY) return "";
  try {
    const res = await fetch(FIRECRAWL_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.FIRECRAWL_API_KEY}` },
      body:    JSON.stringify({ url, formats: [format], timeout: 90_000, waitFor: 6000 }),
      signal:  AbortSignal.timeout(120_000),
    });
    if (!res.ok) return "";
    const data = await res.json() as FirecrawlResp;
    return (format === "markdown" ? data?.data?.markdown : data?.data?.rawHtml) ?? "";
  } catch { return ""; }
}

function jobPaths(html: string): string[] {
  return [...new Set([...html.matchAll(/\/en\/jobs\/\d+-en\/[a-z0-9-]+\/?/gi)].map(m => m[0]))];
}

function parseDetail(md: string): { title: string; rawText: string } | null {
  const h1 = md.match(/^#\s+(.+)$/m);
  const title = (h1?.[1] ?? "").trim();
  // The description sits AFTER the metadata block + "Apply Now" link, so keep
  // everything from the H1 onward and only trim the trailing boilerplate
  // (related vacancies / generic function blurb), not the body.
  let body = h1 ? md.slice(md.indexOf(h1[0]) + h1[0].length) : md;
  body = body
    .replace(/##\s*Related vacancies[\s\S]*$/i, "")
    .replace(/##\s*Why Hilti[\s\S]*$/i, "")
    .replace(/\[Skip to main content\][^\n]*/gi, "")
    .replace(/\[Apply Now\]\([^)]*\)/gi, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")     // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")  // links → text
    .replace(/\bSaveSaved\b/g, "")
    .replace(/\s{3,}/g, "\n")
    .trim();
  if (body.length < 150) return null;
  return { title: title || "Untitled", rawText: body };
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

export async function scrapeHilti(): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  // Collect job links across paged listings (dedupe by numeric id).
  const byId = new Map<string, string>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const sep  = page === 1 ? "" : `&page=${page}`;
    const html = await firecrawl(`${LIST_BASE}${sep}`, "rawHtml");
    if (!html) break;
    const before = byId.size;
    for (const path of jobPaths(html)) {
      const id = path.match(/\/jobs\/(\d+)-en\//i)?.[1];
      if (id && !byId.has(id)) byId.set(id, `${ORIGIN}${path}`);
    }
    if (byId.size === before) break; // page added nothing new → stop
  }

  const links = [...byId.values()];
  if (links.length === 0) return { jds: [], totalAvailable: 0 };
  const totalAvailable = links.length;

  const keep    = targetScrapeCount(totalAvailable);
  const toFetch = links.slice(0, keep + 4);
  const fetched = await mapWithConcurrency(toFetch, CONCURRENCY, async (link) => {
    const md = await firecrawl(link, "markdown");
    if (!md) return null;
    const parsed = parseDetail(md);
    if (!parsed) return null;
    let { title, rawText } = parsed;
    if (looksNonEnglish(rawText) || looksNonEnglish(title)) {
      const t = await translateToEnglish(title, rawText);
      title = t.title; rawText = t.rawText;
    }
    return { title, rawText: rawText.slice(0, 12_000), sourceUrl: link } satisfies ScrapedJD;
  });

  const jds = fetched.filter((x): x is ScrapedJD => x !== null).slice(0, keep);
  return { jds, totalAvailable };
}
