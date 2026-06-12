import { neon } from '@neondatabase/serverless';
import { scrapeCareerPage } from '../src/lib/scraper';
import { isValidJD } from '../src/lib/validation';
import { randomUUID } from 'crypto';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // Step 1: Create Globe Life company
  const slug = 'globe-life';
  const reportToken = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
  
  const existing = await sql`SELECT id FROM companies WHERE name = 'Globe Life'`;
  let companyId: string;
  
  if (existing.length > 0) {
    companyId = existing[0].id;
    console.log('Company already exists:', companyId);
  } else {
    const [c] = await sql`
      INSERT INTO companies (name, career_page_url, ats_type, scrape_status, slug, report_token)
      VALUES ('Globe Life', 'https://careers.globelifeinsurance.com/jobs/jobs-by-category', 'custom', 'pending', ${slug}, ${reportToken})
      RETURNING id, report_token
    `;
    companyId = c.id;
    console.log('Created company:', companyId);
    console.log('Report token:', c.report_token);
  }
  
  // Step 2: Create batch
  const [batch] = await sql`
    INSERT INTO batches (name, filename, status, uploaded_by, total_pocs, total_jds, processed_jds, failed_jds)
    VALUES ('Globe Life', 'globe-life.csv', 'scraping', 'system', 1, 0, 0, 0)
    RETURNING id
  `;
  const batchId = batch.id;
  console.log('Created batch:', batchId);
  
  // Step 3: Update scrape status
  await sql`UPDATE companies SET scrape_status = 'in_progress' WHERE id = ${companyId}`;
  
  // Step 4: Scrape
  console.log('Scraping Globe Life...');
  const result = await scrapeCareerPage(
    'https://careers.globelifeinsurance.com/jobs/jobs-by-category',
    'custom'
  );
  
  if (!result.success) {
    console.error('Scrape failed:', result.error);
    await sql`UPDATE companies SET scrape_status = 'failed', scrape_error = ${result.error} WHERE id = ${companyId}`;
    return;
  }
  
  console.log(`Scraped ${result.jds.length} JDs, totalAvailable=${result.totalAvailable}`);
  console.log('Titles:', result.jds.map(j => j.title));
  
  // Step 5: Clear any old JDs
  await sql`DELETE FROM job_descriptions WHERE company_id = ${companyId}`;
  
  // Step 6: Insert JDs
  let validCount = 0;
  for (const jd of result.jds) {
    const status = isValidJD(jd.title, jd.rawText) ? 'scraped' : 'invalid';
    if (status === 'scraped') validCount++;
    await sql`
      INSERT INTO job_descriptions (company_id, batch_id, title, raw_text, source_url, department, status)
      VALUES (${companyId}, ${batchId}, ${jd.title}, ${jd.rawText}, ${jd.sourceUrl ?? null}, ${jd.department ?? null}, ${status})
    `;
  }
  console.log(`Inserted ${result.jds.length} JDs (${validCount} valid)`);
  
  // Step 7: Update company and batch
  const total = Math.max(result.totalAvailable ?? 0, result.jds.length);
  await sql`
    UPDATE companies SET
      scrape_status = 'complete', scraped_at = NOW(), scrape_error = NULL,
      total_jobs_available = ${total}
    WHERE id = ${companyId}
  `;
  await sql`UPDATE batches SET total_jds = ${validCount}, status = 'complete' WHERE id = ${batchId}`;
  
  // Report URL
  const [co] = await sql`SELECT slug, report_token FROM companies WHERE id = ${companyId}`;
  console.log(`\nReport URL: /report/${co.slug}?token=${co.report_token}`);
  console.log(`companyId: ${companyId}`);
  console.log(`batchId: ${batchId}`);
}

main().catch(console.error);
