import { scrapeCareerPage } from "../src/lib/scraper";

(async () => {
  console.log("Probing scrapeCareerPage on Amica...");
  const result = await scrapeCareerPage("https://careers.amica.com/search/jobs");
  if (!result.success) {
    console.log("FAIL:", result.error, "blocked=", result.blocked);
    return;
  }
  console.log("totalAvailable:", result.totalAvailable);
  console.log("jds returned:  ", result.jds.length);
  for (const j of result.jds.slice(0, 5)) {
    console.log(" -", j.title, "|", j.sourceUrl, "| len=", j.rawText.length);
  }
})();
