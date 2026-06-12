import { scrapeSAPSuccessFactors } from "../src/lib/scrapers/sapSuccessFactors";

(async () => {
  // Try the custom-domain URL first
  console.log("--- via careers.aflac.com (custom domain) ---");
  const a = await scrapeSAPSuccessFactors("https://careers.aflac.com/go/View-All-Jobs/8697400/");
  console.log("totalAvailable:", a.totalAvailable, "jds:", a.jds.length);

  // Then try the canonical jobs2web tenant directly
  console.log("\n--- via aflac.jobs2web.com (canonical) ---");
  const b = await scrapeSAPSuccessFactors("https://aflac.jobs2web.com/");
  console.log("totalAvailable:", b.totalAvailable, "jds:", b.jds.length);
  for (const j of b.jds.slice(0, 5)) {
    console.log(" -", j.title, "| len=", j.rawText.length, "|", j.sourceUrl);
  }
})();
