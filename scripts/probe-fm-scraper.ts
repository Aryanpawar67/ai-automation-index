import { scrapeJibe } from "../src/lib/scrapers/jibe";

(async () => {
  const start = Date.now();
  const { jds, totalAvailable } = await scrapeJibe({
    base:       "https://careers.fm.com",
    detailPath: "/careers-home/jobs/{slug}/job",
  });
  console.log("elapsed:", ((Date.now() - start) / 1000).toFixed(1) + "s");
  console.log("totalAvailable:", totalAvailable);
  console.log("jds returned:  ", jds.length);
  for (const j of jds) {
    console.log(" -", j.title, `[${j.department ?? "?"}]`, "len=", j.rawText.length);
  }
})();
