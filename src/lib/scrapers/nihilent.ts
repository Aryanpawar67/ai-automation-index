import * as cheerio from "cheerio";
import type { ScrapedJD } from "../scraper";

// Nihilent (nihilent.com/job-openings) publishes openings on a server-rendered
// WordPress page as Bootstrap accordion panels:
//   panel:  .commonacc-panelwrp
//   title:  h4.panel-title  (inside the accordion header link)
//   body:   .panel-body.commonacc-panelbody  (Designation / Location / Experience /
//           About the Job Opening)
// The same role can appear under more than one location tab, so dedupe by title.

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120";

export async function scrapeNihilent(url: string): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  let html: string;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return { jds: [], totalAvailable: 0 };
    html = await res.text();
  } catch { return { jds: [], totalAvailable: 0 }; }

  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const jds: ScrapedJD[] = [];

  $(".commonacc-panelwrp").each((_, el) => {
    const $el   = $(el);
    const title = $el.find("h4.panel-title").first().text().replace(/\s+/g, " ").trim();
    if (!title) return;
    const key = title.toLowerCase();
    if (seen.has(key)) return;

    const rawText = $el.find(".panel-body").first().text().replace(/\s+/g, " ").trim();
    if (rawText.length < 80) return;

    seen.add(key);
    jds.push({ title, rawText: rawText.slice(0, 12_000), sourceUrl: url });
  });

  return { jds, totalAvailable: jds.length };
}
