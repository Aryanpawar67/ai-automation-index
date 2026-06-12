import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
(async () => {
  const id = "4997675f-1c94-4032-aece-dc91b36d7af5";
  const [co] = await sql`
    SELECT scrape_status, total_jobs_available, scrape_error, scraped_at
    FROM companies WHERE id = ${id}
  `;
  console.log("Company:", co);
})();
