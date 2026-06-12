import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL!);
async function main() {
  const frpId = 'db4ce886-c735-4551-9a20-ac4870f7ef84';
  
  // Check analyses for FRP
  const analyses = await sql`
    SELECT a.id, jd.title, a.overall_score, a.created_at
    FROM analyses a
    JOIN job_descriptions jd ON a.job_description_id = jd.id
    WHERE a.company_id = ${frpId}
    ORDER BY a.created_at DESC
    LIMIT 5
  `;
  console.log('Existing analyses:', analyses.length, JSON.stringify(analyses.slice(0, 3), null, 2));
  
  const [company] = await sql`SELECT report_token, slug FROM companies WHERE id = ${frpId}`;
  console.log(`Report URL: /report/${company.slug}?token=${company.report_token}`);
}
main().catch(console.error);
