import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db/client";
import { datasetRows }               from "@/lib/db/schema";
import { inArray, eq, isNotNull, ne, and } from "drizzle-orm";
import { findLinkedIn }              from "@/lib/linkedinFinder";

const CONCURRENCY = 3;
const DELAY_MS    = 500;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// POST body: { rowIds?: string[], onlyMissing?: boolean }
// Only processes rows that have pocFirstName (no name = can't search LinkedIn)
export async function POST(req: NextRequest) {
  let body: { rowIds?: string[]; onlyMissing?: boolean } = {};
  try { body = await req.json(); } catch { /* optional */ }

  const cols = {
    id:             datasetRows.id,
    pocFirstName:   datasetRows.pocFirstName,
    pocLastName:    datasetRows.pocLastName,
    pocEmail:       datasetRows.pocEmail,
    companyName:    datasetRows.companyName,
    linkedinStatus: datasetRows.linkedinStatus,
  };

  const rows = body.rowIds?.length
    ? await db.select(cols).from(datasetRows)
        .where(inArray(datasetRows.id, body.rowIds))
    : body.onlyMissing
      ? await db.select(cols).from(datasetRows)
          .where(and(isNotNull(datasetRows.pocFirstName), ne(datasetRows.linkedinStatus, "complete")))
          .limit(50)
      : await db.select(cols).from(datasetRows)
          .where(isNotNull(datasetRows.pocFirstName))
          .limit(50);

  if (rows.length === 0)
    return NextResponse.json({
      error: "No eligible rows. Rows need pocFirstName to search LinkedIn.",
    }, { status: 404 });

  if (rows.length > 50)
    return NextResponse.json({ error: "Max 50 rows per request (Google CSE free tier: 100 queries/day, 2 per company).", count: rows.length }, { status: 422 });

  let found = 0, notFound = 0, failed = 0;

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const chunk = rows.slice(i, i + CONCURRENCY);

    await Promise.all(chunk.map(async row => {
      await db.update(datasetRows)
        .set({ linkedinStatus: "running" })
        .where(eq(datasetRows.id, row.id));

      try {
        const out = await findLinkedIn({
          firstName:   row.pocFirstName ?? "",
          lastName:    row.pocLastName  ?? "",
          companyName: row.companyName,
          emailDomain: row.pocEmail     ?? "",
        });

        if (out.url) {
          await db.update(datasetRows)
            .set({
              linkedinUrl:          out.url,
              linkedinConfidence:   out.confidence,
              linkedinSource:       out.source,
              linkedinStatus:       "complete",
              linkedinDiscoveredAt: new Date(),
            })
            .where(eq(datasetRows.id, row.id));
          found++;
        } else {
          await db.update(datasetRows)
            .set({ linkedinStatus: "not_found", linkedinDiscoveredAt: new Date() })
            .where(eq(datasetRows.id, row.id));
          notFound++;
        }
      } catch {
        await db.update(datasetRows)
          .set({ linkedinStatus: "failed" })
          .where(eq(datasetRows.id, row.id));
        failed++;
      }
    }));

    if (i + CONCURRENCY < rows.length) await sleep(DELAY_MS);
  }

  return NextResponse.json({ total: rows.length, found, notFound, failed });
}
