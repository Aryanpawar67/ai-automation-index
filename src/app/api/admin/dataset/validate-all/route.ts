import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db/client";
import { datasetRows }               from "@/lib/db/schema";
import { inArray, eq }               from "drizzle-orm";
import { validateCareerUrl }         from "@/lib/urlValidator";

const CONCURRENCY = 5;
const DELAY_MS    = 300;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

interface ValidationRow {
  id:            string;
  careerPageUrl: string;
  atsType:       string | null;
}

interface ValidationResult {
  id:             string;
  careerPageUrl:  string;
  reachable:      boolean;
  detectedAts:    string | null;
  suggestedUrl:   string | null;
  isCareerPage:   boolean | null;
  confidence:     string;
  reason:         string;
  validatedAt:    string;
}

// POST body: { rowIds?: string[] }
// If rowIds omitted → validates all rows in dataset_rows (max 500)
export async function POST(req: NextRequest) {
  let body: { rowIds?: string[] } = {};
  try { body = await req.json(); } catch { /* body optional */ }

  let rows: ValidationRow[];

  if (body.rowIds?.length) {
    rows = await db
      .select({ id: datasetRows.id, careerPageUrl: datasetRows.careerPageUrl, atsType: datasetRows.atsType })
      .from(datasetRows)
      .where(inArray(datasetRows.id, body.rowIds));
  } else {
    rows = await db
      .select({ id: datasetRows.id, careerPageUrl: datasetRows.careerPageUrl, atsType: datasetRows.atsType })
      .from(datasetRows);
  }

  if (rows.length === 0)
    return NextResponse.json({ error: "No rows found." }, { status: 404 });

  if (rows.length > 500) {
    return NextResponse.json({
      error: "Too many rows to validate at once. Select fewer than 500 rows.",
      count: rows.length,
    }, { status: 422 });
  }

  const results: ValidationResult[] = [];

  // Process in chunks of CONCURRENCY with delay between chunks (rate-limit protection)
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const chunk = rows.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map(async (row): Promise<ValidationResult> => {
        const v           = await validateCareerUrl(row.careerPageUrl, row.atsType);
        const validatedAt = new Date().toISOString();

        // Write result back to DB immediately
        await db
          .update(datasetRows)
          .set({
            urlReachable:    v.reachable,
            urlConfidence:   v.confidence,
            urlDetectedAts:  v.detectedAts,
            urlSuggestedUrl: v.suggestedUrl,
            urlIsCareerPage: v.isCareerPage,
            urlReason:       v.reason,
            urlValidatedAt:  new Date(),
          })
          .where(eq(datasetRows.id, row.id));

        return {
          id:            row.id,
          careerPageUrl: row.careerPageUrl,
          reachable:     v.reachable,
          detectedAts:   v.detectedAts,
          suggestedUrl:  v.suggestedUrl,
          isCareerPage:  v.isCareerPage,
          confidence:    v.confidence,
          reason:        v.reason,
          validatedAt,
        };
      })
    );
    results.push(...chunkResults);
    if (i + CONCURRENCY < rows.length) await sleep(DELAY_MS);
  }

  return NextResponse.json({
    total:       results.length,
    reachable:   results.filter(r => r.reachable).length,
    unreachable: results.filter(r => !r.reachable).length,
    rows:        results,
  });
}
