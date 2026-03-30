import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db/client";
import { datasetRows }               from "@/lib/db/schema";
import { inArray, eq, isNotNull, ne } from "drizzle-orm";
import { enrichHrStack }             from "@/lib/hrStackEnricher";

const CONCURRENCY = 3;   // Lower than validate-all — CSE + Firecrawl calls are slower
const DELAY_MS    = 500; // Respect Google CSE rate limits between chunks

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// POST body: { rowIds?: string[], onlyMissing?: boolean }
// onlyMissing=true  → skips rows where hrStackStatus is already 'complete'
// rowIds omitted    → processes all rows (up to max 200)
export async function POST(req: NextRequest) {
  let body: { rowIds?: string[]; onlyMissing?: boolean } = {};
  try { body = await req.json(); } catch { /* body is optional */ }

  const cols = {
    id:             datasetRows.id,
    companyName:    datasetRows.companyName,
    domain:         datasetRows.domain,
    careerPageUrl:  datasetRows.careerPageUrl,
    urlDetectedAts: datasetRows.urlDetectedAts,
    hrStackStatus:  datasetRows.hrStackStatus,
  };

  const rows = body.rowIds?.length
    ? await db.select(cols).from(datasetRows)
        .where(inArray(datasetRows.id, body.rowIds))
    : body.onlyMissing
      ? await db.select(cols).from(datasetRows)
          .where(ne(datasetRows.hrStackStatus, "complete"))
          .limit(30)
      : await db.select(cols).from(datasetRows)
          .limit(30);

  if (rows.length === 0)
    return NextResponse.json({ error: "No rows to process." }, { status: 404 });

  // Hard cap — Google CSE free tier is 100 req/day; 3 queries/company = ~33 companies safe per day
  // We allow 200 here but the caller (Enrichment page) will throttle via daily cron
  if (rows.length > 30)
    return NextResponse.json({
      error: "Max 30 rows per request (Google CSE free tier: 100 queries/day, 3 per company).",
      count: rows.length,
    }, { status: 422 });

  let completed = 0, notFound = 0, failed = 0;

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const chunk = rows.slice(i, i + CONCURRENCY);

    await Promise.all(chunk.map(async row => {
      // Mark as running so UI can show a spinner
      await db.update(datasetRows)
        .set({ hrStackStatus: "running" })
        .where(eq(datasetRows.id, row.id));

      const out = await enrichHrStack({
        companyName:    row.companyName,
        domain:         row.domain,
        careerPageUrl:  row.careerPageUrl,
        urlDetectedAts: row.urlDetectedAts,
      });

      await db.update(datasetRows)
        .set({
          hrStackStatus:       out.status,
          hrStack:             out.result,
          hrStackDiscoveredAt: new Date(),
        })
        .where(eq(datasetRows.id, row.id));

      if (out.status === "complete")   completed++;
      else if (out.status === "failed") failed++;
      else                             notFound++;
    }));

    if (i + CONCURRENCY < rows.length) await sleep(DELAY_MS);
  }

  return NextResponse.json({ total: rows.length, completed, notFound, failed });
}
