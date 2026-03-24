/**
 * Tier 1 scraper for SAP SuccessFactors career sites.
 *
 * Two endpoint variants:
 *  1. jobs2web.com hosted (most common): {tenant}.jobs2web.com/job-invite/list/api
 *  2. OData endpoint (older SF format): performancemanager.successfactors.com/odata/v2/...
 *
 * For custom domains, we fetch the page HTML and look for either a jobs2web
 * tenant reference or a data-company-code attribute.
 */

import { stripHtml } from "../stripHtml";
import type { ScrapedJD } from "../scraper";

export function extractSapTenant(url: string): string | null {
  const m = url.match(/https?:\/\/([^.]+)\.jobs2web\.com/i);
  return m ? m[1] : null;
}

export function extractCompanyCode(url: string): string | null {
  const m = url.match(/[?&]company=([^&]+)/i);
  return m ? m[1] : null;
}

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
        title:    item.title ?? "Untitled",
        rawText:  stripHtml(item.description ?? ""),
        sourceUrl: item.applyUrl ?? `https://${tenant}.jobs2web.com`,
      }))
      .filter(jd => jd.rawText.length > 100);
  } catch {
    return [];
  }
}

async function scrapeViaOData(companyCode: string, fallbackUrl: string): Promise<ScrapedJD[]> {
  try {
    const res = await fetch(
      `https://performancemanager.successfactors.com/odata/v2/JobRequisitionLocale` +
      `?$format=json&$select=jobReqId,externalTitle,jobDescription,country` +
      `&$filter=lang eq 'en_US'&company='${encodeURIComponent(companyCode)}'&$top=10`,
      { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(12_000) }
    );
    if (!res.ok) return [];
    const data  = await res.json();
    const items = (data?.d?.results ?? []) as Array<Record<string, string>>;
    return items
      .map(item => ({
        title:    item.externalTitle ?? "Untitled",
        rawText:  stripHtml(item.jobDescription ?? ""),
        sourceUrl: fallbackUrl,
      }))
      .filter(jd => jd.rawText.length > 100);
  } catch {
    return [];
  }
}

export async function scrapeSAPSuccessFactors(url: string): Promise<ScrapedJD[]> {
  // Try jobs2web.com tenant directly from URL
  const tenant = extractSapTenant(url);
  if (tenant) return scrapeViaJobs2Web(tenant, url);

  // Try OData with company code from URL query param
  const companyCode = extractCompanyCode(url);
  if (companyCode) return scrapeViaOData(companyCode, url);

  // Custom domain — fetch page HTML to find SAP config
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)" },
      signal:  AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const html = await res.text();

    // Look for jobs2web tenant in page source
    const tenantMatch = html.match(/([a-z0-9-]+)\.jobs2web\.com/i);
    if (tenantMatch) return scrapeViaJobs2Web(tenantMatch[1], url);

    // Look for company code in data attributes or config objects
    const codeMatch =
      html.match(/data-company-code=["']([^"']+)["']/i) ??
      html.match(/["']companyCode["']\s*:\s*["']([^"']+)["']/i);
    if (codeMatch) return scrapeViaOData(codeMatch[1], url);
  } catch { /* fall through */ }

  return [];  // fall through to Firecrawl
}
