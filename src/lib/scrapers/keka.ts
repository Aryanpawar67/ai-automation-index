import { stripHtml }         from "../stripHtml";
import { targetScrapeCount } from "../jdLimits";
import { looksNonEnglish, translateToEnglish } from "../translate";
import type { ScrapedJD }    from "../scraper";

// Keka Hire career sites (e.g. flentas.keka.com/careers).
//   list: GET /careers/api/jobs/default/active
//         → [{ id, title, description, departmentName, ... }]
// The `description` field carries the full HTML JD inline, so no detail call.

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120";

interface KekaJob { id?: string | number; title?: string; description?: string; departmentName?: string }

/** Origin from a *.keka.com careers URL, or null. */
export function parseKeka(url: string): string | null {
  try {
    const u = new URL(url);
    return /\.keka\.com$/i.test(u.hostname) ? u.origin : null;
  } catch { return null; }
}

export async function scrapeKeka(url: string): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  const origin = parseKeka(url);
  if (!origin) return { jds: [], totalAvailable: 0 };

  let jobs: KekaJob[];
  try {
    const res = await fetch(`${origin}/careers/api/jobs/default/active`, {
      headers: { "Accept": "application/json", "User-Agent": UA },
      signal:  AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { jds: [], totalAvailable: 0 };
    const data = await res.json();
    jobs = (Array.isArray(data) ? data : (data?.data ?? data?.jobs ?? [])) as KekaJob[];
  } catch { return { jds: [], totalAvailable: 0 }; }

  if (jobs.length === 0) return { jds: [], totalAvailable: 0 };
  const totalAvailable = jobs.length;
  const keep = targetScrapeCount(totalAvailable);

  const out: ScrapedJD[] = [];
  for (const job of jobs.slice(0, keep)) {
    let rawText = stripHtml(job.description ?? "");
    if (rawText.length < 100) continue;
    let title = job.title ?? "Untitled";
    if (looksNonEnglish(rawText) || looksNonEnglish(title)) {
      const t = await translateToEnglish(title, rawText);
      title = t.title; rawText = t.rawText;
    }
    out.push({
      title,
      rawText:    rawText.slice(0, 12_000),
      sourceUrl:  job.id ? `${origin}/careers/jobdetails/${job.id}` : url,
      department: job.departmentName,
    });
  }
  return { jds: out, totalAvailable };
}
