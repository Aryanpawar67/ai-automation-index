import { scrapeSAPSuccessFactors } from "../src/lib/scrapers/sapSuccessFactors";

(async () => {
  const url = "https://careers.wipro.com/search/?q=&locationsearch=&searchResultView=LIST";
  const r = await scrapeSAPSuccessFactors(url);
  console.log("totalAvailable:", r.totalAvailable);
  console.log("jds returned:  ", r.jds.length);
  if (r.jds[0]) {
    console.log("first title:    ", r.jds[0].title);
    console.log("first sourceUrl:", r.jds[0].sourceUrl);
    console.log("first rawText length:", r.jds[0].rawText.length);
    console.log("preview:", r.jds[0].rawText.slice(0, 200).replace(/\s+/g, " "));
  }
  console.log("length distribution:", r.jds.map(j => j.rawText.length));
})();
