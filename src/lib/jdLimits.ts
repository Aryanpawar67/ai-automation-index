// Shared tiering for how many roles we scrape per company and how many we
// actually send through analysis. Companies with 50+ open roles get 20 scraped
// (15 for the report + 5 reserve); smaller sites get 15 scraped / 10 analysed.

export const SMALL_SCRAPE    = 15;
export const LARGE_SCRAPE    = 20;
export const SMALL_ANALYSE   = 10;
export const LARGE_ANALYSE   = 15;
export const LARGE_THRESHOLD = 50;

export function targetScrapeCount(totalAvailable: number | null | undefined): number {
  return (totalAvailable ?? 0) > LARGE_THRESHOLD ? LARGE_SCRAPE : SMALL_SCRAPE;
}

export function targetAnalyseCount(totalAvailable: number | null | undefined): number {
  return (totalAvailable ?? 0) > LARGE_THRESHOLD ? LARGE_ANALYSE : SMALL_ANALYSE;
}
