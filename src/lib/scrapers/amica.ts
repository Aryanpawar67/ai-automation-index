import { scrapeTTCPortals } from "./ttcPortals";
import type { ScrapedJD }    from "../scraper";

// Amica Insurance is on TTC Portals — see ./ttcPortals.ts for platform details.

export function scrapeAmica(): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  return scrapeTTCPortals("https://careers.amica.com/search/jobs");
}
