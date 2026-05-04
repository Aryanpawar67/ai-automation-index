/**
 * Tier 1 scraper for Eightfold AI ATS career sites
 * (e.g. careers.newyorklife.com, careers.bain.com).
 *
 * Confirmed API pattern (2026-05):
 *   List:   GET /api/apply/v2/jobs?domain={domain}&start=0&num={N}
 *           → { positions: [{ id, name, location, canonicalPositionUrl, ... }],
 *               count: <total tenant-wide> }
 *   Detail: GET /api/apply/v2/jobs/{id}?domain={domain}
 *           → { job_description: <HTML> }   (top-level field)
 *
 * The list endpoint returns positions only (no JD body), so we must fetch the
 * detail endpoint per role. Concurrency-limited to avoid rate-limiting.
 */

import { stripHtml }         from "../stripHtml";
import { targetScrapeCount } from "../jdLimits";
import type { ScrapedJD }    from "../scraper";

const HEADERS = {
  "Accept":      "application/json",
  "User-Agent":  "Mozilla/5.0 (compatible; research-bot/1.0)",
};
const CONCURRENCY = 6;

export interface EightfoldConfig {
  /** Bare host, e.g. "careers.newyorklife.com" */
  host:   string;
  /** Domain id passed to the API as ?domain=. Often the company's email
   *  domain — e.g. newyorklife.com for New York Life. */
  domain: string;
}

interface EightfoldPosition {
  id:                   number;
  name:                 string;
  location?:            string;
  department?:          string;
  business_unit?:       string;
  canonicalPositionUrl?: string;
}

interface EightfoldListResponse {
  positions?: EightfoldPosition[];
  count?:     number;
}

/** Same dedup helper used by phenom/workday/ttcPortals. */
function roleFamilyKey(title: string): string {
  return title
    .toLowerCase()
    .split(/\s*[-–—]+\s*/)[0]
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPage(cfg: EightfoldConfig, start: number): Promise<EightfoldListResponse> {
  try {
    const res = await fetch(
      `https://${cfg.host}/api/apply/v2/jobs?domain=${cfg.domain}&start=${start}&num=10`,
      { headers: HEADERS, signal: AbortSignal.timeout(15_000) }
    );
    if (!res.ok) return {};
    return await res.json() as EightfoldListResponse;
  } catch { return {}; }
}

async function fetchJD(cfg: EightfoldConfig, id: number): Promise<string> {
  try {
    const res = await fetch(
      `https://${cfg.host}/api/apply/v2/jobs/${id}?domain=${cfg.domain}`,
      { headers: HEADERS, signal: AbortSignal.timeout(12_000) }
    );
    if (!res.ok) return "";
    const d = await res.json();
    const html = (d.job_description ?? d.position?.job_description ?? "") as string;
    return stripHtml(html);
  } catch { return ""; }
}

async function mapWithConcurrency<T, R>(
  items: T[], limit: number, fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx]  = await fn(items[idx]);
      }
    }),
  );
  return out;
}

export async function scrapeEightfold(
  cfg: EightfoldConfig,
): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  // Eightfold's /api/apply/v2/jobs caps each call at 10 results regardless
  // of `num=`. Walk pages until we have enough unique role families or run
  // off the end of the listings. 30 pages = 300 raw positions, plenty for
  // tenants up to ~250 jobs after dedup.
  const PAGE      = 10;
  const MAX_PAGES = 30;
  const seen: Set<string> = new Set();
  const deduped: EightfoldPosition[] = [];
  let totalAvailable = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const r = await fetchPage(cfg, page * PAGE);
    if (page === 0) totalAvailable = r.count ?? 0;
    const positions = r.positions ?? [];
    if (positions.length === 0) break;
    for (const p of positions) {
      const key = roleFamilyKey(p.name || "");
      if (!key || seen.has(key)) continue;
      seen.add(key);
      deduped.push(p);
    }
    const target = targetScrapeCount(totalAvailable || deduped.length);
    if (deduped.length >= target) break;
    if (positions.length < PAGE) break;  // last page
  }

  if (deduped.length === 0) return { jds: [], totalAvailable };
  totalAvailable = totalAvailable || deduped.length;

  const keep    = targetScrapeCount(totalAvailable);
  const toFetch = deduped.slice(0, keep);

  const fetched = await mapWithConcurrency(toFetch, CONCURRENCY, async (p) => {
    const rawText = await fetchJD(cfg, p.id);
    if (!rawText || rawText.length < 200) return null;
    return {
      title:      p.name,
      rawText,
      sourceUrl:  p.canonicalPositionUrl ?? `https://${cfg.host}/careers/job/${p.id}`,
      department: p.department ?? p.business_unit,
    } satisfies ScrapedJD;
  });

  const jds = fetched.filter((x): x is NonNullable<typeof x> => x !== null);
  return { jds, totalAvailable };
}
