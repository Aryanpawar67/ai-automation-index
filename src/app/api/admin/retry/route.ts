import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db/client";
import { jobDescriptions }           from "@/lib/db/schema";
import { inngest }                   from "@/inngest/client";
import { eq }                        from "drizzle-orm";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { jobDescriptionId } = body as { jobDescriptionId?: string };

  if (!jobDescriptionId)
    return NextResponse.json({ error: "Missing jobDescriptionId." }, { status: 400 });

  const [jd] = await db.select().from(jobDescriptions)
    .where(eq(jobDescriptions.id, jobDescriptionId));
  if (!jd)
    return NextResponse.json({ error: "Job description not found." }, { status: 404 });

  await db.update(jobDescriptions)
    .set({ status: "pending", error: null })
    .where(eq(jobDescriptions.id, jobDescriptionId));

  await inngest.send({
    name: "jd/analyze",
    data: { jobDescriptionId, batchId: jd.batchId },
  });

  return NextResponse.json({ queued: true });
}
