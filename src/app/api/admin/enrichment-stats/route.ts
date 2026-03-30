import { NextResponse }      from "next/server";
import { db }                from "@/lib/db/client";
import { datasetRows }       from "@/lib/db/schema";
import { sql, isNotNull, eq } from "drizzle-orm";

export async function GET() {
  try {
    const [total]      = await db.select({ n: sql<number>`count(*)::int` }).from(datasetRows);
    const [hrComplete] = await db.select({ n: sql<number>`count(*)::int` }).from(datasetRows).where(eq(datasetRows.hrStackStatus, "complete"));
    const [hrNotFound] = await db.select({ n: sql<number>`count(*)::int` }).from(datasetRows).where(eq(datasetRows.hrStackStatus, "not_found"));
    const [hrFailed]   = await db.select({ n: sql<number>`count(*)::int` }).from(datasetRows).where(eq(datasetRows.hrStackStatus, "failed"));
    const [liComplete] = await db.select({ n: sql<number>`count(*)::int` }).from(datasetRows).where(eq(datasetRows.linkedinStatus, "complete"));
    const [liNotFound] = await db.select({ n: sql<number>`count(*)::int` }).from(datasetRows).where(eq(datasetRows.linkedinStatus, "not_found"));
    const [liFailed]   = await db.select({ n: sql<number>`count(*)::int` }).from(datasetRows).where(eq(datasetRows.linkedinStatus, "failed"));
    const [hasPoc]     = await db.select({ n: sql<number>`count(*)::int` }).from(datasetRows).where(isNotNull(datasetRows.pocFirstName));

    return NextResponse.json({
      total: total.n,
      hrStack: {
        complete: hrComplete.n,
        notFound: hrNotFound.n,
        failed:   hrFailed.n,
        pending:  total.n - hrComplete.n - hrNotFound.n - hrFailed.n,
      },
      linkedin: {
        eligible: hasPoc.n,
        complete: liComplete.n,
        notFound: liNotFound.n,
        failed:   liFailed.n,
        pending:  hasPoc.n - liComplete.n - liNotFound.n - liFailed.n,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
