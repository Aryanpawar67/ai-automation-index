import { neon } from '@neondatabase/serverless';
import { scrapeCareerPage } from '../src/lib/scraper';
import { isValidJD } from '../src/lib/validation';
import { randomUUID } from 'crypto';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const slug = 'optum-workers-comp-auto-no-fault';
  const reportToken = randomUUID().replace(/-/g,'') + randomUUID().replace(/-/g,'');
  const careerUrl = 'https://careers.unitedhealthgroup.com/search-jobs?acm=ALL&alrpm=ALL,6252001-4831725,6252001-4155751,6252001-5549030,6252001-5815135&ascf=%5B%7B%22key%22:%22custom_fields.UHGAJDType%22,%22value%22:%22Optum%22%7D%5D';

  const [c] = await sql`
    INSERT INTO companies (name, career_page_url, ats_type, scrape_status, slug, report_token)
    VALUES ('Optum Workers'' Comp and Auto No-Fault', ${careerUrl}, 'custom', 'in_progress', ${slug}, ${reportToken})
    RETURNING id, report_token
  `;
  const companyId = c.id;
  console.log('Company:', companyId);

  const [batch] = await sql`
    INSERT INTO batches (name, filename, status, uploaded_by, total_pocs, total_jds, processed_jds, failed_jds)
    VALUES ('Optum Workers'' Comp and Auto No-Fault', 'optum-wcaf.csv', 'scraping', 'system', 1, 0, 0, 0)
    RETURNING id
  `;
  const batchId = batch.id;
  console.log('Batch:', batchId);

  console.log('Scraping...');
  const result = await scrapeCareerPage(careerUrl, 'custom');

  if (!result.success) {
    console.error('Failed:', result.error);
    await sql`UPDATE companies SET scrape_status='failed', scrape_error=${result.error} WHERE id=${companyId}`;
    return;
  }

  console.log(`Scraped ${result.jds.length} JDs, totalAvailable=${result.totalAvailable}`);
  console.log('Titles:', result.jds.map(j => j.title));

  let validCount = 0;
  for (const jd of result.jds) {
    const status = isValidJD(jd.title, jd.rawText) ? 'scraped' : 'invalid';
    if (status === 'scraped') validCount++;
    await sql`INSERT INTO job_descriptions (company_id,batch_id,title,raw_text,source_url,department,status)
      VALUES (${companyId},${batchId},${jd.title},${jd.rawText},${jd.sourceUrl??null},${jd.department??null},${status})`;
  }

  const total = Math.max(result.totalAvailable??0, result.jds.length);
  await sql`UPDATE companies SET scrape_status='complete', scraped_at=NOW(), scrape_error=NULL, total_jobs_available=${total} WHERE id=${companyId}`;
  await sql`UPDATE batches SET total_jds=${validCount}, status='complete' WHERE id=${batchId}`;

  console.log(`\nInserted ${result.jds.length} JDs (${validCount} valid)`);
  console.log(`Report: /report/${slug}?token=${c.report_token}`);
  console.log(`companyId: ${companyId} | batchId: ${batchId}`);
}
main().catch(console.error);
