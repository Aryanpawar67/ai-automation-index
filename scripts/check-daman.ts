import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
async function main() {
  const rows = await sql`SELECT id, name, slug, career_page_url, ats_type, scrape_status FROM companies WHERE name ILIKE '%daman%' OR slug ILIKE '%daman%'`;
  console.log(rows);
}
main().catch(e => { console.error(e); process.exit(1); });
