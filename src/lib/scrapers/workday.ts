/**
 * Tier 1 scraper for Workday career sites.
 *
 * Flow:
 *  1. resolveWorkdayEntryPoint — convert any career landing page URL to a
 *     concrete {tenant, jobSite} by:
 *       a. Parsing direct myworkdayjobs.com URLs
 *       b. Scanning page HTML for embedded myworkdayjobs.com references
 *       c. Following "jobs" links one hop if needed
 *  2. POST CxS API → list of job postings (up to 10)
 *  3. GET CxS detail API per job → jobPostingInfo.jobDescription (JSON, not HTML scraping)
 */

import { stripHtml } from "../stripHtml";
import type { ScrapedJD } from "../scraper";

export interface WorkdayTenant {
  tenant:      string;
  jobSite:     string;
  resolvedUrl?: string; // populated when URL was resolved from a landing page
}

// ── URL extraction helpers ─────────────────────────────────────────────────

/** Extract tenant + jobSite from a direct myworkdayjobs.com URL. */
export function extractWorkdayTenant(url: string): WorkdayTenant | null {
  // Handles: company.wd5.myworkdayjobs.com/[locale/]JobSite[/...]
  //      and: company.myworkdayjobs.com/[locale/]JobSite[/...]
  const m = url.match(
    /https?:\/\/([^.]+)\.(?:wd\d+\.)?myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([^/?#\s]+)/
  );
  if (m) return { tenant: m[1], jobSite: m[2] };
  return null;
}

/** Extract Workday config from page HTML (custom domain). */
export function extractTenantFromHtml(html: string): WorkdayTenant | null {
  // 1. <script id="wd-app"> JSON blob
  const jsonMatch = html.match(/<script[^>]+id="wd-app"[^>]*>([\s\S]*?)<\/script>/i);
  if (jsonMatch) {
    try {
      const cfg = JSON.parse(jsonMatch[1]);
      if (cfg.tenant && cfg.jobSite) return { tenant: cfg.tenant, jobSite: cfg.jobSite };
    } catch { /* ignore */ }
  }

  // 2. CxS API URL embedded in page scripts/network calls — most reliable signal
  const cxsMatch = html.match(/\/wday\/cxs\/([a-z0-9_-]+)\/([a-z0-9_-]+)\/jobs/i);
  if (cxsMatch) return { tenant: cxsMatch[1], jobSite: cxsMatch[2] };

  // 3. Direct myworkdayjobs.com URL in any href/src/script
  const wdLinkMatch = html.match(
    /https?:\/\/([a-z0-9-]+)\.(?:wd\d+\.)?myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([a-z0-9_-]+)/i
  );
  if (wdLinkMatch) return { tenant: wdLinkMatch[1], jobSite: wdLinkMatch[2], resolvedUrl: wdLinkMatch[0] };

  // 4. window.__WD_CONFIG__ = {...}
  const cfgMatch = html.match(/window\.__WD_CONFIG__\s*=\s*(\{[^}]+\})/);
  if (cfgMatch) {
    try {
      const cfg = JSON.parse(cfgMatch[1]);
      if (cfg.tenant && cfg.jobSite) return { tenant: cfg.tenant, jobSite: cfg.jobSite };
    } catch { /* ignore */ }
  }

  // 5. "tenant":"...", "jobSite":"..." anywhere in inline scripts
  const scriptMatch = html.match(
    /["']tenant["']\s*:\s*["']([^"']+)["'][\s\S]{0,300}["']jobSite["']\s*:\s*["']([^"']+)["']/i
  );
  if (scriptMatch) return { tenant: scriptMatch[1], jobSite: scriptMatch[2] };

  return null;
}

// ── Entry-point resolver ───────────────────────────────────────────────────

// Link text patterns that lead to a jobs listing page
const JOBS_LINK_RE = /search.?jobs?|view.?jobs?|browse.?jobs?|open.?position|all.?jobs?|find.?jobs?|see.?jobs?|explore.?jobs?/i;

/**
 * Given any career page URL (landing page or direct), resolves it to a
 * concrete Workday {tenant, jobSite}. Returns null if unresolvable.
 *
 * Strategy:
 *  1. Direct myworkdayjobs.com URL → parse immediately
 *  2. Fetch page HTML → scan for Workday signals
 *  3. One-hop follow on off-domain "View Jobs" links
 */
export async function resolveWorkdayEntryPoint(url: string): Promise<WorkdayTenant | null> {
  // 1. Already a direct Workday URL
  const direct = extractWorkdayTenant(url);
  if (direct) return direct;

  // 2. Fetch landing page
  let html: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch { return null; }

  // Scan this page for embedded Workday config / links
  const fromHtml = extractTenantFromHtml(html);
  if (fromHtml) return fromHtml;

  // 3. Collect candidate "jobs" links from the page for one-hop follow
  //    Priority: off-domain links first (likely the ATS), then on-domain /jobs paths
  const candidates: string[] = [];
  const seen = new Set<string>();

  const hrefRe = /href=["']([^"'#\s]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = hrefRe.exec(html)) !== null) {
    try {
      const abs = m[1].startsWith("http") ? m[1] : new URL(m[1], url).href;
      const normalized = abs.split("?")[0];
      if (seen.has(normalized) || normalized === url) continue;
      seen.add(normalized);

      // Immediately check if any href IS a myworkdayjobs.com URL
      const wdDirect = extractWorkdayTenant(abs);
      if (wdDirect) return { ...wdDirect, resolvedUrl: abs };

      // Collect off-domain links with job-related text or path
      const isOffDomain = new URL(abs).hostname !== new URL(url).hostname;
      const looksLikeJobs = /job|career|work|position|opening/i.test(abs);
      if (isOffDomain && looksLikeJobs) candidates.unshift(abs); // off-domain first
      else if (/job|career|position/i.test(abs)) candidates.push(abs);
    } catch { /* invalid url */ }
  }

  // Also pick up explicit "Search/View Jobs" button hrefs by scanning surrounding text
  const btnRe = new RegExp(
    `(${JOBS_LINK_RE.source})[\\s\\S]{0,200}?href=["']([^"'#\\s]+)["']|href=["']([^"'#\\s]+)["'][\\s\\S]{0,200}?(${JOBS_LINK_RE.source})`,
    "gi"
  );
  while ((m = btnRe.exec(html)) !== null) {
    const href = m[2] ?? m[3];
    if (!href) continue;
    try {
      const abs = href.startsWith("http") ? href : new URL(href, url).href;
      const wdDirect = extractWorkdayTenant(abs);
      if (wdDirect) return { ...wdDirect, resolvedUrl: abs };
      if (!seen.has(abs)) { seen.add(abs); candidates.unshift(abs); }
    } catch { /* ignore */ }
  }

  // Follow up to 4 candidate links (one hop)
  for (const candidate of candidates.slice(0, 4)) {
    const wdDirect = extractWorkdayTenant(candidate);
    if (wdDirect) return { ...wdDirect, resolvedUrl: candidate };

    try {
      const res = await fetch(candidate, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)" },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) continue;
      const hopHtml = await res.text();

      // Check for direct myworkdayjobs.com links on this page
      const wdLinkMatch = hopHtml.match(
        /https?:\/\/([a-z0-9-]+)\.(?:wd\d+\.)?myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([a-z0-9_-]+)/i
      );
      if (wdLinkMatch) {
        const t = extractWorkdayTenant(wdLinkMatch[0]);
        if (t) return { ...t, resolvedUrl: wdLinkMatch[0] };
      }

      const fromHop = extractTenantFromHtml(hopHtml);
      if (fromHop) return { ...fromHop, resolvedUrl: candidate };
    } catch { continue; }
  }

  return null;
}

// ── CxS API calls ──────────────────────────────────────────────────────────

interface WorkdayPosting {
  title:        string;
  externalPath: string;
  locationsText?: string;
}

/** POST to Workday CxS jobs search API. Returns up to 10 postings. */
async function fetchWorkdayJobs(tenant: string, jobSite: string): Promise<WorkdayPosting[]> {
  try {
    const res = await fetch(
      `https://${tenant}.myworkdayjobs.com/wday/cxs/${tenant}/${jobSite}/jobs`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body:    JSON.stringify({ appliedFacets: {}, limit: 10, offset: 0, searchText: "" }),
        signal:  AbortSignal.timeout(12_000),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.jobPostings ?? []).slice(0, 10);
  } catch { return []; }
}

/**
 * Fetch individual JD via Workday CxS JSON detail endpoint.
 * URL: GET /wday/cxs/{tenant}/{jobSite}{externalPath}
 * Returns jobPostingInfo.jobDescription (HTML) + jobRequirements + bulletFields.
 *
 * Falls back to HTML page scraping if API returns no description.
 */
async function fetchWorkdayJD(
  tenant: string,
  jobSite: string,
  externalPath: string
): Promise<string> {
  // Primary: CxS JSON detail API
  try {
    const apiUrl = `https://${tenant}.myworkdayjobs.com/wday/cxs/${tenant}/${jobSite}${externalPath}`;
    const res = await fetch(apiUrl, {
      headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const data = await res.json();
      const info = data?.jobPostingInfo ?? {};
      const parts = [
        info.jobDescription,
        info.jobRequirements,
        ...(Array.isArray(info.bulletFields) ? info.bulletFields.filter((b: string) => b.length > 20) : []),
      ].filter(Boolean) as string[];
      if (parts.length > 0) {
        const combined = stripHtml(parts.join("\n\n"));
        if (combined.length >= 100) return combined;
      }
    }
  } catch { /* fall through to HTML */ }

  // Fallback: fetch the HTML page — look for JSON-LD or embedded job data
  try {
    const pageUrl = `https://${tenant}.myworkdayjobs.com${externalPath}`;
    const res = await fetch(pageUrl, {
      headers: { "Accept": "text/html", "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return "";
    const html = await res.text();

    // JSON-LD structured data (most reliable when present)
    const jsonLdMatch = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatch) {
      for (const block of jsonLdMatch) {
        try {
          const inner = block.replace(/<script[^>]*>/, "").replace(/<\/script>/, "");
          const jld = JSON.parse(inner);
          const desc = jld?.description ?? jld?.responsibilities ?? "";
          if (desc && desc.length > 100) return stripHtml(desc);
        } catch { /* ignore */ }
      }
    }

    // jobPostingInfo embedded in page JS
    const embeddedMatch = html.match(/"jobDescription"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (embeddedMatch) {
      const desc = embeddedMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
      if (desc.length > 100) return stripHtml(desc);
    }

    // Last resort: jobPostingDescription container (shallow match for SSR content)
    const containerRe = /data-automation-id="jobPostingDescription"[^>]*>([\s\S]{100,8000})/i;
    const containerMatch = html.match(containerRe);
    if (containerMatch) {
      const text = stripHtml(containerMatch[1].split("</section>")[0]);
      if (text.length >= 100) return text;
    }
  } catch { /* ignore */ }

  return "";
}

// ── Public entry point ─────────────────────────────────────────────────────

export async function scrapeWorkday(url: string): Promise<{ jds: ScrapedJD[]; resolvedUrl?: string }> {
  const tenantInfo = await resolveWorkdayEntryPoint(url);
  if (!tenantInfo) return { jds: [] };

  const postings = await fetchWorkdayJobs(tenantInfo.tenant, tenantInfo.jobSite);
  if (postings.length === 0) return { jds: [], resolvedUrl: tenantInfo.resolvedUrl };

  const jds: ScrapedJD[] = [];
  for (const posting of postings) {
    if (!posting.externalPath) continue;
    const rawText = await fetchWorkdayJD(tenantInfo.tenant, tenantInfo.jobSite, posting.externalPath);
    if (!rawText || rawText.length < 100) continue;
    jds.push({
      title:     posting.title,
      rawText,
      sourceUrl: `https://${tenantInfo.tenant}.myworkdayjobs.com${posting.externalPath}`,
    });
  }

  return { jds, resolvedUrl: tenantInfo.resolvedUrl };
}
