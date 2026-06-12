import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const env = readFileSync(".env.local", "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
}
const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const cos = await sql`SELECT id, name, slug, scrape_status, total_jobs_available, created_at FROM companies WHERE slug ILIKE 'daman%'`;
  console.log("--- companies ---");
  console.log(cos);

  for (const c of cos as any[]) {
    console.log(`\n--- ${c.slug} (${c.id}) ---`);
    const jd = await sql`SELECT status, COUNT(*)::int AS n FROM job_descriptions WHERE company_id = ${c.id} GROUP BY status ORDER BY status`;
    console.log("JD status breakdown:", jd);

    const an = await sql`SELECT COUNT(*)::int AS n FROM analyses WHERE company_id = ${c.id}`;
    console.log("analyses rows:", an);

    const valid = await sql`
      SELECT a.id, jd.title, jd.status
      FROM analyses a
      JOIN job_descriptions jd ON jd.id = a.job_description_id
      WHERE a.company_id = ${c.id} AND jd.status <> 'invalid'
      ORDER BY a.created_at
    `;
    console.log(`non-invalid analyses (page-visible candidates): ${(valid as any[]).length}`);
    console.log(valid);
  }
}
main().catch(console.error);
