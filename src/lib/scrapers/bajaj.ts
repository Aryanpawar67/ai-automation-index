import { stripHtml }         from "../stripHtml";
import { targetScrapeCount } from "../jdLimits";
import { looksNonEnglish, translateToEnglish } from "../translate";
import type { ScrapedJD }    from "../scraper";

// Bajaj Auto careers (www.bajajauto.com/careers) — custom ASP.NET handler.
//   list: GET /handlers/careers/get-requisitions.ashx
//         (requires X-Requested-With: XMLHttpRequest or it 403s)
//         → { jobRequisitions: [{ jobReqId, jobTitle, custjobRole, jobDescription, ... }] }
// Descriptions are inline, so no per-job detail call is needed.

const ORIGIN = "https://www.bajajauto.com";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120";

interface BajajJob {
  jobReqId?: number; jobTitle?: string; custjobRole?: string; custjobFamily?: string;
  jobDescription?: string; jobUrl?: string; department?: string;
}

export async function scrapeBajaj(): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  let jobs: BajajJob[];
  try {
    const res = await fetch(`${ORIGIN}/handlers/careers/get-requisitions.ashx`, {
      headers: {
        "Accept": "application/json", "User-Agent": UA,
        "X-Requested-With": "XMLHttpRequest",
        "Referer": `${ORIGIN}/careers/search-result`,
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { jds: [], totalAvailable: 0 };
    const data = await res.json() as { jobRequisitions?: BajajJob[] };
    jobs = data.jobRequisitions ?? [];
  } catch { return { jds: [], totalAvailable: 0 }; }

  if (jobs.length === 0) return { jds: [], totalAvailable: 0 };
  const totalAvailable = jobs.length;
  const keep = targetScrapeCount(totalAvailable);

  const out: ScrapedJD[] = [];
  for (const job of jobs.slice(0, keep)) {
    let rawText = stripHtml(job.jobDescription ?? "");
    if (rawText.length < 100) continue;
    // jobTitle is often a terse abbreviation (e.g. "MGR"); enrich with the role.
    const base = (job.jobTitle ?? "").trim();
    const role = (job.custjobRole ?? "").trim();
    let title = base && role && !base.toLowerCase().includes(role.toLowerCase())
      ? `${base} - ${role}` : (base || role || "Untitled");
    if (looksNonEnglish(rawText) || looksNonEnglish(title)) {
      const t = await translateToEnglish(title, rawText);
      title = t.title; rawText = t.rawText;
    }
    out.push({
      title,
      rawText:    rawText.slice(0, 12_000),
      sourceUrl:  job.jobUrl ? (job.jobUrl.startsWith("http") ? job.jobUrl : `${ORIGIN}${job.jobUrl}`) : `${ORIGIN}/careers/search-result`,
      department: job.department ?? job.custjobFamily,
    });
  }
  return { jds: out, totalAvailable };
}
