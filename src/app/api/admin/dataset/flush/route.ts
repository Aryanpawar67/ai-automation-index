import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db/client";
import { datasetRows, batches }      from "@/lib/db/schema";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const full: boolean = body.full === true;

  await db.delete(datasetRows);

  if (full) {
    // Cascades to pocs + jobDescriptions + analyses
    await db.delete(batches);
  }

  return NextResponse.json({ flushed: true, full });
}
