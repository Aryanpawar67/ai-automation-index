import { neon } from '@neondatabase/serverless';
import { scrapeAllstateNationalGeneral } from '../src/lib/scrapers/allstateNationalGeneral';
import { isValidJD } from '../src/lib/validation';
import { randomUUID } from 'crypto';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const CAREER_URL = 'https://www.allstate.jobs/job-search-results/?brand%5B%5D=National%20General';

  // ── 1. Upsert company ─────────────────────────────────────────────────────
  const slug        = 'national-general-lender-services';
  const reportToken = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');

  const existing = await sql`SELECT id FROM companies WHERE slug = ${slug}`;
  let companyId: string;

  if (existing.length > 0) {
    companyId = existing[0].id;
    console.log('Company already exists:', companyId);
  } else {
    const [c] = await sql`
      INSERT INTO companies (name, career_page_url, ats_type, scrape_status, slug, report_token)
      VALUES (
        'National General Lender Services',
        ${CAREER_URL},
        'custom',
        'pending',
        ${slug},
        ${reportToken}
      )
      RETURNING id, report_token
    `;
    companyId = c.id;
    console.log('Created company:', companyId);
    console.log('Report token:  ', c.report_token);
  }

  // ── 2. Create batch ───────────────────────────────────────────────────────
  const [batch] = await sql`
    INSERT INTO batches (name, filename, status, uploaded_by, total_pocs, total_jds, processed_jds, failed_jds)
    VALUES (
      'National General Lender Services',
      'national-general.csv',
      'scraping',
      'system',
      1, 0, 0, 0
    )
    RETURNING id
  `;
  const batchId = batch.id;
  console.log('Created batch:', batchId);

  // ── 3. Scrape JDs ─────────────────────────────────────────────────────────
  console.log('\nScraping National General roles (M-Cloud API)…');
  await sql`UPDATE companies SET scrape_status = 'in_progress' WHERE id = ${companyId}`;

  const { jds, totalAvailable } = await scrapeAllstateNationalGeneral();
  console.log(`API returned ${totalAvailable} total hits, scraped ${jds.length} JDs`);

  if (jds.length === 0) {
    await sql`UPDATE companies SET scrape_status = 'failed', scrape_error = 'No JDs returned by scraper' WHERE id = ${companyId}`;
    console.error('No JDs scraped — aborting.');
    process.exit(1);
  }

  // ── 4. Persist JDs ────────────────────────────────────────────────────────
  let scraped = 0, invalid = 0;

  for (const jd of jds) {
    const valid  = isValidJD(jd.title, jd.rawText);
    const status = valid ? 'scraped' : 'invalid';
    if (valid) scraped++; else invalid++;

    await sql`
      INSERT INTO job_descriptions (company_id, batch_id, title, raw_text, source_url, status)
      VALUES (${companyId}, ${batchId}, ${jd.title}, ${jd.rawText}, ${jd.sourceUrl ?? null}, ${status})
    `;
  }

  await sql`
    UPDATE companies
    SET scrape_status = 'complete', total_jobs_available = ${totalAvailable}
    WHERE id = ${companyId}
  `;
  await sql`
    UPDATE batches
    SET status = 'pending', total_jds = ${scraped}
    WHERE id = ${batchId}
  `;

  console.log(`\nDone! Stored ${scraped} valid JDs, ${invalid} invalid.`);
  console.log(`Batch ID:   ${batchId}`);
  console.log(`Company ID: ${companyId}`);
  console.log(`\nNext: open the batch in admin and click "Analyse All →" to queue analysis.`);
  console.log(`URL: /admin/batches/${batchId}`);
}

main().catch(e => { console.error(e); process.exit(1); });
