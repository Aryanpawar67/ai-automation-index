import { NextResponse } from "next/server";
import { db }           from "@/lib/db/client";
import { datasetRows }  from "@/lib/db/schema";
import { isNull, isNotNull, sql } from "drizzle-orm";

export async function GET() {
  try {
    const [total]   = await db.select({ n: sql<number>`count(*)::int` }).from(datasetRows);
    const [withPoc] = await db.select({ n: sql<number>`count(*)::int` }).from(datasetRows).where(isNotNull(datasetRows.pocEmail));
    const [noPoc]   = await db.select({ n: sql<number>`count(*)::int` }).from(datasetRows).where(isNull(datasetRows.pocEmail));

    const sample = await db
      .select({ companyName: datasetRows.companyName, pocFirstName: datasetRows.pocFirstName, pocLastName: datasetRows.pocLastName, pocEmail: datasetRows.pocEmail })
      .from(datasetRows)
      .where(isNotNull(datasetRows.pocEmail))
      .limit(5);

    const missingSample = await db
      .select({ companyName: datasetRows.companyName })
      .from(datasetRows)
      .where(isNull(datasetRows.pocEmail))
      .limit(10);

    return NextResponse.json({ total: total.n, withPoc: withPoc.n, noPoc: noPoc.n, sample, missingSample });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
