/**
 * Poll until MMA scrape completes, then POST to the admin analyse endpoint
 * to queue jd/analyze (the UI button equivalent).
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const BATCH    = "3cb27ac2-68ee-48be-8b81-60eef56eaf4b";
const COMPANY  = "dfb7781f-1eeb-4f2e-912a-a6ad89ce668b";
const APP_BASE = process.env.APP_BASE_URL ?? "http://localhost:3003";

(async () => {
  for (let i = 0; i < 90; i++) {
    const [c] = await sql`SELECT scrape_status, scrape_error FROM companies WHERE id = ${COMPANY}`;
    const [{ count }] = await sql`SELECT COUNT(*) AS count FROM job_descriptions WHERE batch_id = ${BATCH}`;
    console.log(`[${i * 5}s] scrape=${c.scrape_status} jds=${count}`);
    if (c.scrape_status === "complete") break;
    if (c.scrape_status === "failed") { console.log("ERR:", c.scrape_error); process.exit(1); }
    await new Promise(r => setTimeout(r, 5000));
  }

  // Trigger analyse via the admin route (matches the UI's "Analyze" button)
  const resp = await fetch(`${APP_BASE}/api/admin/batches/${BATCH}/analyse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ companyId: COMPANY }),
  });
  console.log("analyse:", resp.status, await resp.text());
})();
