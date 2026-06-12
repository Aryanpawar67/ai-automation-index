/**
 * Re-runs Daman Health through the pipeline so the new analysis reflects the
 * 6 freshly-posted roles (16 total) on their Oracle HCM site.
 *
 * Creates a new standalone batch — the previous analysis stays in place for
 * history; this just produces a new analysisId under the same company.
 *
 * Run: npx tsx --env-file=.env.local scripts/rescrape-daman-health.ts
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

const NAME = "Daman Health";
const URL  = "https://erel.fa.em8.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs";

async function main() {
  const inngestBaseUrl  = process.env.INNGEST_BASE_URL  ?? "http://localhost:8288";
  const inngestEventKey = process.env.INNGEST_EVENT_KEY ?? "local";

  const existing = await sql`SELECT id, name, scrape_status FROM companies WHERE name = ${NAME} LIMIT 1`;
  if (existing.length === 0) { console.error(`No company "${NAME}" found.`); process.exit(1); }

  const companyId = existing[0].id;
  console.log(`Found "${NAME}" (${companyId}) — was "${existing[0].scrape_status}"`);

  await sql`
    UPDATE companies
    SET scrape_status = 'pending', scrape_error = null,
        career_page_url = ${URL}, ats_type = 'oracle_hcm'
    WHERE id = ${companyId}
  `;
  console.log(`  Reset scrape_status → pending, URL refreshed`);

  // Fresh standalone batch — older batches remain so previous reports stay reachable.
  const filename = `daman-health-rescrape-${new Date().toISOString().slice(0,10)}.csv`;
  const [batch] = await sql`
    INSERT INTO batches (filename, name, uploaded_by, status, total_pocs)
    VALUES (${filename}, ${NAME}, 'admin', 'scraping', 1)
    RETURNING id
  `;
  console.log(`  Created batch ${batch.id}`);

  await sql`
    INSERT INTO pocs (batch_id, company_id, first_name, last_name, email)
    VALUES (${batch.id}, ${companyId}, ${NAME}, '', '')
  `;

  const resp = await fetch(`${inngestBaseUrl}/e/${inngestEventKey}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify([{ name: "company/scrape", data: { companyId, batchId: batch.id } }]),
  });
  if (!resp.ok) { console.error("Inngest error:", await resp.text()); process.exit(1); }

  console.log(`\nSent event:`, JSON.stringify(await resp.json(), null, 2));
  console.log(`\nMonitor at: http://localhost:8288`);
  console.log(`Batch:      http://localhost:3003/admin/batches/${batch.id}`);
}

main().catch(e => { console.error(e); process.exit(1); });
