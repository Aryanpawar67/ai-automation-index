import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL!);
async function main() {
  const rows = await sql`
    SELECT id, name, ats_type, scrape_status, slug, report_token, career_page_url, total_jobs_available
    FROM companies WHERE name ILIKE '%globe life%'
  `;
  console.log(JSON.stringify(rows, null, 2));
}
main().catch(console.error);
