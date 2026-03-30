import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db/client";
import { jobDescriptions }           from "@/lib/db/schema";
import { inngest }                   from "@/inngest/client";
import { eq }                        from "drizzle-orm";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ jdId: string }> }
) {
  const { jdId } = await params;

  const [jd] = await db
    .select({ id: jobDescriptions.id, batchId: jobDescriptions.batchId, status: jobDescriptions.status })
    .from(jobDescriptions)
    .where(eq(jobDescriptions.id, jdId));

  if (!jd) return NextResponse.json({ error: "JD not found" }, { status: 404 });
  if (jd.status !== "scraped") return NextResponse.json({ error: "JD is not in scraped state" }, { status: 400 });

  await db.update(jobDescriptions)
    .set({ status: "pending" })
    .where(eq(jobDescriptions.id, jdId));

  await inngest.send({ name: "jd/analyze", data: { jobDescriptionId: jdId, batchId: jd.batchId } });

  return NextResponse.json({ queued: jdId });
}
