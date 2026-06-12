async function main() {
  const tenant = "RGORGOUS";

  // Try Phenom People CaaS content API (common pattern)
  const endpoints = [
    `https://content-us.phenompeople.com/api/content-delivery/caasContentV1/content?tenantId=${tenant}&locale=en_us&publishedDate=all&type=job&size=20&from=0`,
    `https://content-us.phenompeople.com/api/content-delivery/caasContentV1/jobs?tenantId=${tenant}&locale=en_us&size=20`,
    `https://www.rgarecareers.com/api/jobs?locale=en_us&size=20`,
    `https://content-us.phenompeople.com/api/content-delivery/caasContentV1/content?tenantId=${tenant}&type=job&size=10`,
  ];

  for (const ep of endpoints) {
    try {
      const r = await fetch(ep, {
        headers: {
          "Accept": "application/json",
          "Origin": "https://www.rgarecareers.com",
          "Referer": "https://www.rgarecareers.com/",
        },
        signal: AbortSignal.timeout(10_000),
      });
      const text = await r.text();
      console.log(`\n${ep}`);
      console.log(`  Status: ${r.status}, Content-Type: ${r.headers.get("content-type")}`);
      console.log(`  Body (first 400): ${text.slice(0, 400)}`);
    } catch(e) {
      console.log(`\n${ep} → ERROR: ${e}`);
    }
  }

  // Also try fetching page 2 via pagination to see if it's SSR
  const page2 = await fetch("https://www.rgarecareers.com/us/en/search-results?from=10&s=1", {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    signal: AbortSignal.timeout(10_000),
  });
  const p2html = await page2.text();
  const jobLinks2 = [...new Set([...p2html.matchAll(/href="([^"]*\/jobs\/[^"]+)"/gi)].map(m => m[1]))];
  console.log("\n\nPage 2 job links:", jobLinks2.slice(0, 10));

  // Look for job title patterns in page 2
  const titleMatches = p2html.match(/"title"\s*:\s*"([^"]+)"/g) ?? [];
  console.log("Title JSON fields:", titleMatches.slice(0, 10));

  // Look for job data embedded in script tags
  const scriptDataMatch = p2html.match(/window\.__INITIAL_STATE__\s*=\s*({.{0,2000}})/);
  if (scriptDataMatch) console.log("Initial state:", scriptDataMatch[1].slice(0, 500));
}

main().catch(e => { console.error(e); process.exit(1); });
