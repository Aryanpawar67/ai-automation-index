import { scrapeWorkday } from "../src/lib/scrapers/workday";

async function main() {
  console.log("Testing Workday scraper for rgare.wd1.myworkdayjobs.com/Careers ...");
  const result = await scrapeWorkday("https://rgare.wd1.myworkdayjobs.com/Careers");
  console.log("Total available:", result.totalAvailable);
  console.log("JDs returned:", result.jds.length);
  console.log("Resolved URL:", result.resolvedUrl);
  result.jds.slice(0, 5).forEach((j, i) => console.log(`  [${i+1}] ${j.title}`));
}

main().catch(e => { console.error(e); process.exit(1); });
