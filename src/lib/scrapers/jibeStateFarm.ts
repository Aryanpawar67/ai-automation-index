import { scrapeJibe }  from "./jibe";
import type { ScrapedJD } from "../scraper";

// State Farm (jobs.statefarm.com) is on Jibe — see ./jibe.ts.

export function scrapeJibeStateFarm(): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  return scrapeJibe({
    base:       "https://jobs.statefarm.com",
    detailPath: "/main/jobs/{slug}/job",
    listQuery:  "brand=State%20Farm",
  });
}
