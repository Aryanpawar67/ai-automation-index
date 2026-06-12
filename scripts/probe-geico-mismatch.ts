import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
(async () => {
  const [co] = await sql`
    SELECT id, name, scrape_status, total_jobs_available, career_page_url, ats_type
    FROM companies WHERE name ILIKE '%geico%' OR career_page_url ILIKE '%geico%'
    ORDER BY created_at DESC LIMIT 1
  `;
  console.log("Company:", co);
  if (!co) return;
  const samples = await sql`
    SELECT title, source_url, length(raw_text) AS rt_len, substr(raw_text, 1, 250) AS preview
    FROM job_descriptions WHERE company_id = ${co.id}
    ORDER BY created_at ASC LIMIT 6
  `;
  console.log("\nFirst 6 JDs (title vs description preview):");
  for (const s of samples) {
    console.log("\n  TITLE: ", s.title);
    console.log("  URL:   ", s.source_url);
    console.log("  LEN:   ", s.rt_len);
    console.log("  PREVIEW:", s.preview.replace(/\s+/g, " "));
  }
})();
