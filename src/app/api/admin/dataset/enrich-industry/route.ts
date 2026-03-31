import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db/client";
import { datasetRows }               from "@/lib/db/schema";
import { inArray, eq, ne }           from "drizzle-orm";
import { enrichIndustry }            from "@/lib/industryEnricher";

const CONCURRENCY = 5;   // Industry uses only DDG (free, no rate limit)
const DELAY_MS    = 300; // Small pause between chunks

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// POST body: { rowIds?: string[], onlyMissing?: boolean }
// onlyMissing=true  → skips rows where industryStatus is already 'complete'
// rowIds omitted    → processes all rows (up to max 50)
export async function POST(req: NextRequest) {
  let body: { rowIds?: string[]; onlyMissing?: boolean } = {};
  try { body = await req.json(); } catch { /* body is optional */ }

  const cols = {
    id:           datasetRows.id,
    companyName:  datasetRows.companyName,
    domain:       datasetRows.domain,
    careerPageUrl: datasetRows.careerPageUrl,
    industryStatus: datasetRows.industryStatus,
  };

  const rows = body.rowIds?.length
    ? await db.select(cols).from(datasetRows)
        .where(inArray(datasetRows.id, body.rowIds))
    : body.onlyMissing
      ? await db.select(cols).from(datasetRows)
          .where(ne(datasetRows.industryStatus, "complete"))
          .limit(50)
      : await db.select(cols).from(datasetRows)
          .limit(50);

  if (rows.length === 0)
    return NextResponse.json({ error: "No rows to process." }, { status: 404 });

  if (rows.length > 50)
    return NextResponse.json({
      error: "Max 50 rows per request.",
      count: rows.length,
    }, { status: 422 });

  let completed = 0, notFound = 0, failed = 0;

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const chunk = rows.slice(i, i + CONCURRENCY);

    await Promise.all(chunk.map(async row => {
      await db.update(datasetRows)
        .set({ industryStatus: "running" })
        .where(eq(datasetRows.id, row.id));

      const out = await enrichIndustry({
        companyName:   row.companyName,
        domain:        row.domain,
        careerPageUrl: row.careerPageUrl,
      });

      await db.update(datasetRows)
        .set({
          industryStatus:       out.status,
          industry:             out.industry,
          industryDiscoveredAt: new Date(),
        })
        .where(eq(datasetRows.id, row.id));

      if (out.status === "complete")    completed++;
      else if (out.status === "failed") failed++;
      else                              notFound++;
    }));

    if (i + CONCURRENCY < rows.length) await sleep(DELAY_MS);
  }

  return NextResponse.json({ total: rows.length, completed, notFound, failed });
}
