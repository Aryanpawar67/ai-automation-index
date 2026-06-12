import { neon } from '@neondatabase/serverless';
import { inngest } from '../src/inngest/client';
const sql = neon(process.env.DATABASE_URL!);
const companyId = 'ee5519fa-7f6d-4fb9-ab8b-a881e3f870d6';
const batchId = '5d5c99ca-a1cb-41be-821b-c33f31413bb2';
async function main() {
  const all = await sql`SELECT id, title, source_url FROM job_descriptions WHERE company_id=${companyId} ORDER BY created_at ASC`;
  console.log('Total JDs:', all.length);
  // Find and delete duplicates (keep first occurrence of each source_url)
  const seen = new Set<string>();
  const toDelete: string[] = [];
  for (const jd of all) {
    const key = jd.source_url ?? jd.title;
    if (seen.has(key)) { toDelete.push(jd.id); } else { seen.add(key); }
  }
  if (toDelete.length > 0) {
    for (const id of toDelete) await sql`DELETE FROM job_descriptions WHERE id=${id}`;
    console.log(`Deleted ${toDelete.length} duplicates`);
  }
  const remaining = await sql`SELECT id, title, status FROM job_descriptions WHERE company_id=${companyId} ORDER BY created_at ASC`;
  console.log('Remaining:', remaining.length, remaining.map(j => j.title));
  // Queue 15 for analysis, keep 5 reserve
  const toQueue = remaining.filter(j => j.status === 'scraped').slice(0, 15);
  for (const jd of toQueue) await sql`UPDATE job_descriptions SET status='pending' WHERE id=${jd.id}`;
  await inngest.send(toQueue.map(jd => ({ name: 'jd/analyze' as const, data: { jobDescriptionId: jd.id, batchId } })));
  console.log(`Queued ${toQueue.length} for analysis`);
  const reserve = remaining.filter(j => j.status === 'scraped').slice(15);
  console.log('Reserve:', reserve.map(j => j.title));
}
main().catch(console.error);
