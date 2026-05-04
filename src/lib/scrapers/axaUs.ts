import { stripHtml }         from "../stripHtml";
import { targetScrapeCount } from "../jdLimits";
import type { ScrapedJD }    from "../scraper";

const SITEMAP_URL  = "https://careers.axa.com/sitemap1.xml";
const JD_BASE      = "https://careers.axa.com/careers-home/jobs";
const HEADERS      = { "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)" };
const CONCURRENCY  = 10;

interface JobLd {
  title:       string;
  description: string;
  jobLocation?: { address?: { addressCountry?: string } };
}

async function fetchSitemapUrls(): Promise<string[]> {
  const res = await fetch(SITEMAP_URL, { headers: HEADERS, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return [];
  const xml  = await res.text();
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const m of xml.matchAll(/<loc>(https:\/\/careers\.axa\.com\/jobs\/(\d+)\?lang=en-us)<\/loc>/g)) {
    const url = `${JD_BASE}/${m[2]}?lang=en-us`;
    if (!seen.has(url)) { seen.add(url); urls.push(url); }
  }
  return urls;
}

function extractJsonLd(html: string): JobLd | null {
  try {
    const scriptMatch = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
    if (!scriptMatch) return null;
    const data = JSON.parse(scriptMatch[1]);
    if (data["@type"] !== "JobPosting") return null;
    return data as JobLd;
  } catch { return null; }
}

function isUsJob(ld: JobLd): boolean {
  const country = ld.jobLocation?.address?.addressCountry ?? "";
  return /united\s+states|usa|\bUS\b/i.test(country);
}

async function fetchJob(url: string): Promise<ScrapedJD | null> {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const html    = await res.text();
    const ld      = extractJsonLd(html);
    if (!ld || !isUsJob(ld)) return null;
    const rawText = stripHtml(ld.description);
    if (rawText.length < 200) return null;
    return { title: ld.title, rawText, sourceUrl: url };
  } catch { return null; }
}

export async function scrapeAxaUs(): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  const allUrls = await fetchSitemapUrls();
  const target  = targetScrapeCount(1791);
  const jds: ScrapedJD[] = [];

  // Process in parallel batches of CONCURRENCY, stop once we hit target
  for (let i = 0; i < allUrls.length && jds.length < target; i += CONCURRENCY) {
    const batch   = allUrls.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(fetchJob));
    for (const jd of results) {
      if (jd && jds.length < target) jds.push(jd);
    }
  }

  return { jds, totalAvailable: 1791 };
}
