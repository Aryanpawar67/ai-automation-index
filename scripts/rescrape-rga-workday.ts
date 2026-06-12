/**
 * Switches RGA to its Workday backend URL and re-scrapes the existing batch.
 * Run: npx tsx --env-file=.env.local scripts/rescrape-rga-workday.ts
 */
import { neon } from "@neondatabase/serverless";

const sql   = neon(process.env.DATABASE_URL!);
const COMPANY_ID = "b59a8e28-d7f7-4f25-a38d-5c2559bb9c9a";
const BATCH_ID   = "aa9e5862-d568-435b-9495-96b065d0d132";
const WORKDAY_URL = "https://rgare.wd1.myworkdayjobs.com/Careers";
const INNGEST_BASE_URL  = process.env.INNGEST_BASE_URL  ?? "http://localhost:8288";
const INNGEST_EVENT_KEY = process.env.INNGEST_EVENT_KEY ?? "local";

async function main() {
  // 1. Update company: Workday URL + atsType + reset scrape state
  await sql`
    UPDATE companies
    SET career_page_url      = ${WORKDAY_URL},
        ats_type             = 'workday',
        scrape_status        = 'pending',
        scrape_error         = null,
        scraped_at           = null,
        total_jobs_available = null
    WHERE id = ${COMPANY_ID}
  `;
  console.log("Updated career URL →", WORKDAY_URL, "(atsType: workday)");

  // 2. Delete all existing JDs for this batch so we start clean
  const del = await sql`
    DELETE FROM job_descriptions
    WHERE batch_id = ${BATCH_ID}
    RETURNING id
  `;
  console.log(`Deleted ${del.length} existing JDs from batch`);

  // 3. Reset batch to scraping state
  await sql`
    UPDATE batches
    SET status     = 'scraping',
        total_jds  = 0,
        processed_jds = 0,
        failed_jds    = 0
    WHERE id = ${BATCH_ID}
  `;
  console.log("Reset batch status → scraping");

  // 4. Fire company/scrape event
  const resp = await fetch(`${INNGEST_BASE_URL}/e/${INNGEST_EVENT_KEY}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify([{ name: "company/scrape", data: { companyId: COMPANY_ID, batchId: BATCH_ID } }]),
  });
  if (!resp.ok) { console.error("Inngest error:", await resp.text()); process.exit(1); }
  console.log("Fired company/scrape event");
  console.log("Monitor: http://localhost:3003/admin/batches/" + BATCH_ID);
}

main().catch(e => { console.error(e); process.exit(1); });
