import { neon } from "@neondatabase/serverless";
import { randomBytes } from "crypto";

const sql = neon(process.env.DATABASE_URL!);

function slugify(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

const token = () => randomBytes(32).toString("hex");

interface Target { name: string; careerPageUrl: string; total: number }

const TARGETS: Target[] = [
  {
    name:          "NCS Group",
    careerPageUrl: "https://careers.in.ncs-i.com/ncsi/jobslist",
    total:         51,
  },
  {
    name:          "Cohesity",
    careerPageUrl: "https://www.cohesity.com/careers/open-positions/",
    total:         182,
  },
  {
    name:          "Capgemini",
    careerPageUrl: "https://www.capgemini.com/careers/join-capgemini/job-search/?size=11&page=1",
    total:         6321,
  },
];

async function setupCompany(t: Target): Promise<string> {
  const base = slugify(t.name);
  const [existing] = await sql`SELECT id, slug FROM companies WHERE slug = ${base}`;

  let companyId: string;
  if (existing) {
    companyId = existing.id;
    console.log(`Existing company ${t.name}: id=${companyId}`);
    await sql`DELETE FROM job_descriptions WHERE company_id = ${companyId}`;
    await sql`
      UPDATE companies SET
        scrape_status = 'pending', scrape_error = NULL,
        total_jobs_available = ${t.total}, scraped_at = NULL,
        career_page_url = ${t.careerPageUrl}
      WHERE id = ${companyId}
    `;
  } else {
    const conflicts = await sql`SELECT slug FROM companies WHERE slug LIKE ${base + "%"}`;
    const taken = new Set(conflicts.map((r: { slug: string }) => r.slug));
    let finalSlug = base, n = 2;
    while (taken.has(finalSlug)) finalSlug = `${base}-${n++}`;
    const [newCo] = await sql`
      INSERT INTO companies (name, career_page_url, scrape_status, ats_type, slug, report_token, total_jobs_available)
      VALUES (${t.name}, ${t.careerPageUrl}, 'pending', NULL, ${finalSlug}, ${token()}, ${t.total})
      RETURNING id, name, slug
    `;
    console.log("Created:", newCo);
    companyId = newCo.id;
  }
  return companyId;
}

(async () => {
  const inngestBaseUrl  = process.env.INNGEST_BASE_URL  ?? "http://localhost:8288";
  const inngestEventKey = process.env.INNGEST_EVENT_KEY ?? "local";

  for (const t of TARGETS) {
    const companyId = await setupCompany(t);

    const filename = `${slugify(t.name)}-standalone.csv`;
    const [batch] = await sql`
      INSERT INTO batches (filename, name, uploaded_by, status, total_pocs)
      VALUES (${filename}, ${t.name}, 'admin', 'scraping', 1)
      RETURNING id
    `;
    await sql`
      INSERT INTO pocs (batch_id, company_id, first_name, last_name, email)
      VALUES (${batch.id}, ${companyId}, ${t.name}, '', '')
    `;
    console.log(`Batch for ${t.name}: ${batch.id}`);

    const resp = await fetch(`${inngestBaseUrl}/e/${inngestEventKey}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify([{
        name: "company/scrape",
        data: { companyId, batchId: batch.id },
      }]),
    });
    console.log(`Inngest response (${t.name}):`, await resp.json());
    console.log(`Watch: http://localhost:3003/admin/batches/${batch.id}\n`);
  }
})();
