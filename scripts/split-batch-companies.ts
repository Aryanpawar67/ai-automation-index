/**
 * Moves Lemonade and Trupanion out of the shared "Insurance Campaign" batch
 * into their own individual batches. Existing JDs, analyses, and report URLs
 * are fully preserved — only batch_id FKs are repointed.
 *
 * Run: npx tsx --env-file=.env.local scripts/split-batch-companies.ts
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

const SOURCE_BATCH_ID = "ac535979-c910-4982-81d2-b802976ae46f";
const COMPANIES_TO_SPLIT = ["Lemonade", "Trupanion"];

async function main() {
  // 1. Verify source batch exists
  const [sourceBatch] = await sql`
    SELECT id, name, status FROM batches WHERE id = ${SOURCE_BATCH_ID} LIMIT 1
  `;
  if (!sourceBatch) {
    console.error(`Source batch ${SOURCE_BATCH_ID} not found`);
    process.exit(1);
  }
  console.log(`Source batch: "${sourceBatch.name}" (${SOURCE_BATCH_ID})`);

  for (const companyName of COMPANIES_TO_SPLIT) {
    // 2. Resolve company
    const [company] = await sql`
      SELECT id, slug FROM companies WHERE name = ${companyName} LIMIT 1
    `;
    if (!company) {
      console.error(`Company "${companyName}" not found — skipping`);
      continue;
    }

    // 3. Idempotence guard — skip if a standalone batch already exists
    const existing = await sql`
      SELECT id FROM batches
      WHERE name = ${companyName}
        AND uploaded_by = 'admin'
        AND filename = ${`${company.slug}-standalone.csv`}
      LIMIT 1
    `;
    if (existing.length > 0) {
      console.log(`${companyName}: standalone batch already exists (${existing[0].id}) — skipping`);
      continue;
    }

    // 4. Count rows in the source batch for this company
    const [pocRow] = await sql`
      SELECT COUNT(*)::int AS cnt FROM pocs
      WHERE batch_id = ${SOURCE_BATCH_ID} AND company_id = ${company.id}
    `;
    const [jdTotalRow] = await sql`
      SELECT COUNT(*)::int AS cnt FROM job_descriptions
      WHERE batch_id = ${SOURCE_BATCH_ID} AND company_id = ${company.id}
    `;
    const [jdCompleteRow] = await sql`
      SELECT COUNT(*)::int AS cnt FROM job_descriptions
      WHERE batch_id = ${SOURCE_BATCH_ID} AND company_id = ${company.id}
        AND status = 'complete'
    `;
    const [jdFailedRow] = await sql`
      SELECT COUNT(*)::int AS cnt FROM job_descriptions
      WHERE batch_id = ${SOURCE_BATCH_ID} AND company_id = ${company.id}
        AND status IN ('failed', 'invalid')
    `;

    const pocCount    = pocRow.cnt     as number;
    const jdTotal     = jdTotalRow.cnt as number;
    const jdComplete  = jdCompleteRow.cnt as number;
    const jdFailed    = jdFailedRow.cnt   as number;

    console.log(`\n${companyName}: ${pocCount} POC(s), ${jdTotal} JDs (${jdComplete} complete, ${jdFailed} failed)`);

    // 5. Create the new standalone batch
    const [newBatch] = await sql`
      INSERT INTO batches (filename, name, uploaded_by, status, total_pocs, total_jds, processed_jds, failed_jds, completed_at)
      VALUES (
        ${`${company.slug}-standalone.csv`},
        ${companyName},
        'admin',
        'complete',
        ${pocCount},
        ${jdTotal},
        ${jdComplete},
        ${jdFailed},
        NOW()
      )
      RETURNING id
    `;
    console.log(`${companyName}: created new batch ${newBatch.id}`);

    // 6. Repoint POCs
    const updatedPocs = await sql`
      UPDATE pocs SET batch_id = ${newBatch.id}
      WHERE batch_id = ${SOURCE_BATCH_ID} AND company_id = ${company.id}
      RETURNING id
    `;
    console.log(`${companyName}: moved ${updatedPocs.length} POC(s)`);

    // 7. Repoint JDs
    const updatedJds = await sql`
      UPDATE job_descriptions SET batch_id = ${newBatch.id}
      WHERE batch_id = ${SOURCE_BATCH_ID} AND company_id = ${company.id}
      RETURNING id
    `;
    console.log(`${companyName}: moved ${updatedJds.length} JD(s)`);

    console.log(`${companyName}: http://localhost:3003/admin/batches/${newBatch.id}`);
  }

  // 8. Recompute source batch counters from remaining rows
  const [remainingPocs] = await sql`
    SELECT COUNT(*)::int AS cnt FROM pocs WHERE batch_id = ${SOURCE_BATCH_ID}
  `;
  const [remainingJds] = await sql`
    SELECT COUNT(*)::int AS cnt FROM job_descriptions WHERE batch_id = ${SOURCE_BATCH_ID}
  `;
  const [remainingComplete] = await sql`
    SELECT COUNT(*)::int AS cnt FROM job_descriptions
    WHERE batch_id = ${SOURCE_BATCH_ID} AND status = 'complete'
  `;
  const [remainingFailed] = await sql`
    SELECT COUNT(*)::int AS cnt FROM job_descriptions
    WHERE batch_id = ${SOURCE_BATCH_ID} AND status IN ('failed', 'invalid')
  `;

  await sql`
    UPDATE batches SET
      total_pocs    = ${remainingPocs.cnt   as number},
      total_jds     = ${remainingJds.cnt    as number},
      processed_jds = ${remainingComplete.cnt as number},
      failed_jds    = ${remainingFailed.cnt   as number}
    WHERE id = ${SOURCE_BATCH_ID}
  `;

  console.log(`\nInsurance Campaign batch updated:`);
  console.log(`  ${remainingPocs.cnt} POC(s), ${remainingJds.cnt} JDs (${remainingComplete.cnt} complete, ${remainingFailed.cnt} failed)`);
  console.log(`  http://localhost:3003/admin/batches/${SOURCE_BATCH_ID}`);
  console.log("\nDone.");
}

main().catch(e => { console.error(e); process.exit(1); });
