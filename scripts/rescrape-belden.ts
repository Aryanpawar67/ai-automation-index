/**
 * Resets and rescrapes Belden using the correct career URL.
 * 113 open roles → LARGE tier → scrapes 20, analyses 15.
 *
 * Run: npx tsx --env-file=.env.local scripts/rescrape-belden.ts
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

const COMPANY_ID   = "47107092-da75-409b-b5ca-a5d8973ccf4d";
const CAREER_URL   = "https://careers.belden.com/search/?createNewAlert=false&q=";
const TOTAL_AVAIL  = 113;

async function main() {
  // Reset company to pending with correct URL and totalJobsAvailable
  await sql`
    UPDATE companies
    SET career_page_url      = ${CAREER_URL},
        ats_type             = 'oracle_taleo',
        scrape_status        = 'pending',
        scrape_error         = null,
        scraped_at           = null,
        total_jobs_available = ${TOTAL_AVAIL}
    WHERE id = ${COMPANY_ID}
  `;
  console.log(`Reset Belden (${COMPANY_ID}) → pending, URL updated, totalJobsAvailable = ${TOTAL_AVAIL}`);

  // Create a fresh batch
  const filename = `belden-rescrape-may-2026.csv`;
  const [batch] = await sql`
    INSERT INTO batches (filename, name, uploaded_by, status, total_pocs)
    VALUES (${filename}, 'Belden', 'admin', 'scraping', 1)
    RETURNING id
  `;
  console.log(`Created batch ${batch.id}`);

  await sql`
    INSERT INTO pocs (batch_id, company_id, first_name, last_name, email)
    VALUES (${batch.id}, ${COMPANY_ID}, 'Belden', '', '')
  `;

  // Fire scrape event
  const inngestBaseUrl  = process.env.INNGEST_BASE_URL  ?? "http://localhost:8288";
  const inngestEventKey = process.env.INNGEST_EVENT_KEY ?? "local";

  const resp = await fetch(`${inngestBaseUrl}/e/${inngestEventKey}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify([{ name: "company/scrape", data: { companyId: COMPANY_ID, batchId: batch.id } }]),
  });

  if (!resp.ok) { console.error("Inngest error:", await resp.text()); process.exit(1); }
  console.log("Inngest response:", JSON.stringify(await resp.json(), null, 2));
  console.log(`\nBatch page: http://localhost:3003/admin/batches/${batch.id}`);
  console.log(`Report:     https://ai-automation-index.up.railway.app/report/belden?token=3af2ef69a2bb4d494c98da79e90e34623b5908e738175cb2ff82e9de28bf3041`);
}

main().catch(e => { console.error(e); process.exit(1); });
