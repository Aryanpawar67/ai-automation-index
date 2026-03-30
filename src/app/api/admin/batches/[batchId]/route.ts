import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db/client";
import { batches }                   from "@/lib/db/schema";
import { eq }                        from "drizzle-orm";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;

  const deleted = await db.delete(batches)
    .where(eq(batches.id, batchId))
    .returning({ id: batches.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  return NextResponse.json({ deleted: deleted[0].id });
}
