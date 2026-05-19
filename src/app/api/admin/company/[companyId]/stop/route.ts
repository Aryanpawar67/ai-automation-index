import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db/client";
import { jobDescriptions }           from "@/lib/db/schema";
import { eq, and, inArray }          from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  const { batchId } = body as { batchId?: string };

  if (!batchId)
    return NextResponse.json({ error: "Missing batchId." }, { status: 400 });

  const cancellable = await db
    .select({ id: jobDescriptions.id })
    .from(jobDescriptions)
    .where(
      and(
        eq(jobDescriptions.companyId, companyId),
        eq(jobDescriptions.batchId, batchId),
        inArray(jobDescriptions.status, ["scraped", "pending"])
      )
    );

  if (cancellable.length > 0) {
    await db.update(jobDescriptions)
      .set({ status: "cancelled" })
      .where(inArray(jobDescriptions.id, cancellable.map(j => j.id)));
  }

  return NextResponse.json({ cancelled: cancellable.length });
}
