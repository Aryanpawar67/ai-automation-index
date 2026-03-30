import { NextRequest, NextResponse } from "next/server";
import { db }        from "@/lib/db/client";
import { jobDescriptions, analyses } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ batchId: string; companyId: string }> }
) {
  const { batchId, companyId } = await params;

  const jds = await db
    .select({ id: jobDescriptions.id, title: jobDescriptions.title, status: jobDescriptions.status })
    .from(jobDescriptions)
    .where(and(eq(jobDescriptions.batchId, batchId), eq(jobDescriptions.companyId, companyId)));

  const completeIds = jds.filter(j => j.status === "complete").map(j => j.id);
  const analysisRows = completeIds.length > 0
    ? await db.select({
        jobDescriptionId: analyses.jobDescriptionId,
        overallScore:     analyses.overallScore,
        hoursSaved:       analyses.hoursSaved,
      }).from(analyses).where(inArray(analyses.jobDescriptionId, completeIds))
    : [];
  const analysisMap = Object.fromEntries(analysisRows.map(a => [a.jobDescriptionId, a]));

  const result = jds.map(j => ({
    id:           j.id,
    title:        j.title,
    status:       j.status,
    overallScore: analysisMap[j.id]?.overallScore ?? null,
    hoursSaved:   analysisMap[j.id]?.hoursSaved   ?? null,
  }));

  return NextResponse.json(result);
}
