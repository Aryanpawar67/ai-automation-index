import * as cheerio from "cheerio";
import { stripHtml } from "../stripHtml";
import { targetScrapeCount } from "../jdLimits";
import type { ScrapedJD } from "../scraper";

const BASE = "https://careers.unitedhealthgroup.com";

const SEARCH_PARAMS = {
  acm: "ALL",
  alrpm: "ALL,6252001-4831725,6252001-4155751,6252001-5549030,6252001-5815135",
  ascf: '[{"key":"custom_fields.UHGAJDType","value":"Optum"}]',
};

interface JobLd {
  "@type"?: string;
  title?: string;
  description?: string;
}

function parseJobLinks(html: string): Array<{ href: string; title: string }> {
  const $ = cheerio.load(html);
  const jobs: Array<{ href: string; title: string }> = [];
  $("a[href^='/job/']").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const title = $(el).find("h2").text().trim();
    if (href && title) jobs.push({ href: `${BASE}${href}`, title });
  });
  return jobs;
}

async function fetchPageViaPost(from: number, cookieHeader = ""): Promise<string> {
  const body = new URLSearchParams({
    ...SEARCH_PARAMS,
    from: String(from),
  });
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    "X-Requested-With": "XMLHttpRequest",
    "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)",
    "Referer": `${BASE}/search-jobs`,
  };
  if (cookieHeader) headers["Cookie"] = cookieHeader;
  const res = await fetch(`${BASE}/search-jobs/resultspost`, {
    method: "POST",
    headers,
    body: body.toString(),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return "";
  const json = await res.json() as { results?: string };
  return json.results ?? "";
}

async function fetchJD(href: string, title: string): Promise<ScrapedJD | null> {
  try {
    const res = await fetch(href, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);
    let rawText = "";
    let finalTitle = title;
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const parsed = JSON.parse($(el).html() ?? "{}") as JobLd;
        if (parsed["@type"] === "JobPosting") {
          if (parsed.title) finalTitle = parsed.title;
          if (parsed.description) rawText = stripHtml(parsed.description);
        }
      } catch { /* skip */ }
    });
    if (!rawText) return null;
    return { title: finalTitle, rawText, sourceUrl: href };
  } catch {
    return null;
  }
}

export async function scrapeUHGOptum(): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  // Fetch first page via GET — captures cookies needed for AJAX POST pagination
  const firstUrl = `${BASE}/search-jobs?${new URLSearchParams(SEARCH_PARAMS).toString()}`;
  const firstRes = await fetch(firstUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!firstRes.ok) return { jds: [], totalAvailable: 0 };

  // Capture session cookies from the first GET so POST pagination works
  const rawCookies = firstRes.headers.getSetCookie?.() ?? [];
  const cookieHeader = rawCookies.map(c => c.split(";")[0]).join("; ");

  const firstHtml = await firstRes.text();
  const $first = cheerio.load(firstHtml);
  const totalAvailable = parseInt(
    $first("#search-results").attr("data-total-job-results") ?? "0", 10
  );
  const keep = targetScrapeCount(totalAvailable);
  // Max possible offset so we never stop short on large result sets
  const maxFrom = totalAvailable > 0 ? totalAvailable : 10_000;

  // Collect links — dedup by absolute href
  const seenHrefs = new Set<string>();
  const links: Array<{ href: string; title: string }> = [];

  for (const j of parseJobLinks(firstHtml)) {
    if (!seenHrefs.has(j.href)) { seenHrefs.add(j.href); links.push(j); }
  }

  // Fetch additional pages via AJAX POST, forwarding session cookies
  let from = 15;
  let emptyStreak = 0;
  while (links.length < keep && from < maxFrom) {
    const html = await fetchPageViaPost(from, cookieHeader);
    if (!html) { emptyStreak++; if (emptyStreak >= 3) break; from += 15; continue; }
    const page = parseJobLinks(html);
    if (page.length === 0) { emptyStreak++; if (emptyStreak >= 3) break; from += 15; continue; }
    emptyStreak = 0;
    for (const j of page) {
      if (!seenHrefs.has(j.href)) { seenHrefs.add(j.href); links.push(j); }
    }
    from += 15;
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 300));
  }

  const toFetch = links.slice(0, keep);

  // Fetch JDs in batches of 5
  const jds: ScrapedJD[] = [];
  for (let i = 0; i < toFetch.length; i += 5) {
    const results = await Promise.all(toFetch.slice(i, i + 5).map(j => fetchJD(j.href, j.title)));
    for (const r of results) { if (r) jds.push(r); }
  }

  return { jds, totalAvailable };
}
