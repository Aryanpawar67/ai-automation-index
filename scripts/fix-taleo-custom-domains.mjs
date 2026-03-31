/**
 * One-time fix: update Belden and Yash Technologies from sap_sf → oracle_taleo
 * and correct Yash's career page URL to the actual Taleo custom domain.
 * Run with: node scripts/fix-taleo-custom-domains.mjs
 */

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

async function main() {
  // 1. Fix Belden: change atsType sap_sf → oracle_taleo
  //    URL stays as careers.belden.com (Taleo REST API is on that host)
  const beldenResult = await sql`
    UPDATE companies
    SET ats_type = 'oracle_taleo'
    WHERE career_page_url ILIKE '%careers.belden.com%'
      AND (ats_type = 'sap_sf' OR ats_type IS NULL)
    RETURNING id, name, career_page_url, ats_type
  `;
  console.log("Belden updated:", beldenResult);

  // 2. Fix Yash Technologies: change URL to careers.yash.com AND ats_type to oracle_taleo
  const yashResult = await sql`
    UPDATE companies
    SET career_page_url = 'https://careers.yash.com',
        ats_type = 'oracle_taleo'
    WHERE (
      career_page_url ILIKE '%career10.successfactors.com%yashtechno%'
      OR career_page_url ILIKE '%careers.yash.com%'
      OR name ILIKE '%yash tech%'
    )
    RETURNING id, name, career_page_url, ats_type
  `;
  console.log("Yash updated:", yashResult);

  // 3. Delete stale/garbage JDs for these companies so they can be re-scraped
  if (beldenResult.length > 0) {
    const beldenIds = beldenResult.map(r => r.id);
    for (const id of beldenIds) {
      const del = await sql`
        DELETE FROM job_descriptions
        WHERE company_id = ${id}
          AND status NOT IN ('complete', 'analyzing')
        RETURNING id, title, status
      `;
      console.log(`Deleted ${del.length} stale JDs for Belden (${id}):`);
      del.forEach(j => console.log(`  [${j.status}] ${j.title}`));
    }
  }

  if (yashResult.length > 0) {
    const yashIds = yashResult.map(r => r.id);
    for (const id of yashIds) {
      const del = await sql`
        DELETE FROM job_descriptions
        WHERE company_id = ${id}
          AND status NOT IN ('complete', 'analyzing')
        RETURNING id, title, status
      `;
      console.log(`Deleted ${del.length} stale JDs for Yash (${id}):`);
      del.forEach(j => console.log(`  [${j.status}] ${j.title}`));
    }
  }

  // 4. Reset scrape_status to 'pending' for these companies
  const allIds = [...beldenResult, ...yashResult].map(r => r.id);
  if (allIds.length > 0) {
    await sql`
      UPDATE companies
      SET scrape_status = 'pending', scrape_error = NULL
      WHERE id = ANY(${allIds})
    `;
    console.log(`Reset scrape_status → pending for ${allIds.length} company(ies)`);
  }

  console.log("\nDone. Now re-scrape Belden and Yash from the admin UI.");
}

main().catch(err => { console.error(err); process.exit(1); });
