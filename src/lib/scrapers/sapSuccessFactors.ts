/**
 * Tier 1 scraper for SAP SuccessFactors career sites.
 *
 * Endpoint variants (in order of attempt):
 *  1. jobs2web.com hosted: {tenant}.jobs2web.com/job-invite/list/api
 *  2. career{N}.successfactors.com or career{N}.sapsf.com:
 *     → list via /api/rest/listjobs/v4/job  (SF Career Site Builder REST)
 *     → fallback: OData v2 (performancemanager.successfactors.com)
 *  3. Custom domain — HTML scan for jobs2web tenant, CompanyId, or companyCode
 */

import { stripHtml } from "../stripHtml";
import type { ScrapedJD } from "../scraper";

// CDN / infrastructure subdomains that are never real career tenants
const SF_INFRA_RE = /^rmkcdn\.|^rmk-map-|^cdn\.|^static\.|^assets\./i;

export function extractSapTenant(url: string): string | null {
  const m = url.match(/https?:\/\/([^.]+)\.jobs2web\.com/i);
  if (!m || SF_INFRA_RE.test(m[1])) return null;
  return m[1];
}

/** Extract the SF host from a known SF URL (career{N}.successfactors.com or career{N}.sapsf.com). */
export function extractSfHost(url: string): string | null {
  const m = url.match(/https?:\/\/(career\d+\.(?:successfactors|sapsf)\.com)/i);
  return m ? m[1] : null;
}

export function extractCompanyCode(url: string): string | null {
  // Handles: ?company=X, ?career_company=X
  const m = url.match(/[?&](?:career_)?company=([^&#]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

// ── Jobs2Web list API ─────────────────────────────────────────────────────────

async function scrapeViaJobs2Web(tenant: string, fallbackUrl: string): Promise<ScrapedJD[]> {
  try {
    const res = await fetch(
      `https://${tenant}.jobs2web.com/job-invite/list/api?limit=10&offset=0&lang=en&country=all`,
      { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(12_000) }
    );
    if (!res.ok) return [];
    const data    = await res.json();
    const results = (data?.results ?? []) as Array<Record<string, string>>;
    return results.slice(0, 10)
      .map(item => ({
        title:     item.title ?? "Untitled",
        rawText:   stripHtml(item.description ?? ""),
        sourceUrl: item.applyUrl ?? `https://${tenant}.jobs2web.com`,
      }))
      .filter(jd => jd.rawText.length > 100);
  } catch { return []; }
}

// ── SF Career Site Builder REST API ──────────────────────────────────────────
// Used by career10.successfactors.com and similar modern SF deployments.
// Endpoint: POST /api/rest/listjobs/v4/job?companyId={code}&language=en_US

async function scrapeViaCsb(companyCode: string, fallbackUrl: string): Promise<ScrapedJD[]> {
  // Prefer the host embedded in the source URL (e.g. career44.sapsf.com)
  const urlHost = extractSfHost(fallbackUrl);
  const defaultHosts = [
    "career10.successfactors.com",
    "career5.successfactors.com",
    "career4.successfactors.com",
  ];
  const hosts = urlHost
    ? [urlHost, ...defaultHosts.filter(h => h !== urlHost)]
    : defaultHosts;

  for (const host of hosts) {
    try {
      const listRes = await fetch(
        `https://${host}/api/rest/listjobs/v4/job?companyId=${encodeURIComponent(companyCode)}&language=en_US&pageSize=10&pageNo=0`,
        { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(10_000) }
      );
      if (!listRes.ok) continue;
      const listData = await listRes.json();
      const jobs = (listData?.jobs ?? listData?.jobPostings ?? []) as Array<Record<string, unknown>>;
      if (jobs.length === 0) continue;

      const jds: ScrapedJD[] = [];
      for (const job of jobs.slice(0, 10)) {
        const jobId = job.jobId ?? job.jobReqId ?? job.id;
        if (!jobId) continue;
        try {
          const detailRes = await fetch(
            `https://${host}/api/rest/jobdetail/v4/job/${jobId}?companyId=${encodeURIComponent(companyCode)}&language=en_US`,
            { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(8_000) }
          );
          if (!detailRes.ok) continue;
          const detail  = await detailRes.json();
          const rawText = stripHtml([
            detail?.jobDescription,
            detail?.jobDescriptionStr,
            detail?.jobSummary,
            detail?.extJobDesc,
          ].filter(Boolean).join("\n\n"));
          if (rawText.length < 100) continue;
          jds.push({
            title:     String(job.jobTitle ?? job.title ?? "Untitled"),
            rawText,
            sourceUrl: `https://${host}/career?company=${companyCode}&jobId=${jobId}`,
          });
        } catch { continue; }
      }
      if (jds.length > 0) return jds;
    } catch { continue; }
  }
  return [];
}

// ── OData v2 (legacy SF, still works for some tenants) ───────────────────────

async function scrapeViaOData(companyCode: string, fallbackUrl: string): Promise<ScrapedJD[]> {
  const hosts = [
    "performancemanager.successfactors.com",
    "performancemanager4.successfactors.com",
    "performancemanager5.successfactors.com",
  ];
  for (const host of hosts) {
    try {
      const res = await fetch(
        `https://${host}/odata/v2/JobRequisitionLocale` +
        `?$format=json&$select=jobReqId,externalTitle,jobDescription,country` +
        `&$filter=lang eq 'en_US'&company='${encodeURIComponent(companyCode)}'&$top=10`,
        { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(12_000) }
      );
      if (!res.ok) continue;
      const data  = await res.json();
      const items = (data?.d?.results ?? []) as Array<Record<string, string>>;
      if (items.length === 0) continue;
      const jds = items
        .map(item => ({
          title:     item.externalTitle ?? "Untitled",
          rawText:   stripHtml(item.jobDescription ?? ""),
          sourceUrl: fallbackUrl,
        }))
        .filter(jd => jd.rawText.length > 100);
      if (jds.length > 0) return jds;
    } catch { continue; }
  }
  return [];
}

// ── Company code extraction from HTML ────────────────────────────────────────

function extractCompanyCodeFromHtml(html: string): string | null {
  return (
    html.match(/data-company-code=["']([^"']+)["']/i)?.[1] ??
    html.match(/["']companyCode["']\s*:\s*["']([^"']+)["']/i)?.[1] ??
    // SF Career Site Builder: CompanyId" : 'powerinter'
    html.match(/[Cc]ompany[Ii]d["'\s:=]+["']([A-Za-z0-9_-]{3,})["']/)?.[1] ??
    // ?company=X embedded in script src or iframe src
    html.match(/[?&]company=([A-Za-z0-9_-]{3,})/i)?.[1] ??
    null
  );
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function scrapeSAPSuccessFactors(url: string): Promise<ScrapedJD[]> {
  // 1. Direct jobs2web tenant URL
  const tenant = extractSapTenant(url);
  if (tenant) return scrapeViaJobs2Web(tenant, url);

  // 2. Company code in URL → try CSB first, OData as fallback
  const companyCode = extractCompanyCode(url);
  if (companyCode) {
    const csb = await scrapeViaCsb(companyCode, url);
    if (csb.length > 0) return csb;
    return scrapeViaOData(companyCode, url);
  }

  // 3. Custom domain — fetch page HTML to find SAP config
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)" },
      signal:  AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const html = await res.text();

    // jobs2web tenant in HTML (exclude CDN/infra subdomains)
    const j2wMatches = [...html.matchAll(/([a-z0-9_-]+)\.jobs2web\.com/gi)];
    for (const m of j2wMatches) {
      if (SF_INFRA_RE.test(m[1])) continue;
      const jds = await scrapeViaJobs2Web(m[1], url);
      if (jds.length > 0) return jds;
      break; // found a tenant but returned empty — don't loop
    }

    // Company code in HTML
    const code = extractCompanyCodeFromHtml(html);
    if (code) {
      const csb = await scrapeViaCsb(code, url);
      if (csb.length > 0) return csb;
      return scrapeViaOData(code, url);
    }
  } catch { /* fall through to Firecrawl */ }

  return [];
}
