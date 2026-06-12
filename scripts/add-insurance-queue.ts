/**
 * Adds 9 insurance companies to a new batch and triggers scraping via Inngest.
 * Run with: npx tsx --env-file=.env.local scripts/add-insurance-queue.ts
 */

import { neon }     from "@neondatabase/serverless";
import { randomBytes } from "crypto";

const sql = neon(process.env.DATABASE_URL!);

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim()
    .replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function token(): string {
  return randomBytes(32).toString("hex");
}

const COMPANIES: Array<{ name: string; careerPageUrl: string; atsType: string | null }> = [
  { name: "AmTrust Financial Services, Inc.",         careerPageUrl: "https://careers-amtrustgroup.icims.com/jobs/intro",   atsType: null },
  { name: "NFP, an Aon company",                      careerPageUrl: "https://careers.nfp.com/",                            atsType: null },
  { name: "Reinsurance Group of America",             careerPageUrl: "https://www.rgare.com/careers/apply",                 atsType: null },
  { name: "Amica Insurance",                          careerPageUrl: "https://careers.amica.com/",                          atsType: null },
  { name: "Oscar Health",                             careerPageUrl: "https://boards.greenhouse.io/oscar",                  atsType: null },
  { name: "W. R. Berkley Corporation",                careerPageUrl: "https://careers-berkley.icims.com/jobs/intro",        atsType: null },
  { name: "Lemonade",                                 careerPageUrl: "https://makers.lemonade.com/",                        atsType: null },
  { name: "Trupanion",                                careerPageUrl: "https://www.trupanion.com/about/careers",             atsType: null },
  { name: "Berkshire Hathaway GUARD Insurance Companies", careerPageUrl: "https://careers.guard.com/",                     atsType: null },
];

async function main() {
  // 1. Create the batch
  const [batch] = await sql`
    INSERT INTO batches (filename, name, uploaded_by, status, total_pocs)
    VALUES ('insurance-campaign-manual.csv', 'Insurance Campaign', 'admin', 'scraping', ${COMPANIES.length})
    RETURNING id
  `;
  console.log("Created batch:", batch.id);

  const scrapePayloads: Array<{ companyId: string; batchId: string }> = [];

  for (const co of COMPANIES) {
    // 2. Check if company already exists by name
    const existing = await sql`
      SELECT id FROM companies WHERE name = ${co.name} LIMIT 1
    `;

    let companyId: string;

    if (existing.length > 0) {
      companyId = existing[0].id;
      // Reset scrape status so it gets re-scraped
      await sql`
        UPDATE companies
        SET scrape_status = 'pending', scrape_error = null
        WHERE id = ${companyId}
      `;
      console.log(`  Found existing: ${co.name} (${companyId})`);
    } else {
      // Generate a unique slug
      const base = slug(co.name);
      const conflicts = await sql`
        SELECT slug FROM companies WHERE slug LIKE ${base + "%"}
      `;
      const taken = new Set(conflicts.map((r: { slug: string }) => r.slug));
      let finalSlug = base;
      let n = 2;
      while (taken.has(finalSlug)) { finalSlug = `${base}-${n}`; n++; }

      const [newCo] = await sql`
        INSERT INTO companies (name, career_page_url, scrape_status, ats_type, slug, report_token)
        VALUES (
          ${co.name},
          ${co.careerPageUrl},
          'pending',
          ${co.atsType},
          ${finalSlug},
          ${token()}
        )
        RETURNING id
      `;
      companyId = newCo.id;
      console.log(`  Created: ${co.name} → ${finalSlug} (${companyId})`);
    }

    // 3. Create a POC stub linked to this batch
    await sql`
      INSERT INTO pocs (batch_id, company_id, first_name, last_name, email)
      VALUES (${batch.id}, ${companyId}, ${co.name}, '', '')
    `;

    scrapePayloads.push({ companyId, batchId: batch.id });
  }

  // 4. Send company/scrape events to Inngest via HTTP API
  const inngestBaseUrl = process.env.INNGEST_BASE_URL ?? "http://localhost:8288";
  const inngestEventKey = process.env.INNGEST_EVENT_KEY ?? "local";

  const events = scrapePayloads.map(p => ({
    name: "company/scrape",
    data: p,
  }));

  const resp = await fetch(`${inngestBaseUrl}/e/${inngestEventKey}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(events),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error("Inngest send failed:", resp.status, text);
    process.exit(1);
  }

  const result = await resp.json();
  console.log(`\nSent ${events.length} company/scrape events to Inngest:`, JSON.stringify(result));
  console.log(`\nBatch ID: ${batch.id}`);
  console.log(`Visit: http://localhost:3003/admin/batches/${batch.id}`);
}

main().catch(e => { console.error(e); process.exit(1); });
