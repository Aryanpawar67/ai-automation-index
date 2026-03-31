import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db/client";
import { jobDescriptions, batches }  from "@/lib/db/schema";
import { inngest }                   from "@/inngest/client";
import { eq, and, asc, sql }         from "drizzle-orm";

// Maximum JDs to analyse per company per batch — extras stay as 'scraped' reserve
// so analyzeJD can pull replacements when a JD is rejected during analysis.
const TARGET_JDS_PER_COMPANY = 10;

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

  // Ordered so oldest-scraped are queued first (deterministic)
  const allScraped = await db
    .select({ id: jobDescriptions.id, companyId: jobDescriptions.companyId })
    .from(jobDescriptions)
    .where(conditions)
    .orderBy(asc(jobDescriptions.createdAt));

  if (allScraped.length === 0) {
    return NextResponse.json({ queued: 0, message: "No scraped JDs to analyse" });
  }

  // Cap at TARGET_JDS_PER_COMPANY per company — extras stay 'scraped' as reserve
  const countPerCompany: Record<string, number> = {};
  const toQueue = allScraped.filter(jd => {
    const n = countPerCompany[jd.companyId] ?? 0;
    if (n < TARGET_JDS_PER_COMPANY) {
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
