import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const rows = await sql`SELECT id, name, career_page_url, ats_type, scrape_status FROM companies WHERE name ILIKE '%maveric%' ORDER BY name`;
for (const r of rows) console.log(r.id, r.ats_type?.padEnd(12), r.scrape_status?.padEnd(12), r.career_page_url);
