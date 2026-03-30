import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db/client";
import { jobDescriptions }           from "@/lib/db/schema";
import { eq }                        from "drizzle-orm";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ jdId: string }> }
) {
  const { jdId } = await params;

  const updated = await db.update(jobDescriptions)
    .set({ status: "cancelled" })
    .where(eq(jobDescriptions.id, jdId))
    .returning({ id: jobDescriptions.id });

  if (updated.length === 0) return NextResponse.json({ error: "JD not found" }, { status: 404 });

  return NextResponse.json({ skipped: jdId });
}
