import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db/client";
import { jobDescriptions }           from "@/lib/db/schema";
import { inngest }                   from "@/inngest/client";
import { eq, and }                   from "drizzle-orm";

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

  const jds = await db.select({ id: jobDescriptions.id })
    .from(jobDescriptions)
    .where(conditions);

  if (jds.length === 0) {
    return NextResponse.json({ queued: 0, message: "No scraped JDs to analyse" });
  }

  // Transition all to pending before fanning out
  for (const jd of jds) {
    await db.update(jobDescriptions)
      .set({ status: "pending" })
      .where(eq(jobDescriptions.id, jd.id));
  }

  await inngest.send(
    jds.map(jd => ({
      name: "jd/analyze" as const,
      data: { jobDescriptionId: jd.id, batchId },
    }))
  );

  return NextResponse.json({ queued: jds.length });
}
