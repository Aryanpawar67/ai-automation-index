/**
 * Trigger Kemper scrape + analyse pipeline.
 * Run: npx tsx --env-file=.env.local scripts/process-kemper.ts
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const COMPANY_ID = "f8aa9829-5734-4c42-af81-0fd2313c4f80";
const NAME       = "Kemper";

(async () => {
  await sql`DELETE FROM job_descriptions WHERE company_id = ${COMPANY_ID}`;
  await sql`
    UPDATE companies SET
      scrape_status = 'pending', scrape_error = NULL, scraped_at = NULL
    WHERE id = ${COMPANY_ID}
  `;
  console.log("Reset Kemper");

  const [batch] = await sql`
    INSERT INTO batches (filename, name, uploaded_by, status, total_pocs)
    VALUES ('kemper-standalone.csv', ${NAME}, 'admin', 'scraping', 1)
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
  console.log(`Watch: http://localhost:3003/admin/batches/${batch.id}`);

  // Poll until scrape complete, then trigger analyse via the admin route
  for (let i = 0; i < 90; i++) {
    const [c] = await sql`SELECT scrape_status, scrape_error FROM companies WHERE id = ${COMPANY_ID}`;
    const [{ count }] = await sql`SELECT COUNT(*) AS count FROM job_descriptions WHERE batch_id = ${batch.id}`;
    console.log(`[${i * 5}s] scrape=${c.scrape_status} jds=${count}`);
    if (c.scrape_status === "complete") break;
    if (c.scrape_status === "failed") { console.log("ERR:", c.scrape_error); process.exit(1); }
    await new Promise(r => setTimeout(r, 5000));
  }
  const appBase = process.env.APP_BASE_URL ?? "http://localhost:3003";
  const ar = await fetch(`${appBase}/api/admin/batches/${batch.id}/analyse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ companyId: COMPANY_ID }),
  });
  console.log("analyse:", ar.status, await ar.text());
})();
