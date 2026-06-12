import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

(async () => {
  const [co] = await sql`
    SELECT id, name, slug, scrape_status, total_jobs_available
    FROM companies WHERE slug = 'fiserv-health'
  `;
  if (!co) throw new Error("fiserv-health row not found");
  console.log("Company:", co);

  // Wipe any stale JDs (none currently, but defensive against future re-runs)
  const deleted = await sql`
    DELETE FROM job_descriptions WHERE company_id = ${co.id} RETURNING id
  `;
  console.log(`Deleted ${deleted.length} stale JD rows`);

  // Reset company state
  await sql`
    UPDATE companies
    SET scrape_status = 'pending', scrape_error = NULL,
        total_jobs_available = NULL, scraped_at = NULL
    WHERE id = ${co.id}
  `;

  // Create a fresh standalone batch + POC (matches the reset-axa.ts flow)
  const filename = `${co.slug}-standalone.csv`;
  const [batch] = await sql`
    INSERT INTO batches (filename, name, uploaded_by, status, total_pocs)
    VALUES (${filename}, ${co.name}, 'admin', 'scraping', 1)
    RETURNING id
  `;
  await sql`
    INSERT INTO pocs (batch_id, company_id, first_name, last_name, email)
    VALUES (${batch.id}, ${co.id}, ${co.name}, '', '')
  `;
  console.log("Batch:", batch.id);

  const inngestBaseUrl  = process.env.INNGEST_BASE_URL  ?? "http://localhost:8288";
  const inngestEventKey = process.env.INNGEST_EVENT_KEY ?? "local";
  const resp = await fetch(`${inngestBaseUrl}/e/${inngestEventKey}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify([{
      name: "company/scrape",
      data: { companyId: co.id, batchId: batch.id },
    }]),
  });
  console.log("Inngest response:", await resp.json());
  console.log(`\nWatch: http://localhost:3003/admin/batches/${batch.id}`);
})();
