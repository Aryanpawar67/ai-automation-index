import { stripHtml }        from "../stripHtml";
import { targetScrapeCount } from "../jdLimits";
import type { ScrapedJD }    from "../scraper";

interface SRPosting {
  id:         string;
  name:       string;
  postingUrl?: string;
  department?: { label?: string };
}

interface SRDetail {
  postingUrl?: string;
  jobAd?: {
    sections?: {
      companyDescription?:    { text?: string };
      jobDescription?:        { text?: string };
      qualifications?:        { text?: string };
      additionalInformation?: { text?: string };
    };
  };
}

/** Extract the SmartRecruiters company identifier from a careers URL.
 *  e.g. https://careers.smartrecruiters.com/trupanion1 → "trupanion1" */
export function extractSmartRecruitersSlug(url: string): string | null {
  const m = url.match(/smartrecruiters\.com\/([a-zA-Z0-9_-]+)/i);
  return m?.[1] ?? null;
}

/**
 * Reduces a SmartRecruiters job title to a "role family" key for dedup.
 * Large tenants (e.g. Etihad Airways, 77 postings) repeat the same role across
 * many locations and seniority bands:
 *   "Duty Supervisor - PVG"                 → "duty supervisor"
 *   "Duty Supervisor - PKX"                 → "duty supervisor"
 *   "Sales Representative - Philippines"    → "sales representative"
 *   "Senior Cabin Crew"                     → "cabin crew"
 *   "Cabin Crew II"                         → "cabin crew"
 * Drops everything after the first dash, strips standalone seniority modifiers
 * and trailing level markers (I/II/III/IV/V, 1–5), then lowercases + collapses
 * whitespace. Conservative: distinct families ("Cargo Operations Officer" vs
 * "Airport Operations Officer") still stay separate.
 */
export function roleFamilyKey(title: string): string {
  const seniority = /^(senior|sr\.?|junior|jr\.?|lead|principal|staff|associate|head of|chief|deputy)\s+/i;
  const trailingLevel = /\s+(senior|sr\.?|junior|jr\.?|lead|principal|staff|associate|i{1,3}v?|iv|v|[1-5])$/i;

  let key = title
    .toLowerCase()
    .split(/\s*[-–—]+\s*/)[0]
    .replace(/\s+/g, " ")
    .trim();

  // Strip seniority repeatedly — handles "Senior Lead Engineer" → "engineer".
  while (seniority.test(key)) key = key.replace(seniority, "").trim();
  while (trailingLevel.test(key)) key = key.replace(trailingLevel, "").trim();

  return key;
}

export async function scrapeSmartRecruiters(
  url: string
): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  const slug = extractSmartRecruitersSlug(url);
  if (!slug) return { jds: [], totalAvailable: 0 };

  const listRes = await fetch(
    `https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=100`,
    { signal: AbortSignal.timeout(10_000) }
  );
  if (!listRes.ok) return { jds: [], totalAvailable: 0 };

  const list = await listRes.json() as { totalFound?: number; content?: SRPosting[] };
  const all  = list.content ?? [];
  const totalAvailable = list.totalFound ?? all.length;
  const keep = targetScrapeCount(totalAvailable);

  // Dedup by role family — drop near-duplicates that only differ by location
  // or seniority band (common on large SR tenants like Etihad Airways).
  const seen: Set<string> = new Set();
  const deduped: SRPosting[] = [];
  for (const p of all) {
    const key = roleFamilyKey(p.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(p);
    if (deduped.length >= keep) break;
  }

  const jds: ScrapedJD[] = [];

  for (const posting of deduped) {
    try {
      const detailRes = await fetch(
        `https://api.smartrecruiters.com/v1/companies/${slug}/postings/${posting.id}`,
        { signal: AbortSignal.timeout(8_000) }
      );
      if (!detailRes.ok) continue;

      const detail = await detailRes.json() as SRDetail;
      const secs   = detail.jobAd?.sections ?? {};

      const rawText = [
        secs.companyDescription?.text,
        secs.jobDescription?.text,
        secs.qualifications?.text,
        secs.additionalInformation?.text,
      ]
        .filter(Boolean)
        .map(t => stripHtml(t!))
        .join("\n\n")
        .slice(0, 8000);

      if (!rawText) continue;

      jds.push({
        title:      posting.name,
        rawText,
        sourceUrl:  detail.postingUrl ?? posting.postingUrl,
        department: posting.department?.label,
      });
    } catch { /* skip failed individual JD */ }
  }

  return { jds, totalAvailable };
}
