import { stripHtml }         from "../stripHtml";
import { targetScrapeCount } from "../jdLimits";
import type { ScrapedJD }    from "../scraper";

/** Extract base URL from any icims.com careers URL.
 *  e.g. https://careers-cfins.icims.com/jobs/intro → https://careers-cfins.icims.com */
function extractIcimsBase(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("icims.com")) return null;
    return `${u.protocol}//${u.hostname}`;
  } catch { return null; }
}

/** GET /jobs/intro to obtain a JSESSIONID, then return cookie string. */
async function getIcimsSession(base: string): Promise<string> {
  try {
    const res = await fetch(`${base}/jobs/intro`, {
      redirect: "follow",
      signal:   AbortSignal.timeout(10_000),
    });
    const setCookie = res.headers.get("set-cookie") ?? "";
    const match = setCookie.match(/JSESSIONID=([^;,\s]+)/i);
    return match ? `JSESSIONID=${match[1]}` : "";
  } catch { return ""; }
}

/** Fetch all job IDs across all paginated search result pages (pr=0, pr=1, …). */
async function fetchJobIds(base: string, cookie: string): Promise<number[]> {
  const seen = new Set<number>();
  const all:  number[] = [];

  // Fetch page 0 first, then detect total page count from "Page 1 of N" text
  const fetchPage = async (page: number): Promise<{ ids: number[]; totalPages: number }> => {
    try {
      const res = await fetch(`${base}/jobs/search?ss=1&in_iframe=1&pr=${page}`, {
        headers: { Cookie: cookie },
        signal:  AbortSignal.timeout(15_000),
      });
      if (!res.ok) return { ids: [], totalPages: 1 };
      const html = await res.text();
      const ids  = [...html.matchAll(/\/jobs\/(\d{4,6})\//g)].map(m => parseInt(m[1], 10));

      // "Search Results Page 1 of 3" → extract the total page count
      const pageMatch  = html.match(/Page\s+\d+\s+of\s+(\d+)/i);
      const totalPages = pageMatch ? parseInt(pageMatch[1], 10) : 1;
      return { ids, totalPages };
    } catch { return { ids: [], totalPages: 1 }; }
  };

  const first = await fetchPage(0);
  for (const id of first.ids) { if (!seen.has(id)) { seen.add(id); all.push(id); } }

  for (let page = 1; page < first.totalPages; page++) {
    const { ids } = await fetchPage(page);
    for (const id of ids) { if (!seen.has(id)) { seen.add(id); all.push(id); } }
  }

  return all;
}

/** Fetch and parse a single job page. */
async function fetchJobPage(
  base: string,
  jobId: number,
  cookie: string,
): Promise<ScrapedJD | null> {
  try {
    const res = await fetch(`${base}/jobs/${jobId}/job?in_iframe=1`, {
      headers: { Cookie: cookie },
      signal:  AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Title — prefer job-title class, fall back to first h1
    const titleMatch =
      html.match(/<[^>]+class="[^"]*job-title[^"]*"[^>]*>([\s\S]*?)<\/[a-z]+>/i) ??
      html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const title = titleMatch
      ? stripHtml(titleMatch[1]).trim().replace(/\s+/g, " ") || "Untitled Position"
      : "Untitled Position";

    // Body text — strip scripts/styles then grab everything after the h1
    const bodyStart = html.indexOf("<h1");
    const relevant  = bodyStart >= 0 ? html.slice(bodyStart) : html;
    const rawText   = stripHtml(relevant)
      .replace(/\s{3,}/g, "\n")
      .trim()
      .slice(0, 8000);

    if (rawText.length < 200) return null;

    // Category (department) — appears as plain text in metadata: "Category\nClaims"
    const catMatch = html.match(/\bCategory\b[\s\S]{0,80}?>\s*([A-Za-z][A-Za-z &\/\-]{1,60}?)\s*</);
    const dept     = catMatch ? catMatch[1].trim() : undefined;

    return {
      title,
      rawText,
      sourceUrl:  `${base}/jobs/${jobId}/job`,
      department: dept || undefined,
    };
  } catch { return null; }
}

export async function scrapeICIMS(
  url: string,
): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  const base = extractIcimsBase(url);
  if (!base) return { jds: [], totalAvailable: 0 };

  const cookie = await getIcimsSession(base);
  if (!cookie) return { jds: [], totalAvailable: 0 };

  const allIds      = await fetchJobIds(base, cookie);
  const totalAvailable = allIds.length;
  if (totalAvailable === 0) return { jds: [], totalAvailable: 0 };

  const keep = targetScrapeCount(totalAvailable);
  const jds:  ScrapedJD[] = [];

  for (const id of allIds.slice(0, keep)) {
    const jd = await fetchJobPage(base, id, cookie);
    if (jd) jds.push(jd);
  }

  return { jds, totalAvailable };
}
