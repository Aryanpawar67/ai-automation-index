import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db/client";
import { jobDescriptions, batches }  from "@/lib/db/schema";
import { eq, and, inArray }          from "drizzle-orm";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;

  const cancellable = await db.select({ id: jobDescriptions.id })
    .from(jobDescriptions)
    .where(
      and(
        eq(jobDescriptions.batchId, batchId),
        inArray(jobDescriptions.status, ["scraped", "pending"])
      )
    );

  if (cancellable.length > 0) {
    await db.update(jobDescriptions)
      .set({ status: "cancelled" })
      .where(inArray(jobDescriptions.id, cancellable.map(j => j.id)));
  }

  await db.update(batches)
    .set({ status: "stopped" })
    .where(eq(batches.id, batchId));

  return NextResponse.json({ cancelled: cancellable.length });
}
