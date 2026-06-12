import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
(async () => {
  const coId = "0117b8fa-0f11-499f-be9e-76ffb42d46f4";
  const [co] = await sql`
    SELECT scrape_status, total_jobs_available, scrape_error, scraped_at
    FROM companies WHERE id = ${coId}
  `;
  console.log("Company:", co);
  const counts = await sql`
    SELECT status, count(*) FROM job_descriptions WHERE company_id = ${coId} GROUP BY status
  `;
  console.log("JD counts:", counts);
  const samples = await sql`
    SELECT title, length(raw_text) AS rt_len, source_url, status
    FROM job_descriptions WHERE company_id = ${coId}
    ORDER BY created_at ASC LIMIT 6
  `;
  console.log("First 6:");
  for (const s of samples) console.log(" -", s);
})();
