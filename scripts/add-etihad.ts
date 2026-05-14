/**
 * Adds Etihad Airways to the pipeline in its own standalone batch.
 * Safe to re-run: if Etihad already exists it is reset and re-scraped;
 * if a standalone batch for it already exists that batch is reused.
 *
 * Run: npx tsx --env-file=.env.local scripts/add-etihad.ts
 */
import { neon }        from "@neondatabase/serverless";
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

function token(): string {
  return randomBytes(32).toString("hex");
}

const COMPANY = {
  name:          "Etihad Airways",
  careerPageUrl: "https://careers.smartrecruiters.com/EtihadAirways5",
  atsType:       null as string | null,
};

async function getOrCreateCompany(): Promise<string> {
  const existing = await sql`SELECT id, name, scrape_status FROM companies WHERE name = ${COMPANY.name} LIMIT 1`;

  if (existing.length > 0) {
    const c = existing[0];
    console.log(`  Found existing: "${c.name}" (${c.id}) — status was "${c.scrape_status}"`);
    await sql`
      UPDATE companies
      SET scrape_status = 'pending', scrape_error = null, career_page_url = ${COMPANY.careerPageUrl}
      WHERE id = ${c.id}
    `;
    console.log(`  Reset scrape_status → pending`);
    return c.id;
  }

  const base      = slugify(COMPANY.name);
  const conflicts = await sql`SELECT slug FROM companies WHERE slug LIKE ${base + "%"}`;
  const taken     = new Set(conflicts.map((r: { slug: string }) => r.slug));
  let   finalSlug = base;
  let   n         = 2;
  while (taken.has(finalSlug)) { finalSlug = `${base}-${n}`; n++; }

  const [newCo] = await sql`
    INSERT INTO companies (name, career_page_url, scrape_status, ats_type, slug, report_token)
    VALUES (${COMPANY.name}, ${COMPANY.careerPageUrl}, 'pending', ${COMPANY.atsType}, ${finalSlug}, ${token()})
    RETURNING id
  `;
  console.log(`  Created: "${COMPANY.name}" → slug "${finalSlug}" (${newCo.id})`);
  return newCo.id;
}

async function getOrCreateBatch(companyId: string): Promise<string> {
  const slug     = slugify(COMPANY.name);
  const filename = `${slug}-standalone.csv`;

  const existing = await sql`
    SELECT id FROM batches
    WHERE name = ${COMPANY.name} AND filename = ${filename} AND uploaded_by = 'admin'
    LIMIT 1
  `;
  if (existing.length > 0) {
    console.log(`  Reusing existing batch ${existing[0].id}`);
    return existing[0].id;
  }

  const [batch] = await sql`
    INSERT INTO batches (filename, name, uploaded_by, status, total_pocs)
    VALUES (${filename}, ${COMPANY.name}, 'admin', 'scraping', 1)
    RETURNING id
  `;
  console.log(`  Created batch ${batch.id}`);

  await sql`
    INSERT INTO pocs (batch_id, company_id, first_name, last_name, email)
    VALUES (${batch.id}, ${companyId}, ${COMPANY.name}, '', '')
  `;

  return batch.id;
}

async function main() {
  const inngestBaseUrl  = process.env.INNGEST_BASE_URL  ?? "http://localhost:8288";
  const inngestEventKey = process.env.INNGEST_EVENT_KEY ?? "local";

  console.log(`\n── ${COMPANY.name} ──`);
  const companyId = await getOrCreateCompany();
  const batchId   = await getOrCreateBatch(companyId);
  console.log(`  → http://localhost:3003/admin/batches/${batchId}`);

  const resp = await fetch(`${inngestBaseUrl}/e/${inngestEventKey}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify([{ name: "company/scrape", data: { companyId, batchId } }]),
  });

  if (!resp.ok) { console.error("Inngest error:", await resp.text()); process.exit(1); }
  console.log("\nSent event:", JSON.stringify(await resp.json(), null, 2));
  console.log("\nMonitor at: http://localhost:8288");
}

main().catch(e => { console.error(e); process.exit(1); });
