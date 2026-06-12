async function fetchPage(from: number) {
  const url = from === 0
    ? "https://www.rgarecareers.com/us/en/search-results"
    : `https://www.rgarecareers.com/us/en/search-results?from=${from}&s=1`;

  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    signal: AbortSignal.timeout(15_000),
  });
  return r.text();
}

async function main() {
  const html = await fetchPage(10); // page 2

  // Find all JSON objects containing "title" and some job URL
  // Look for tenant+job ID patterns
  const jobIdMatches = [...new Set([...html.matchAll(/RGORGOUSJ(\d+)EXTERNALENUS/g)].map(m => m[0]))];
  console.log("Job IDs on page 2:", jobIdMatches.slice(0, 10));

  // Find job URL patterns
  const jobUrlMatches = [...new Set([...html.matchAll(/["'](\/us\/en\/jobs\/[^"']+)["']/g)].map(m => m[1]))];
  console.log("Job URL paths:", jobUrlMatches.slice(0, 10));

  // Find the full JSON blob containing job listings (look for array of job objects)
  // Try to find window.__PRELOADED_DATA__ or similar
  const preloadMatches = html.match(/(?:__PRELOADED|__INITIAL|__NEXT|preloaded[A-Z])[^=]*=\s*({.{100,5000}?})\s*;/g) ?? [];
  console.log("\nPreloaded data vars:", preloadMatches.length);

  // Extract a chunk around "Chief Marketing Officer" to see the surrounding JSON structure
  const cmoIdx = html.indexOf('"Chief Marketing Officer"');
  if (cmoIdx > -1) {
    console.log("\nContext around 'Chief Marketing Officer':");
    console.log(html.slice(Math.max(0, cmoIdx - 300), cmoIdx + 300));
  }

  // Also look for reqId or jobId fields
  const reqIdCtx = html.match(/"(?:reqId|jobId|requisitionId|externalJobId|id)"\s*:\s*"([^"]+)"/g) ?? [];
  console.log("\nreqId/jobId fields (first 10):", reqIdCtx.slice(0, 10));
}

main().catch(e => { console.error(e); process.exit(1); });
