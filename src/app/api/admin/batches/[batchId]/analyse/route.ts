import { NextRequest, NextResponse }    from "next/server";
import { db }                           from "@/lib/db/client";
import { jobDescriptions, batches, companies } from "@/lib/db/schema";
import { inngest }                      from "@/inngest/client";
import { eq, and, asc, sql }            from "drizzle-orm";
import { targetAnalyseCount }           from "@/lib/jdLimits";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  const body = await req.json().catch(() => ({}));
  const companyId: string | undefined = body.companyId;

  const conditions = companyId
    ? and(eq(jobDescriptions.batchId, batchId), eq(jobDescriptions.companyId, companyId), eq(jobDescriptions.status, "scraped"))
    : and(eq(jobDescriptions.batchId, batchId), eq(jobDescriptions.status, "scraped"));

  // Ordered so oldest-scraped are queued first (deterministic). Join companies
  // so each row carries the per-company totalJobsAvailable that drives the
  // dynamic cap (15 if large, 10 otherwise).
  const allScraped = await db
    .select({
      id:             jobDescriptions.id,
      companyId:      jobDescriptions.companyId,
      totalAvailable: companies.totalJobsAvailable,
    })
    .from(jobDescriptions)
    .leftJoin(companies, eq(jobDescriptions.companyId, companies.id))
    .where(conditions)
    .orderBy(asc(jobDescriptions.createdAt));

  if (allScraped.length === 0) {
    return NextResponse.json({ queued: 0, message: "No scraped JDs to analyse" });
  }

  // Per-company dynamic cap — extras stay 'scraped' as the replacement reserve
  // for analyzeJD.
  const countPerCompany: Record<string, number> = {};
  const capPerCompany:   Record<string, number> = {};
  const toQueue = allScraped.filter(jd => {
    const cap = capPerCompany[jd.companyId] ??
      (capPerCompany[jd.companyId] = targetAnalyseCount(jd.totalAvailable));
    const n = countPerCompany[jd.companyId] ?? 0;
    if (n < cap) {
      countPerCompany[jd.companyId] = n + 1;
      return true;
    }
    return false;
  });

  // Transition queued JDs to pending + update batch totalJds counter
  for (const jd of toQueue) {
    await db.update(jobDescriptions)
      .set({ status: "pending" })
      .where(eq(jobDescriptions.id, jd.id));
  }

  // Ensure batch totalJds reflects what's actually being queued
  // (may differ from the initial scrape count if extras were capped)
  await db.update(batches)
    .set({ totalJds: sql`(SELECT COUNT(*) FROM job_descriptions WHERE batch_id = ${batchId} AND status NOT IN ('invalid','cancelled','scraped'))` })
    .where(eq(batches.id, batchId));

  await inngest.send(
    toQueue.map(jd => ({
      name: "jd/analyze" as const,
      data: { jobDescriptionId: jd.id, batchId },
    }))
  );

  return NextResponse.json({ queued: toQueue.length, reserved: allScraped.length - toQueue.length });
}
