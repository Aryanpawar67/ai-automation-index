import { stripHtml }         from "../stripHtml";
import { targetScrapeCount } from "../jdLimits";
import type { ScrapedJD }    from "../scraper";

// Capgemini careers (custom Azure API via WordPress plugin cg-jobs).
//   list:   GET https://cg-jobstream-api.azurewebsites.net/api/job-search?page=N&size=50[&country_code=<code>]
//           → { count, data: [{ id, title, description, description_stripped,
//                              country_code, country_name, location, department, apply_job_url }] }
// description is full HTML in the list response — no separate detail call needed.

const API_BASE = "https://cg-jobstream-api.azurewebsites.net/api/job-search";
const PAGE_SIZE = 100;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120";

interface CgJob {
  id?: string;
  title?: string;
  description?: string;
  description_stripped?: string;
  country_code?: string;
  country_name?: string;
  location?: string;
  department?: string;
  apply_job_url?: string;
}

async function fetchPage(page: number, countryCode?: string): Promise<{ count: number; data: CgJob[] } | null> {
  let url = `${API_BASE}?page=${page}&size=${PAGE_SIZE}`;
  if (countryCode) url += `&country_code=${encodeURIComponent(countryCode)}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept": "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    return await res.json() as { count: number; data: CgJob[] };
  } catch { return null; }
}

export async function scrapeCapgemini(countryCode?: string): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  const first = await fetchPage(1, countryCode);
  if (!first) return { jds: [], totalAvailable: 0 };

  const totalAvailable = first.count ?? 0;
  const keep = targetScrapeCount(totalAvailable);

  const allJobs: CgJob[] = [...first.data];

  for (let page = 2; allJobs.length < keep + 10; page++) {
    const r = await fetchPage(page, countryCode);
    if (!r || !r.data?.length) break;
    allJobs.push(...r.data);
    if (allJobs.length >= totalAvailable) break;
  }

  const jds = allJobs.slice(0, keep).map((job): ScrapedJD | null => {
    const rawText = stripHtml(job.description ?? job.description_stripped ?? "");
    if (rawText.length < 100) return null;
    const location = [job.location, job.country_name].filter(Boolean).join(", ");
    return {
      title:      job.title ?? "Untitled",
      rawText:    rawText.slice(0, 14_000),
      sourceUrl:  job.apply_job_url ?? undefined,
      department: [job.department, location].filter(Boolean).join(" | ") || undefined,
    };
  }).filter((x): x is ScrapedJD => x !== null);

  return { jds, totalAvailable };
}
