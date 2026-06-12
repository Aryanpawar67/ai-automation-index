/**
 * Marks false-positive JDs (banner/nav elements) as 'invalid' for the RGA batch,
 * and corrects the batch totalJds counter.
 *
 * Run: npx tsx --env-file=.env.local scripts/fix-rga-jds.ts
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

const COMPANY_ID = "b59a8e28-d7f7-4f25-a38d-5c2559bb9c9a";
const BATCH_ID   = "aa9e5862-d568-435b-9495-96b065d0d132";

// Titles that are clearly NOT real job postings
const FAKE_TITLE_PATTERNS = [
  /^yun[- ]cui[- ]banner$/i,
  /^skip to/i,
];

async function main() {
  const rows = await sql`
    SELECT id, title, status
    FROM job_descriptions
    WHERE company_id = ${COMPANY_ID}
    ORDER BY created_at
  `;

  console.log("All JDs for RGA:");
  rows.forEach((r: { id: string; title: string; status: string }) =>
    console.log(`  [${r.status}] ${r.title} (${r.id})`)
  );

  const toInvalidate = rows.filter((r: { id: string; title: string; status: string }) =>
    FAKE_TITLE_PATTERNS.some(re => re.test(r.title))
  );

  if (toInvalidate.length === 0) {
    console.log("\nNo fake JDs found — nothing to do.");
    return;
  }

  console.log(`\nInvalidating ${toInvalidate.length} fake JD(s):`);
  for (const jd of toInvalidate as Array<{ id: string; title: string; status: string }>) {
    await sql`
      UPDATE job_descriptions
      SET status = 'invalid'
      WHERE id = ${jd.id}
    `;
    console.log(`  ✓ Marked invalid: "${jd.title}"`);
  }

  // Recount and fix batch totalJds
  const [cnt] = await sql`
    SELECT COUNT(*) AS n
    FROM job_descriptions
    WHERE batch_id = ${BATCH_ID}
      AND status NOT IN ('invalid', 'cancelled', 'scraped')
  `;
  // Also count scraped ones that should count toward total
  const [scrapedCnt] = await sql`
    SELECT COUNT(*) AS n
    FROM job_descriptions
    WHERE batch_id = ${BATCH_ID}
      AND status IN ('scraped', 'pending', 'analyzing', 'complete', 'failed')
  `;
  const newTotal = Number(scrapedCnt.n);
  await sql`
    UPDATE batches
    SET total_jds = ${newTotal}
    WHERE id = ${BATCH_ID}
  `;
  console.log(`\nUpdated batch totalJds → ${newTotal}`);
}

main().catch(e => { console.error(e); process.exit(1); });
