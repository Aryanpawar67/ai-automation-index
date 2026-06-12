import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
(async () => {
  const rows = await sql`
    SELECT id, name, slug, scrape_status, total_jobs_available, career_page_url
    FROM companies
    WHERE name ILIKE '%fiserv%' OR career_page_url ILIKE '%fiserv%'
    ORDER BY created_at DESC
    LIMIT 5
  `;
  console.log(JSON.stringify(rows, null, 2));
})();
