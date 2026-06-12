import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL!);
async function main() {
  const rows = await sql`
    SELECT name, career_page_url, ats_type, scrape_status
    FROM companies
    WHERE name IN ('Globe Life', 'Excellus BCBS', 'Foundation Risk Partners')
    ORDER BY name
  `;
  for (const r of rows) {
    console.log(`${r.name}`);
    console.log(`  career_page_url: ${r.career_page_url}`);
    console.log(`  ats_type:        ${r.ats_type}`);
    console.log(`  scrape_status:   ${r.scrape_status}`);
  }
}
main().catch(console.error);
