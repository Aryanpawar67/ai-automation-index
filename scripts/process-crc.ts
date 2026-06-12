import { db } from "../src/lib/db/client";
import { companies, batches, jobDescriptions, pocs } from "../src/lib/db/schema";
import { stripHtml } from "../src/lib/stripHtml";
import { isValidJD } from "../src/lib/validation";
import { ilike, eq } from "drizzle-orm";

const HOST     = "tihinsurance.wd1.myworkdayjobs.com";
const TENANT   = "tihinsurance";
const JOB_SITE = "CRC_Careers";
const TOTAL    = 118;
const KEEP     = 20; // LARGE_SCRAPE threshold

/** Extract externalPath from a Workday job URL. */
function externalPath(jobUrl: string): string | null {
  const m = jobUrl.match(/\/job\/[^?#]+/);
  return m ? m[0] : null;
}

/** Fetch one JD via the CxS detail API (known-working even when list API is 500). */
async function fetchDetail(path: string): Promise<string> {
  try {
    const res = await fetch(
      `https://${HOST}/wday/cxs/${TENANT}/${JOB_SITE}${path}`,
      { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) return "";
    const data = await res.json();
    const info = data?.jobPostingInfo ?? {};
    const parts = [info.jobDescription, info.jobRequirements]
      .filter(Boolean) as string[];
    return parts.length ? stripHtml(parts.join("\n\n")) : "";
  } catch { return ""; }
}

async function main() {
  // 1. Find CRC Group
  const [company] = await db.select().from(companies).where(ilike(companies.name, "%CRC%"));
  if (!company) { console.error("CRC Group not found"); process.exit(1); }
  console.log("Company:", company.name, company.id);

  // 2. Delete stale batch created earlier and make a fresh one
  const stale = await db.select({ id: batches.id }).from(batches)
    .where(eq(batches.filename, "crc-group-manual.csv"));
  for (const b of stale) {
    await db.delete(batches).where(eq(batches.id, b.id));
    console.log("Deleted stale batch:", b.id);
  }

  const [batch] = await db.insert(batches).values({
    filename:   "crc-group-manual.csv",
    name:       "CRC Group",
    uploadedBy: "admin",
    status:     "scraping",
    totalPocs:  1,
  }).returning();
  console.log("Created batch:", batch.id);

  await db.insert(pocs).values({
    batchId: batch.id, companyId: company.id,
    firstName: "CRC Group", lastName: "", email: "",
  });

  // 3. Firecrawl the listing page to get all job links
  console.log("\nFirecrawling listing page...");
  const fcRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}` },
    body: JSON.stringify({ url: `https://${HOST}/en-US/${JOB_SITE}/jobs`, formats: ["markdown"], waitFor: 6000 }),
    signal: AbortSignal.timeout(60_000),
  });
  const fcData = await fcRes.json() as { data?: { markdown?: string } };
  const markdown = fcData?.data?.markdown ?? "";
  console.log("Markdown length:", markdown.length);

  // Extract job links (no cap — take up to KEEP)
  const linkRe = /\[([^\]]{5,120})\]\((https?:\/\/[^\)]+\/job\/[^\)]+)\)/gi;
  const seen = new Set<string>();
  const links: Array<{ title: string; url: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(markdown)) !== null && links.length < KEEP) {
    const url = m[2].trim();
    if (seen.has(url)) continue;
    seen.add(url);
    links.push({ title: m[1].trim(), url });
  }
  console.log(`Found ${links.length} job links (capped at ${KEEP})`);

  // 4. Fetch individual JD descriptions via the working detail API
  const jdRows: Array<{
    companyId: string; batchId: string; title: string;
    rawText: string; sourceUrl: string | null;
    department: string | null; status: "scraped" | "invalid";
  }> = [];

  for (const { title, url } of links) {
    const path = externalPath(url);
    const rawText = path ? await fetchDetail(path) : "";
    const effective = rawText.length >= 100 ? rawText : markdown.slice(0, 8000);
    process.stdout.write(`  ${title.slice(0, 50)} → ${rawText.length} chars\n`);
    jdRows.push({
      companyId:  company.id,
      batchId:    batch.id,
      title,
      rawText:    effective,
      sourceUrl:  url,
      department: null,
      status:     isValidJD(title, effective) ? "scraped" : "invalid",
    });
  }

  // 5. Insert JDs
  await db.insert(jobDescriptions).values(jdRows);
  const validCount = jdRows.filter(j => j.status === "scraped").length;
  console.log(`\nInserted ${jdRows.length} JDs (${validCount} valid)`);

  // 6. Update company + batch
  await db.update(companies).set({
    scrapeStatus: "complete", scrapedAt: new Date(),
    scrapeError: null, totalJobsAvailable: TOTAL,
  }).where(eq(companies.id, company.id));

  await db.update(batches).set({
    totalJds: validCount, status: "complete", completedAt: new Date(),
  }).where(eq(batches.id, batch.id));

  console.log("Done — batch", batch.id, "| totalAvailable:", TOTAL, "| scraped:", validCount);
}

main().catch(e => { console.error(e); process.exit(1); });
