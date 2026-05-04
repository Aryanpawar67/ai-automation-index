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

  const jds: ScrapedJD[] = [];

  for (const posting of all.slice(0, keep)) {
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
