import { scrapeWorkday } from "../src/lib/scrapers/workday";

(async () => {
  const url = "https://geico.wd1.myworkdayjobs.com/External";
  const start = Date.now();
  const result = await scrapeWorkday(url);
  console.log("elapsed:", ((Date.now() - start) / 1000).toFixed(1) + "s");
  console.log("totalAvailable:", result.totalAvailable);
  console.log("resolvedUrl:   ", result.resolvedUrl);
  console.log("jds returned:  ", result.jds.length);
  console.log("\n--- title ↔ description match check ---");
  for (const j of result.jds) {
    const titleWords = j.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const descLower  = j.rawText.toLowerCase().slice(0, 1500);
    const matches    = titleWords.filter(w => descLower.includes(w));
    const matchRatio = matches.length / Math.max(titleWords.length, 1);
    console.log(`\n  TITLE: ${j.title}`);
    console.log(`  URL:   ${j.sourceUrl}`);
    console.log(`  LEN:   ${j.rawText.length}`);
    console.log(`  TITLE-WORD-MATCH: ${matches.length}/${titleWords.length} (${(matchRatio*100).toFixed(0)}%)`);
    console.log(`  PREVIEW: ${j.rawText.slice(0, 250).replace(/\s+/g, " ")}`);
  }
})();
