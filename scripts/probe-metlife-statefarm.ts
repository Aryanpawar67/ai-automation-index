/**
 * Probes MetLife and State Farm career pages to identify ATS type and job listing structure.
 * Run: npx tsx scripts/probe-metlife-statefarm.ts
 */

async function probePage(label: string, url: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`${label}: ${url}`);
  console.log("=".repeat(60));

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(20_000),
  });
  console.log("Status:", res.status, res.headers.get("content-type"));
  console.log("Final URL:", res.url);

  const html = await res.text();
  console.log("Page size:", html.length, "chars");

  const signals = [
    ["Phenom People",      /phenom/i],
    ["SAP SuccessFactors", /successfactors|sapsf\.com|jobs2web/i],
    ["Oracle Taleo",       /taleo|careersection/i],
    ["iCIMS",              /icims/i],
    ["Workday",            /workday|myworkdayjobs/i],
    ["SmartRecruiters",    /smartrecruiters/i],
    ["Lever",              /lever\.co/i],
    ["Greenhouse",         /greenhouse/i],
    ["Eightfold",          /eightfold/i],
    ["TeamTailor",         /teamtailor/i],
    ["API endpoint",       /\/api\//i],
  ] as const;

  console.log("\nATS signals:");
  for (const [name, re] of signals) {
    if (re.test(html)) console.log(" ✓", name);
  }

  // Job count mentions
  const countMatches = html.match(/\d+\s*(?:jobs?|positions?|openings?|results?)/gi) ?? [];
  console.log("\nJob count mentions:", countMatches.slice(0, 5));

  // Look for API URLs
  const apiUrls = [...new Set(html.match(/["'`](https?:\/\/[^"'`\s]{10,}(?:api|jobs|search|careers|positions)[^"'`\s]*?)["'`]/gi) ?? [])];
  console.log("\nPotential API URLs (first 10):");
  apiUrls.slice(0, 10).forEach(u => console.log(" ", u.slice(1, -1)));

  // Global JS vars
  const jsVars = html.match(/window\.__[A-Z_a-z]+\s*=\s*[\{\["][^;]{0,300}/g) ?? [];
  if (jsVars.length) {
    console.log("\nGlobal JS config vars:");
    jsVars.slice(0, 5).forEach(m => console.log(" ", m.slice(0, 200)));
  }

  // iframes
  const iframes = html.match(/<iframe[^>]*src=["']([^"']+)["'][^>]*>/gi) ?? [];
  console.log("\nIframes:", iframes.slice(0, 3));

  // Redirect / meta refresh
  const metaRefresh = html.match(/<meta[^>]*refresh[^>]*>/gi) ?? [];
  if (metaRefresh.length) console.log("\nMeta refresh:", metaRefresh);

  // First 2000 chars
  console.log("\n--- First 2000 chars ---");
  console.log(html.slice(0, 2000));
}

async function main() {
  await probePage("MetLife", "https://www.metlifecareers.com/en_US/ml/SearchJobs");
  await probePage("State Farm", "https://jobs.statefarm.com/main/jobs");
}

main().catch(e => { console.error(e); process.exit(1); });
