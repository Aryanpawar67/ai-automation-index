/**
 * Adds RGA and W. R. Berkley each to their own fresh standalone batch,
 * updating career URLs and resetting scrape state.
 *
 * Run: npx tsx --env-file=.env.local scripts/add-rga-berkley-separate.ts
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

const DATE_TAG = new Date().toISOString().slice(0, 10); // e.g. 2026-04-30

const COMPANIES: Array<{ name: string; careerPageUrl: string; atsType: string | null }> = [
  {
    name:          "Reinsurance Group of America, Incorporated",
    careerPageUrl: "https://www.rgarecareers.com/us/en/search-results",
    atsType:       null,
  },
  {
    name:          "W. R. Berkley Corporation",
    careerPageUrl: "https://careers-berkley.icims.com/jobs/search?pr=0",
    atsType:       null, // iCIMS — auto-detected by scraper
  },
];

async function upsertCompany(co: typeof COMPANIES[number]): Promise<string> {
  const existing = await sql`
    SELECT id, name, career_page_url, scrape_status
    FROM companies
    WHERE name = ${co.name}
    LIMIT 1
  `;

  if (existing.length > 0) {
    const c = existing[0];
    console.log(`  Found existing: "${c.name}" (${c.id}) — status was "${c.scrape_status}"`);
    await sql`
      UPDATE companies
      SET career_page_url = ${co.careerPageUrl},
          scrape_status   = 'pending',
          scrape_error    = null,
          scraped_at      = null
          ${co.atsType ? sql`, ats_type = ${co.atsType}` : sql``}
      WHERE id = ${c.id}
    `;
    console.log(`  Updated URL → ${co.careerPageUrl}`);
    console.log(`  Reset scrape_status → pending`);
    return c.id;
  }

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

async function createFreshBatch(co: typeof COMPANIES[number], companyId: string): Promise<string> {
  const slug     = slugify(co.name);
  const filename = `${slug}-standalone-${DATE_TAG}.csv`;

  const [batch] = await sql`
    INSERT INTO batches (filename, name, uploaded_by, status, total_pocs)
    VALUES (${filename}, ${co.name}, 'admin', 'scraping', 1)
    RETURNING id
  `;
  console.log(`  Created batch ${batch.id} (${filename})`);

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
    const companyId = await upsertCompany(co);
    const batchId   = await createFreshBatch(co, companyId);
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
