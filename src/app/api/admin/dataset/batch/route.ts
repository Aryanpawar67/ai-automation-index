import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db/client";
import { batches, companies, datasetRows, pocs } from "@/lib/db/schema";
import { inngest }                   from "@/inngest/client";
import { inArray, eq }               from "drizzle-orm";

export async function POST(req: NextRequest) {
  const body: { rowIds: string[]; name: string } = await req.json();
  const { rowIds, name } = body;

  if (!name?.trim())
    return NextResponse.json({ error: "Batch name is required." }, { status: 400 });
  if (!rowIds?.length)
    return NextResponse.json({ error: "No rows selected." }, { status: 400 });

  // Fetch selected dataset rows
  const selected = await db
    .select()
    .from(datasetRows)
    .where(inArray(datasetRows.id, rowIds));

  if (selected.length === 0)
    return NextResponse.json({ error: "No matching rows found." }, { status: 404 });

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
      const [newCo] = await db.insert(companies).values({
        name:          row.companyName,
        careerPageUrl: row.careerPageUrl,
        scrapeStatus:  "pending",
        atsType:       row.atsType,
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

  if (scrapeEvents.length > 0) await inngest.send(scrapeEvents);

  return NextResponse.json({ batchId: batch.id, queued: scrapeEvents.length });
}
