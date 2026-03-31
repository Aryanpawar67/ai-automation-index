import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db/client";
import { companies, pocs, jobDescriptions, batches } from "@/lib/db/schema";
import { inngest }                   from "@/inngest/client";
import { eq, and, notInArray, sql }  from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  const { batchId } = body as { batchId?: string };

  if (!batchId)
    return NextResponse.json({ error: "Missing batchId." }, { status: 400 });

  const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
  if (!company)
    return NextResponse.json({ error: "Company not found." }, { status: 404 });

  // Verify company belongs to this batch
  const [poc] = await db.select().from(pocs)
    .where(eq(pocs.companyId, companyId));
  if (!poc)
    return NextResponse.json({ error: "Company not in any batch." }, { status: 404 });

  // Delete stale JDs for this company+batch that aren't yet analysed, so
  // re-scraping produces a clean slate without duplicate/garbage entries.
  const staleStatuses = ["scraped", "invalid", "pending", "failed"] as const;
  const deleted = await db.delete(jobDescriptions)
    .where(and(
      eq(jobDescriptions.companyId, companyId),
      eq(jobDescriptions.batchId, batchId),
      notInArray(jobDescriptions.status, ["complete", "analyzing"]),
    ))
    .returning({ id: jobDescriptions.id });

  if (deleted.length > 0) {
    // Recalculate batch totalJds to reflect the removed rows
    await db.update(batches)
      .set({ totalJds: sql`(SELECT COUNT(*) FROM job_descriptions WHERE batch_id = ${batchId} AND status NOT IN ('invalid','cancelled','scraped'))` })
      .where(eq(batches.id, batchId));
  }

  // Reset scrape state
  await db.update(companies)
    .set({ scrapeStatus: "pending", scrapeError: null })
    .where(eq(companies.id, companyId));

  await inngest.send({
    name: "company/scrape",
    data: { companyId, batchId },
  });

  return NextResponse.json({ queued: true });
}
