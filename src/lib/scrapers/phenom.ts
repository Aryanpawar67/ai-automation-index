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
    selected_fields: {},
    sort:            { order: "desc", field: "postedDate" },
    locationData:    {},
    refNum:          cfg.refNum,
    ddoKey:          "refineSearch",
  };
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
  // Single search call gives us totalHits + enough jobs for our scrape budget.
  const initialSize = 25;
  const searchRes   = await fetch(`https://${cfg.host}/widgets`, {
    method:  "POST",
    headers: HEADERS,
    body:    JSON.stringify(buildSearchPayload(cfg, 0, initialSize)),
    signal:  AbortSignal.timeout(30_000),
  });
  if (!searchRes.ok) return { jds: [], totalAvailable: 0 };

  const data           = await searchRes.json() as RefineSearchResponse;
  const totalAvailable = data.refineSearch?.totalHits ?? 0;
  const jobs           = data.refineSearch?.data?.jobs ?? [];
  if (jobs.length === 0) return { jds: [], totalAvailable };

  const keep    = targetScrapeCount(totalAvailable);
  const toFetch = jobs.slice(0, keep);

  const fetched = await mapWithConcurrency(toFetch, CONCURRENCY, j => fetchJobDescription(cfg, j));
  const jds     = fetched.filter((x): x is ScrapedJD => x !== null);

  return { jds, totalAvailable };
}
