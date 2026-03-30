import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db/client";
import { datasetRows }               from "@/lib/db/schema";
import { parseExcelRaw }             from "@/lib/excel";
import { inArray, eq }               from "drizzle-orm";

// POST ?dryRun=true  → parse only, return stats (no DB write)
// POST               → insert new rows; update POC fields on existing rows
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
    .select({ id: datasetRows.id, domain: datasetRows.domain })
    .from(datasetRows)
    .where(inArray(datasetRows.domain, incomingDomains));

  const existingByDomain = new Map(existing.map(r => [r.domain, r.id]));
  const newRows           = parsed.filter(r => !existingByDomain.has(r.domain));
  const updateRows        = parsed.filter(r => existingByDomain.has(r.domain) && (r.pocFirstName || r.pocLastName || r.pocEmail));
  const duplicateCount    = parsed.length - newRows.length;

  // Dry run — return stats only
  if (dryRun) {
    return NextResponse.json({
      total:          parsed.length,
      newRows:        newRows.length,
      duplicates:     duplicateCount,
      existingInDb:   existingByDomain.size,
    });
  }

  // Insert new rows
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
        sourceFile:    file.name,
        pocFirstName:  r.pocFirstName,
        pocLastName:   r.pocLastName,
        pocEmail:      r.pocEmail,
      }))
    );
  }

  // Update POC fields on existing rows (one query per row — typically small batch)
  for (const r of updateRows) {
    const id = existingByDomain.get(r.domain)!;
    await db
      .update(datasetRows)
      .set({ pocFirstName: r.pocFirstName, pocLastName: r.pocLastName, pocEmail: r.pocEmail })
      .where(eq(datasetRows.id, id));
  }

  return NextResponse.json({
    inserted:   newRows.length,
    updated:    updateRows.length,
    duplicates: duplicateCount,
    total:      parsed.length,
  });
}
