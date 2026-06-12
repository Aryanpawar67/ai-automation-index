import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
(async () => {
  const coId = "f937713d-c12c-4849-bd00-a653a6fa9d4c";
  console.log("--- pocs ---");
  console.log(await sql`SELECT id, batch_id FROM pocs WHERE company_id = ${coId}`);
  console.log("--- job_descriptions (count) ---");
  console.log(await sql`SELECT batch_id, count(*) FROM job_descriptions WHERE company_id = ${coId} GROUP BY batch_id`);
  console.log("--- recent batches ---");
  console.log(await sql`SELECT id, name, status, total_jds, total_pocs, created_at FROM batches WHERE name ILIKE '%fiserv%' OR filename ILIKE '%fiserv%' ORDER BY created_at DESC LIMIT 5`);
})();
