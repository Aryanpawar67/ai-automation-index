import { neon } from '@neondatabase/serverless';
import { inngest } from '../src/inngest/client';

const sql = neon(process.env.DATABASE_URL!);
const companyId = 'aabe93d1-ea2a-4e3a-a9e8-7acdb7db802d';
const batchId = '0cf1d431-d7a9-4691-a4f8-d01f793bd4e0';

async function main() {
  const jds = await sql`
    SELECT id, title FROM job_descriptions
    WHERE company_id = ${companyId} AND status = 'scraped'
    ORDER BY created_at ASC
  `;
  console.log(`Found ${jds.length} scraped JDs`);

  const toQueue = jds.slice(0, 10);

  for (const jd of toQueue) {
    await sql`UPDATE job_descriptions SET status = 'pending' WHERE id = ${jd.id}`;
  }

  await inngest.send(
    toQueue.map(jd => ({
      name: 'jd/analyze' as const,
      data: { jobDescriptionId: jd.id, batchId },
    }))
  );

  console.log(`Queued ${toQueue.length} for analysis, ${jds.length - toQueue.length} held as reserve`);
  console.log('Queued:', toQueue.map(j => j.title));
  console.log('\nReserve:', jds.slice(10).map(j => j.title));
}

main().catch(console.error);
