import * as cheerio from "cheerio";
import { stripHtml }              from "./stripHtml";
import { scrapeWorkday, findWorkdayConfigOnPage } from "./scrapers/workday";
import { scrapeOracleHCM, scrapeOracleTaleo } from "./scrapers/oracleHcm";
import { scrapeSAPSuccessFactors } from "./scrapers/sapSuccessFactors";
import { scrapeSmartRecruiters }  from "./scrapers/smartRecruiters";
import { scrapeICIMS }            from "./scrapers/icims";
import { extractTeamtailorLinks, scrapeTeamtailorFromLinks } from "./scrapers/teamtailor";
import { scrapeJibeStateFarm }     from "./scrapers/jibeStateFarm";
import { scrapeAvatureMetLife }    from "./scrapers/avatureMetLife";
import { scrapeGlobeLife }         from "./scrapers/globeLife";
import { scrapeUHGOptum }          from "./scrapers/uhgOptum";
import { scrapeAllstateNationalGeneral } from "./scrapers/allstateNationalGeneral";
import { scrapeAxaUs }                  from "./scrapers/axaUs";
import { targetScrapeCount }       from "./jdLimits";

export interface ScrapedJD {
  title:      string;
  rawText:    string;
  sourceUrl?: string;
  department?: string;
}

export type ScrapeResult =
  | { success: true;  jds: ScrapedJD[]; resolvedUrl?: string; totalAvailable?: number }
  | { success: false; error: string; blocked: boolean };

const NAV_TITLE_RE = /^(skip to\b.*|search( for jobs)?|filters?|jobs page (is )?loaded|view (all )?jobs?|all jobs?|jump to|menu|home|login|sign[- ]?in|apply now|next page|previous page|.*[-_]banner$|banner)$/i;

function looksLikeListingNoise(jds: ScrapedJD[]): boolean {
  if (jds.some(j => NAV_TITLE_RE.test(j.title.trim()))) return true;
  // Noise signal: all JDs point to the same sourceUrl (nav anchors / fallback entries)
  const uniqueUrls = new Set(jds.map(j => j.sourceUrl ?? ""));
  if (jds.length >= 2 && uniqueUrls.size === 1) return true;
  return false;
}

// ── Tier 1: Known ATS public APIs ─────────────────────────────────────────────

// Map of companies that use Greenhouse behind a custom domain (no greenhouse.io in URL).
// Key: regex to match the career page URL. Value: Greenhouse board slug.
const CUSTOM_GREENHOUSE_BOARDS: Array<[RegExp, string]> = [
  [/stripe\.com\/jobs/i, "stripe"],
];

function detectATS(url: string): { ats: string; boardSlug?: string } | null {
  if (/greenhouse\.io/i.test(url))       return { ats: "greenhouse" };
  if (/lever\.co/i.test(url))            return { ats: "lever" };
  if (/smartrecruiters\.com/i.test(url)) return { ats: "smartrecruiters" };
  if (/teamtailor\.com/i.test(url))      return { ats: "teamtailor" };
  if (/workable\.com/i.test(url))        return { ats: "workable" };

  for (const [re, slug] of CUSTOM_GREENHOUSE_BOARDS) {
    if (re.test(url)) return { ats: "greenhouse", boardSlug: slug };
  }
  return null;
}

// Sites known to be JS-rendered SPAs — skip Tier 2, route straight to Tier 3
// Note: stripe.com/jobs excluded — individual listing pages are server-side rendered
const SPA_JOB_SITES = [
  /amazon\.jobs/i,
  /careers\.google\.com/i,
  /jobs\.netflix\.com/i,
  /meta\.com\/careers/i,
  /careers\.microsoft\.com/i,
  /workday\.com/i,
  /myworkdaysite\.com/i,
  /myworkdayjobs\.com/i,
  /smartrecruiters\.com/i,
  /teamtailor\.com/i,
  /icims\.com/i,
  /taleo\.net/i,
  /successfactors/i,
  /sapsf\.com/i,
];

function isSPAJobSite(url: string): boolean {
  return SPA_JOB_SITES.some(re => re.test(url));
}

/** Detect Taleo ATS on custom domains by characteristic URL patterns. */
function isTaleoCustomDomain(url: string): boolean {
  return /createNewAlert=false|\/careersection\//i.test(url);
}

// Non-job marketing content paths — exclude these even if they contain job keywords
const NON_JOB_PATH =
  /\/(about|leadership|blog|news|press|investors?|team|culture|life|values|benefits|faq|login|signup|register|privacy|terms|contact|sitemap|resources|guides|docs|support|help|diversity|inclusion)\b/i;

async function scrapeGreenhouse(url: string, boardSlug?: string): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  const slug = boardSlug ?? url.match(/greenhouse\.io\/([^/?#]+)/i)?.[1];
  if (!slug) return { jds: [], totalAvailable: 0 };
  const res = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`,
    { signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) return { jds: [], totalAvailable: 0 };
  const data = await res.json() as { jobs?: Array<{ title: string; content: string; absolute_url: string; departments?: Array<{ name: string }> }> };
  const all = data.jobs ?? [];
  const totalAvailable = all.length;
  const keep = targetScrapeCount(totalAvailable);
  // Deduplicate by normalised title — Greenhouse often posts the same role multiple times
  const seenTitles = new Set<string>();
  const unique = all.filter(j => {
    const key = j.title.trim().toLowerCase();
    if (seenTitles.has(key)) return false;
    seenTitles.add(key);
    return true;
  });
  const jds = unique.slice(0, keep).map(j => ({
    title:      j.title,
    rawText:    stripHtml(j.content ?? j.title),
    sourceUrl:  j.absolute_url,
    department: j.departments?.[0]?.name,
  }));
  return { jds, totalAvailable };
}

async function scrapeLever(url: string): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  const match = url.match(/lever\.co\/([^/?#]+)/i);
  if (!match) return { jds: [], totalAvailable: 0 };
  const company = match[1];
  // Fetch up to 100 so `data.length` is a credible "total" for tier decisions.
  const res     = await fetch(
    `https://api.lever.co/v0/postings/${company}?mode=json&limit=100`,
    { signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) return { jds: [], totalAvailable: 0 };
  const data = await res.json() as Array<{ text: string; descriptionPlain: string; hostedUrl: string; categories?: { team?: string } }>;
  const all = Array.isArray(data) ? data : [];
  const totalAvailable = all.length;
  const keep = targetScrapeCount(totalAvailable);
  const jds = all.slice(0, keep).map(j => ({
    title:      j.text,
    rawText:    stripHtml(j.descriptionPlain ?? j.text),
    sourceUrl:  j.hostedUrl,
    department: j.categories?.team,
  }));
  return { jds, totalAvailable };
}

// ── Tier 2: Static HTML scraping with cheerio ─────────────────────────────────

// Returns true if the page body looks like an actual job description
function looksLikeJobContent(text: string): boolean {
  const lower     = text.toLowerCase();
  const wordCount = lower.split(/\s+/).filter(Boolean).length;
  const hits = [
    // English
    /\bresponsibilit/, /\brequirement/, /\bqualification/,
    /\bwe (are|re) (looking|hiring|seeking)/, /\byou (will|ll|should|must)/,
    /\bexperience (with|in)/, /\bskills?\b/, /\bbenefits?\b/, /\bsalary\b/,
    /\bcompensation\b/, /\bapply\b/,
    // French
    /\bresponsabilit/, /\bcompétences?\b/, /\bexpérience\b/, /\bmissions?\b/,
    // German
    /\baufgaben\b/, /\bkenntnisse\b/, /\berfahrung\b/, /\banforderungen\b/,
    // Spanish / Portuguese
    /\bresponsabilidades\b/, /\brequisitos\b/, /\bhabilidades\b/,
    // Dutch / Italian
    /\bvacature\b/, /\bresponsabilità\b/, /\brequisiti\b/,
  ].filter(re => re.test(lower)).length;

  if (hits >= 2) return true;
  // Non-English fallback: non-ASCII chars (Cyrillic, accented, CJK) in a reasonably long text
  if (wordCount >= 80 && /[^\x00-\x7F]/.test(text)) return true;
  // Very long structured text with no known-language signals
  if (wordCount >= 200) return true;
  return false;
}

// Extract the best available title from a JD page
function extractTitle($jd: ReturnType<typeof cheerio.load>): string {
  // Try specific job-title selectors first
  const candidates = [
    $jd("[class*='job-title'],[class*='jobtitle'],[class*='position-title'],[class*='role-title']").first().text().trim(),
    $jd("h1").first().text().trim(),
    $jd("h2").first().text().trim(),
    // <title> tag minus site-name suffix (e.g. "Software Engineer | Stripe")
    $jd("title").text().replace(/\s*[|\-–—].*$/, "").trim(),
  ];
  return candidates.find(t => t.length > 3 && t.length < 120) ?? "Untitled Position";
}

async function scrapeStatic(url: string): Promise<ScrapedJD[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];

  const html = await res.text();
  const $    = cheerio.load(html);

  // Minimum path depth for a link to be considered an individual job listing.
  // Must be strictly deeper than the source career page URL — this filters out
  // locale-prefixed hub pages like /in/jobs, /au/jobs that appear in nav/footer
  // of sites like stripe.com/jobs/search (depth=2 → require depth≥3).
  const sourceDepth = new URL(url).pathname.split("/").filter(Boolean).length;
  const minLinkDepth = Math.max(2, sourceDepth + 1);

  // Collect job-like links — exclude marketing paths and shallow hub pages
  const seen     = new Set<string>();
  const jobLinks: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const text = $(el).text().toLowerCase();
    if (/job|career|position|opening|vacancy|role/.test(href + text)) {
      if (NON_JOB_PATH.test(href)) return;
      try {
        const absolute = href.startsWith("http") ? href : new URL(href, url).href;
        // Skip shallow hub/category pages (localized variants, section indexes)
        const linkDepth = new URL(absolute).pathname.split("/").filter(Boolean).length;
        if (linkDepth < minLinkDepth) return;
        if (!seen.has(absolute)) { seen.add(absolute); jobLinks.push(absolute); }
      } catch { /* invalid url, skip */ }
    }
  });

  // Sort deeper/more-specific paths first so the best candidates fill the 10 slots
  jobLinks.sort((a, b) => {
    const da = new URL(a).pathname.split("/").filter(Boolean).length;
    const db = new URL(b).pathname.split("/").filter(Boolean).length;
    return db - da;
  });

  const jds: ScrapedJD[] = [];
  for (const link of jobLinks.slice(0, 15)) {
    try {
      const jdRes = await fetch(link, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)" },
        signal: AbortSignal.timeout(8_000),
      });
      if (!jdRes.ok) continue;
      const jdHtml = await jdRes.text();
      const $jd    = cheerio.load(jdHtml);
      $jd("script,style,nav,footer,header").remove();
      const rawText = $jd("body").text().replace(/\s{3,}/g, "\n").trim().slice(0, 8000);
      const title   = extractTitle($jd);
      // Require min length AND content that looks like an actual job description
      if (rawText.length > 300 && looksLikeJobContent(rawText)) {
        jds.push({ title, rawText, sourceUrl: link });
      }
    } catch { /* skip failed individual JD */ }
  }
  return jds;
}

// ── Tier 3: Firecrawl (handles JS-rendered pages) ────────────────────────────

async function scrapeFirecrawl(url: string): Promise<{ jds: ScrapedJD[]; rawHtml: string }> {
  if (!process.env.FIRECRAWL_API_KEY) return { jds: [], rawHtml: "" };
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        url,
        formats: ["markdown", "rawHtml"],
        waitFor: 6000,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return { jds: [], rawHtml: "" };
    const data = await res.json() as { success?: boolean; data?: { markdown?: string; rawHtml?: string; metadata?: { title?: string } } };
    const markdown = data?.data?.markdown ?? "";
    const rawHtml  = data?.data?.rawHtml  ?? "";
    if (!markdown || markdown.length < 100) return { jds: [], rawHtml };

    // Extract individual job links from markdown
    const jobLinkRegex = /\[([^\]]{5,120})\]\((https?:\/\/[^\)]+(?:job|career|requisition|req_id|jobReqId|career_job_req_id)[^\)]*)\)/gi;
    const seen = new Set<string>();
    const jds: ScrapedJD[] = [];
    let match: RegExpExecArray | null;

    while ((match = jobLinkRegex.exec(markdown)) !== null) {
      const title  = match[1].trim();
      const jobUrl = match[2].trim();
      if (NAV_TITLE_RE.test(title)) continue;
      if (seen.has(jobUrl)) continue;
      seen.add(jobUrl);
      jds.push({ title, rawText: markdown.slice(0, 8000), sourceUrl: jobUrl });
      if (jds.length >= 10) break;
    }

    // Fallback: treat the whole page as one entry
    if (jds.length === 0) {
      const isListingPage = /\b\d+\s+JOBS\s+FOUND\b/i.test(markdown) &&
        (markdown.match(/###\s+\[/g) ?? []).length >= 3;
      if (!isListingPage) {
        jds.push({
          title:     data?.data?.metadata?.title ?? "Job Listing",
          rawText:   markdown.slice(0, 8000),
          sourceUrl: url,
        });
      }
    }

    return { jds, rawHtml };
  } catch {
    return { jds: [], rawHtml: "" };
  }
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function scrapeCareerPage(url: string, atsType?: string | null): Promise<ScrapeResult> {
  try {
    // Tier 0 — custom scrapers for sites with known-incompatible generic paths
    if (/jobs\.statefarm\.com/i.test(url)) {
      const { jds, totalAvailable } = await scrapeJibeStateFarm();
      if (jds.length > 0) return { success: true, jds, totalAvailable };
    }
    if (/metlifecareers\.com/i.test(url)) {
      const { jds, totalAvailable } = await scrapeAvatureMetLife();
      if (jds.length > 0) return { success: true, jds, totalAvailable };
    }
    if (/careers\.globelifeinsurance\.com/i.test(url)) {
      const { jds, totalAvailable } = await scrapeGlobeLife();
      if (jds.length > 0) return { success: true, jds, totalAvailable };
    }
    if (/careers\.unitedhealthgroup\.com\/search-jobs/i.test(url)) {
      const { jds, totalAvailable } = await scrapeUHGOptum();
      if (jds.length > 0) return { success: true, jds, totalAvailable };
    }
    if (/allstate\.jobs.*brand.*National[\s%+]General/i.test(url)) {
      const { jds, totalAvailable } = await scrapeAllstateNationalGeneral();
      if (jds.length > 0) return { success: true, jds, totalAvailable };
    }
    if (/jobs\.azblue\.com/i.test(url)) {
      const result = await scrapeWorkday(url, {
        tenant: "bcbsaz",
        jobSite: "BCBSAZCareers",
        host: "bcbsaz.wd1.myworkdayjobs.com",
      });
      if (result.jds.length > 0) return { success: true, jds: result.jds, totalAvailable: result.totalAvailable };
    }
    if (/careers\.axa\.com/i.test(url)) {
      const { jds, totalAvailable } = await scrapeAxaUs();
      if (jds.length > 0) return { success: true, jds, totalAvailable };
    }

    // Tier 1a — known ATS APIs (direct Greenhouse/Lever/SmartRecruiters or custom-domain companies)
    const detected = detectATS(url);
    if (detected?.ats === "greenhouse") {
      const { jds, totalAvailable } = await scrapeGreenhouse(url, detected.boardSlug);
      if (jds.length > 0) return { success: true, jds, totalAvailable: Math.max(totalAvailable, jds.length) };
    }
    if (detected?.ats === "lever") {
      const { jds, totalAvailable } = await scrapeLever(url);
      if (jds.length > 0) return { success: true, jds, totalAvailable: Math.max(totalAvailable, jds.length) };
    }
    if (detected?.ats === "smartrecruiters") {
      const { jds, totalAvailable } = await scrapeSmartRecruiters(url);
      if (jds.length > 0) return { success: true, jds, totalAvailable: Math.max(totalAvailable, jds.length) };
    }

    // Tier 1b — enterprise HCM platforms (atsType from companies table takes priority over URL detection)
    if (atsType === "workday" || /myworkdayjobs\.com|myworkdaysite\.com/i.test(url)) {
      const result = await scrapeWorkday(url);
      if (result.jds.length > 0) return { success: true, jds: result.jds, resolvedUrl: result.resolvedUrl, totalAvailable: result.totalAvailable };
    }
    if (atsType === "oracle_hcm" || /\.fa\.[a-z0-9-]+\.oraclecloud\.com/i.test(url)) {
      const { jds, totalAvailable } = await scrapeOracleHCM(url);
      if (jds.length > 0) return { success: true, jds, totalAvailable };
    }
    if (atsType === "oracle_taleo" || /taleo\.net/i.test(url) || isTaleoCustomDomain(url)) {
      const jds = await scrapeOracleTaleo(url);
      if (jds.length > 0) return { success: true, jds, totalAvailable: jds.length };
    }
    if (atsType === "sap_sf" || /\.jobs2web\.com|successfactors\.com|sapsf\.com/i.test(url)) {
      const result = await scrapeSAPSuccessFactors(url);
      if (result.jds.length > 0) return {
        success: true,
        jds: result.jds,
        totalAvailable: Math.max(result.totalAvailable ?? 0, result.jds.length),
      };
    }
    if (atsType === "icims" || /icims\.com/i.test(url)) {
      const { jds, totalAvailable } = await scrapeICIMS(url);
      if (jds.length > 0) return { success: true, jds, totalAvailable: Math.max(totalAvailable, jds.length) };
    }

    // Tier 2 — static HTML (skip for known JS-rendered SPAs)
    if (!isSPAJobSite(url)) {
      const staticJds = await scrapeStatic(url);
      if (staticJds.length > 0) return { success: true, jds: staticJds, totalAvailable: staticJds.length };
    }

    // Tier 3 — Firecrawl for JS-rendered pages
    const { jds: firecrawlJds, rawHtml } = await scrapeFirecrawl(url);

    // Teamtailor detection: custom domains (e.g. makers.lemonade.com) embed /recipe/ links in HTML
    if (rawHtml) {
      const recipeLinks = extractTeamtailorLinks(rawHtml, url);
      if (recipeLinks.length >= 3) {
        const { jds, totalAvailable } = await scrapeTeamtailorFromLinks(recipeLinks);
        if (jds.length > 0) return { success: true, jds, totalAvailable };
      }
    }

    if (firecrawlJds.length > 0) {
      if (looksLikeListingNoise(firecrawlJds)) {
        const wd = await findWorkdayConfigOnPage(url);
        if (wd) {
          const retry = await scrapeWorkday(url, wd);
          if (retry.jds.length > 0 && !looksLikeListingNoise(retry.jds)) {
            return { success: true, jds: retry.jds, resolvedUrl: retry.resolvedUrl, totalAvailable: retry.totalAvailable };
          }
        }
        return { success: false, error: "Scraped content looks like listing-page noise; no JDs extracted.", blocked: false };
      }
      return { success: true, jds: firecrawlJds, totalAvailable: firecrawlJds.length };
    }

    return { success: false, error: "No job listings found on this page.", blocked: false };
  } catch (err: unknown) {
    const msg     = err instanceof Error ? err.message : String(err);
    const blocked = /403|401|forbidden|blocked|ECONNREFUSED/i.test(msg);
    return { success: false, error: msg, blocked };
  }
}
