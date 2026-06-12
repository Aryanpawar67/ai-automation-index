import { neon } from "@neondatabase/serverless";
import { randomBytes } from "crypto";

const sql = neon(process.env.DATABASE_URL!);

function slugify(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

const token = () => randomBytes(32).toString("hex");

(async () => {
  const name = "Oscar Health";
  const careerPageUrl = "https://www.hioscar.com/careers/search";

  const [existing] = await sql`SELECT id, slug FROM companies WHERE slug = 'oscar-health'`;

  let companyId: string;
  if (existing) {
    companyId = existing.id;
    console.log("Existing company:", existing);
    await sql`DELETE FROM job_descriptions WHERE company_id = ${companyId}`;
    await sql`
      UPDATE companies SET
        scrape_status = 'pending', scrape_error = NULL,
        total_jobs_available = NULL, scraped_at = NULL,
        career_page_url = ${careerPageUrl}
      WHERE id = ${companyId}
    `;
  } else {
    const base = slugify(name);
    const conflicts = await sql`SELECT slug FROM companies WHERE slug LIKE ${base + "%"}`;
    const taken = new Set(conflicts.map((r: { slug: string }) => r.slug));
    let finalSlug = base, n = 2;
    while (taken.has(finalSlug)) finalSlug = `${base}-${n++}`;
    const [newCo] = await sql`
      INSERT INTO companies (name, career_page_url, scrape_status, ats_type, slug, report_token, total_jobs_available)
      VALUES (${name}, ${careerPageUrl}, 'pending', 'greenhouse', ${finalSlug}, ${token()}, 247)
      RETURNING id, name, slug
    `;
    console.log("Created:", newCo);
    companyId = newCo.id;
  }

  const filename = `oscar-health-standalone.csv`;
  const [batch] = await sql`
    INSERT INTO batches (filename, name, uploaded_by, status, total_pocs)
    VALUES (${filename}, ${name}, 'admin', 'scraping', 1)
    RETURNING id
  `;
  await sql`
    INSERT INTO pocs (batch_id, company_id, first_name, last_name, email)
    VALUES (${batch.id}, ${companyId}, ${name}, '', '')
  `;
  console.log("Batch:", batch.id);

  const inngestBaseUrl  = process.env.INNGEST_BASE_URL  ?? "http://localhost:8288";
  const inngestEventKey = process.env.INNGEST_EVENT_KEY ?? "local";
  const resp = await fetch(`${inngestBaseUrl}/e/${inngestEventKey}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify([{
      name: "company/scrape",
      data: { companyId, batchId: batch.id },
    }]),
  });
  console.log("Inngest response:", await resp.json());
  console.log(`\nWatch: http://localhost:3003/admin/batches/${batch.id}`);
})();
