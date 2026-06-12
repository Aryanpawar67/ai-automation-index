import { scrapePhenom } from "../src/lib/scrapers/phenom";

(async () => {
  const { jds, totalAvailable } = await scrapePhenom({
    host:   "careers.fiserv.com",
    refNum: "FFFYJUS",
  });
  console.log("totalAvailable:", totalAvailable);
  console.log("jds returned:", jds.length);
  if (jds[0]) {
    console.log("first title:    ", jds[0].title);
    console.log("first sourceUrl:", jds[0].sourceUrl);
    console.log("first dept:     ", jds[0].department);
    console.log("first rawText length:", jds[0].rawText.length);
    console.log("preview:", jds[0].rawText.slice(0, 200).replace(/\s+/g, " "));
  }
  console.log("\nlength distribution:", jds.map(j => j.rawText.length));
})();
