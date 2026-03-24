/**
 * Tier 1 scrapers for Oracle HCM Cloud and Oracle Taleo.
 *
 * Oracle HCM Cloud:
 *   - Exposes a REST API at {pod}.fa.{region}.oraclecloud.com/hcmRestApi/...
 *   - Pod/region detected from URL or page HTML; if unknown, common regions are probed.
 *
 * Oracle Taleo (legacy):
 *   - REST API at {tenant}.taleo.net/careersection/rest/jobboard/...
 *   - Tenant always extractable from the taleo.net URL.
 */

import { stripHtml } from "../stripHtml";
import type { ScrapedJD } from "../scraper";

// Common Oracle HCM Cloud regional pods to probe when region is unknown
const ORACLE_REGIONS = ["us2", "uk3", "eu5", "ap2", "us6", "ca2"];

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
    const jobs = (data?.requisition ?? []).slice(0, 10);
    const jds: ScrapedJD[] = [];

    for (const job of jobs) {
      try {
        const jdRes = await fetch(
          `https://${tenant}.taleo.net/careersection/api/jobdescription/en/detail/${job.jobId}`,
          { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(8_000) }
        );
        if (!jdRes.ok) continue;
        const jdData = await jdRes.json();
        const rawText = stripHtml(jdData?.jobDescription ?? jdData?.description ?? "");
        if (rawText.length < 100) continue;
        jds.push({
          title:    job.title ?? "Untitled",
          rawText,
          sourceUrl: `https://${tenant}.taleo.net/careersection/jobdetail.ftl?job=${job.jobId}`,
        });
      } catch { /* skip failed individual JD */ }
    }
    return jds;
  } catch {
    return [];
  }
}

// ── Oracle HCM Cloud ──────────────────────────────────────────────────────────

export function buildOraclePodUrl(pod: string, region: string): string {
  return (
    `https://${pod}.fa.${region}.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions` +
    `?onlyData=true&fields=Title,PrimaryLocation,JobFunction,JobPostingDescription,RequisitionId&limit=10`
  );
}

/** Probe common Oracle HCM regions to find which one this pod lives on. */
async function probeOraclePod(pod: string): Promise<string | null> {
  for (const region of ORACLE_REGIONS) {
    const url = buildOraclePodUrl(pod, region);
    try {
      const res = await fetch(url, {
        headers: { "Accept": "application/json" },
        signal:  AbortSignal.timeout(5_000),
      });
      if (res.ok) return url;
    } catch { /* try next region */ }
  }
  return null;
}

/** Look for Oracle pod + region embedded in page HTML. */
function extractOraclePodFromHtml(html: string): { pod: string; region: string } | null {
  const m = html.match(/([a-z0-9]+)\.fa\.([a-z0-9]+)\.oraclecloud\.com/i);
  if (m) return { pod: m[1], region: m[2] };
  return null;
}

export async function scrapeOracleHCM(url: string): Promise<ScrapedJD[]> {
  // Try to extract pod + region directly from the URL
  let apiUrl: string | null = null;
  const urlPod = url.match(/([a-z0-9]+)\.fa\.([a-z0-9]+)\.oraclecloud\.com/i);

  if (urlPod) {
    apiUrl = buildOraclePodUrl(urlPod[1], urlPod[2]);
  } else {
    // Custom domain — fetch page HTML to find Oracle config
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)" },
        signal:  AbortSignal.timeout(10_000),
      });
      if (!res.ok) return [];
      const html = await res.text();
      const cfg  = extractOraclePodFromHtml(html);
      if (cfg) {
        apiUrl = buildOraclePodUrl(cfg.pod, cfg.region);
        // Verify this URL actually responds — if not, probe other regions
        const probe = await fetch(apiUrl, {
          headers: { "Accept": "application/json" },
          signal:  AbortSignal.timeout(5_000),
        }).catch(() => null);
        if (!probe?.ok) apiUrl = await probeOraclePod(cfg.pod);
      }
    } catch {
      return [];
    }
  }

  if (!apiUrl) return [];  // fall through to Firecrawl

  try {
    const res = await fetch(apiUrl, {
      headers: { "Accept": "application/json" },
      signal:  AbortSignal.timeout(12_000),
    });
    if (!res.ok) return [];

    const data  = await res.json();
    const items = (data?.items ?? []) as Array<Record<string, string>>;

    return items.slice(0, 10)
      .map(item => ({
        title:    item.Title ?? "Untitled",
        rawText:  stripHtml(item.JobPostingDescription ?? ""),
        sourceUrl: url,
      }))
      .filter(jd => jd.rawText.length > 100);
  } catch {
    return [];
  }
}
