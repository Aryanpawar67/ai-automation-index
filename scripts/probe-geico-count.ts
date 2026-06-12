import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
(async () => {
  const id = "4997675f-1c94-4032-aece-dc91b36d7af5";
  const counts = await sql`SELECT status, count(*) FROM job_descriptions WHERE company_id = ${id} GROUP BY status`;
  console.log("counts:", counts);
  const all = await sql`
    SELECT id, title, source_url, length(raw_text) AS rt_len, status,
           substr(raw_text, 1, 200) AS preview
    FROM job_descriptions WHERE company_id = ${id}
    ORDER BY created_at ASC
  `;
  console.log("\nALL", all.length, "JDs:");
  for (const r of all) {
    console.log(`\n  TITLE:   ${r.title}`);
    console.log(`  URL:     ${r.source_url}`);
    console.log(`  STATUS:  ${r.status}, len=${r.rt_len}`);
    console.log(`  PREVIEW: ${(r.preview ?? "").replace(/\s+/g, " ")}`);
  }
})();
