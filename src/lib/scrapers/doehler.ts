import * as cheerio from "cheerio";
import { targetScrapeCount } from "../jdLimits";
import { looksGerman, translateToEnglish } from "../translate";
import type { ScrapedJD } from "../scraper";

// Döhler Group (jobs.doehler.com) runs SAP SuccessFactors / jobs2web (RMK).
// The site is German-first; none of the generic ATS detectors match the custom
// domain, and the listings are loaded via a JSON API rather than server HTML.
//
//   list:   POST /services/recruiting/v1/jobs
//           body { locale, pageNumber, ... } → { jobSearchResult: [{response}], totalJobs }
//           Requesting locale "en_US" returns the English versions of postings
//           that have them (~69 of 88); the rest fall back to German.
//   detail: GET /default/job/{urlTitle}/{id}-{locale}  (server-rendered HTML;
//           the description lives in #content)
//
// Reports are English-only, so any posting Döhler still serves in German is
// translated to English (title + body) before being returned.

const ORIGIN       = "https://jobs.doehler.com";
const LIST_API     = `${ORIGIN}/services/recruiting/v1/jobs`;
const PAGE_SIZE    = 10;   // API returns 10 results per page
const MAX_PAGES    = 12;   // safety cap (88 roles ≈ 9 pages)
const CONCURRENCY  = 5;
const UA           = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120";

interface DoehlerJob {
  id:       string;
  urlTitle: string;
  title:    string;
}

function listBody(locale: string, pageNumber: number): string {
  return JSON.stringify({
    locale, pageNumber, sortBy: "", keywords: "", location: "",
    facetFilters: {}, brand: "", skills: [], categoryId: 0, alertId: "", rcmCandidateId: "",
  });
}

/** Fetch every page of the job list for a given locale. */
async function fetchJobList(locale: string): Promise<{ jobs: DoehlerJob[]; total: number }> {
  const jobs: DoehlerJob[] = [];
  let total = 0;
  const seen = new Set<string>();

  for (let page = 0; page < MAX_PAGES; page++) {
    let data: { jobSearchResult?: Array<{ response?: Record<string, unknown> }>; totalJobs?: number };
    try {
      const res = await fetch(LIST_API, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json", "User-Agent": UA },
        body:    listBody(locale, page),
        signal:  AbortSignal.timeout(15_000),
      });
      if (!res.ok) break;
      data = await res.json();
    } catch { break; }

    const results = data.jobSearchResult ?? [];
    if (typeof data.totalJobs === "number") total = data.totalJobs;
    if (results.length === 0) break;

    for (const r of results) {
      const resp = r.response ?? {};
      const id   = String(resp.id ?? "");
      const urlTitle = String(resp.urlTitle ?? resp.unifiedUrlTitle ?? "");
      const title    = String(resp.unifiedStandardTitle ?? resp.jobTitle ?? "Untitled");
      if (!id || !urlTitle || seen.has(id)) continue;
      seen.add(id);
      jobs.push({ id, urlTitle, title });
    }

    if (jobs.length >= total && total > 0) break;
    if (results.length < PAGE_SIZE) break;
  }

  return { jobs, total: Math.max(total, jobs.length) };
}

/** Remove a trailing "(12345)" job-id artifact some titles carry. */
function cleanTitle(title: string): string {
  return title.replace(/\(\d{4,}\)\s*$/, "").trim();
}

/** Pull the job-description text out of a detail page's #content region. */
function extractDetail(html: string): string {
  const $ = cheerio.load(html);
  $("script,style,nav,footer,header,noscript").remove();
  let text = $("#content").text().replace(/\s+/g, " ").trim();
  if (!text) text = $("body").text().replace(/\s+/g, " ").trim();
  // Strip the chrome that precedes the actual description on every page.
  text = text.replace(/^.*?Job Description:\s*/i, "");
  // Drop the apply/share boilerplate that can trail the description.
  text = text.replace(/\bApply now\b.*$/i, "").trim();
  return text;
}

async function fetchDetail(job: DoehlerJob): Promise<ScrapedJD | null> {
  const url = `${ORIGIN}/default/job/${job.urlTitle}/${job.id}-en_US`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return null;
    const text = extractDetail(await res.text());
    if (text.length < 200) return null;

    let title   = cleanTitle(job.title);
    let rawText = text;
    // English-only report: translate any posting Döhler still serves in German.
    if (looksGerman(rawText) || looksGerman(title)) {
      const t = await translateToEnglish(title, rawText);
      title   = cleanTitle(t.title);
      rawText = t.rawText;
    }

    return { title, rawText: rawText.slice(0, 12_000), sourceUrl: url };
  } catch { return null; }
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

export async function scrapeDoehler(): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  // English postings drive the report; the German list gives the true headcount
  // of open roles (some roles have no English version).
  const [en, de] = await Promise.all([fetchJobList("en_US"), fetchJobList("de_DE")]);
  if (en.jobs.length === 0) return { jds: [], totalAvailable: de.total };

  const totalAvailable = Math.max(en.total, de.total);
  const keep    = targetScrapeCount(totalAvailable);
  const toFetch = en.jobs.slice(0, keep);

  const fetched = await mapWithConcurrency(toFetch, CONCURRENCY, fetchDetail);
  const jds = fetched.filter((x): x is ScrapedJD => x !== null);
  return { jds, totalAvailable };
}
