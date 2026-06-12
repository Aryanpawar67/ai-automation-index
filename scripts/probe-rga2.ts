async function main() {
  const url = "https://www.rgarecareers.com/us/en/search-results";
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    signal: AbortSignal.timeout(15_000),
  });
  const html = await res.text();

  // Find all job-like links on the page
  const jobLinks = [...new Set(
    [...html.matchAll(/href="([^"]*\/jobs\/[^"]+)"/gi)].map(m => m[1])
  )];
  console.log("Job links found on page 1:");
  jobLinks.slice(0, 20).forEach(l => console.log(" ", l));

  // Also look for the content API or embedded JSON with jobs
  const phenomApiMatch = html.match(/phenompeople\.com\/api[^"']*/gi) ?? [];
  console.log("\nPhenom API endpoints:", phenomApiMatch.slice(0, 5));

  // Look for client ID / tenant
  const tenantMatch = html.match(/["'](RGORG[A-Z0-9]*|rga[a-z0-9]*)["']/gi) ?? [];
  console.log("Tenant IDs:", [...new Set(tenantMatch)].slice(0, 5));

  // Look for job count in page
  const countMatch = html.match(/(\d+)\s*(?:jobs?|results?|positions?|openings?)/gi) ?? [];
  console.log("Count mentions:", [...new Set(countMatch)].slice(0, 10));

  // Find link rel=next patterns  
  const nextLinks = [...html.matchAll(/href="([^"]*search-results[^"]*from=\d+[^"]*)"/gi)].map(m => m[1]);
  console.log("Pagination links:", [...new Set(nextLinks)].slice(0, 5));
}

main().catch(e => { console.error(e); process.exit(1); });
