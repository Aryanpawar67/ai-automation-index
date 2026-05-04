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
import { LARGE_SCRAPE, targetScrapeCount } from "../jdLimits";

export interface WorkdayTenant {
  tenant:       string;
  jobSite:      string;
  host:         string;  // full hostname e.g. comcast.wd5.myworkdayjobs.com
  resolvedUrl?: string;  // populated when URL was resolved from a landing page
}

// ── URL extraction helpers ─────────────────────────────────────────────────

/** Extract tenant + jobSite from a direct Workday-hosted URL. */
export function extractWorkdayTenant(url: string): WorkdayTenant | null {
  // 1. company.wd5.myworkdayjobs.com/[locale/]JobSite[/...]
  //    company.myworkdayjobs.com/[locale/]JobSite[/...]
  const jobs = url.match(
    /https?:\/\/([^.]+\.((?:wd\d+\.)?myworkdayjobs\.com))\/(?:[a-z]{2}-[A-Z]{2}\/)?([^/?#\s]+)/
  );
  if (jobs) return { tenant: jobs[1].split(".")[0], host: jobs[1], jobSite: jobs[3] };

  // 2. wd5.myworkdaysite.com/[locale/]recruiting/<tenant>/<jobSite>[/...]
  //    Workday hosted-careers domain — same CxS API at /wday/cxs/<tenant>/<jobSite>/jobs
  const site = url.match(
    /https?:\/\/(wd\d+\.myworkdaysite\.com)\/(?:[a-z]{2}-[A-Z]{2}\/)?recruiting\/([a-z0-9_-]+)\/([a-z0-9_-]+)/i
  );
  if (site) return { tenant: site[2], host: site[1], jobSite: site[3] };

  return null;
}

/** Extract Workday config from page HTML (custom domain). */
export function extractTenantFromHtml(html: string, pageUrl?: string): WorkdayTenant | null {
  // Fast path: if pageUrl is itself a Workday hosted-careers URL, try parsing it directly
  if (pageUrl) {
    const direct = extractWorkdayTenant(pageUrl);
    if (direct) return direct;
  }

  // Determine if the pageUrl host is a Workday hosted-careers domain (wdN.myworkdaysite.com
  // or wdN.myworkdayjobs.com). When true we preserve that host instead of rewriting to
  // ${tenant}.myworkdayjobs.com, because the CxS API lives at the same host.
  let pageUrlHost: string | undefined;
  if (pageUrl) {
    try {
      const hostname = new URL(pageUrl).hostname;
      if (/^wd\d+\.(myworkdaysite|myworkdayjobs)\.com$/i.test(hostname)) {
        pageUrlHost = hostname;
      }
    } catch { /* ignore invalid URLs */ }
  }

  // 1. <script id="wd-app"> JSON blob
  const jsonMatch = html.match(/<script[^>]+id="wd-app"[^>]*>([\s\S]*?)<\/script>/i);
  if (jsonMatch) {
    try {
      const cfg = JSON.parse(jsonMatch[1]);
      if (cfg.tenant && cfg.jobSite) return { tenant: cfg.tenant, host: pageUrlHost ?? `${cfg.tenant}.myworkdayjobs.com`, jobSite: cfg.jobSite };
    } catch { /* ignore */ }
  }

  // 2. CxS API URL embedded in page scripts/network calls — most reliable signal
  const cxsMatch = html.match(/\/wday\/cxs\/([a-z0-9_-]+)\/([a-z0-9_-]+)\/jobs/i);
  if (cxsMatch) return { tenant: cxsMatch[1], host: pageUrlHost ?? `${cxsMatch[1]}.myworkdayjobs.com`, jobSite: cxsMatch[2] };

  // 3. Direct myworkdayjobs.com URL in any href/src/script — capture full host with wd shard
  const wdLinkMatch = html.match(
    /https?:\/\/([a-z0-9-]+\.((?:wd\d+\.)?myworkdayjobs\.com))\/(?:[a-z]{2}-[A-Z]{2}\/)?([a-z0-9_-]+)/i
  );
  if (wdLinkMatch) {
    const baseUrl = wdLinkMatch[0].split(/\/login|\/apply|\/signin/i)[0];
    const tenant  = wdLinkMatch[1].split(".")[0];
    return { tenant, host: wdLinkMatch[1], jobSite: wdLinkMatch[3], resolvedUrl: baseUrl };
  }

  // 4. window.__WD_CONFIG__ = {...}
  const cfgMatch = html.match(/window\.__WD_CONFIG__\s*=\s*(\{[^}]+\})/);
  if (cfgMatch) {
    try {
      const cfg = JSON.parse(cfgMatch[1]);
      if (cfg.tenant && cfg.jobSite) return { tenant: cfg.tenant, host: pageUrlHost ?? `${cfg.tenant}.myworkdayjobs.com`, jobSite: cfg.jobSite };
    } catch { /* ignore */ }
  }

  // 5. "tenant":"...", "jobSite":"..." anywhere in inline scripts
  const scriptMatch = html.match(
    /["']tenant["']\s*:\s*["']([^"']+)["'][\s\S]{0,300}["']jobSite["']\s*:\s*["']([^"']+)["']/i
  );
  if (scriptMatch) return { tenant: scriptMatch[1], host: pageUrlHost ?? `${scriptMatch[1]}.myworkdayjobs.com`, jobSite: scriptMatch[2] };

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
  const fromHtml = extractTenantFromHtml(html, url);
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
      if (wdDirect) {
        const cleanUrl = abs.split(/\/login|\/apply|\/signin/i)[0];
        return { ...wdDirect, resolvedUrl: cleanUrl };
      }

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

      const fromHop = extractTenantFromHtml(hopHtml, res.url ?? candidate);
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

/**
 * Reduces a job title to a "role family" key for cross-listing dedup.
 * Workday tenants (e.g. Progressive, large insurers) often post the same role
 * many times with city/specialty appended after a dash:
 *   "Claims Adjuster Senior - Litigation"  → "claims adjuster senior"
 *   "Claims Adjuster Senior - Injury"      → "claims adjuster senior"
 * Strips everything after the first " - " or " -- ", lowercases, and collapses
 * whitespace. Conservative — distinct families ("Auto Damage Claims Adjuster"
 * vs "Field Claims Adjuster") stay separate.
 */
function roleFamilyKey(title: string): string {
  // Split on any dash with optional surrounding whitespace — covers both
  // "Claims Adjuster - Senior" (TTC style) and "Licensed Insurance Agent-Houston
  // West" (Kemper style, no space before the dash). Conservative still, because
  // we only drop the tail after the FIRST dash, so "Claims Adjuster Senior"
  // (no dash) stays intact.
  return title
    .toLowerCase()
    .split(/\s*[-–—]+\s*/)[0]
    .replace(/\s+/g, " ")
    .trim();
}

/** POST to Workday CxS jobs search API. Walks pages until we have enough
 *  unique role families (or hit end of listings).
 *
 *  Tenants like Kemper (492 postings, ~5 unique families per 20-row page) need
 *  many pages to fill the LARGE_SCRAPE budget after dedup; without pagination
 *  we'd report just 5 JDs from a 492-job site.
 *
 *  Some tenants (e.g. geico.wd1) reject this POST with 500 unless the request
 *  includes browser-style Origin + Referer headers — Workday's CSRF check
 *  treats requests without them as cross-site. The detail GET is unaffected. */
async function fetchWorkdayJobs(
  host: string, tenant: string, jobSite: string
): Promise<{ postings: WorkdayPosting[]; total: number }> {
  const siteUrl  = `https://${host}/${jobSite}`;
  const PAGE     = 20;     // Workday CxS hard cap per request
  const MAX_PAGES = 8;     // covers up to 160 raw postings per scrape
  const headers  = {
    "Content-Type":    "application/json",
    "Accept":          "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin":          `https://${host}`,
    "Referer":         siteUrl,
    "User-Agent":      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36",
  };

  const seen: Set<string> = new Set();
  const deduped: WorkdayPosting[] = [];
  let total = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    try {
      const res = await fetch(`https://${host}/wday/cxs/${tenant}/${jobSite}/jobs`, {
        method:  "POST",
        headers,
        body:    JSON.stringify({ appliedFacets: {}, limit: PAGE, offset: page * PAGE, searchText: "" }),
        signal:  AbortSignal.timeout(12_000),
      });
      if (!res.ok) break;
      const data = await res.json();
      const postings = (data.jobPostings ?? []) as WorkdayPosting[];
      if (page === 0) {
        // Max-with-floor: some tenants return `total: 0` while still returning postings.
        total = Math.max(
          typeof data.total === "number" ? data.total : 0,
          typeof data.totalJobPostings === "number" ? data.totalJobPostings : 0,
          postings.length,
        );
      }
      if (postings.length === 0) break;

      for (const p of postings) {
        const key = roleFamilyKey(p.title || "");
        if (!key || seen.has(key)) continue;
        seen.add(key);
        deduped.push(p);
      }

      const target = targetScrapeCount(total || deduped.length);
      if (deduped.length >= target) break;
      if (postings.length < PAGE) break;  // hit end of listings
    } catch { break; }
  }

  if (deduped.length === 0) return { postings: [], total: 0 };
  total = total || deduped.length;
  const keep = targetScrapeCount(total);
  return { postings: deduped.slice(0, keep), total };
}

/**
 * Fetch individual JD via Workday CxS JSON detail endpoint.
 * URL: GET /wday/cxs/{tenant}/{jobSite}{externalPath}
 * Returns jobPostingInfo.jobDescription (HTML) + jobRequirements + bulletFields.
 *
 * Falls back to HTML page scraping if API returns no description.
 */
async function fetchWorkdayJD(
  host: string,
  tenant: string,
  jobSite: string,
  externalPath: string
): Promise<string> {
  // Primary: CxS JSON detail API
  try {
    const apiUrl = `https://${host}/wday/cxs/${tenant}/${jobSite}${externalPath}`;
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
    const pageUrl = `https://${host}${externalPath}`;
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

/**
 * Fetches `url` as HTML and tries to extract a Workday tenant config from it.
 * Preserves the actual request host when the page is itself Workday-hosted.
 * Used by the adaptive fallback in scraper.ts after garbage-output detection.
 */
export async function findWorkdayConfigOnPage(url: string): Promise<WorkdayTenant | null> {
  // Fast path: direct Workday URL needs no fetch
  const direct = extractWorkdayTenant(url);
  if (direct) return direct;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    return extractTenantFromHtml(html, res.url ?? url);
  } catch {
    return null;
  }
}

// ── Public entry point ─────────────────────────────────────────────────────

export async function scrapeWorkday(url: string, preResolved?: WorkdayTenant): Promise<{ jds: ScrapedJD[]; resolvedUrl?: string; totalAvailable?: number }> {
  const tenantInfo = preResolved ?? await resolveWorkdayEntryPoint(url);
  if (!tenantInfo) return { jds: [] };

  const { host, tenant, jobSite } = tenantInfo;
  const { postings, total } = await fetchWorkdayJobs(host, tenant, jobSite);
  if (postings.length === 0) return { jds: [], resolvedUrl: tenantInfo.resolvedUrl };

  const jds: ScrapedJD[] = [];
  for (const posting of postings) {
    if (!posting.externalPath) continue;
    const rawText = await fetchWorkdayJD(host, tenant, jobSite, posting.externalPath);
    if (!rawText || rawText.length < 100) continue;
    jds.push({
      title:     posting.title,
      rawText,
      sourceUrl: host.endsWith("myworkdaysite.com")
        ? `https://${host}/en-US/recruiting/${tenant}/${jobSite}${posting.externalPath}`
        : `https://${host}/${jobSite}${posting.externalPath}`,
    });
  }

  // Floor totalAvailable on the JD count we actually produced so a tenant
  // returning `total: 0` never erases a populated list downstream.
  const totalAvailable = Math.max(total, jds.length);
  return { jds, resolvedUrl: tenantInfo.resolvedUrl, totalAvailable };
}
