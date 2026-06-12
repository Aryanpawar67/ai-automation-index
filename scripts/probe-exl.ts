/**
 * Find EXL company row + active batch.
 * Run: npx tsx --env-file=.env.local scripts/probe-exl.ts
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const rows = await sql`
    SELECT id, name, slug, career_page_url, ats_type, scrape_status, total_jobs_available, scraped_at
    FROM companies
    WHERE name ILIKE '%exl%' OR slug ILIKE '%exl%'
    ORDER BY created_at DESC
    LIMIT 10
  `;
  console.log("Companies:", JSON.stringify(rows, null, 2));

  if (rows.length === 0) return;
  for (const r of rows) {
    const batches = await sql`
      SELECT id, status, total_jds, processed_jds, failed_jds, created_at
      FROM batches
      WHERE id IN (
        SELECT DISTINCT batch_id FROM job_descriptions WHERE company_id = ${r.id}
      )
      ORDER BY created_at DESC
      LIMIT 5
    `;
    console.log(`Batches for ${r.name} (${r.id}):`, JSON.stringify(batches, null, 2));
  }
}
main().catch(e => { console.error(e); process.exit(1); });
