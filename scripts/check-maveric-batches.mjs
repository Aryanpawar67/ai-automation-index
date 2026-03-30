import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const rows = await sql`
  SELECT p.company_id, p.batch_id, c.name, c.career_page_url, c.scrape_status
  FROM pocs p 
  JOIN companies c ON c.id = p.company_id 
  WHERE c.name ILIKE '%maveric%'
`;
for (const r of rows) console.log('batch:', r.batch_id, '| status:', r.scrape_status, '| url:', r.career_page_url?.substring(0,60));
if (rows.length === 0) console.log('No pocs found for Maveric');
