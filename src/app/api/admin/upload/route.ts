import { NextRequest, NextResponse }  from "next/server";
import { db }                         from "@/lib/db/client";
import { batches, companies, pocs }   from "@/lib/db/schema";
import { parseExcel }                 from "@/lib/excel";
import { inngest }                    from "@/inngest/client";
import { generateUniqueSlug }         from "@/lib/slug";
import { eq }                         from "drizzle-orm";

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  let rows;
  try {
    rows = parseExcel(buffer);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to parse Excel file." },
      { status: 422 }
    );
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "No valid rows found in file." }, { status: 422 });
  }

  // Create batch record
  const [batch] = await db.insert(batches).values({
    filename:  file.name,
    totalPocs: rows.length,
    status:    "scraping",
  }).returning();

  const scrapeEvents: { name: "company/scrape"; data: { companyId: string; batchId: string } }[] = [];

  for (const row of rows) {
    // De-duplicate companies by name across batches
    const existing = await db.select().from(companies)
      .where(eq(companies.name, row.companyName)).limit(1);

    let companyId: string;
    if (existing.length > 0) {
      companyId = existing[0].id;
      // Reset scrape status so it gets re-scraped in this batch;
      // also update atsType if the new upload has a value for it
      await db.update(companies)
        .set({
          scrapeStatus: "pending",
          scrapeError:  null,
          ...(row.atsType ? { atsType: row.atsType } : {}),
        })
        .where(eq(companies.id, companyId));
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

    await db.insert(pocs).values({
      batchId:   batch.id,
      companyId,
      firstName: row.firstName,
      lastName:  row.lastName,
      email:     row.email,
      country:   row.country,
    });

    scrapeEvents.push({ name: "company/scrape", data: { companyId, batchId: batch.id } });
  }

  if (scrapeEvents.length > 0) await inngest.send(scrapeEvents);

  return NextResponse.json({ batchId: batch.id, total: rows.length });
}
