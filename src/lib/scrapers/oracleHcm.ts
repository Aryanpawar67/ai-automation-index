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

const ORACLE_REGIONS = ["us2", "uk3", "eu5", "ap2", "us6", "ca2", "us1", "eu1"];

// ── Oracle Taleo ──────────────────────────────────────────────────────────────

export function extractTaleoTenant(url: string): string | null {
  const m = url.match(/https?:\/\/([^.]+)\.taleo\.net/i);
  return m ? m[1] : null;
}

export async function scrapeOracleTaleo(url: string): Promise<ScrapedJD[]> {
  const tenant = extractTaleoTenant(url);
  if (!tenant) return [];
  try {
    const listRes = await fetch(
      `https://${tenant}.taleo.net/careersection/rest/jobboard/joblist?lang=en&act=showpage&pg=1`,
      { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(12_000) }
    );
    if (!listRes.ok) return [];
    const data = await listRes.json();
    const jobs  = (data?.requisition ?? []).slice(0, 15);
    const jds: ScrapedJD[] = [];
    for (const job of jobs) {
      try {
        const jdRes = await fetch(
          `https://${tenant}.taleo.net/careersection/api/jobdescription/en/detail/${job.jobId}`,
          { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(8_000) }
        );
        if (!jdRes.ok) continue;
        const jdData  = await jdRes.json();
        const rawText = stripHtml(jdData?.jobDescription ?? jdData?.description ?? "");
        if (rawText.length < 100) continue;
        jds.push({
          title:    job.title ?? "Untitled",
          rawText,
          sourceUrl: `https://${tenant}.taleo.net/careersection/jobdetail.ftl?job=${job.jobId}`,
        });
      } catch { /* skip */ }
    }
    return jds;
  } catch { return []; }
}

// ── Oracle HCM Cloud ──────────────────────────────────────────────────────────

interface OracleContext {
  base:       string;  // https://{pod}.fa.{region}.oraclecloud.com
  siteNumber: string;  // WMCareers or CX_4001
}

/** Extract Oracle base URL + siteNumber from a direct Oracle Cloud URL. */
function extractFromOracleUrl(url: string): OracleContext | null {
  const m = url.match(/https?:\/\/([a-z0-9]+)\.fa\.([a-z0-9]+)\.oraclecloud\.com/i);
  if (!m) return null;
  const base       = `https://${m[1]}.fa.${m[2]}.oraclecloud.com`;
  // /sites/WMCareers → WMCareers
  const siteName   = url.match(/\/sites\/([A-Za-z0-9_-]+)/i)?.[1];
  // siteNumber=CX_4001 query param
  const siteParam  = new URL(url).searchParams.get("siteNumber");
  const siteNumber = siteParam ?? siteName ?? "";
  return { base, siteNumber };
}

/** Extract Oracle context from page HTML (custom domain case). */
function extractFromHtml(html: string): OracleContext | null {
  // Look for Oracle domain reference in scripts or links
  const domainMatch = html.match(/https?:\/\/([a-z0-9]+)\.fa\.([a-z0-9]+)\.oraclecloud\.com/i);
  if (!domainMatch) return null;
  const base = `https://${domainMatch[1]}.fa.${domainMatch[2]}.oraclecloud.com`;

  // Try CX_XXXX siteNumber first (most reliable)
  const cxMatch   = html.match(/siteNumber[=:]["']?\s*(CX_\d+)/i);
  // Then try URL-embedded site name
  const nameMatch = html.match(/\/sites\/([A-Za-z0-9_-]+)/i);
  const siteNumber = cxMatch?.[1] ?? nameMatch?.[1] ?? "";

  return { base, siteNumber };
}

/** Probe common Oracle HCM regions to find where the pod lives. */
async function probeRegions(pod: string, siteNumber: string): Promise<OracleContext | null> {
  for (const region of ORACLE_REGIONS) {
    const base = `https://${pod}.fa.${region}.oraclecloud.com`;
    const url  = buildListUrl(base, siteNumber);
    try {
      const res = await fetch(url, {
        headers: { "Accept": "application/json" },
        signal:  AbortSignal.timeout(5_000),
      });
      if (res.ok) return { base, siteNumber };
    } catch { /* try next */ }
  }
  return null;
}

function buildListUrl(base: string, siteNumber: string): string {
  const finder = siteNumber ? `&finder=findReqs;siteNumber=${encodeURIComponent(siteNumber)}` : "";
  return `${base}/hcmRestApi/resources/latest/recruitingCEJobRequisitions` +
    `?onlyData=true&limit=15&expand=requisitionList${finder}`;
}

interface OracleListJob {
  Id:              string;
  Title:           string;
  PrimaryLocation: string;
}

async function fetchJobList(ctx: OracleContext): Promise<OracleListJob[]> {
  try {
    const res = await fetch(buildListUrl(ctx.base, ctx.siteNumber), {
      headers: { "Accept": "application/json" },
      signal:  AbortSignal.timeout(12_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    // Jobs are nested: items[0].requisitionList = array
    const jobs = data?.items?.[0]?.requisitionList;
    return Array.isArray(jobs) ? jobs : [];
  } catch { return []; }
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

export async function scrapeOracleHCM(url: string): Promise<ScrapedJD[]> {
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
      if (!res.ok) return [];
      const html = await res.text();
      ctx = extractFromHtml(html);

      if (ctx) {
        // Verify this base URL actually responds
        const probe = await fetch(buildListUrl(ctx.base, ctx.siteNumber), {
          headers: { "Accept": "application/json" },
          signal:  AbortSignal.timeout(6_000),
        }).catch(() => null);

        if (!probe?.ok) {
          // Pod may be on a different region — extract pod and probe
          const podMatch = ctx.base.match(/\/\/([a-z0-9]+)\.fa\./i);
          if (podMatch) ctx = await probeRegions(podMatch[1], ctx.siteNumber);
        }
      }
    } catch { return []; }
  }

  if (!ctx) return [];

  // Fetch job list
  const jobs = await fetchJobList(ctx);
  if (jobs.length === 0) return [];

  // Fetch individual JD detail for each job
  const jds: ScrapedJD[] = [];
  for (const job of jobs.slice(0, 15)) {
    const rawText = await fetchJobDetail(ctx.base, job.Id);
    if (!rawText || rawText.length < 100) continue;

    const siteSlug = ctx.siteNumber.startsWith("CX_")
      ? ctx.siteNumber
      : ctx.siteNumber;

    jds.push({
      title:    job.Title ?? "Untitled",
      rawText,
      sourceUrl: `${ctx.base}/hcmUI/CandidateExperience/en/sites/${siteSlug}/job/${job.Id}`,
    });
  }
  return jds;
}

// ── Export buildOraclePodUrl for tests ────────────────────────────────────────
export function buildOraclePodUrl(pod: string, region: string): string {
  return `https://${pod}.fa.${region}.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions` +
    `?onlyData=true&limit=10&expand=requisitionList`;
}
