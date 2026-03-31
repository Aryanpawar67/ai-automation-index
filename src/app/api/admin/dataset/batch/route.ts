import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db/client";
import { batches, companies, datasetRows, pocs } from "@/lib/db/schema";
import { inngest }                   from "@/inngest/client";
import { generateUniqueSlug }        from "@/lib/slug";
import { inArray, eq }               from "drizzle-orm";
import { validateCareerUrl }         from "@/lib/urlValidator";

export async function POST(req: NextRequest) {
  let body: { rowIds: string[]; name: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { rowIds, name } = body;

  if (!name?.trim())
    return NextResponse.json({ error: "Batch name is required." }, { status: 400 });
  if (!rowIds?.length)
    return NextResponse.json({ error: "No rows selected." }, { status: 400 });

  try {
    // Fetch selected dataset rows
    const selected = await db
      .select()
      .from(datasetRows)
      .where(inArray(datasetRows.id, rowIds));

    if (selected.length === 0)
      return NextResponse.json({ error: "No matching rows found." }, { status: 404 });

    // Pre-flight: quick HTTP reachability check on all selected URLs (3s timeout for speed)
    const validationResults = await Promise.allSettled(
      selected.map(row => validateCareerUrl(row.careerPageUrl, row.atsType, 3000))
    );

    const failedUrls = selected
      .map((row, i) => {
        const r = validationResults[i];
        if (r.status === "rejected") return { url: row.careerPageUrl, company: row.companyName, reason: "Validation error" };
        if (!r.value.reachable)      return { url: row.careerPageUrl, company: row.companyName, reason: r.value.reason };
        return null;
      })
      .filter((x): x is { url: string; company: string; reason: string } => x !== null);

    if (failedUrls.length > 0) {
      return NextResponse.json({
        error:   "URL_VALIDATION_FAILED",
        message: `${failedUrls.length} career page URL(s) are unreachable. Fix them in the dataset before creating this batch.`,
        failed:  failedUrls,
      }, { status: 422 });
    }

    // Create named batch
    const [batch] = await db.insert(batches).values({
      filename:  name.trim(),
      name:      name.trim(),
      totalPocs: selected.length,
      status:    "scraping",
    }).returning();

    const scrapeEvents: { name: "company/scrape"; data: { companyId: string; batchId: string } }[] = [];

    for (const row of selected) {
      // Find or create company record
      const existing = await db
        .select()
        .from(companies)
        .where(eq(companies.careerPageUrl, row.careerPageUrl))
        .limit(1);

      let companyId: string;
      if (existing.length > 0) {
        companyId = existing[0].id;
        // Reset scrape status for reprocessing
        await db.update(companies).set({
          scrapeStatus: "pending",
          scrapeError:  null,
          atsType:      row.atsType ?? existing[0].atsType,
        }).where(eq(companies.id, companyId));
      } else {
        const slug = await generateUniqueSlug(row.companyName);
        const [newCo] = await db.insert(companies).values({
          name:          row.companyName,
          careerPageUrl: row.careerPageUrl,
          scrapeStatus:  "pending",
          atsType:       row.atsType,
          slug,
        }).returning();
        companyId = newCo.id;
      }

      // Insert a stub poc so batch-progress SSE can find this company via batchId
      await db.insert(pocs).values({
        batchId:   batch.id,
        companyId,
        firstName: row.companyName,
        lastName:  "",
        email:     "",
        country:   null,
      });

      scrapeEvents.push({ name: "company/scrape", data: { companyId, batchId: batch.id } });
    }

    try {
      if (scrapeEvents.length > 0) await inngest.send(scrapeEvents);
    } catch (err) {
      console.error("[batch] inngest.send failed:", err);
      // Batch and companies are already created — return success so the UI can navigate
    }

    return NextResponse.json({ batchId: batch.id, queued: scrapeEvents.length });

  } catch (err) {
    console.error("[batch] Unhandled error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Server error: ${message}` }, { status: 500 });
  }
}
