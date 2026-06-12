import { scrapeAxaUs } from '../src/lib/scrapers/axaUs';

async function main() {
  console.log("Testing AXA US scraper...");
  const { jds, totalAvailable } = await scrapeAxaUs();
  console.log(`Found ${jds.length} US jobs (total available: ${totalAvailable})`);
  for (const jd of jds.slice(0, 3)) {
    console.log(`\n--- ${jd.title} ---`);
    console.log(`URL: ${jd.sourceUrl}`);
    console.log(`Text preview: ${jd.rawText.slice(0, 200)}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
