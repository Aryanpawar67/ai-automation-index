import { neon } from '@neondatabase/serverless';
import { scrapeCareerPage } from '../src/lib/scraper';
import { isValidJD } from '../src/lib/validation';
import { randomUUID } from 'crypto';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const slug = 'excellus-bcbs';
  const reportToken = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');

  // Create company
  const [c] = await sql`
    INSERT INTO companies (name, career_page_url, ats_type, scrape_status, slug, report_token)
    VALUES (
      'Excellus BCBS',
      'https://lthc.wd1.myworkdayjobs.com/ExcellusBCBSCareers',
      'workday',
      'in_progress',
      ${slug},
      ${reportToken}
    )
    ON CONFLICT (slug) DO UPDATE SET scrape_status = 'in_progress'
    RETURNING id, report_token
  `;
  const companyId = c.id;
  console.log('Company:', companyId);

  // Create batch
  const [batch] = await sql`
    INSERT INTO batches (name, filename, status, uploaded_by, total_pocs, total_jds, processed_jds, failed_jds)
    VALUES ('Excellus BCBS', 'excellus-bcbs.csv', 'scraping', 'system', 1, 0, 0, 0)
    RETURNING id
  `;
  const batchId = batch.id;
  console.log('Batch:', batchId);

  // Scrape
  console.log('Scraping...');
  const result = await scrapeCareerPage(
    'https://lthc.wd1.myworkdayjobs.com/ExcellusBCBSCareers',
    'workday'
  );

  if (!result.success) {
    console.error('Scrape failed:', result.error);
    await sql`UPDATE companies SET scrape_status = 'failed', scrape_error = ${result.error} WHERE id = ${companyId}`;
    return;
  }

  console.log(`Scraped ${result.jds.length} JDs, totalAvailable=${result.totalAvailable}`);
  console.log('Titles:', result.jds.map(j => j.title));

  // Clear old JDs
  await sql`DELETE FROM job_descriptions WHERE company_id = ${companyId}`;

  // Insert JDs
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

  // Update company + batch
  const total = Math.max(result.totalAvailable ?? 0, result.jds.length);
  await sql`
    UPDATE companies SET scrape_status = 'complete', scraped_at = NOW(), scrape_error = NULL,
      total_jobs_available = ${total}
    WHERE id = ${companyId}
  `;
  await sql`UPDATE batches SET total_jds = ${validCount}, status = 'complete' WHERE id = ${batchId}`;

  console.log(`\nReport URL: /report/${slug}?token=${c.report_token}`);
  console.log(`companyId: ${companyId} | batchId: ${batchId}`);
}

main().catch(console.error);
