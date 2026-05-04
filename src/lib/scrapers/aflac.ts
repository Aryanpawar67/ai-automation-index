import * as cheerio          from "cheerio";
import { stripHtml }         from "../stripHtml";
import { targetScrapeCount } from "../jdLimits";
import type { ScrapedJD }    from "../scraper";

// Aflac (careers.aflac.com) is on SAP / jobs2web (CNAME: aflac.jobs2web.com).
// Their sitemap.xml lists every open role exactly once with stable URLs at
// /job/{slug}/{id}/. Detail pages are server-rendered with the description
// inside <span itemprop="description"> (microdata).

const SITEMAP_URL = "https://careers.aflac.com/sitemap.xml";
const HEADERS     = { "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)" };
const CONCURRENCY = 6;

async function fetchSitemapJobUrls(): Promise<string[]> {
  const res = await fetch(SITEMAP_URL, { headers: HEADERS, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return [];
  const xml  = await res.text();
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const m of xml.matchAll(/<loc>(https:\/\/careers\.aflac\.com\/job\/[^<]+)<\/loc>/g)) {
    const url = m[1].trim();
    if (!seen.has(url)) { seen.add(url); urls.push(url); }
  }
  return urls;
}

async function fetchJD(url: string): Promise<ScrapedJD | null> {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const $ = cheerio.load(await res.text());

    // Microdata: <span itemprop="description"> contains the full body
    const descEl = $('[itemprop="description"]').first();
    const rawText = stripHtml(descEl.html() ?? descEl.text() ?? "");
    if (rawText.length < 300) return null;

    // Title: h1 or itemprop="title"
    const title =
      $('[itemprop="title"]').first().text().trim() ||
      $("h1").first().text().trim() ||
      $("title").text().replace(/\s*[|\-–—].*$/, "").trim() ||
      "Untitled";

    return { title, rawText: rawText.slice(0, 12_000), sourceUrl: url };
  } catch {
    return null;
  }
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

export async function scrapeAflac(): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  const urls           = await fetchSitemapJobUrls();
  const totalAvailable = urls.length;
  if (totalAvailable === 0) return { jds: [], totalAvailable: 0 };

  const keep    = targetScrapeCount(totalAvailable);
  const toFetch = urls.slice(0, keep);

  const fetched = await mapWithConcurrency(toFetch, CONCURRENCY, fetchJD);
  const jds     = fetched.filter((x): x is ScrapedJD => x !== null);
  return { jds, totalAvailable };
}
