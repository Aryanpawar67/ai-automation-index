import { neon } from '@neondatabase/serverless';
import { scrapeUHGOptum } from '../src/lib/scrapers/uhgOptum';
import { isValidJD } from '../src/lib/validation';
import { inngest } from '../src/inngest/client';

const sql = neon(process.env.DATABASE_URL!);
const companyId = 'ee5519fa-7f6d-4fb9-ab8b-a881e3f870d6';
const batchId = '5d5c99ca-a1cb-41be-821b-c33f31413bb2';

async function main() {
  console.log('Scraping...');
  const result = await scrapeUHGOptum();
  console.log(`Scraped ${result.jds.length} JDs, totalAvailable=${result.totalAvailable}`);
  console.log('Titles:', result.jds.map(j => j.title));

  // Clear existing JDs and reinsert
  await sql`DELETE FROM job_descriptions WHERE company_id=${companyId}`;

  let validCount = 0;
  for (const jd of result.jds) {
    const status = isValidJD(jd.title, jd.rawText) ? 'scraped' : 'invalid';
    if (status === 'scraped') validCount++;
    await sql`INSERT INTO job_descriptions (company_id,batch_id,title,raw_text,source_url,status)
      VALUES (${companyId},${batchId},${jd.title},${jd.rawText},${jd.sourceUrl??null},${status})`;
  }
  console.log(`Inserted ${result.jds.length} JDs (${validCount} valid)`);

  // Queue 15 for analysis, keep 5 as reserve
  const scraped = await sql`SELECT id,title FROM job_descriptions WHERE company_id=${companyId} AND status='scraped' ORDER BY created_at ASC`;
  const toQueue = scraped.slice(0, 15);
  const reserve = scraped.slice(15);

  for (const jd of toQueue) await sql`UPDATE job_descriptions SET status='pending' WHERE id=${jd.id}`;
  await inngest.send(toQueue.map(jd => ({ name: 'jd/analyze' as const, data: { jobDescriptionId: jd.id, batchId } })));

  await sql`UPDATE companies SET total_jobs_available=${result.totalAvailable} WHERE id=${companyId}`;
  await sql`UPDATE batches SET total_jds=${toQueue.length} WHERE id=${batchId}`;

  console.log(`\nQueued ${toQueue.length} for analysis, ${reserve.length} reserve`);
  console.log('Reserve:', reserve.map(j => j.title));
}
main().catch(console.error);
