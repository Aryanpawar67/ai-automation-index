/**
 * Update EXL career URL → Oracle CX US-filter URL, reset state, create batch,
 * fire company/scrape Inngest event.
 * Run: npx tsx --env-file=.env.local scripts/process-exl.ts
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

const COMPANY_ID = "3d975431-33c7-437f-ba4a-68bb48d8c104";
const NEW_URL = "https://fa-ewjt-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_2/jobs?location=United+States&locationId=300000000467584&locationLevel=country&mode=job-location";
const US_TOTAL = 171;

(async () => {
  // 1. Reset company + apply new URL
  await sql`
    DELETE FROM job_descriptions WHERE company_id = ${COMPANY_ID}
  `;
  await sql`
    UPDATE companies SET
      career_page_url      = ${NEW_URL},
      ats_type             = 'oracle_hcm',
      scrape_status        = 'pending',
      scrape_error         = NULL,
      scraped_at           = NULL,
      total_jobs_available = ${US_TOTAL}
    WHERE id = ${COMPANY_ID}
  `;
  console.log(`Updated EXL → US-filter URL (total=${US_TOTAL})`);

  // 2. Create new batch
  const [batch] = await sql`
    INSERT INTO batches (filename, name, uploaded_by, status, total_pocs)
    VALUES ('exl-us-standalone.csv', 'EXL', 'admin', 'scraping', 1)
    RETURNING id
  `;
  await sql`
    INSERT INTO pocs (batch_id, company_id, first_name, last_name, email)
    VALUES (${batch.id}, ${COMPANY_ID}, 'EXL', '', '')
  `;
  console.log("Batch created:", batch.id);

  // 3. Fire Inngest event
  const inngestBaseUrl  = process.env.INNGEST_BASE_URL  ?? "http://localhost:8288";
  const inngestEventKey = process.env.INNGEST_EVENT_KEY ?? "local";
  const resp = await fetch(`${inngestBaseUrl}/e/${inngestEventKey}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify([{
      name: "company/scrape",
      data: { companyId: COMPANY_ID, batchId: batch.id },
    }]),
  });
  console.log("Inngest:", resp.status, await resp.text());
  console.log(`Watch: http://localhost:3003/admin/batches/${batch.id}`);
})();
