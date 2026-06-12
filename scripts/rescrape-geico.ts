import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

(async () => {
  const coId = "4997675f-1c94-4032-aece-dc91b36d7af5";
  const [co] = await sql`SELECT name, slug, career_page_url, total_jobs_available FROM companies WHERE id = ${coId}`;
  if (!co) throw new Error("Geico not found");
  console.log("Company:", co);

  const deleted = await sql`DELETE FROM job_descriptions WHERE company_id = ${coId} RETURNING id`;
  console.log(`Deleted ${deleted.length} stale JDs`);

  await sql`
    UPDATE companies SET
      scrape_status = 'pending', scrape_error = NULL,
      total_jobs_available = NULL, scraped_at = NULL,
      ats_type = 'workday'
    WHERE id = ${coId}
  `;

  const [batch] = await sql`
    INSERT INTO batches (filename, name, uploaded_by, status, total_pocs)
    VALUES ('geico-standalone.csv', ${co.name}, 'admin', 'scraping', 1)
    RETURNING id
  `;
  await sql`
    INSERT INTO pocs (batch_id, company_id, first_name, last_name, email)
    VALUES (${batch.id}, ${coId}, ${co.name}, '', '')
  `;
  console.log("Batch:", batch.id);

  const inngestBaseUrl  = process.env.INNGEST_BASE_URL  ?? "http://localhost:8288";
  const inngestEventKey = process.env.INNGEST_EVENT_KEY ?? "local";
  const resp = await fetch(`${inngestBaseUrl}/e/${inngestEventKey}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify([{
      name: "company/scrape",
      data: { companyId: coId, batchId: batch.id },
    }]),
  });
  console.log("Inngest:", await resp.json());
  console.log(`Watch: http://localhost:3003/admin/batches/${batch.id}`);
})();
