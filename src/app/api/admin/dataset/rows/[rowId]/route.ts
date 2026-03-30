import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db/client";
import { datasetRows }               from "@/lib/db/schema";
import { eq }                        from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ rowId: string }> }
) {
  const { rowId } = await params;

  let body: { careerPageUrl?: string; atsType?: string | null };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }

  const update: Partial<{
    careerPageUrl: string;
    atsType:       string | null;
    domain:        string;
  }> = {};

  if (body.careerPageUrl !== undefined) {
    const trimmed = body.careerPageUrl.trim();
    if (!trimmed)
      return NextResponse.json({ error: "careerPageUrl cannot be empty." }, { status: 400 });

    // Re-extract domain to keep dedup key in sync after URL edit
    let domain = "";
    try { domain = new URL(trimmed).hostname; } catch { /* keep empty */ }

    update.careerPageUrl = trimmed;
    update.domain        = domain;
  }

  if ("atsType" in body) {
    update.atsType = body.atsType ?? null;
  }

  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const [updated] = await db
    .update(datasetRows)
    .set(update)
    .where(eq(datasetRows.id, rowId))
    .returning();

  if (!updated)
    return NextResponse.json({ error: "Row not found." }, { status: 404 });

  return NextResponse.json(updated);
}
