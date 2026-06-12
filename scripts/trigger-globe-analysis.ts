import { neon } from '@neondatabase/serverless';
import { inngest } from '../src/inngest/client';

const sql = neon(process.env.DATABASE_URL!);
const companyId = '060f9b85-e4db-4986-8e4b-190fbb8bf224';
const batchId = 'b0da8029-0bb7-4ea5-bfaf-bfea972ce88c';

async function main() {
  const jds = await sql`
    SELECT id, title FROM job_descriptions
    WHERE company_id = ${companyId} AND status = 'scraped'
    ORDER BY created_at ASC
  `;
  console.log(`Found ${jds.length} scraped JDs`);
  
  // SMALL_ANALYSE = 10, keep 5 as reserve
  const toQueue = jds.slice(0, 10);
  
  for (const jd of toQueue) {
    await sql`UPDATE job_descriptions SET status = 'pending' WHERE id = ${jd.id}`;
  }
  console.log(`Marked ${toQueue.length} as pending, ${jds.length - toQueue.length} kept as reserve`);
  
  await inngest.send(
    toQueue.map(jd => ({
      name: 'jd/analyze' as const,
      data: { jobDescriptionId: jd.id, batchId },
    }))
  );
  
  console.log(`Queued ${toQueue.length} JDs for analysis`);
  console.log('Queued:', toQueue.map(j => j.title));
  console.log('\nReserve (scraped, not queued):');
  console.log(jds.slice(10).map(j => j.title));
}

main().catch(console.error);
