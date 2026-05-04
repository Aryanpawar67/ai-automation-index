/**
 * Tier 1 scrapers for Oracle HCM Cloud and Oracle Taleo.
 *
 * Oracle HCM Cloud (confirmed API pattern, 2026-03):
 *   List:   GET /hcmRestApi/resources/latest/recruitingCEJobRequisitions
 *              ?onlyData=true&limit=10&expand=requisitionList
 *              &finder=findReqs;siteNumber={site}
 *   Detail: GET /hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails/{Id}
 *              ?onlyData=true
 *
 * The siteNumber can be:
 *   - The URL site slug: /sites/WMCareers → WMCareers
 *   - The CX number from page HTML: siteNumber=CX_4001
 *
 * Oracle Taleo (legacy):
 *   Separate REST API at {tenant}.taleo.net — unchanged.
 */

import { stripHtml } from "../stripHtml";
import type { ScrapedJD } from "../scraper";
import { targetScrapeCount } from "../jdLimits";

const ORACLE_REGIONS = ["us2", "uk3", "eu5", "ap2", "us6", "ca2", "us1", "eu1"];

// ── Oracle Taleo ──────────────────────────────────────────────────────────────

export function extractTaleoTenant(url: string): string | null {
  const m = url.match(/https?:\/\/([^.]+)\.taleo\.net/i);
  return m ? m[1] : null;
}

/** Taleo REST API on any host (covers taleo.net AND custom domains). */
async function scrapeOracleTaleoOnHost(host: string): Promise<ScrapedJD[]> {
  try {
    const listRes = await fetch(
      `https://${host}/careersection/rest/jobboard/joblist?lang=en&act=showpage&pg=1`,
      { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(12_000) }
    );
    if (!listRes.ok) return [];
    const data = await listRes.json();
    const jobs  = (data?.requisition ?? []).slice(0, 15);
    const jds: ScrapedJD[] = [];
    for (const job of jobs) {
      try {
        const jdRes = await fetch(
          `https://${host}/careersection/api/jobdescription/en/detail/${job.jobId}`,
          { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(8_000) }
        );
        if (!jdRes.ok) continue;
        const jdData  = await jdRes.json();
        const rawText = stripHtml(jdData?.jobDescription ?? jdData?.description ?? "");
        if (rawText.length < 100) continue;
        jds.push({
          title:    job.title ?? "Untitled",
          rawText,
          sourceUrl: `https://${host}/careersection/jobdetail.ftl?job=${job.jobId}`,
        });
      } catch { continue; }
    }
    return jds;
  } catch { return []; }
}

export async function scrapeOracleTaleo(url: string): Promise<ScrapedJD[]> {
  // Standard taleo.net hosted
  const tenant = extractTaleoTenant(url);
  if (tenant) return scrapeOracleTaleoOnHost(`${tenant}.taleo.net`);

  // Custom domain (e.g. careers.belden.com, careers.yash.com)
  try {
    const host = new URL(url).hostname;
    return scrapeOracleTaleoOnHost(host);
  } catch { return []; }
}

// ── Oracle HCM Cloud ──────────────────────────────────────────────────────────

interface OracleContext {
  base:       string;  // https://{pod}.fa.{region}.oraclecloud.com
  siteNumber: string;  // WMCareers or CX_4001
  // Optional location filter — Oracle CX URLs encode this as ?locationId=...
  // When present, we pass it as selectedLocationsFacet so the scraper honors
  // the filter (e.g. "United States only", "Americas region only").
  locationId?: string;
}

/** Extract Oracle base URL + siteNumber from a direct Oracle Cloud URL. */
function extractFromOracleUrl(url: string): OracleContext | null {
  const m = url.match(/https?:\/\/([a-z0-9-]+)\.fa\.([a-z0-9-]+)\.oraclecloud\.com/i);
  if (!m) return null;
  const base       = `https://${m[1]}.fa.${m[2]}.oraclecloud.com`;
  // /sites/WMCareers → WMCareers
  const siteName   = url.match(/\/sites\/([A-Za-z0-9_-]+)/i)?.[1];
  // siteNumber=CX_4001 query param
  let parsed: URL;
  try { parsed = new URL(url); } catch { return null; }
  const siteParam  = parsed.searchParams.get("siteNumber");
  const siteNumber = siteParam ?? siteName ?? "";
  const locationId = parsed.searchParams.get("locationId") ?? undefined;
  return { base, siteNumber, locationId };
}

/** Extract Oracle context from page HTML (custom domain case). */
function extractFromHtml(html: string): OracleContext | null {
  // First try: match Oracle URL with embedded /sites/<siteNumber> — most precise
  const fullMatch = html.match(
    /https?:\/\/([a-z0-9-]+)\.fa\.([a-z0-9-]+)\.oraclecloud\.com[^"'\s]*\/sites\/([A-Za-z0-9_-]+)/i
  );
  if (fullMatch) {
    return {
      base:       `https://${fullMatch[1]}.fa.${fullMatch[2]}.oraclecloud.com`,
      siteNumber: fullMatch[3],
    };
  }

  // Fallback: domain only, then look for siteNumber=CX_XXXX in page scripts
  const domainMatch = html.match(/https?:\/\/([a-z0-9-]+)\.fa\.([a-z0-9-]+)\.oraclecloud\.com/i);
  if (!domainMatch) return null;
  const base = `https://${domainMatch[1]}.fa.${domainMatch[2]}.oraclecloud.com`;

  const cxMatch    = html.match(/siteNumber[=:]["']?\s*(CX_\d+)/i);
  const siteNumber = cxMatch?.[1] ?? "";
  return { base, siteNumber };
}

/** Probe common Oracle HCM regions to find where the pod lives. */
async function probeRegions(pod: string, siteNumber: string, locationId?: string): Promise<OracleContext | null> {
  for (const region of ORACLE_REGIONS) {
    const base = `https://${pod}.fa.${region}.oraclecloud.com`;
    const url  = buildListUrl(base, siteNumber, locationId);
    try {
      const res = await fetch(url, {
        headers: { "Accept": "application/json" },
        signal:  AbortSignal.timeout(5_000),
      });
      if (res.ok) return { base, siteNumber, locationId };
    } catch { /* try next */ }
  }
  return null;
}

// Oracle HCM API always returns up to 25 jobs per request in requisitionList;
// Offset/Limit inside the finder string are rejected (400) on most instances.
// TotalJobsCount in items[0] gives the real total available.
//
// When `locationId` is supplied (parsed from the source URL's ?locationId=
// param), we append `,selectedLocationsFacet=<id>` to the finder so the API
// returns only jobs in that location — matches the filter the user set in the
// careers UI (e.g. country=United States → 171 jobs instead of 2644 tenant-wide).
function buildListUrl(base: string, siteNumber: string, locationId?: string): string {
  if (!siteNumber) {
    return `${base}/hcmRestApi/resources/latest/recruitingCEJobRequisitions` +
      `?onlyData=true&limit=25&expand=requisitionList`;
  }
  let finderInner = `findReqs;siteNumber=${siteNumber}`;
  if (locationId) finderInner += `,selectedLocationsFacet=${locationId}`;
  return `${base}/hcmRestApi/resources/latest/recruitingCEJobRequisitions` +
    `?onlyData=true&limit=25&expand=requisitionList&finder=${encodeURIComponent(finderInner)}`;
}

interface OracleListJob {
  Id:              string;
  Title:           string;
  PrimaryLocation: string;
}

interface OracleListResult {
  jobs:  OracleListJob[];
  total: number;
}

async function fetchJobList(ctx: OracleContext): Promise<OracleListResult> {
  try {
    const res = await fetch(buildListUrl(ctx.base, ctx.siteNumber, ctx.locationId), {
      headers: { "Accept": "application/json" },
      signal:  AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { jobs: [], total: 0 };
    const data = await res.json();
    // Jobs are nested: items[0].requisitionList; TotalJobsCount gives the real total
    const item  = data?.items?.[0];
    const jobs  = Array.isArray(item?.requisitionList) ? item.requisitionList : [];
    const total = (item?.TotalJobsCount as number | undefined) ?? jobs.length;
    return { jobs, total };
  } catch { return { jobs: [], total: 0 }; }
}

async function fetchJobDetail(base: string, jobId: string): Promise<string> {
  try {
    const res = await fetch(
      `${base}/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails/${jobId}?onlyData=true`,
      { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) return "";
    const d = await res.json();
    // Combine all description fields in order of richness
    const combined = [
      d.ExternalDescriptionStr,
      d.ExternalResponsibilitiesStr,
      d.ExternalQualificationsStr,
      d.CorporateDescriptionStr,
      d.OrganizationDescriptionStr,
    ].filter(Boolean).join("\n\n");
    return stripHtml(combined);
  } catch { return ""; }
}

export async function scrapeOracleHCM(url: string): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  let ctx: OracleContext | null = null;

  // Direct Oracle Cloud URL
  ctx = extractFromOracleUrl(url);

  if (!ctx) {
    // Custom domain — fetch page HTML and look for Oracle config
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)" },
        signal:  AbortSignal.timeout(12_000),
      });
      if (!res.ok) return { jds: [], totalAvailable: 0 };
      const html = await res.text();
      ctx = extractFromHtml(html);

      if (ctx) {
        // Verify this base URL actually responds
        const probe = await fetch(buildListUrl(ctx.base, ctx.siteNumber, ctx.locationId), {
          headers: { "Accept": "application/json" },
          signal:  AbortSignal.timeout(6_000),
        }).catch(() => null);

        if (!probe?.ok) {
          // Pod may be on a different region — extract pod and probe
          const podMatch = ctx.base.match(/\/\/([a-z0-9-]+)\.fa\./i);
          if (podMatch) ctx = await probeRegions(podMatch[1], ctx.siteNumber, ctx.locationId);
        }
      }
    } catch { return { jds: [], totalAvailable: 0 }; }
  }

  if (!ctx) return { jds: [], totalAvailable: 0 };

  // Oracle API returns up to 25 jobs per request (hard cap); TotalJobsCount gives real total.
  // targetScrapeCount caps us at 20 for LARGE tier — always within the 25-job single page.
  const { jobs, total } = await fetchJobList(ctx);
  if (jobs.length === 0) return { jds: [], totalAvailable: 0 };

  const keep = targetScrapeCount(total);

  // Fetch individual JD detail for each job up to keep
  const jds: ScrapedJD[] = [];
  for (const job of jobs.slice(0, keep)) {
    const rawText = await fetchJobDetail(ctx.base, job.Id);
    if (!rawText || rawText.length < 100) continue;
    jds.push({
      title:    job.Title ?? "Untitled",
      rawText,
      sourceUrl: `${ctx.base}/hcmUI/CandidateExperience/en/sites/${ctx.siteNumber}/job/${job.Id}`,
    });
  }
  return { jds, totalAvailable: Math.max(total, jds.length) };
}

// ── Export buildOraclePodUrl for tests ────────────────────────────────────────
export function buildOraclePodUrl(pod: string, region: string): string {
  return `https://${pod}.fa.${region}.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions` +
    `?onlyData=true&limit=10&expand=requisitionList`;
}
