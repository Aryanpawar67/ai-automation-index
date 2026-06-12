/**
 * Set up Marsh McLennan Agency (MMA) as a separate company from "Marsh"
 * (parent's Workday URL). Uses the careers.marsh.com Phenom site with the
 * MMA business filter — 458 roles, ~20 distinct role families scraped.
 * Run: npx tsx --env-file=.env.local scripts/process-mma.ts
 */
import { neon }       from "@neondatabase/serverless";
import { randomBytes } from "crypto";

const sql       = neon(process.env.DATABASE_URL!);
const NAME      = "Marsh McLennan Agency";
const SLUG_BASE = "marsh-mclennan-agency";
const URL_      = "https://careers.marsh.com/global/en/mma-search";
const TOTAL     = 458;
const token     = () => randomBytes(32).toString("hex");

(async () => {
  // 1. Find or create the company (separate from existing "Marsh" entry)
  const [existing] = await sql`
    SELECT id, slug FROM companies WHERE slug = ${SLUG_BASE} OR (name = ${NAME} AND slug != 'marsh')
  `;
  let companyId: string;
  if (existing) {
    companyId = existing.id;
    await sql`DELETE FROM job_descriptions WHERE company_id = ${companyId}`;
    await sql`
      UPDATE companies SET
        name                 = ${NAME},
        career_page_url      = ${URL_},
        ats_type             = 'phenom',
        scrape_status        = 'pending',
        scrape_error         = NULL,
        scraped_at           = NULL,
        total_jobs_available = ${TOTAL}
      WHERE id = ${companyId}
    `;
    console.log("Updated existing MMA:", companyId);
  } else {
    const conflicts = await sql`SELECT slug FROM companies WHERE slug LIKE ${SLUG_BASE + "%"}`;
    const taken = new Set(conflicts.map((r: { slug: string }) => r.slug));
    let finalSlug = SLUG_BASE, n = 2;
    while (taken.has(finalSlug)) finalSlug = `${SLUG_BASE}-${n++}`;
    const [newCo] = await sql`
      INSERT INTO companies (name, career_page_url, scrape_status, ats_type, slug, report_token, total_jobs_available)
      VALUES (${NAME}, ${URL_}, 'pending', 'phenom', ${finalSlug}, ${token()}, ${TOTAL})
      RETURNING id, name, slug
    `;
    console.log("Created MMA:", newCo);
    companyId = newCo.id;
  }

  // 2. Create batch
  const [batch] = await sql`
    INSERT INTO batches (filename, name, uploaded_by, status, total_pocs)
    VALUES ('mma-standalone.csv', ${NAME}, 'admin', 'scraping', 1)
    RETURNING id
  `;
  await sql`
    INSERT INTO pocs (batch_id, company_id, first_name, last_name, email)
    VALUES (${batch.id}, ${companyId}, ${NAME}, '', '')
  `;
  console.log("Batch:", batch.id);

  // 3. Fire Inngest event
  const inngestBaseUrl  = process.env.INNGEST_BASE_URL  ?? "http://localhost:8288";
  const inngestEventKey = process.env.INNGEST_EVENT_KEY ?? "local";
  const resp = await fetch(`${inngestBaseUrl}/e/${inngestEventKey}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify([{ name: "company/scrape", data: { companyId, batchId: batch.id } }]),
  });
  console.log("Inngest:", resp.status, await resp.text());
  console.log(`Watch: http://localhost:3003/admin/batches/${batch.id}`);
})();
