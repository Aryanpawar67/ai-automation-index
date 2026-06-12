import { neon } from '@neondatabase/serverless';
import { scrapeCareerPage } from '../src/lib/scraper';
import { isValidJD } from '../src/lib/validation';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const frpId = 'db4ce886-c735-4551-9a20-ac4870f7ef84';
  
  // Step 1: Fix ats_type to "greenhouse"
  await sql`UPDATE companies SET ats_type = 'greenhouse' WHERE id = ${frpId}`;
  console.log('Fixed ats_type to greenhouse');
  
  // Step 2: Create a batch for FRP
  const [batch] = await sql`
    INSERT INTO batches (name, filename, status, uploaded_by, total_pocs, total_jds, processed_jds, failed_jds)
    VALUES ('Foundation Risk Partners', 'foundation-risk-partners.csv', 'scraping', 'system', 1, 0, 0, 0)
    RETURNING id
  `;
  const batchId = batch.id;
  console.log('Created batch:', batchId);
  
  // Step 3: Scrape
  console.log('Scraping FRP...');
  const result = await scrapeCareerPage(
    'https://job-boards.greenhouse.io/foundationriskpartners',
    'greenhouse'
  );
  
  if (!result.success) {
    console.error('Scrape failed:', result.error);
    return;
  }
  
  console.log(`Scraped ${result.jds.length} JDs, totalAvailable=${result.totalAvailable}`);
  
  // Step 4: Delete any existing JDs for FRP
  const deleted = await sql`DELETE FROM job_descriptions WHERE company_id = ${frpId} RETURNING id`;
  console.log(`Deleted ${deleted.length} existing JDs`);
  
  // Step 5: Insert new JDs
  let validCount = 0;
  for (const jd of result.jds) {
    const status = isValidJD(jd.title, jd.rawText) ? 'scraped' : 'invalid';
    if (status === 'scraped') validCount++;
    await sql`
      INSERT INTO job_descriptions (company_id, batch_id, title, raw_text, source_url, department, status)
      VALUES (${frpId}, ${batchId}, ${jd.title}, ${jd.rawText}, ${jd.sourceUrl ?? null}, ${jd.department ?? null}, ${status})
    `;
  }
  console.log(`Inserted ${result.jds.length} JDs (${validCount} valid)`);
  
  // Step 6: Update batch totalJds
  await sql`UPDATE batches SET total_jds = ${validCount}, status = 'complete' WHERE id = ${batchId}`;
  
  // Step 7: Update company
  const total = Math.max(result.totalAvailable ?? 0, result.jds.length);
  await sql`
    UPDATE companies SET 
      scrape_status = 'complete', 
      scraped_at = NOW(),
      scrape_error = NULL,
      total_jobs_available = ${total}
    WHERE id = ${frpId}
  `;
  console.log(`Updated company: total_jobs_available=${total}`);
  
  // Verify
  const verify = await sql`SELECT COUNT(*) AS cnt FROM job_descriptions WHERE company_id = ${frpId}`;
  console.log(`Verification: ${verify[0].cnt} JDs in DB`);
  const titles = await sql`SELECT title, status FROM job_descriptions WHERE company_id = ${frpId} ORDER BY title`;
  console.log('JDs:', titles.map(j => `${j.title} [${j.status}]`));
}

main().catch(console.error);
