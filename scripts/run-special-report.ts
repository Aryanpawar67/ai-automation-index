/**
 * One-off CLI to run a "special request" report for a single company whose
 * site isn't in the normal upload flow. Produces the same DB state as a
 * standard upload: a `batches` row (visible on /admin/batches), a `companies`
 * row with slug/reportToken, a single placeholder POC, scraped JDs, and queued
 * jd/analyze Inngest events — so the existing UI, report page, and analysis
 * pipeline all work unchanged.
 *
 * Usage:
 *   npx tsx scripts/run-special-report.ts daman
 *   npx tsx scripts/run-special-report.ts pih
 *
 * Each invocation creates its OWN batch (one company per batch).
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { db }           from "../src/lib/db/client";
import {
  batches, companies, pocs, jobDescriptions,
}                       from "../src/lib/db/schema";
import { inngest }      from "../src/inngest/client";
import { scrapeOracleHCM } from "../src/lib/scrapers/oracleHcm";
import { scrapeJobs2WebHtmlDiverse } from "../src/lib/scrapers/jobs2webHtml";
import { isValidJD }    from "../src/lib/validation";
import { generateUniqueSlug } from "../src/lib/slug";
import { generatePermanentToken } from "../src/lib/token";
import type { ScrapedJD }     from "../src/lib/scraper";
import { eq, sql, and }       from "drizzle-orm";

// ── Per-company configs ──────────────────────────────────────────────────────
interface TargetConfig {
  key:           "daman" | "pih";
  companyName:   string;
  careerPageUrl: string;
  atsType:       string;
  pocEmail:      string;
  targetJdCount: number;
  scrape:        () => Promise<ScrapedJD[]>;
}

const POC_EMAIL = "aryan.pawar@imocha.co";

const DAMAN_URL  = "https://erel.fa.em8.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs";
const DAMAN_BASE = "https://erel.fa.em8.oraclecloud.com";
const DAMAN_SITE = "CX_1001";

/**
 * Daman scraper wrapper: `scrapeOracleHCM` drops jobs whose detail-API returns
 * <100 chars (correct for every other company), but Daman has one role (id 1413
 * "Coordinator, Authorisation") where all description fields are empty on their
 * side. For this one-off we want all 10 roles available, so we backfill any
 * missing listings with an honest "description-not-published" stub derived from
 * the title + location (passes isValidJD; flagged in rawText so it's clear).
 */
async function scrapeDamanAllTen(): Promise<ScrapedJD[]> {
  // Full Oracle list — authoritative source of all 10 requisitions
  const listRes = await fetch(
    `${DAMAN_BASE}/hcmRestApi/resources/latest/recruitingCEJobRequisitions` +
    `?onlyData=true&limit=25&expand=requisitionList&finder=findReqs;siteNumber=${DAMAN_SITE}`,
    { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(15_000) },
  );
  const listData = await listRes.json();
  const allJobs  = (listData?.items?.[0]?.requisitionList ?? []) as Array<{ Id: string; Title: string; PrimaryLocation?: string }>;

  // Jobs with real descriptions — from the shared scraper
  const scraped = await scrapeOracleHCM(DAMAN_URL);
  const covered = new Set(scraped.map(jd => jd.sourceUrl?.match(/\/job\/(\d+)/)?.[1]).filter(Boolean));

  // Backfill any missing id with a stub
  const backfilled: ScrapedJD[] = [];
  for (const job of allJobs) {
    if (covered.has(job.Id)) continue;
    const loc = job.PrimaryLocation ?? "UAE";
    backfilled.push({
      title: job.Title,
      rawText:
        `Job Summary\n\n${job.Title} at Daman Health — ${loc}.\n\n` +
        `Note: Daman Health has not published the full job description for this role on their careers site at the time of scraping. The following analysis is inferred from the role title and the health insurance industry context.\n\n` +
        `Responsibilities\n\nThe successful candidate will perform the core duties typical of a ${job.Title} within a health insurance organisation, supporting the relevant function in Daman's operations.\n\n` +
        `Requirements\n\nRelevant experience for the ${job.Title} position; skills appropriate to the role; qualifications aligned with health insurance industry standards.`,
      sourceUrl: `${DAMAN_BASE}/hcmUI/CandidateExperience/en/sites/${DAMAN_SITE}/job/${job.Id}`,
    });
  }
  return [...scraped, ...backfilled];
}

const TARGETS: Record<string, TargetConfig> = {
  daman: {
    key:           "daman",
    companyName:   "Daman Health",
    careerPageUrl: DAMAN_URL,
    atsType:       "oracle_hcm",
    pocEmail:      POC_EMAIL,
    targetJdCount: 10,
    scrape:        scrapeDamanAllTen,
  },
  pih: {
    key:           "pih",
    companyName:   "Power International Holding",
    careerPageUrl: "https://careers.powerholding-intl.com/search/",
    atsType:       "jobs2web_html",
    pocEmail:      POC_EMAIL,
    targetJdCount: 15,
    scrape: () => scrapeJobs2WebHtmlDiverse(
      "https://careers.powerholding-intl.com",
      15,
    ),
  },
};

// ── Per-company orchestration ────────────────────────────────────────────────
async function runOne(cfg: TargetConfig): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  console.log(`\n═══ ${cfg.companyName} (${cfg.targetJdCount} roles) ═══`);

  // 1. Create batch — mirrors POST /api/admin/upload shape so /batches renders it
  const [batch] = await db.insert(batches).values({
    filename:  `special-${cfg.key}-${today}.manual`,
    name:      `Special — ${cfg.companyName}`,
    totalPocs: 1,
    status:    "scraping",
  }).returning();
  console.log(`  batch ${batch.id}`);

  // 2. Find-or-create company — same dedup logic as the upload route
  const existing = await db.select().from(companies)
    .where(eq(companies.name, cfg.companyName)).limit(1);

  let companyId: string;
  if (existing.length > 0) {
    companyId = existing[0].id;
    await db.update(companies).set({
      scrapeStatus:  "pending",
      scrapeError:   null,
      careerPageUrl: cfg.careerPageUrl,
      atsType:       cfg.atsType,
    }).where(eq(companies.id, companyId));
    console.log(`  reused existing company ${companyId}`);
  } else {
    const slug = await generateUniqueSlug(cfg.companyName);
    const [newCo] = await db.insert(companies).values({
      name:          cfg.companyName,
      careerPageUrl: cfg.careerPageUrl,
      atsType:       cfg.atsType,
      scrapeStatus:  "pending",
      slug,
      reportToken:   generatePermanentToken(),
    }).returning();
    companyId = newCo.id;
    console.log(`  created company ${companyId} (slug: ${slug})`);
  }

  // 3. POC row — lets /batches render the report link (inner-joins on pocs)
  await db.insert(pocs).values({
    batchId:   batch.id,
    companyId,
    firstName: "Special",
    lastName:  "Request",
    email:     cfg.pocEmail,
  });

  // 4. Scrape inline (bypass Inngest for the scrape half — avoids needing the
  //    custom PIH scraper to be registered in scrapeCareerPage, and keeps this
  //    CLI self-contained)
  await db.update(companies)
    .set({ scrapeStatus: "in_progress" })
    .where(eq(companies.id, companyId));

  console.log(`  scraping ${cfg.careerPageUrl} ...`);
  let scraped: ScrapedJD[] = [];
  try {
    scraped = await cfg.scrape();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.update(companies).set({
      scrapeStatus: "failed", scrapeError: msg,
    }).where(eq(companies.id, companyId));
    await db.update(batches).set({
      status: "partial_failure", completedAt: new Date(),
    }).where(eq(batches.id, batch.id));
    console.error(`  ✗ scrape failed: ${msg}`);
    return;
  }
  console.log(`  scraped ${scraped.length} JD(s)`);

  if (scraped.length === 0) {
    await db.update(companies).set({
      scrapeStatus: "failed", scrapeError: "No jobs returned by scraper",
    }).where(eq(companies.id, companyId));
    await db.update(batches).set({
      status: "partial_failure", completedAt: new Date(),
    }).where(eq(batches.id, batch.id));
    console.error(`  ✗ scraper returned no jobs`);
    return;
  }

  // 5. Insert JDs — same shape as scrapeCompanyFn
  const jdRows = scraped.map(jd => ({
    companyId,
    batchId:    batch.id,
    title:      jd.title,
    rawText:    jd.rawText,
    sourceUrl:  jd.sourceUrl ?? null,
    department: jd.department ?? null,
    status:     isValidJD(jd.title, jd.rawText) ? ("scraped" as const) : ("invalid" as const),
  }));
  const inserted = await db.insert(jobDescriptions).values(jdRows).returning();
  const validCount = jdRows.filter(j => j.status === "scraped").length;
  console.log(`  inserted ${inserted.length} JD rows (${validCount} valid, ${inserted.length - validCount} invalid)`);

  // 6. Mirror scrapeCompanyFn post-scrape state transitions
  await db.update(companies).set({
    scrapeStatus:       "complete",
    scrapedAt:          new Date(),
    totalJobsAvailable: scraped.length,
  }).where(eq(companies.id, companyId));

  if (validCount > 0) {
    await db.update(batches)
      .set({ totalJds: sql`total_jds + ${validCount}` })
      .where(eq(batches.id, batch.id));
  }

  // 7. Transition up to `targetJdCount` scraped → pending and queue analyze
  //    (mirrors POST /api/admin/batches/:id/analyse, with a per-company cap
  //    that matches the user's request: 10 Daman, 15 PIH)
  const scrapedJdIds = inserted
    .filter(r => r.status === "scraped")
    .slice(0, cfg.targetJdCount)
    .map(r => r.id);

  if (scrapedJdIds.length === 0) {
    console.log(`  ✗ no valid JDs to analyse`);
    return;
  }

  for (const id of scrapedJdIds) {
    await db.update(jobDescriptions).set({ status: "pending" }).where(eq(jobDescriptions.id, id));
  }

  // Keep batches.totalJds in sync with what's now queued for analysis
  await db.update(batches).set({
    totalJds: sql`(SELECT COUNT(*) FROM job_descriptions WHERE batch_id = ${batch.id} AND status NOT IN ('invalid','cancelled','scraped'))`,
    status:   "analyzing",
  }).where(eq(batches.id, batch.id));

  await inngest.send(
    scrapedJdIds.map(jdId => ({
      name: "jd/analyze" as const,
      data: { jobDescriptionId: jdId, batchId: batch.id },
    })),
  );
  console.log(`  queued ${scrapedJdIds.length} jd/analyze event(s)`);
  console.log(`  ✓ done — view at /admin/batches/${batch.id}`);
}

// ── Entry point ──────────────────────────────────────────────────────────────
async function main() {
  const arg = process.argv[2]?.toLowerCase();
  if (!arg || !TARGETS[arg]) {
    console.error("Usage: npx tsx scripts/run-special-report.ts <daman|pih>");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set — is .env.local present?");
    process.exit(1);
  }
  // Re-seed Inngest with env loaded after its construction (the SDK snapshots
  // process.env in its constructor; without this it can't see INNGEST_DEV).
  inngest.setEnvVars(process.env);
  await runOne(TARGETS[arg]);
}

main().catch(err => { console.error(err); process.exit(1); });
