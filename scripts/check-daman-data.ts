import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
async function main() {
  const cid = "d99477bc-9b43-45ca-91ee-2ce3c6f26c49";

  const allAnalyses = await sql`
    SELECT a.id, a.created_at, j.id AS jd_id, j.batch_id, j.title, j.status, b.status AS batch_status, b.filename
    FROM analyses a
    JOIN job_descriptions j ON a.job_description_id = j.id
    LEFT JOIN batches b ON j.batch_id = b.id
    WHERE a.company_id = ${cid}
    ORDER BY a.created_at
  `;
  console.log(`Total analyses for Daman: ${allAnalyses.length}`);
  for (const r of allAnalyses as { id: string; created_at: Date; jd_id: string; batch_id: string | null; title: string; status: string; batch_status: string | null; filename: string | null }[]) {
    console.log(`  ${r.created_at.toISOString().slice(0,19)} [${r.status}] batch=${r.batch_id?.slice(0,8) ?? "ORPHAN"}(${r.batch_status ?? "deleted"}) — ${r.title}`);
  }

  const allBatchIds = [...new Set((allAnalyses as { batch_id: string | null }[]).map(r => r.batch_id).filter(Boolean))];
  console.log(`\nDistinct batches referenced: ${allBatchIds.length}`);
  for (const bid of allBatchIds) {
    const b = await sql`SELECT id, name, filename, status, created_at FROM batches WHERE id = ${bid}`;
    console.log("  ", b[0]);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
