import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db/client";
import { datasetRows }               from "@/lib/db/schema";
import { parseExcelRaw }             from "@/lib/excel";
import { inArray }                   from "drizzle-orm";

// POST ?dryRun=true  → parse only, return stats (no DB write)
// POST               → parse + insert new rows, skip exact-domain duplicates
export async function POST(req: NextRequest) {
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "true";

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: "Invalid form data." }, { status: 400 }); }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  let parsed;
  try { parsed = parseExcelRaw(buffer, file.name); }
  catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to parse file." },
      { status: 422 }
    );
  }

  if (parsed.length === 0)
    return NextResponse.json({ error: "No valid rows found." }, { status: 422 });

  // Find which domains already exist in dataset_rows
  const incomingDomains = parsed.map(r => r.domain).filter(Boolean);
  const existing = await db
    .select({ domain: datasetRows.domain })
    .from(datasetRows)
    .where(inArray(datasetRows.domain, incomingDomains));

  const existingDomains = new Set(existing.map(r => r.domain));
  const newRows         = parsed.filter(r => !existingDomains.has(r.domain));
  const duplicateCount  = parsed.length - newRows.length;

  // Dry run — return stats only
  if (dryRun) {
    return NextResponse.json({
      total:          parsed.length,
      newRows:        newRows.length,
      duplicates:     duplicateCount,
      existingInDb:   existingDomains.size,
    });
  }

  // Actual insert — only new rows
  if (newRows.length > 0) {
    await db.insert(datasetRows).values(
      newRows.map(r => ({
        rowNumber:     r.rowNumber,
        companyName:   r.companyName,
        domain:        r.domain,
        headquarters:  r.headquarters || null,
        employeeSize:  r.employeeSize || null,
        hcmRaw:        r.hcmRaw || null,
        atsType:       r.atsType,
        careerPageUrl: r.careerPageUrl,
        jobPreview:    r.jobPreview.length > 0 ? r.jobPreview : null,
        sourceFile:    file.name,
      }))
    );
  }

  return NextResponse.json({
    inserted:   newRows.length,
    duplicates: duplicateCount,
    total:      parsed.length,
  });
}
