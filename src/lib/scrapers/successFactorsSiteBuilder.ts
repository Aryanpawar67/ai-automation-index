import * as cheerio from "cheerio";
import { targetScrapeCount } from "../jdLimits";
import { looksNonEnglish, translateToEnglish } from "../translate";
import type { ScrapedJD } from "../scraper";

// SAP SuccessFactors RMK "Site Builder" career sites with a SERVER-RENDERED
// search page (e.g. careers.tataautocomp.com/search/). Unlike the Döhler-style
// tenants whose listings come from a JSON API, these render job tiles directly
// in the /search/ HTML:
//   listing: GET /search/?q=&startrow=N   → anchors to /job/{slug}/{id}/, and a
//            "… of <N>" results count
//   detail:  GET /job/{slug}/{id}/        → description in .jobdescription /
//            [itemprop=description]; title in <h1>
// Pages serve ~25 tiles; paginate via ?startrow. Report the true total from the
// results count (not just the number of tiles scraped).

const UA          = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120";
const PAGE_ROWS   = 25;
const MAX_PAGES   = 12;
const CONCURRENCY = 5;

/** True if a URL looks like an SF RMK Site Builder server-rendered search page. */
export function isSapSiteBuilderSearch(url: string): boolean {
  return /\/search\/?\?/i.test(url) || /\/search\/?$/i.test(url);
}

function jobLinksFrom(html: string, origin: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/\/job\/[A-Za-z0-9%._-]+\/\d+\/?/gi)) {
    out.add(new URL(m[0], origin).href);
  }
  return [...out];
}

function totalFrom(html: string): number {
  // Prefer the explicit results count ("Results 1 to 25 of 652" / "Results 1 – 25
  // of 652"). A bare "of N" also matches the page count ("Page 1 of 27"), which
  // is much smaller — so match the Results phrase first, then fall back to the
  // LARGEST "of N" on the page.
  const r = html.match(/Results?\s+[\d,]+\s*(?:to|–|-|—)\s*[\d,]+\s+of\s+([\d,]+)/i);
  if (r) return Number(r[1].replace(/,/g, ""));
  const all = [...html.matchAll(/\bof\s+([\d,]+)\b/gi)].map(m => Number(m[1].replace(/,/g, "")));
  return all.length ? Math.max(...all) : 0;
}

function buildSearchUrl(url: string, startrow: number): string {
  const u = new URL(url);
  u.searchParams.set("startrow", String(startrow));
  return u.toString();
}

async function fetchHtml(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return "";
    return await res.text();
  } catch { return ""; }
}

function parseDetail(html: string): { title: string; rawText: string } | null {
  const $ = cheerio.load(html);
  $("script,style,noscript").remove();
  let rawText =
    $("[itemprop='description']").first().text().replace(/\s+/g, " ").trim() ||
    $(".jobdescription").first().text().replace(/\s+/g, " ").trim() ||
    $("#content").text().replace(/\s+/g, " ").trim();
  // Strip leaked search-form chrome that precedes the body on some templates.
  rawText = rawText.replace(/^.*?(About Us|Job Description|Position Summary|Your Role)\b/i, "$1").trim();
  if (rawText.length < 150) return null;
  // Prefer the <title> tag (clean "Role Job Details | Company"); fall back to the
  // <h1>, which on some tenants (e.g. Birlasoft) carries a "Title:" label prefix.
  const cleanTitle = (s: string) =>
    s.replace(/\s+/g, " ").replace(/^\s*Title:\s*/i, "").replace(/\s+Job Details\b.*$/i, "").replace(/\s*[|\-–—]\s*[^|]*$/, "").trim();
  const fromTitleTag = cleanTitle($("title").text());
  const fromH1       = cleanTitle($("h1").first().text());
  const title = (fromTitleTag.length > 3 ? fromTitleTag : fromH1) || "Untitled";
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

export async function scrapeSapSiteBuilder(url: string): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  const origin = new URL(url).origin;

  // Page 1: links + authoritative results count.
  const firstHtml = await fetchHtml(url);
  if (!firstHtml) return { jds: [], totalAvailable: 0 };

  const reported = totalFrom(firstHtml);
  const links = new Set(jobLinksFrom(firstHtml, origin));

  // Paginate until we have the whole list (or enough links for the scrape target).
  const want = targetScrapeCount(Math.max(reported, links.size));
  for (let page = 1; page < MAX_PAGES && links.size < Math.max(reported, want); page++) {
    const html = await fetchHtml(buildSearchUrl(url, page * PAGE_ROWS));
    if (!html) break;
    const before = links.size;
    for (const l of jobLinksFrom(html, origin)) links.add(l);
    if (links.size === before) break; // no new links → stop
  }

  const totalAvailable = Math.max(reported, links.size);
  if (links.size === 0) return { jds: [], totalAvailable };

  const keep = targetScrapeCount(totalAvailable);
  const toFetch = [...links].slice(0, keep + 6); // buffer for skips

  const fetched = await mapWithConcurrency(toFetch, CONCURRENCY, async (link) => {
    const html = await fetchHtml(link);
    if (!html) return null;
    const parsed = parseDetail(html);
    if (!parsed) return null;
    let { title, rawText } = parsed;
    // Report is English-only — translate any non-English posting.
    if (looksNonEnglish(rawText) || looksNonEnglish(title)) {
      const t = await translateToEnglish(title, rawText);
      title = t.title; rawText = t.rawText;
    }
    return { title, rawText: rawText.slice(0, 12_000), sourceUrl: link } satisfies ScrapedJD;
  });

  const jds = fetched.filter((x): x is ScrapedJD => x !== null).slice(0, keep);
  return { jds, totalAvailable };
}
