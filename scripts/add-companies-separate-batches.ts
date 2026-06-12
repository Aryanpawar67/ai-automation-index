/**
 * Adds companies to the pipeline, each in its own standalone batch.
 * Safe to re-run: if a company already exists by name it is reset and re-scraped;
 * if a standalone batch for it already exists that batch is reused.
 *
 * Run: npx tsx --env-file=.env.local scripts/add-companies-separate-batches.ts
 */
import { neon }       from "@neondatabase/serverless";
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

const COMPANIES: Array<{ name: string; careerPageUrl: string; atsType: string | null }> = [
  {
    name:          "Tokio Marine HCC-Casualty Group",
    careerPageUrl: "https://www.tmhcc.com/en/careers",
    atsType:       null,
  },
  {
    name:          "Crum & Forster",
    careerPageUrl: "https://careers-cfins.icims.com/jobs/intro",
    atsType:       null,    // iCIMS — auto-detected by scraper
  },
  {
    name:          "Celedinas Insurance Group",
    careerPageUrl: "https://mmc.wd1.myworkdayjobs.com/MMC",
    atsType:       "workday",
  },
];

async function getOrCreateCompany(co: typeof COMPANIES[number]): Promise<string> {
  const existing = await sql`SELECT id, name, career_page_url, scrape_status FROM companies WHERE name = ${co.name} LIMIT 1`;

  if (existing.length > 0) {
    const c = existing[0];
    console.log(`  Found existing: "${c.name}" (${c.id}) — status was "${c.scrape_status}"`);
    await sql`
      UPDATE companies
      SET scrape_status = 'pending', scrape_error = null
          ${co.atsType ? sql`, ats_type = ${co.atsType}` : sql``}
      WHERE id = ${c.id}
    `;
    console.log(`  Reset scrape_status → pending`);
    return c.id;
  }

  // Generate unique slug
  const base      = slugify(co.name);
  const conflicts = await sql`SELECT slug FROM companies WHERE slug LIKE ${base + "%"}`;
  const taken     = new Set(conflicts.map((r: { slug: string }) => r.slug));
  let   finalSlug = base;
  let   n         = 2;
  while (taken.has(finalSlug)) { finalSlug = `${base}-${n}`; n++; }

  const [newCo] = await sql`
    INSERT INTO companies (name, career_page_url, scrape_status, ats_type, slug, report_token)
    VALUES (${co.name}, ${co.careerPageUrl}, 'pending', ${co.atsType}, ${finalSlug}, ${token()})
    RETURNING id
  `;
  console.log(`  Created: "${co.name}" → slug "${finalSlug}" (${newCo.id})`);
  return newCo.id;
}

async function getOrCreateBatch(co: typeof COMPANIES[number], companyId: string): Promise<string> {
  const slug     = slugify(co.name);
  const filename = `${slug}-standalone.csv`;

  const existing = await sql`
    SELECT id FROM batches
    WHERE name = ${co.name} AND filename = ${filename} AND uploaded_by = 'admin'
    LIMIT 1
  `;
  if (existing.length > 0) {
    console.log(`  Reusing existing batch ${existing[0].id}`);
    return existing[0].id;
  }

  // Count existing POCs for this company (if it was already in the db)
  const [pocCount] = await sql`SELECT COUNT(*)::int AS cnt FROM pocs WHERE company_id = ${companyId}`;

  const [batch] = await sql`
    INSERT INTO batches (filename, name, uploaded_by, status, total_pocs)
    VALUES (${filename}, ${co.name}, 'admin', 'scraping', 1)
    RETURNING id
  `;
  console.log(`  Created batch ${batch.id}`);

  // Create a POC stub (name-only, no email)
  await sql`
    INSERT INTO pocs (batch_id, company_id, first_name, last_name, email)
    VALUES (${batch.id}, ${companyId}, ${co.name}, '', '')
  `;

  return batch.id;
}

async function main() {
  const inngestBaseUrl  = process.env.INNGEST_BASE_URL  ?? "http://localhost:8288";
  const inngestEventKey = process.env.INNGEST_EVENT_KEY ?? "local";

  const events: Array<{ name: string; data: { companyId: string; batchId: string } }> = [];

  for (const co of COMPANIES) {
    console.log(`\n── ${co.name} ──`);
    const companyId = await getOrCreateCompany(co);
    const batchId   = await getOrCreateBatch(co, companyId);
    events.push({ name: "company/scrape", data: { companyId, batchId } });
    console.log(`  → company/scrape event queued`);
    console.log(`  → http://localhost:3003/admin/batches/${batchId}`);
  }

  const resp = await fetch(`${inngestBaseUrl}/e/${inngestEventKey}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(events),
  });

  if (!resp.ok) { console.error("Inngest error:", await resp.text()); process.exit(1); }
  console.log("\nSent events:", JSON.stringify(await resp.json(), null, 2));
  console.log("\nMonitor at: http://localhost:8288");
}

main().catch(e => { console.error(e); process.exit(1); });
