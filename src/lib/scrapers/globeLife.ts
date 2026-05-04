import * as cheerio from "cheerio";
import { stripHtml } from "../stripHtml";
import { targetScrapeCount } from "../jdLimits";
import type { ScrapedJD } from "../scraper";

const BASE = "https://careers.globelifeinsurance.com";
const LIST_URL = `${BASE}/jobs/jobs-by-category`;

interface JobLdSchema {
  title?: string;
  description?: string;
  occupationalCategory?: string;
}

export async function scrapeGlobeLife(): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  const listRes = await fetch(LIST_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!listRes.ok) return { jds: [], totalAvailable: 0 };

  const listHtml = await listRes.text();
  const $ = cheerio.load(listHtml);

  // Collect all unique job detail links
  const links: Array<{ href: string; title: string; department: string }> = [];
  const seenHrefs = new Set<string>();

  $("a[href*='/jobs/job-details/']").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const absUrl = href.startsWith("http") ? href : `${BASE}${href}`;
    // Strip query string for dedup but keep it for fetching
    const hrefKey = absUrl.split("?")[0];
    if (seenHrefs.has(hrefKey)) return;
    seenHrefs.add(hrefKey);

    const titleEl = $(el).find(".jobs-list-title");
    const title = titleEl.text().trim() || $(el).text().trim();

    // Department from URL segment: /jobs/job-details/{category}-job-JRxxxxxx
    const depMatch = href.match(/job-details\/([^/]+?)-job-JR/i);
    const department = depMatch
      ? depMatch[1].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
      : "";

    if (title) links.push({ href: absUrl, title, department });
  });

  const totalAvailable = links.length;
  const keep = targetScrapeCount(totalAvailable);
  const toFetch = links.slice(0, keep);

  const jds: ScrapedJD[] = [];

  await Promise.all(
    toFetch.map(async ({ href, title: listTitle, department }) => {
      try {
        const res = await fetch(href, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) return;

        const html = await res.text();
        const $d = cheerio.load(html);

        // Prefer JSON-LD structured data for description
        let rawText = "";
        let title = listTitle;

        $d('script[type="application/ld+json"]').each((_, el) => {
          try {
            const parsed = JSON.parse($d(el).html() ?? "{}") as JobLdSchema;
            if (parsed["@type" as keyof JobLdSchema] === "JobPosting" || parsed.title) {
              if (parsed.title) title = parsed.title;
              if (parsed.description) rawText = stripHtml(parsed.description);
            }
          } catch {
            // ignore malformed ld+json
          }
        });

        // Fallback: grab from HTML description span
        if (!rawText) {
          const descEl = $d("#job-detail");
          rawText = stripHtml(descEl.html() ?? descEl.text() ?? "");
        }

        if (rawText) {
          jds.push({ title, rawText, sourceUrl: href, department: department || undefined });
        }
      } catch {
        // skip failed individual fetches
      }
    })
  );

  return { jds, totalAvailable };
}
