import { targetScrapeCount } from "../jdLimits";
import type { ScrapedJD }    from "../scraper";

/** Extract all unique /recipe/ job URLs from raw HTML of a Teamtailor listing page. */
export function extractTeamtailorLinks(rawHtml: string, baseUrl: string): string[] {
  const origin = (() => { try { return new URL(baseUrl).origin; } catch { return ""; } })();
  const seen   = new Set<string>();
  const links: string[] = [];

  for (const m of rawHtml.matchAll(/https?:\/\/[a-z0-9.-]+\/recipe\/[a-z0-9-]+/gi)) {
    const url = m[0];
    if (!seen.has(url)) { seen.add(url); links.push(url); }
  }
  // Relative paths (unlikely but handle just in case)
  if (origin) {
    for (const m of rawHtml.matchAll(/href=["']?(\/recipe\/[a-z0-9-]+)/gi)) {
      const url = `${origin}${m[1]}`;
      if (!seen.has(url)) { seen.add(url); links.push(url); }
    }
  }

  return links;
}

/** Firecrawl a single URL and return its markdown. */
async function firecrawlMarkdown(url: string): Promise<string> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return "";
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body:    JSON.stringify({ url, formats: ["markdown"], waitFor: 5000 }),
      signal:  AbortSignal.timeout(40_000),
    });
    if (!res.ok) return "";
    const data = await res.json() as { data?: { markdown?: string } };
    return data?.data?.markdown ?? "";
  } catch { return ""; }
}

/**
 * Given a list of /recipe/ job page URLs already extracted from the listing page,
 * fetch each via Firecrawl and return ScrapedJDs.
 */
export async function scrapeTeamtailorFromLinks(
  recipeLinks: string[]
): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  const totalAvailable = recipeLinks.length;
  const keep           = targetScrapeCount(totalAvailable);
  const jds: ScrapedJD[] = [];

  for (const jobUrl of recipeLinks.slice(0, keep)) {
    const markdown = await firecrawlMarkdown(jobUrl);
    if (!markdown || markdown.length < 200) continue;

    // Extract title from the first H1 in the markdown
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    const title      = titleMatch?.[1]?.trim() ?? "Untitled Position";

    jds.push({ title, rawText: markdown.slice(0, 8000), sourceUrl: jobUrl });
  }

  return { jds, totalAvailable };
}
