import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db/client";
import { datasetRows }               from "@/lib/db/schema";
import { inArray, isNull, ne, or }   from "drizzle-orm";
import { enrichIndustry }            from "@/lib/industryEnricher";

const CONCURRENCY = 10;  // Haiku-first is fast — safe to run 10 at once
const DELAY_MS    = 200; // Small pause between chunks

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// POST body: { rowIds?: string[], onlyMissing?: boolean, limit?: number }
// onlyMissing=true  → skips rows where industryStatus is already 'complete'
// rowIds omitted    → processes all missing rows up to `limit` (default 200)
export async function POST(req: NextRequest) {
  let body: { rowIds?: string[]; onlyMissing?: boolean; limit?: number } = {};
  try { body = await req.json(); } catch { /* body is optional */ }

  const cap = body.limit ?? 200;

  const cols = {
    id:             datasetRows.id,
    companyName:    datasetRows.companyName,
    domain:         datasetRows.domain,
    careerPageUrl:  datasetRows.careerPageUrl,
    industryStatus: datasetRows.industryStatus,
  };

  const rows = body.rowIds?.length
    ? await db.select(cols).from(datasetRows)
        .where(inArray(datasetRows.id, body.rowIds))
    : body.onlyMissing
      ? await db.select(cols).from(datasetRows)
          .where(or(isNull(datasetRows.industryStatus), ne(datasetRows.industryStatus, "complete")))
          .limit(cap)
      : await db.select(cols).from(datasetRows)
          .limit(cap);

  if (rows.length === 0)
    return NextResponse.json({ error: "No rows to process." }, { status: 404 });

  let completed = 0, notFound = 0, failed = 0;

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const chunk = rows.slice(i, i + CONCURRENCY);

    const results = await Promise.all(chunk.map(row => enrichIndustry({
      companyName:   row.companyName,
      domain:        row.domain,
      careerPageUrl: row.careerPageUrl,
    })));

    // Write sequentially to avoid Neon connection pool exhaustion
    for (let j = 0; j < chunk.length; j++) {
      const row = chunk[j];
      const out  = results[j];

      await db.update(datasetRows)
        .set({
          industryStatus:       out.status,
          industry:             out.industry,
          industryDiscoveredAt: new Date(),
        })
        .where(inArray(datasetRows.id, [row.id]));

      if (out.status === "complete")    completed++;
      else if (out.status === "failed") failed++;
      else                              notFound++;
    }

    if (i + CONCURRENCY < rows.length) await sleep(DELAY_MS);
  }

  return NextResponse.json({ total: rows.length, completed, notFound, failed });
}
