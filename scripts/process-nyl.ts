/**
 * Set up New York Life (Eightfold ATS, 241 roles), reset state, create batch,
 * fire scrape, poll until complete, then trigger analyse.
 * Run: npx tsx --env-file=.env.local scripts/process-nyl.ts
 */
import { neon }       from "@neondatabase/serverless";
import { randomBytes } from "crypto";

const sql       = neon(process.env.DATABASE_URL!);
const NAME      = "New York Life";
const SLUG_BASE = "new-york-life";
const URL_      = "https://careers.newyorklife.com/careers";
const TOTAL     = 241;
const APP_BASE  = process.env.APP_BASE_URL ?? "http://localhost:3003";
const token     = () => randomBytes(32).toString("hex");

(async () => {
  const [existing] = await sql`SELECT id FROM companies WHERE slug = ${SLUG_BASE} OR name = ${NAME}`;
  let companyId: string;
  if (existing) {
    companyId = existing.id;
    await sql`DELETE FROM job_descriptions WHERE company_id = ${companyId}`;
    await sql`
      UPDATE companies SET
        name                 = ${NAME},
        career_page_url      = ${URL_},
        ats_type             = 'eightfold',
        scrape_status        = 'pending',
        scrape_error         = NULL,
        scraped_at           = NULL,
        total_jobs_available = ${TOTAL}
      WHERE id = ${companyId}
    `;
    console.log("Updated existing:", companyId);
  } else {
    const conflicts = await sql`SELECT slug FROM companies WHERE slug LIKE ${SLUG_BASE + "%"}`;
    const taken = new Set(conflicts.map((r: { slug: string }) => r.slug));
    let finalSlug = SLUG_BASE, n = 2;
    while (taken.has(finalSlug)) finalSlug = `${SLUG_BASE}-${n++}`;
    const [newCo] = await sql`
      INSERT INTO companies (name, career_page_url, scrape_status, ats_type, slug, report_token, total_jobs_available)
      VALUES (${NAME}, ${URL_}, 'pending', 'eightfold', ${finalSlug}, ${token()}, ${TOTAL})
      RETURNING id, slug
    `;
    console.log("Created:", newCo);
    companyId = newCo.id;
  }

  const [batch] = await sql`
    INSERT INTO batches (filename, name, uploaded_by, status, total_pocs)
    VALUES ('nyl-standalone.csv', ${NAME}, 'admin', 'scraping', 1)
    RETURNING id
  `;
  await sql`
    INSERT INTO pocs (batch_id, company_id, first_name, last_name, email)
    VALUES (${batch.id}, ${companyId}, ${NAME}, '', '')
  `;
  console.log("Batch:", batch.id);

  const inngestBaseUrl  = process.env.INNGEST_BASE_URL  ?? "http://localhost:8288";
  const inngestEventKey = process.env.INNGEST_EVENT_KEY ?? "local";
  const resp = await fetch(`${inngestBaseUrl}/e/${inngestEventKey}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify([{ name: "company/scrape", data: { companyId, batchId: batch.id } }]),
  });
  console.log("Inngest:", resp.status, await resp.text());
  console.log(`Watch: ${APP_BASE}/admin/batches/${batch.id}`);

  for (let i = 0; i < 90; i++) {
    const [c] = await sql`SELECT scrape_status, scrape_error FROM companies WHERE id = ${companyId}`;
    const [{ count }] = await sql`SELECT COUNT(*) AS count FROM job_descriptions WHERE batch_id = ${batch.id}`;
    console.log(`[${i * 5}s] scrape=${c.scrape_status} jds=${count}`);
    if (c.scrape_status === "complete") break;
    if (c.scrape_status === "failed") { console.log("ERR:", c.scrape_error); process.exit(1); }
    await new Promise(r => setTimeout(r, 5000));
  }
  const ar = await fetch(`${APP_BASE}/api/admin/batches/${batch.id}/analyse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ companyId }),
  });
  console.log("analyse:", ar.status, await ar.text());
})();
