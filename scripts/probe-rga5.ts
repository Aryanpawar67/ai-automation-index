async function main() {
  const url = "https://www.rgarecareers.com/us/en/search-results?from=10&s=1";
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    signal: AbortSignal.timeout(15_000),
  });
  const html = await r.text();

  // Find context around first reqId match to see full job object
  const firstReqIdx = html.indexOf('"reqId":"J');
  if (firstReqIdx > -1) {
    // Go back to find enclosing { and print 800 chars
    const start = Math.max(0, firstReqIdx - 200);
    console.log("Job object context (first job on page 2):");
    console.log(html.slice(start, start + 800));
  }

  // Try to build job URL: tenant+reqId pattern
  // Individual job URL: /us/en/jobs/{TENANTJREQIDEXTERNALENUS}/{slug}
  // Or maybe: /us/en/jobs/{reqId}/{slug}
  // Let's look for /jobs/ patterns specifically
  const jobPageLinks = [...html.matchAll(/href="([^"]*\/jobs\/[^"]{5,}?)"/gi)].map(m => m[1]);
  console.log("\n/jobs/ hrefs:", [...new Set(jobPageLinks)].slice(0, 10));

  // Check if there's a "url" or "slug" or "urlSlug" field
  const slugFields = html.match(/"(?:url|slug|urlSlug|jobUrl|applyUrl|detailUrl)"\s*:\s*"([^"]+)"/g) ?? [];
  console.log("\nURL/slug fields:", slugFields.slice(0, 15));
}

main().catch(e => { console.error(e); process.exit(1); });
