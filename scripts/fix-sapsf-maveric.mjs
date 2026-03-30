import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);

// Get exact IDs for all Maveric rows
const all = await sql`SELECT id, career_page_url, scrape_status FROM companies WHERE name ILIKE '%maveric%'`;
for (const r of all) console.log(r.id, r.scrape_status, r.career_page_url?.substring(0,50));

// Update the ones still on old URL
const updated = await sql`
  UPDATE companies 
  SET career_page_url = 'https://career44.sapsf.com/career?company=mavericsys&career_ns=job_listing_summary&navBarLevel=JOB_SEARCH',
      scrape_status   = 'failed',
      scrape_error    = 'Retrying with corrected SAP SF URL'
  WHERE name ILIKE '%maveric%'
    AND career_page_url LIKE '%maveric-systems.com%'
  RETURNING id, career_page_url
`;
console.log('Updated rows:', updated.length);
for (const r of updated) console.log(' ->', r.id, r.career_page_url?.substring(0,50));
