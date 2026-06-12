import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL!);
async function main() {
  const rows = await sql`SELECT id, name, career_page_url, ats_type, scrape_status, slug FROM companies WHERE name ILIKE '%blue%arizona%' OR career_page_url ILIKE '%azblue%' OR slug ILIKE '%bcbs-az%'`;
  console.log(JSON.stringify(rows, null, 2));
}
main().catch(console.error);
