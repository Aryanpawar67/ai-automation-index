import { targetScrapeCount } from "../jdLimits";
import type { ScrapedJD }    from "../scraper";

// UltraTech Cement (ultratechcement.com/corporate/career/jobs-at-ultratech).
// The public careers page lazy-loads a stale AEM GraphQL dataset that is also
// WAF-blocked to automation, so we go straight to UltraTech's real ATS — the
// Aditya Birla Group PeopleStrong candidate portal:
//   list:   POST /api/cp/rest/altone/cp/jobs/v1?offset=&limit=  (group-wide;
//           filter organizationUnit === "Cement" → UltraTech's live openings)
//   detail: /job/detail/{jobCode} — an Angular SPA behind Incapsula, so the
//           full JD (KRAs / skills / qualifications) is rendered via Firecrawl.

const ORIGIN        = "https://abgcareers.peoplestrong.com";
const LIST_URL      = `${ORIGIN}/api/cp/rest/altone/cp/jobs/v1`;
const DETAIL_BASE   = `${ORIGIN}/job/detail/`;
const FIRECRAWL_URL = "https://api.firecrawl.dev/v1/scrape";
const UA            = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
// UltraTech is the Aditya Birla Group's cement business; "Cement" is the org
// unit that scopes the group-wide feed down to UltraTech's openings.
const ORG_UNIT      = "Cement";
const PAGE          = 100;
const CONCURRENCY   = 4;

interface JobListItem {
  jobCode?:                 string | null;
  jobTitle?:                string | null;
  organizationUnit?:        string | null;
  locationHierarchy?:       string | null;
  locationHierarchyComplete?: string | null;
  expRange?:                string | null;
  jobPostedDate?:           string | null;
  skills?: { mustTohave?: string[]; goodtohave?: string[] } | null;
}
interface JobListResp { totalRecords?: number; response?: JobListItem[] | null }
interface FirecrawlResp { success?: boolean; data?: { markdown?: string } }

async function fetchListPage(offset: number): Promise<JobListItem[]> {
  try {
    const res = await fetch(`${LIST_URL}?offset=${offset}&limit=${PAGE}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "User-Agent": UA, "Referer": `${ORIGIN}/job/joblist` },
      body:    "{}",
      signal:  AbortSignal.timeout(20_000),
    });
    if (!res.ok) return [];
    const data = await res.json() as JobListResp;
    return data.response ?? [];
  } catch { return []; }
}

async function firecrawl(url: string): Promise<string> {
  if (!process.env.FIRECRAWL_API_KEY) return "";
  try {
    const res = await fetch(FIRECRAWL_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.FIRECRAWL_API_KEY}` },
      body:    JSON.stringify({ url, formats: ["markdown"], timeout: 90_000, waitFor: 6000 }),
      signal:  AbortSignal.timeout(120_000),
    });
    if (!res.ok) return "";
    const data = await res.json() as FirecrawlResp;
    return data?.data?.markdown ?? "";
  } catch { return ""; }
}

// Strip the leading nav (Home / Menus) and trailing UI noise from the rendered
// PeopleStrong detail markdown, keeping from the first real heading onward.
function cleanDetail(md: string): string {
  const start = md.search(/^##\s+\S/m);
  let body = start >= 0 ? md.slice(start) : md;
  return body
    .replace(/expand_less[\s\S]*$/i, "")
    .replace(/^Share(Register and Apply)?\s*$/gim, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")    // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links → text
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
    }),
  );
  return out;
}

export async function scrapeUltraTech(): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  // Paginate the group-wide feed, then scope to UltraTech (Cement).
  // The API returns ~99 per page, so stop on an empty page rather than a short
  // one; an offset bound backstops against an endlessly non-empty feed.
  const all: JobListItem[] = [];
  for (let offset = 0; offset <= 5_000; ) {
    const page = await fetchListPage(offset);
    if (page.length === 0) break;
    all.push(...page);
    offset += page.length; // advance by actual count (API returns ~99 per page)
  }

  const jobs = all.filter(j => j.organizationUnit === ORG_UNIT && (j.jobCode ?? "").trim());
  const totalAvailable = jobs.length;
  if (totalAvailable === 0) return { jds: [], totalAvailable: 0 };

  const keep    = targetScrapeCount(totalAvailable);
  const toFetch = jobs.slice(0, keep + 4);

  const fetched = await mapWithConcurrency(toFetch, CONCURRENCY, async (job) => {
    const code      = job.jobCode!.trim();
    const sourceUrl = `${DETAIL_BASE}${code}`;
    const md        = await firecrawl(sourceUrl);
    const body      = md ? cleanDetail(md) : "";

    const title = (job.jobTitle?.trim()
      || body.match(/^##\s+(.+)$/m)?.[1]?.trim()
      || "Untitled Position").slice(0, 120);

    const skills = [
      ...(job.skills?.mustTohave ?? []),
      ...(job.skills?.goodtohave ?? []),
    ].filter(Boolean);

    const meta = [
      job.jobTitle           && `Role: ${job.jobTitle}`,
      (job.locationHierarchyComplete || job.locationHierarchy) &&
        `Location: ${job.locationHierarchyComplete || job.locationHierarchy}`,
      job.expRange           && `Experience: ${job.expRange}`,
      skills.length          && `Skills: ${skills.join(", ")}`,
    ].filter(Boolean).join("\n");

    const rawText = `${meta}\n\n${body}`.trim();
    if (rawText.length < 200) return null; // metadata alone is too thin to analyse

    return { title, rawText: rawText.slice(0, 12_000), sourceUrl, department: "Cement" } satisfies ScrapedJD;
  });

  const jds = (fetched.filter((x): x is NonNullable<typeof x> => x !== null) as ScrapedJD[]).slice(0, keep);
  return { jds, totalAvailable };
}
