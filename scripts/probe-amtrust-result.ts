import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
(async () => {
  const coId = "70454d6c-5fc4-4ac7-a862-49e8782b1337";
  const [co] = await sql`
    SELECT scrape_status, total_jobs_available, scrape_error, scraped_at
    FROM companies WHERE id = ${coId}
  `;
  console.log("Company:", co);
  const counts = await sql`
    SELECT status, count(*) FROM job_descriptions
    WHERE company_id = ${coId} GROUP BY status
  `;
  console.log("JD counts by status:", counts);
  const samples = await sql`
    SELECT title, department, length(raw_text) AS rt_len, source_url, status
    FROM job_descriptions WHERE company_id = ${coId}
    ORDER BY created_at ASC LIMIT 8
  `;
  console.log("First 8 JDs:");
  for (const s of samples) console.log(" -", s);
})();
