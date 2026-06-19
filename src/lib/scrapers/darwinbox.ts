import { stripHtml }         from "../stripHtml";
import { targetScrapeCount } from "../jdLimits";
import { looksNonEnglish, translateToEnglish } from "../translate";
import type { ScrapedJD }    from "../scraper";

// Darwinbox recruiting career sites (e.g. inspire-unominda.darwinbox.in).
//   list: POST /ms/candidateapi/job/alljobs?companyId={cid}
//         body { companyId, page, sort_option, limit }
//         → { data: [{ id, title, designation, jd, department_name, ... }], job_counts }
// The `jd` field carries the full (HTML-encoded) description inline, so no
// per-job detail call is needed.
//
// Some tenants front the API with Cloudflare (e.g. thermaxglobal) so a direct
// server-side request 403s. For those we render the career page with Firecrawl
// and run the API fetch in-page (passing the Cloudflare clearance the browser
// already has), writing the JSON into the DOM to read it back.

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120";
const FIRECRAWL_URL = "https://api.firecrawl.dev/v1/scrape";

interface DarwinboxJob {
  id?: string; title?: string; designation?: string; designation_display_name?: string;
  jd?: string; department_name?: string;
}
interface DarwinboxResp { status?: string; data?: DarwinboxJob[]; job_counts?: number }

/** Origin + companyId from a Darwinbox career URL (/ms/candidatev2/{cid}/careers/...). */
export function parseDarwinbox(url: string): { origin: string; companyId: string } | null {
  try {
    const u = new URL(url);
    if (!/\.darwinbox\.in$/i.test(u.hostname)) return null;
    const m = u.pathname.match(/\/ms\/candidatev2\/([^/]+)\//i);
    return { origin: u.origin, companyId: m?.[1] ?? "main" };
  } catch { return null; }
}

const apiBody = (companyId: string) =>
  JSON.stringify({ companyId, page: 1, sort_option: "new", limit: 100 });

/** Direct server-side call to the alljobs API (works for non-Cloudflare tenants). */
async function fetchDirect(origin: string, companyId: string, referer: string): Promise<DarwinboxResp | null> {
  try {
    const res = await fetch(`${origin}/ms/candidateapi/job/alljobs?companyId=${encodeURIComponent(companyId)}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json", "User-Agent": UA, "Referer": referer },
      body:    apiBody(companyId),
      signal:  AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return await res.json() as DarwinboxResp;
  } catch { return null; }
}

/** Cloudflare-fronted fallback: render the page with Firecrawl, run the API
 *  fetch in-page, and read the JSON back from an injected DOM node. */
async function fetchViaFirecrawl(url: string, companyId: string): Promise<DarwinboxResp | null> {
  if (!process.env.FIRECRAWL_API_KEY) return null;
  const js =
    `fetch("/ms/candidateapi/job/alljobs?companyId=${companyId}",{method:"POST",` +
    `headers:{"Content-Type":"application/json","Accept":"application/json"},` +
    `body:JSON.stringify({companyId:"${companyId}",page:1,sort_option:"new",limit:100})})` +
    `.then(function(r){return r.text();}).then(function(t){var p=document.createElement("pre");` +
    `p.id="__jobs_json__";p.textContent="JOBSTART"+t+"JOBEND";document.body.appendChild(p);});`;
  try {
    const res = await fetch(FIRECRAWL_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.FIRECRAWL_API_KEY}` },
      body: JSON.stringify({
        url, formats: ["rawHtml"], timeout: 120_000, waitFor: 8000,
        actions: [
          { type: "wait", milliseconds: 7000 },
          { type: "executeJavascript", script: js },
          { type: "wait", milliseconds: 4000 },
        ],
      }),
      signal: AbortSignal.timeout(150_000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { data?: { rawHtml?: string } };
    const m = (data?.data?.rawHtml ?? "").match(/JOBSTART([\s\S]*?)JOBEND/);
    if (!m) return null;
    return JSON.parse(m[1]) as DarwinboxResp;
  } catch { return null; }
}

export async function scrapeDarwinbox(url: string): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  const parsed = parseDarwinbox(url);
  if (!parsed) return { jds: [], totalAvailable: 0 };
  const { origin, companyId } = parsed;

  const resp = (await fetchDirect(origin, companyId, url)) ?? (await fetchViaFirecrawl(url, companyId));
  if (!resp) return { jds: [], totalAvailable: 0 };

  const all = resp.data ?? [];
  if (all.length === 0) return { jds: [], totalAvailable: 0 };
  const totalAvailable = Math.max(resp.job_counts ?? 0, all.length);
  const keep = targetScrapeCount(totalAvailable);

  const jds: ScrapedJD[] = [];
  for (const job of all.slice(0, keep)) {
    const rawHtml = job.jd ?? "";
    let rawText = stripHtml(rawHtml);
    if (rawText.length < 100) continue;
    let title = job.title ?? job.designation_display_name ?? job.designation ?? "Untitled";
    if (looksNonEnglish(rawText) || looksNonEnglish(title)) {
      const t = await translateToEnglish(title, rawText);
      title = t.title; rawText = t.rawText;
    }
    jds.push({
      title,
      rawText:    rawText.slice(0, 12_000),
      sourceUrl:  job.id ? `${origin}/ms/candidatev2/${companyId}/careers/jobDetail/${job.id}` : url,
      department: job.department_name,
    });
  }
  return { jds, totalAvailable };
}
