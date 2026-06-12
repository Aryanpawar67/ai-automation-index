/**
 * Probes rgarecareers.com to identify ATS type and pagination API.
 */
async function main() {
  const url = "https://www.rgarecareers.com/us/en/search-results";
  console.log("Fetching career page...");

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    signal: AbortSignal.timeout(15_000),
  });
  console.log("Status:", res.status, res.headers.get("content-type"));

  const html = await res.text();
  console.log("Page size:", html.length, "chars");

  // Look for ATS signals
  const signals = [
    ["Phenom People", /phenom/i],
    ["SAP SuccessFactors", /successfactors|sapsf\.com|jobs2web/i],
    ["Oracle Taleo", /taleo|careersection/i],
    ["iCIMS", /icims/i],
    ["Workday", /workday|myworkdayjobs/i],
    ["SmartRecruiters", /smartrecruiters/i],
    ["Lever", /lever\.co/i],
    ["Greenhouse", /greenhouse/i],
    ["API endpoint", /\/api\//i],
  ] as const;

  console.log("\nATS signals found:");
  for (const [name, re] of signals) {
    if (re.test(html)) console.log(" ✓", name);
  }

  // Look for JSON config / embedded data
  const jsonMatches = html.match(/window\.__[A-Z_]+\s*=\s*\{[^;]{0,500}/g) ?? [];
  if (jsonMatches.length) {
    console.log("\nGlobal JS config vars:");
    jsonMatches.slice(0, 5).forEach(m => console.log(" ", m.slice(0, 200)));
  }

  // Look for API URLs in the HTML
  const apiUrls = [...new Set(html.match(/["'](https?:\/\/[^"']*(?:api|jobs|search|careers)[^"']*?)["']/gi) ?? [])];
  console.log("\nPotential API URLs:");
  apiUrls.slice(0, 10).forEach(u => console.log(" ", u));

  // Find any data-* attributes with job info
  const dataAttrs = html.match(/data-(?:job|position|req)[^=]*="[^"]*"/gi) ?? [];
  console.log("\nJob-related data attributes (first 5):");
  dataAttrs.slice(0, 5).forEach(d => console.log(" ", d));

  // Print first 2000 chars of HTML for context
  console.log("\n--- First 1500 chars of HTML ---");
  console.log(html.slice(0, 1500));
}

main().catch(e => { console.error(e); process.exit(1); });
