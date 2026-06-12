import { scrapeAmica } from "../src/lib/scrapers/amica";

(async () => {
  const start = Date.now();
  const { jds, totalAvailable } = await scrapeAmica();
  console.log("elapsed:", ((Date.now() - start) / 1000).toFixed(1) + "s");
  console.log("totalAvailable:", totalAvailable);
  console.log("jds returned:  ", jds.length);
  for (const j of jds.slice(0, 5)) {
    console.log(" -", j.title, "| len=", j.rawText.length);
    console.log("    ", j.sourceUrl);
  }
  console.log("\nlength distribution:", jds.map(j => j.rawText.length));
})();
