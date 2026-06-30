import * as cheerio from "cheerio";
import { targetScrapeCount } from "../jdLimits";
import type { ScrapedJD }    from "../scraper";

// Datamatics (www.datamatics.com/human-resources/job-openings) — a HubSpot CMS
// page that server-renders every opening inline. Roles are grouped into location
// tabs (Mumbai / Bengaluru / Gurugram / Nashik / USA / UK); each tab is a
// `div[id].tab-group` containing `.accordion-item`s whose `.accordion-title`
// holds the role + experience and whose `.accordion-body` holds the full JD
// (responsibilities, qualifications, etc.) as an inline table. No API/JS needed.

const URL = "https://www.datamatics.com/human-resources/job-openings";
const UA  = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36";

// tab-group div id → human-readable location label
const LOCATION_BY_ID: Record<string, string> = {
  mumbai:    "Mumbai",
  bengaluru: "Bengaluru",
  gurugram:  "Gurugram",
  ns:        "Nashik",
  usa:       "USA",
  uk:        "UK",
};

export async function scrapeDatamatics(): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  const res = await fetch(URL, {
    headers: { "User-Agent": UA },
    signal:  AbortSignal.timeout(20_000),
  });
  if (!res.ok) return { jds: [], totalAvailable: 0 };

  const $ = cheerio.load(await res.text());

  // Collect every opening with its location, deduping by title (a role can be
  // listed under more than one tab markup wrapper).
  const seen: Set<string> = new Set();
  const all: ScrapedJD[]  = [];

  for (const [id, location] of Object.entries(LOCATION_BY_ID)) {
    const section = $(`#${id}.tab-group`).first();
    if (!section.length) continue;

    section.find(".accordion-item").each((_, el) => {
      const item  = $(el);
      const title = item.find(".accordion-title").first().text().replace(/\s+/g, " ").trim();
      if (!title) return;

      const body = item.find(".accordion-body").first()
        .text()
        .replace(/ /g, " ")
        .replace(/[ \t]+/g, " ")
        .replace(/\n\s*\n\s*\n+/g, "\n\n")
        .trim();
      if (body.length < 80) return;

      const key = `${location}::${title}`.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);

      all.push({
        title,
        rawText:    `Location: ${location}\n\n${body}`.slice(0, 12_000),
        sourceUrl:  URL,
        department: location,
      });
    });
  }

  const totalAvailable = all.length;
  const keep           = targetScrapeCount(totalAvailable);
  return { jds: all.slice(0, keep), totalAvailable };
}
