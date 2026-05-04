import { stripHtml } from "../stripHtml";
import { targetScrapeCount } from "../jdLimits";
import type { ScrapedJD } from "../scraper";

const API_BASE    = "https://jobsapi-internal.m-cloud.io/api/job";
const BRAND_FACET = "brand:National General";
const ORG         = "2030";
const PAGE_SIZE   = 10; // API ignores count param; always returns 10 per page
const JOB_DETAIL_BASE = "https://www.allstate.jobs/job";

interface MCloudJob {
  id:           number;
  title?:       string;
  description?: string;
}

interface MCloudResponse {
  totalHits?:   number;
  queryResult?: MCloudJob[];
}

function buildJobUrl(job: MCloudJob): string {
  const slug = (job.title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${JOB_DETAIL_BASE}/${job.id}/${slug}/`;
}

async function fetchPage(offset: number): Promise<MCloudResponse> {
  const url = `${API_BASE}?Organization=${ORG}&count=${PAGE_SIZE}&offset=${offset}&callback=cwsCb&facet=${encodeURIComponent(BRAND_FACET)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)",
      "Referer":    "https://www.allstate.jobs/",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return {};
  let raw = await res.text();
  const m = raw.match(/^[A-Za-z_$][A-Za-z0-9_.]*\s*\(\s*([\s\S]*)\s*\)\s*;?\s*$/);
  if (m) raw = m[1];
  try { return JSON.parse(raw) as MCloudResponse; }
  catch { return {}; }
}

export async function scrapeAllstateNationalGeneral(): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  // Fetch first page to get real total, then paginate up to targetScrapeCount
  const first      = await fetchPage(0);
  const totalHits  = first.totalHits ?? 0;
  const keep       = targetScrapeCount(totalHits);

  const jds: ScrapedJD[] = [];
  const seenIds = new Set<number>();

  const processPage = (jobs: MCloudJob[]) => {
    for (const job of jobs) {
      if (jds.length >= keep) break;
      if (seenIds.has(job.id)) continue;
      seenIds.add(job.id);
      const rawText = stripHtml((job.description ?? "").trim());
      if (!rawText || rawText.length < 100) continue;
      jds.push({ title: job.title ?? "Untitled Position", rawText, sourceUrl: buildJobUrl(job) });
    }
  };

  processPage(first.queryResult ?? []);

  let offset = PAGE_SIZE;
  while (jds.length < keep && offset < totalHits) {
    const data = await fetchPage(offset);
    const jobs = data.queryResult ?? [];
    if (jobs.length === 0) break;
    processPage(jobs);
    if (jobs.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    await new Promise(r => setTimeout(r, 200));
  }

  return { jds, totalAvailable: totalHits };
}
