import { neon } from "@neondatabase/serverless";
import { inngest } from "../src/inngest/client";
import { targetAnalyseCount } from "../src/lib/jdLimits";

const sql = neon(process.env.DATABASE_URL!);

const SLUGS = ["datamatics", "ultratech-cement"];

async function main() {
  for (const slug of SLUGS) {
    const [co] = await sql`
      SELECT id, name, total_jobs_available FROM companies WHERE slug = ${slug}
    `;
    if (!co) { console.log(`No company for slug ${slug}`); continue; }

    // Most recent batch for this company.
    const [batch] = await sql`
      SELECT b.id FROM batches b
      JOIN pocs p ON p.batch_id = b.id
      WHERE p.company_id = ${co.id}
      ORDER BY b.created_at DESC LIMIT 1
    `;

    const jds = await sql`
      SELECT id, title FROM job_descriptions
      WHERE company_id = ${co.id} AND status = 'scraped'
      ORDER BY created_at ASC
    `;

    const keep    = targetAnalyseCount(co.total_jobs_available);
    const toQueue = jds.slice(0, keep);

    for (const jd of toQueue) {
      await sql`UPDATE job_descriptions SET status = 'pending' WHERE id = ${jd.id}`;
    }

    await inngest.send(
      toQueue.map(jd => ({
        name: "jd/analyze" as const,
        data: { jobDescriptionId: jd.id, batchId: batch.id },
      })),
    );

    console.log(`${co.name}: ${jds.length} scraped → queued ${toQueue.length} for analysis (${jds.length - toQueue.length} reserve)`);
  }
}

main().catch(console.error);
