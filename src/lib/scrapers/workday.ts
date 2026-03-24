/**
 * Tier 1 scraper for Workday career sites.
 *
 * Workday exposes a public CxS (Candidate Experience Suite) API that powers
 * all Workday career pages. No auth required for external job listings.
 *
 * Flow:
 *  1. Resolve tenant + jobSite from URL (direct) or page HTML (custom domain)
 *  2. POST to CxS API → list of job postings (up to 10)
 *  3. GET each individual job page → extract JD from SSR HTML
 */

import { stripHtml } from "../stripHtml";
import type { ScrapedJD } from "../scraper";

interface WorkdayTenant {
  tenant:  string;
  jobSite: string;
}

/** Extract tenant + jobSite from a myworkdayjobs.com URL. Returns null for custom domains. */
export function extractWorkdayTenant(url: string): WorkdayTenant | null {
  const m = url.match(/https?:\/\/([^.]+)\.wd\d+\.myworkdayjobs\.com\/(?:[^/]+\/)?([^/?#]+)/);
  if (m) return { tenant: m[1], jobSite: m[2] };
  return null;
}

/** Extract tenant + jobSite from page HTML (custom domain case). */
export function extractTenantFromHtml(html: string): WorkdayTenant | null {
  // Try <script type="application/json" id="wd-app">
  const jsonMatch = html.match(/<script[^>]+id="wd-app"[^>]*>([\s\S]*?)<\/script>/i);
  if (jsonMatch) {
    try {
      const cfg = JSON.parse(jsonMatch[1]);
      if (cfg.tenant && cfg.jobSite) return { tenant: cfg.tenant, jobSite: cfg.jobSite };
    } catch { /* ignore */ }
  }
  // Try window.__WD_CONFIG__
  const cfgMatch = html.match(/window\.__WD_CONFIG__\s*=\s*(\{[^}]+\})/);
  if (cfgMatch) {
    try {
      const cfg = JSON.parse(cfgMatch[1]);
      if (cfg.tenant && cfg.jobSite) return { tenant: cfg.tenant, jobSite: cfg.jobSite };
    } catch { /* ignore */ }
  }
  // Try X-WD-Tenant pattern in inline scripts
  const scriptMatch = html.match(/["']tenant["']\s*:\s*["']([^"']+)["'][\s\S]{0,200}["']jobSite["']\s*:\s*["']([^"']+)["']/i);
  if (scriptMatch) return { tenant: scriptMatch[1], jobSite: scriptMatch[2] };

  return null;
}

interface WorkdayPosting {
  title:        string;
  externalPath: string;
  locationsText?: string;
}

/** POST to the Workday CxS jobs search API. Returns up to 10 postings. */
async function fetchWorkdayJobs(tenant: string, jobSite: string): Promise<WorkdayPosting[]> {
  try {
    const res = await fetch(
      `https://${tenant}.myworkdayjobs.com/wday/cxs/${tenant}/${jobSite}/jobs`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ appliedFacets: {}, limit: 10, offset: 0, searchText: "" }),
        signal:  AbortSignal.timeout(12_000),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.jobPostings ?? []).slice(0, 10);
  } catch {
    return [];
  }
}

/** Fetch an individual Workday job page (SSR) and extract the JD text. */
async function fetchWorkdayJD(tenant: string, externalPath: string): Promise<string> {
  try {
    const url = `https://${tenant}.myworkdayjobs.com${externalPath}`;
    const res = await fetch(url, {
      headers: { "Accept": "text/html", "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)" },
      signal:  AbortSignal.timeout(10_000),
    });
    if (!res.ok) return "";
    const html = await res.text();

    // Workday SSR pages contain the JD in a div with data-automation-id="jobPostingDescription"
    const m = html.match(/data-automation-id="jobPostingDescription"[^>]*>([\s\S]*?)<\/div>/i);
    return m ? stripHtml(m[1]) : "";
  } catch {
    return "";
  }
}

export async function scrapeWorkday(url: string): Promise<ScrapedJD[]> {
  // Step 1: resolve tenant + jobSite
  let tenantInfo = extractWorkdayTenant(url);

  if (!tenantInfo) {
    // Custom domain — fetch page HTML and extract Workday config
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)" },
        signal:  AbortSignal.timeout(10_000),
      });
      if (!res.ok) return [];
      const html  = await res.text();
      tenantInfo  = extractTenantFromHtml(html);
    } catch {
      return [];
    }
    if (!tenantInfo) return [];  // fall through to Firecrawl
  }

  // Step 2: fetch job list from CxS API
  const postings = await fetchWorkdayJobs(tenantInfo.tenant, tenantInfo.jobSite);
  if (postings.length === 0) return [];

  // Step 3: fetch individual JD pages
  const jds: ScrapedJD[] = [];
  for (const posting of postings) {
    const rawText = await fetchWorkdayJD(tenantInfo.tenant, posting.externalPath);
    if (!rawText || rawText.length < 100) continue;
    jds.push({
      title:    posting.title,
      rawText,
      sourceUrl: `https://${tenantInfo.tenant}.myworkdayjobs.com${posting.externalPath}`,
    });
  }
  return jds;
}
