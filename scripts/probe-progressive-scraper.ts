import { scrapeTTCPortals } from "../src/lib/scrapers/ttcPortals";

(async () => {
  const start = Date.now();
  const { jds, totalAvailable } = await scrapeTTCPortals("https://careers.progressive.com/search/jobs/");
  console.log("elapsed:", ((Date.now() - start) / 1000).toFixed(1) + "s");
  console.log("totalAvailable:", totalAvailable);
  console.log("jds:           ", jds.length);
  for (const j of jds) {
    console.log(" -", j.title, "| len=", j.rawText.length);
  }
  console.log("\nlength dist:", jds.map(j => j.rawText.length));
})();
