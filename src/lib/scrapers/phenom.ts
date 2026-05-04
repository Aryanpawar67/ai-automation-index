import { stripHtml }         from "../stripHtml";
import { targetScrapeCount } from "../jdLimits";
import type { ScrapedJD }    from "../scraper";

// Phenom People career sites (e.g. careers.fiserv.com) expose a tenant-scoped
// search API at `/widgets`. The page-rendered listing only shows ~10 jobs;
// the API returns the full set with totalHits + pagination via from/size.
//
// Tenant id (`refNum`) is embedded in the rendered HTML — same value Phenom
// historically called `appConfig`. For Fiserv it's "FFFYJUS".

const HEADERS = {
  "Content-Type":  "application/json",
  "User-Agent":    "Mozilla/5.0 (compatible; research-bot/1.0)",
};
const CONCURRENCY = 8;

interface PhenomJob {
  jobId:              string;
  jobSeqNo:           string;
  reqId?:             string;
  title:              string;
  location?:          string;
  city?:              string;
  state?:             string;
  country?:           string;
  category?:          string;
  multi_category?:    string[];
  type?:              string;
  postedDate?:        string;
  applyUrl?:          string;
  descriptionTeaser?: string;
}

interface RefineSearchResponse {
  refineSearch?: {
    totalHits?: number;
    data?: { jobs?: PhenomJob[] };
  };
}

interface JobPostingLd {
  "@type"?:      string;
  title?:        string;
  description?:  string;
}

export interface PhenomConfig {
  /** Bare host, e.g. "careers.fiserv.com" */
  host:    string;
  /** Tenant id from the page (a.k.a. appConfig). E.g. "FFFYJUS". */
  refNum:  string;
  /** Locale path segment for detail URLs. Defaults to "us/en". */
  locale?: string;
  /** API `lang` field. Defaults to "en_us". */
  lang?:   string;
  /** Optional facet filter passed as selected_fields. E.g. for Marsh McLennan
   *  Agency on careers.marsh.com: { business: ["Marsh McLennan Agency"] }.
   *  Without this the API returns the whole tenant (parent-company-wide). */
  selectedFields?: Record<string, string[]>;
}

function buildSearchPayload(cfg: PhenomConfig, from: number, size: number) {
  return {
    lang:            cfg.lang ?? "en_us",
    deviceType:      "desktop",
    country:         "us",
    pageName:        "search-results",
    size,
    from,
    jobs:            true,
    counts:          true,
    all_fields:      ["category", "country", "city", "type"],
    clearAll:        false,
    jdsource:        "facets",
    isSliderEnable:  false,
    pageId:          "page20",
    siteType:        "external",
    keywords:        "",
    global:          true,
    selected_fields: cfg.selectedFields ?? {},
    sort:            { order: "desc", field: "postedDate" },
    locationData:    {},
    refNum:          cfg.refNum,
    ddoKey:          "refineSearch",
  };
}

/** Reduce a job title to its role family for cross-listing dedup.
 *  Mirrors the helper in ttcPortals/workday: large tenants post the same role
 *  across many locations with city/branch suffixes after a dash. Strips the
 *  first " - " or " -- " suffix, lowercases, collapses whitespace. */
function roleFamilyKey(title: string): string {
  // Permissive split — also catches "Title-City" (no space before dash).
  return title
    .toLowerCase()
    .split(/\s*[-–—]+\s*/)[0]
    .replace(/\s+/g, " ")
    .trim();
}

/** Quick language sniff for listing-level filtering. Some Phenom tenants
 *  (e.g. Marsh's MAMCGLOBAL with business=Marsh Risk) tag every job with the
 *  global locale `en_global` even when the actual posting is in Spanish /
 *  Japanese / French — so we can't rely on an API-level language facet alone.
 *
 *  Heuristic: presence of any 2 high-frequency English stop-tokens in the
 *  descriptionTeaser (or title as fallback). This works because the same
 *  tokens are extremely uncommon in Romance / CJK language postings.
 *  Also rejects strings dominated by CJK characters as a fast pre-check.
 */
const EN_STOP = ["the","and","for","with","you","our","this","are","will","that"];
function isLikelyEnglish(text: string | undefined): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  // Fast reject: CJK / Cyrillic / Arabic / Devanagari runs dominate
  const nonLatin = (text.match(/[぀-ヿ一-鿿Ѐ-ӿ؀-ۿऀ-ॿ]/g) ?? []).length;
  if (nonLatin > 8) return false;
  let hits = 0;
  for (const w of EN_STOP) {
    if (new RegExp(`\\b${w}\\b`).test(lower)) {
      hits++;
      if (hits >= 2) return true;
    }
  }
  return false;
}

function jobDetailUrl(cfg: PhenomConfig, jobSeqNo: string): string {
  return `https://${cfg.host}/${cfg.locale ?? "us/en"}/job/${jobSeqNo}`;
}

function extractJobPostingLd(html: string): JobPostingLd | null {
  // Phenom detail pages embed multiple <script type="application/ld+json"> blocks;
  // the JobPosting one isn't always first. Iterate and pick the right @type.
  const re = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1]) as JobPostingLd;
      if (data["@type"] === "JobPosting" && typeof data.description === "string") {
        return data;
      }
    } catch { /* malformed block, skip */ }
  }
  return null;
}

async function fetchJobDescription(
  cfg: PhenomConfig,
  job: PhenomJob,
): Promise<ScrapedJD | null> {
  const url = jobDetailUrl(cfg, job.jobSeqNo);
  try {
    const res  = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return fallbackFromTeaser(job, url);
    const html = await res.text();
    const ld   = extractJobPostingLd(html);
    if (!ld) return fallbackFromTeaser(job, url);

    // JSON-LD descriptions are HTML-encoded; stripHtml unescapes + strips tags.
    const rawText = stripHtml(ld.description ?? "");
    if (rawText.length < 200) return fallbackFromTeaser(job, url);

    return {
      title:      ld.title ?? job.title,
      rawText,
      sourceUrl:  url,
      department: job.multi_category?.[0] ?? job.category,
    };
  } catch {
    return fallbackFromTeaser(job, url);
  }
}

function fallbackFromTeaser(job: PhenomJob, url: string): ScrapedJD | null {
  const teaser = job.descriptionTeaser?.trim() ?? "";
  if (teaser.length < 80) return null;
  return {
    title:      job.title,
    rawText:    teaser,
    sourceUrl:  url,
    department: job.multi_category?.[0] ?? job.category,
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx  = i++;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function scrapePhenom(
  cfg: PhenomConfig,
): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  // Walk pages until we have enough unique English-language role families
  // (or hit end of list). Bumped to 12 pages because the English filter can
  // reject a lot of postings on multilingual tenants (e.g. Marsh Risk where
  // ~40% of listings are Spanish/French/Japanese despite an en_* facet tag).
  const PAGE_SIZE   = 50;
  const MAX_PAGES   = 12;       // covers up to 600 listings
  const seen: Set<string> = new Set();
  const deduped: PhenomJob[] = [];
  let totalAvailable = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch(`https://${cfg.host}/widgets`, {
      method:  "POST",
      headers: HEADERS,
      body:    JSON.stringify(buildSearchPayload(cfg, page * PAGE_SIZE, PAGE_SIZE)),
      signal:  AbortSignal.timeout(30_000),
    });
    if (!res.ok) break;
    const data = await res.json() as RefineSearchResponse;
    if (page === 0) totalAvailable = data.refineSearch?.totalHits ?? 0;
    const jobs = data.refineSearch?.data?.jobs ?? [];
    if (jobs.length === 0) break;

    for (const j of jobs) {
      const key = roleFamilyKey(j.title || "");
      if (!key || seen.has(key)) continue;
      // Skip non-English postings — fall through to next role rather than
      // shrinking the budget. Use teaser when available (most discriminative);
      // fall back to title for very short listings.
      const sample = (j.descriptionTeaser?.length ?? 0) > 30
        ? j.descriptionTeaser
        : j.title;
      if (!isLikelyEnglish(sample)) continue;
      seen.add(key);
      deduped.push(j);
    }

    const target = targetScrapeCount(totalAvailable || deduped.length);
    if (deduped.length >= target) break;
    if (jobs.length < PAGE_SIZE) break;  // hit end of listings
  }

  if (deduped.length === 0) return { jds: [], totalAvailable };

  const keep    = targetScrapeCount(totalAvailable);
  const toFetch = deduped.slice(0, keep);

  const fetched = await mapWithConcurrency(toFetch, CONCURRENCY, j => fetchJobDescription(cfg, j));
  const jds     = fetched.filter((x): x is ScrapedJD => x !== null);

  return { jds, totalAvailable };
}
