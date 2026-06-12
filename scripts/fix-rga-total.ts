import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const COMPANY_ID = "b59a8e28-d7f7-4f25-a38d-5c2559bb9c9a";

async function main() {
  const [before] = await sql`SELECT total_jobs_available FROM companies WHERE id = ${COMPANY_ID}`;
  console.log("Before:", before.total_jobs_available);
  await sql`UPDATE companies SET total_jobs_available = 75 WHERE id = ${COMPANY_ID}`;
  const [after] = await sql`SELECT total_jobs_available FROM companies WHERE id = ${COMPANY_ID}`;
  console.log("After:", after.total_jobs_available);
}

main().catch(e => { console.error(e); process.exit(1); });
