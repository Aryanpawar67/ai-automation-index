import { neon } from '@neondatabase/serverless';
import { inngest } from '../src/inngest/client';

const sql = neon(process.env.DATABASE_URL!);
const frpId = 'db4ce886-c735-4551-9a20-ac4870f7ef84';
const batchId = '53a9b196-413c-4fb8-a302-3749524fba91';

async function main() {
  // Get scraped JDs for FRP
  const jds = await sql`
    SELECT id, company_id, title FROM job_descriptions
    WHERE company_id = ${frpId} AND status = 'scraped'
    ORDER BY created_at ASC
  `;
  console.log(`Found ${jds.length} scraped JDs`);
  
  // Cap at 15 (large company: 63 > 50 threshold → LARGE_ANALYSE = 15)
  const toQueue = jds.slice(0, 15);
  
  // Mark as pending
  for (const jd of toQueue) {
    await sql`UPDATE job_descriptions SET status = 'pending' WHERE id = ${jd.id}`;
  }
  console.log(`Marked ${toQueue.length} JDs as pending`);
  
  // Send Inngest events
  await inngest.send(
    toQueue.map(jd => ({
      name: 'jd/analyze' as const,
      data: { jobDescriptionId: jd.id, batchId },
    }))
  );
  console.log(`Queued ${toQueue.length} JDs for analysis`);
  console.log('Titles:', toQueue.map(j => j.title));
}

main().catch(console.error);
