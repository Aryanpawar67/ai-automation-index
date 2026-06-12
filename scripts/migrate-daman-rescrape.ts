/**
 * Splits the contaminated Daman Health record into two separate reports.
 *
 * Before: company "Daman Health" (d99477bc-…) had 20 analyses — 10 from the
 * April special-batch run, 10 from the May rescrape batch. The report page
 * aggregated all 20 under one URL.
 *
 * After:
 *   • Old entry (slug "daman-health") keeps the 10 April analyses.
 *   • New entry (slug "daman-health-may-2026", fresh report_token) owns the
 *     10 May analyses + their JDs + the rescrape batch + its POC.
 *
 * Idempotent: re-running detects existing "daman-health-may-2026" and exits.
 *
 * Run: npx tsx --env-file=.env.local scripts/migrate-daman-rescrape.ts
 */
import { neon }        from "@neondatabase/serverless";
import { randomBytes } from "crypto";

const sql = neon(process.env.DATABASE_URL!);

const OLD_CID    = "d99477bc-9b43-45ca-91ee-2ce3c6f26c49";
const BATCH_ID   = "e758165c-3ed8-4ff2-affe-69ece337c46b";  // May rescrape batch to migrate
const NEW_SLUG   = "daman-health-may-2026";
const NEW_NAME   = "Daman Health";
const ORACLE_URL = "https://erel.fa.em8.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs";

async function main() {
  const existing = await sql`SELECT id FROM companies WHERE slug = ${NEW_SLUG}`;
  if (existing.length > 0) {
    console.error(`Aborting: slug "${NEW_SLUG}" already exists as company ${existing[0].id}.`);
    process.exit(1);
  }

  // Snapshot what we're about to move.
  const jds = await sql`SELECT id, title FROM job_descriptions WHERE batch_id = ${BATCH_ID} AND company_id = ${OLD_CID}`;
  const analyses = await sql`
    SELECT a.id, j.title
    FROM analyses a
    JOIN job_descriptions j ON a.job_description_id = j.id
    WHERE a.company_id = ${OLD_CID} AND j.batch_id = ${BATCH_ID}
  `;
  console.log(`Will migrate: ${jds.length} JDs, ${analyses.length} analyses, batch ${BATCH_ID}`);

  if (jds.length === 0) { console.error("No JDs found for batch — aborting."); process.exit(1); }

  const token = randomBytes(32).toString("hex");

  // 1. Create the new company row. totalJobsAvailable matches analysis count so the
  //    "Complete coverage" hero strip lights up on the new report.
  const [newCo] = await sql`
    INSERT INTO companies (name, career_page_url, scrape_status, ats_type, slug, report_token, total_jobs_available)
    VALUES (${NEW_NAME}, ${ORACLE_URL}, 'complete', 'oracle_hcm', ${NEW_SLUG}, ${token}, ${analyses.length})
    RETURNING id
  `;
  const newCid = newCo.id as string;
  console.log(`Created new company ${newCid} (slug ${NEW_SLUG})`);

  // 2. Reassign JDs, analyses, POCs to the new company.
  await sql`UPDATE job_descriptions SET company_id = ${newCid} WHERE batch_id = ${BATCH_ID} AND company_id = ${OLD_CID}`;
  await sql`
    UPDATE analyses SET company_id = ${newCid}
    WHERE company_id = ${OLD_CID}
      AND job_description_id IN (SELECT id FROM job_descriptions WHERE batch_id = ${BATCH_ID})
  `;
  await sql`UPDATE pocs SET company_id = ${newCid} WHERE batch_id = ${BATCH_ID} AND company_id = ${OLD_CID}`;

  // 3. Flip the migrated batch to 'complete' so the admin view shows it as a finished run.
  await sql`UPDATE batches SET status = 'complete' WHERE id = ${BATCH_ID}`;

  // 4. Make sure the original entry's scrape_status is back to 'complete'.
  await sql`UPDATE companies SET scrape_status = 'complete', scrape_error = null WHERE id = ${OLD_CID}`;

  // Verify counts.
  const oldCount = await sql`SELECT COUNT(*)::int AS n FROM analyses WHERE company_id = ${OLD_CID}`;
  const newCount = await sql`SELECT COUNT(*)::int AS n FROM analyses WHERE company_id = ${newCid}`;
  console.log(`\nAfter migration:`);
  console.log(`  old Daman (${OLD_CID.slice(0,8)}): ${(oldCount[0] as { n: number }).n} analyses`);
  console.log(`  new Daman (${newCid.slice(0,8)}): ${(newCount[0] as { n: number }).n} analyses`);
  console.log(`\nReport URLs:`);
  console.log(`  Old (April): http://localhost:3003/report/daman-health?token=<original_token>`);
  console.log(`  New (May):   http://localhost:3003/report/${NEW_SLUG}?token=${token}`);
}

main().catch(e => { console.error(e); process.exit(1); });
