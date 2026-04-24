/**
 * HTML scraper for SAP SuccessFactors jobs2web deployments on custom domains
 * whose CSB JSON REST API is disabled or session-gated (e.g. PIH —
 * careers.powerholding-intl.com).
 *
 * The public HTML listing at /searchjobs/?p=N exposes:
 *  - 25 jobs per page as <a href="/job/<slug>/<id>/"> links
 *  - Each detail page has a <span itemprop="description"> with the full JD
 *
 * `scrapeJobs2WebHtmlDiverse` paginates until it collects `limit` *role-diverse*
 * titles — i.e. seniority-stripped title roots are unique (so "Lead Procurement
 * Engineer" blocks "Senior Procurement Engineer", but not "Procurement Officer").
 */
import * as cheerio from "cheerio";
import { stripHtml } from "../stripHtml";
import type { ScrapedJD } from "../scraper";

const PAGE_SIZE  = 25;
const MAX_PAGES  = 12;   // 300 titles max — enough to find 15 unique roles
const FETCH_UA   = "Mozilla/5.0 (compatible; research-bot/1.0)";

/** Strip seniority modifiers, parentheticals, and location suffixes from a title. */
export function normalizeRoleTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")                                    // (FWA), (Emirati)
    .replace(/\s+in\s+[a-z][a-z\s,-]+$/i, " ")                   // "... in Dubai"
    .replace(/\s+[-|–—]\s+[a-z][a-z\s,]+$/i, " ")                // "... - Dubai"
    .replace(/\b(sr\.?|senior|jr\.?|junior|lead|principal|staff|chief|deputy|assistant|asst\.?|associate|executive|trainee|intern|graduate|supervisor|managing|head\s+of|mid[- ]?level|entry[- ]?level)\b/gi, " ")
    .replace(/\b(i{1,3}|iv|v)\b/gi, " ")                        // roman numerals I/II/III/IV/V
    .replace(/\b[1-5]\b/g, " ")                                 // level 1-5
    .replace(/[,.&/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface ListingLink {
  url:   string;   // absolute
  title: string;
}

async function fetchListingPage(baseUrl: string, pageNum: number): Promise<ListingLink[]> {
  const url = `${baseUrl.replace(/\/$/, "")}/searchjobs/?p=${pageNum}`;
  const res = await fetch(url, {
    headers: { "User-Agent": FETCH_UA },
    signal:  AbortSignal.timeout(15_000),
  });
  if (!res.ok) return [];
  const html = await res.text();
  const $    = cheerio.load(html);
  const origin = new URL(baseUrl).origin;
  const seen = new Set<string>();
  const links: ListingLink[] = [];
  $("a[href^='/job/']").each((_, el) => {
    const href  = $(el).attr("href") ?? "";
    const match = href.match(/^\/job\/([^/]+)\/(\d+)\/?/);
    if (!match) return;
    const absolute = `${origin}${href}`;
    if (seen.has(absolute)) return;
    seen.add(absolute);
    // Prefer text from nearby <h3>/<span class="jobTitle"> over raw anchor text
    const title = $(el).find(".jobTitle, h3").first().text().trim()
                  || $(el).attr("title")?.trim()
                  || $(el).text().trim()
                  || match[1].replace(/-/g, " ");
    if (title) links.push({ url: absolute, title });
  });
  return links;
}

async function fetchJobDetail(url: string): Promise<{ rawText: string; title: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": FETCH_UA },
      signal:  AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $    = cheerio.load(html);
    // SF deployments wrap the JD in <span itemprop="description">
    const descHtml = $("[itemprop='description']").first().html() ?? "";
    const rawText  = stripHtml(descHtml).replace(/\s{3,}/g, "\n").trim();
    // Title: prefer a microdata itemprop, fallback to <title> minus the suffix
    const titleMicrodata = $("[itemprop='title']").first().text().trim();
    const titleTag       = $("title").text().replace(/\s*(?:Job\s+Details)?\s*[|\-–—].*$/i, "").trim();
    const title = titleMicrodata || titleTag;
    if (rawText.length < 200) return null;
    return { rawText, title: title || "Untitled Position" };
  } catch {
    return null;
  }
}

/**
 * Paginate the SF HTML search listing, pick `limit` role-diverse titles
 * (seniority-normalized), and return full ScrapedJD entries with detail text.
 */
export async function scrapeJobs2WebHtmlDiverse(
  baseUrl: string,
  limit: number,
): Promise<ScrapedJD[]> {
  const picked: ListingLink[] = [];
  const seenRoots = new Set<string>();

  for (let p = 1; p <= MAX_PAGES && picked.length < limit; p++) {
    const links = await fetchListingPage(baseUrl, p);
    if (links.length === 0) break;                              // exhausted listings
    for (const link of links) {
      if (picked.length >= limit) break;
      const root = normalizeRoleTitle(link.title);
      if (!root || seenRoots.has(root)) continue;
      seenRoots.add(root);
      picked.push(link);
    }
    if (links.length < PAGE_SIZE) break;                        // final page
  }

  const jds: ScrapedJD[] = [];
  for (const link of picked) {
    const detail = await fetchJobDetail(link.url);
    if (!detail) continue;
    jds.push({
      title:     link.title,
      rawText:   detail.rawText,
      sourceUrl: link.url,
    });
  }
  return jds;
}
