/**
 * Deletes stale JDs for Lemonade and Trupanion and re-fires company/scrape events.
 * Run: npx tsx --env-file=.env.local scripts/rescrape-lemonade-trupanion.ts
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

const COMPANIES = ["Lemonade", "Trupanion"];

async function main() {
  for (const name of COMPANIES) {
    const [co] = await sql`SELECT id, scrape_status FROM companies WHERE name = ${name} LIMIT 1`;
    if (!co) { console.log(`${name}: not found`); continue; }

    // Delete old JDs for this company in the insurance batch
    const deleted = await sql`
      DELETE FROM job_descriptions
      WHERE company_id = ${co.id}
      RETURNING id
    `;
    console.log(`${name}: deleted ${deleted.length} old JDs`);

    // Reset scrape status
    await sql`UPDATE companies SET scrape_status = 'pending', scrape_error = null WHERE id = ${co.id}`;
  }

  // Get the insurance batch id
  const [batch] = await sql`SELECT id FROM batches WHERE name = 'Insurance Campaign' ORDER BY created_at DESC LIMIT 1`;
  if (!batch) { console.error("Insurance Campaign batch not found"); process.exit(1); }
  console.log("Batch:", batch.id);

  // Re-send scrape events for just these two companies
  const rows = await sql`
    SELECT p.company_id, c.name
    FROM pocs p
    JOIN companies c ON c.id = p.company_id
    WHERE p.batch_id = ${batch.id}
      AND c.name = ANY(${COMPANIES})
  `;

  const events = rows.map((r: { company_id: string }) => ({
    name: "company/scrape",
    data: { companyId: r.company_id, batchId: batch.id },
  }));

  const inngestBaseUrl  = process.env.INNGEST_BASE_URL  ?? "http://localhost:8288";
  const inngestEventKey = process.env.INNGEST_EVENT_KEY ?? "local";

  const resp = await fetch(`${inngestBaseUrl}/e/${inngestEventKey}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(events),
  });

  if (!resp.ok) { console.error("Inngest error:", await resp.text()); process.exit(1); }
  console.log("Sent events:", await resp.json());
  console.log(`\nMonitor at: http://localhost:8288`);
}

main().catch(e => { console.error(e); process.exit(1); });
