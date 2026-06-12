import { neon } from '@neondatabase/serverless';
import { randomBytes } from 'crypto';
const sql = neon(process.env.DATABASE_URL!);
function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}
function token(): string { return randomBytes(32).toString("hex"); }
async function main() {
  const name = 'Fiserv Health';
  const careerPageUrl = 'https://careers.fiserv.com/us/en/search-results';
  const atsType = null;
  const base = slugify(name);
  const conflicts = await sql`SELECT slug FROM companies WHERE slug LIKE ${base + "%"}`;
  const taken = new Set(conflicts.map((r: any) => r.slug));
  let finalSlug = base; let n = 2;
  while (taken.has(finalSlug)) { finalSlug = `${base}-${n}`; n++; }
  const [newCo] = await sql`
    INSERT INTO companies (name, career_page_url, scrape_status, ats_type, slug, report_token, total_jobs_available)
    VALUES (${name}, ${careerPageUrl}, 'pending', ${atsType}, ${finalSlug}, ${token()}, 454)
    RETURNING id, name, slug
  `;
  console.log(`Created: "${newCo.name}" slug="${newCo.slug}" id=${newCo.id}`);
  const filename = `${finalSlug}-standalone.csv`;
  const [batch] = await sql`
    INSERT INTO batches (filename, name, uploaded_by, status, total_pocs)
    VALUES (${filename}, ${name}, 'admin', 'scraping', 1)
    RETURNING id
  `;
  await sql`INSERT INTO pocs (batch_id, company_id, first_name, last_name, email) VALUES (${batch.id}, ${newCo.id}, ${name}, '', '')`;
  const inngestBaseUrl = process.env.INNGEST_BASE_URL ?? "http://localhost:8288";
  const inngestEventKey = process.env.INNGEST_EVENT_KEY ?? "local";
  const resp = await fetch(`${inngestBaseUrl}/e/${inngestEventKey}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify([{ name: "company/scrape", data: { companyId: newCo.id, batchId: batch.id } }]),
  });
  console.log("Inngest:", JSON.stringify(await resp.json()));
  console.log(`Batch: http://localhost:3003/admin/batches/${batch.id}`);
}
main().catch(e => { console.error(e); process.exit(1); });
