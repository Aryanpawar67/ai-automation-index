// Complete-analysis script for Volante Technologies (BambooHR: volanteoneteam).
// Bypasses targetScrapeCount / targetAnalyseCount — scrapes and queues EVERY
// available JD for analysis under a dedicated "COMPLETE ANALYSIS" batch.

import { neon }   from "@neondatabase/serverless";
import { inngest } from "../../src/inngest/client";
import { stripHtml } from "../../src/lib/stripHtml";
import { isValidJD }  from "../../src/lib/validation";
import { randomBytes } from "crypto";

const sql = neon(process.env.DATABASE_URL!);

const COMPANY_SLUG = "volante-technologies";
const SUBDOMAIN    = "volanteoneteam";
const UA           = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120";
const FIRECRAWL    = "https://api.firecrawl.dev/v1/scrape";
const CONCURRENCY  = 4;

interface BambooListItem { id: string | number; jobOpeningName?: string; departmentLabel?: string | null }
interface BambooList     { result?: BambooListItem[] }
interface BambooDetail   { jobOpening?: { jobOpeningName?: string; description?: string } }

async function fetchList(): Promise<BambooListItem[]> {
  const res = await fetch(`https://${SUBDOMAIN}.bamboohr.com/careers/list`, {
    headers: { "Accept": "application/json", "User-Agent": UA },
    signal:  AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`BambooHR list failed: ${res.status}`);
  const data = await res.json() as BambooList;
  return data.result ?? [];
}

async function detailViaApi(id: string | number): Promise<string> {
  try {
    const res = await fetch(`https://${SUBDOMAIN}.bamboohr.com/careers/${id}/detail`, {
      headers: { "Accept": "application/json", "User-Agent": UA },
      signal:  AbortSignal.timeout(10_000),
    });
    if (!res.ok) return "";
    const d = await res.json() as BambooDetail;
    return stripHtml(d.jobOpening?.description ?? "");
  } catch { return ""; }
}

async function detailViaFirecrawl(url: string): Promise<string> {
  if (!process.env.FIRECRAWL_API_KEY) return "";
  try {
    const res = await fetch(FIRECRAWL, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.FIRECRAWL_API_KEY}` },
      body:    JSON.stringify({ url, formats: ["markdown"], timeout: 90_000, waitFor: 7000 }),
      signal:  AbortSignal.timeout(120_000),
    });
    if (!res.ok) return "";
    const data = await res.json() as { data?: { markdown?: string } };
    const md   = data?.data?.markdown ?? "";
    if (!md) return "";
    const afterRule = md.includes("* * *") ? md.slice(md.indexOf("* * *") + 5) : md;
    return afterRule
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/\s{3,}/g, "\n")
      .trim();
  } catch { return ""; }
}

async function mapConcurrent<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
  }));
  return out;
}

(async () => {
  const [company] = await sql`
    SELECT id, name, total_jobs_available FROM companies WHERE slug = ${COMPANY_SLUG}
  `;
  if (!company) throw new Error(`Company '${COMPANY_SLUG}' not found in DB`);
  const companyId: string = company.id;

  console.log(`Company: ${company.name} (${companyId})`);

  // Fetch full listing — no cap.
  const openings = await fetchList();
  console.log(`BambooHR listing: ${openings.length} openings`);
  if (openings.length === 0) { console.log("No openings found — aborting."); process.exit(0); }

  // Fetch detail for every opening.
  console.log(`Fetching details (concurrency=${CONCURRENCY})…`);
  interface FetchedJD { title: string; rawText: string; sourceUrl: string; department?: string }
  const fetched = await mapConcurrent(openings, CONCURRENCY, async (job): Promise<FetchedJD | null> => {
    const sourceUrl = `https://${SUBDOMAIN}.bamboohr.com/careers/${job.id}`;
    let rawText = await detailViaApi(job.id);
    if (rawText.length < 100) rawText = await detailViaFirecrawl(sourceUrl);
    if (rawText.length < 100) { console.log(`  SKIP (too short): ${job.jobOpeningName}`); return null; }
    return { title: job.jobOpeningName ?? "Untitled", rawText: rawText.slice(0, 12_000), sourceUrl, department: job.departmentLabel ?? undefined };
  });

  const jds = fetched.filter((x): x is FetchedJD => x !== null);
  console.log(`Fetched ${jds.length}/${openings.length} JDs with content`);

  // Create a dedicated COMPLETE ANALYSIS batch.
  const batchName = `COMPLETE ANALYSIS — ${company.name}`;
  const filename  = `complete-analysis-volante-technologies.csv`;
  const [batch] = await sql`
    INSERT INTO batches (filename, name, uploaded_by, status, total_pocs)
    VALUES (${filename}, ${batchName}, 'admin', 'scraping', 1)
    RETURNING id
  `;
  const batchId: string = batch.id;

  await sql`
    INSERT INTO pocs (batch_id, company_id, first_name, last_name, email)
    VALUES (${batchId}, ${companyId}, ${company.name}, '', '')
  `;
  console.log(`Batch created: ${batchId}`);
  console.log(`Watch: http://localhost:3003/admin/batches/${batchId}`);

  // Insert all JDs as 'pending' — skip the 'scraped' reserve stage entirely.
  let inserted = 0, skipped = 0;
  const toAnalyze: string[] = [];

  for (const jd of jds) {
    const valid = isValidJD(jd.title, jd.rawText);
    const status = valid ? "pending" : "invalid";
    const [row] = await sql`
      INSERT INTO job_descriptions (company_id, batch_id, title, raw_text, source_url, department, status)
      VALUES (${companyId}, ${batchId}, ${jd.title}, ${jd.rawText}, ${jd.sourceUrl ?? null}, ${jd.department ?? null}, ${status})
      RETURNING id
    `;
    if (valid) { toAnalyze.push(row.id); inserted++; }
    else        { skipped++; console.log(`  INVALID: ${jd.title}`); }
  }

  // Update batch with real JD count.
  await sql`UPDATE batches SET total_jds = ${toAnalyze.length}, status = 'analyzing' WHERE id = ${batchId}`;

  console.log(`Inserted: ${inserted} valid, ${skipped} invalid`);

  if (toAnalyze.length === 0) { console.log("Nothing to analyze — done."); process.exit(0); }

  // Fire jd/analyze for every valid JD — no cap.
  await inngest.send(
    toAnalyze.map(jobDescriptionId => ({
      name: "jd/analyze" as const,
      data: { jobDescriptionId, batchId },
    })),
  );

  console.log(`Sent ${toAnalyze.length} jd/analyze events`);
  console.log(`\nDone. Watch: http://localhost:3003/admin/batches/${batchId}`);
})().catch(e => { console.error(e); process.exit(1); });
