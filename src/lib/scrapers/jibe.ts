import { stripHtml }         from "../stripHtml";
import { targetScrapeCount } from "../jdLimits";
import type { ScrapedJD }    from "../scraper";

// Generic scraper for Jibe-powered career sites (jibecdn.com / app.jibecdn.com).
// Jibe exposes a stable JSON list API at /api/jobs returning full descriptions
// inline (no per-job detail fetch needed). Pagination is via &page=N.
//
// Known tenants:
//   - jobs.statefarm.com    (State Farm)        detailPath: /main/jobs/{slug}/job
//   - careers.fm.com        (Factory Mutual)    detailPath: /careers-home/jobs/{slug}/job
//
// Listing API response (relevant fields):
//   {
//     "totalCount": 61,
//     "jobs": [
//       { "data": {
//           "slug":        "1784",
//           "title":       "Senior Administrative Assistant/Analyst",
//           "description": "<p>...</p>",
//           "categories":  [" Administrative"],
//           "department":  "Administrative",
//           "category":    { "name": "..." } | "...",
//           "req_id":      "1784",
//           "job_url":     null
//       } }
//     ]
//   }

type CategoryEntry = string | { name?: string };

interface JibeJobData {
  slug?:        string;
  title?:       string;
  description?: string;
  // Different Jibe tenants serialize categories differently. Observed:
  //   State Farm: category = "Sales" | { name: "Sales" }
  //   FM:         category = [" Administrative"], categories = [{name:"Administrative"}]
  categories?:  CategoryEntry[];
  department?:  string;
  category?:    CategoryEntry | CategoryEntry[];
}

interface JibeJob {
  data?: JibeJobData;
}

interface JibePageResp {
  jobs?:       JibeJob[];
  totalCount?: number;
}

export interface JibeConfig {
  /** Tenant host root, e.g. "https://careers.fm.com" */
  base:       string;
  /** Path template for detail URLs, with `{slug}` placeholder. */
  detailPath: string;
  /** Optional extra query string appended to the list API (no leading `&`). */
  listQuery?: string;
}

async function fetchPage(cfg: JibeConfig, page: number): Promise<JibePageResp | null> {
  const qs  = ["sortBy=relevance", "descending=false", "internal=false", `page=${page}`];
  if (cfg.listQuery) qs.push(cfg.listQuery);
  const url = `${cfg.base}/api/jobs?${qs.join("&")}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)",
        "Accept":     "application/json",
        "Referer":    `${cfg.base}/careers-home/jobs`,
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return await res.json() as JibePageResp;
  } catch { return null; }
}

function flattenCategoryEntry(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (v && typeof v === "object" && "name" in v) {
    const n = (v as { name?: unknown }).name;
    if (typeof n === "string" && n.trim()) return n.trim();
  }
  return undefined;
}

function pickDepartment(d: JibeJobData): string | undefined {
  if (typeof d.department === "string" && d.department.trim()) return d.department.trim();
  for (const v of d.categories ?? []) {
    const s = flattenCategoryEntry(v);
    if (s) return s;
  }
  if (Array.isArray(d.category)) {
    for (const v of d.category) {
      const s = flattenCategoryEntry(v);
      if (s) return s;
    }
  } else {
    const s = flattenCategoryEntry(d.category);
    if (s) return s;
  }
  return undefined;
}

export async function scrapeJibe(cfg: JibeConfig): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  const first = await fetchPage(cfg, 1);
  if (!first) return { jds: [], totalAvailable: 0 };

  const totalAvailable    = first.totalCount ?? 0;
  const keep              = targetScrapeCount(totalAvailable);
  const allJobs: JibeJob[] = [...(first.jobs ?? [])];

  let page = 2;
  while (allJobs.length < keep && allJobs.length < totalAvailable) {
    const next = await fetchPage(cfg, page++);
    if (!next || !next.jobs?.length) break;
    allJobs.push(...next.jobs);
  }

  const jds: ScrapedJD[] = [];
  for (const job of allJobs.slice(0, keep)) {
    const d = job.data;
    if (!d?.title) continue;
    const raw = stripHtml(d.description ?? d.title)
      .replace(/\s{3,}/g, "\n")
      .trim()
      .slice(0, 12_000);
    if (raw.length < 200) continue;
    const slug = d.slug ?? "";
    const sourceUrl = slug
      ? `${cfg.base}${cfg.detailPath.replace("{slug}", encodeURIComponent(slug))}`
      : undefined;
    jds.push({
      title:      d.title,
      rawText:    raw,
      sourceUrl,
      department: pickDepartment(d),
    });
  }

  return { jds, totalAvailable };
}
