/**
 * Switch Marsh (parent) from the Workday URL to the Phenom marsh-search URL
 * (business=Marsh Risk, English-only). Reset state, create batch, fire scrape,
 * poll until complete, then trigger analyse.
 * Run: npx tsx --env-file=.env.local scripts/process-marsh.ts
 */
import { neon } from "@neondatabase/serverless";

const sql        = neon(process.env.DATABASE_URL!);
const COMPANY_ID = "cf7dc0a0-b8ac-42a1-b01d-3b8ceddc8b77";
const NAME       = "Marsh";
const NEW_URL    = "https://careers.marsh.com/global/en/marsh-search";
const TOTAL      = 614;
const APP_BASE   = process.env.APP_BASE_URL ?? "http://localhost:3003";

(async () => {
  await sql`DELETE FROM job_descriptions WHERE company_id = ${COMPANY_ID}`;
  await sql`
    UPDATE companies SET
      career_page_url      = ${NEW_URL},
      ats_type             = 'phenom',
      scrape_status        = 'pending',
      scrape_error         = NULL,
      scraped_at           = NULL,
      total_jobs_available = ${TOTAL}
    WHERE id = ${COMPANY_ID}
  `;
  console.log(`Updated Marsh → ${NEW_URL} (total=${TOTAL})`);

  const [batch] = await sql`
    INSERT INTO batches (filename, name, uploaded_by, status, total_pocs)
    VALUES ('marsh-standalone.csv', ${NAME}, 'admin', 'scraping', 1)
    RETURNING id
  `;
  await sql`
    INSERT INTO pocs (batch_id, company_id, first_name, last_name, email)
    VALUES (${batch.id}, ${COMPANY_ID}, ${NAME}, '', '')
  `;
  console.log("Batch:", batch.id);

  const inngestBaseUrl  = process.env.INNGEST_BASE_URL  ?? "http://localhost:8288";
  const inngestEventKey = process.env.INNGEST_EVENT_KEY ?? "local";
  const resp = await fetch(`${inngestBaseUrl}/e/${inngestEventKey}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify([{ name: "company/scrape", data: { companyId: COMPANY_ID, batchId: batch.id } }]),
  });
  console.log("Inngest:", resp.status, await resp.text());
  console.log(`Watch: ${APP_BASE}/admin/batches/${batch.id}`);

  for (let i = 0; i < 120; i++) {
    const [c] = await sql`SELECT scrape_status, scrape_error FROM companies WHERE id = ${COMPANY_ID}`;
    const [{ count }] = await sql`SELECT COUNT(*) AS count FROM job_descriptions WHERE batch_id = ${batch.id}`;
    console.log(`[${i * 5}s] scrape=${c.scrape_status} jds=${count}`);
    if (c.scrape_status === "complete") break;
    if (c.scrape_status === "failed") { console.log("ERR:", c.scrape_error); process.exit(1); }
    await new Promise(r => setTimeout(r, 5000));
  }
  const ar = await fetch(`${APP_BASE}/api/admin/batches/${batch.id}/analyse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ companyId: COMPANY_ID }),
  });
  console.log("analyse:", ar.status, await ar.text());
})();
