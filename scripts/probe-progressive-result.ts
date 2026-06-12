import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
(async () => {
  const coId = "b6053b38-9e9a-42bb-86bb-3d079ef989e0";
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
    SELECT title, length(raw_text) AS rt_len, status
    FROM job_descriptions WHERE company_id = ${coId}
    ORDER BY created_at ASC
  `;
  console.log(`All ${samples.length} titles:`);
  for (const s of samples) console.log(`  - [${s.status}] ${s.title}  (len=${s.rt_len})`);
})();
