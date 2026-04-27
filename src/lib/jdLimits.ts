// Shared tiering for how many roles we scrape per company and how many we
// actually send through analysis. Companies with a large career site (>100 open
// roles) get a bigger scrape + analysis pool so the resulting report covers
// enough breadth; small sites stay at the current 15/10 split.

export const SMALL_SCRAPE    = 15;
export const LARGE_SCRAPE    = 20;
export const SMALL_ANALYSE   = 10;
export const LARGE_ANALYSE   = 15;
export const LARGE_THRESHOLD = 100;

export function targetScrapeCount(totalAvailable: number | null | undefined): number {
  return (totalAvailable ?? 0) > LARGE_THRESHOLD ? LARGE_SCRAPE : SMALL_SCRAPE;
}

export function targetAnalyseCount(totalAvailable: number | null | undefined): number {
  return (totalAvailable ?? 0) > LARGE_THRESHOLD ? LARGE_ANALYSE : SMALL_ANALYSE;
}
