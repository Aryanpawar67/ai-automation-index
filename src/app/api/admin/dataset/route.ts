import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db/client";
import { datasetRows, companies }    from "@/lib/db/schema";
import { ilike, eq, and, SQL, inArray } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const sp   = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(10, parseInt(sp.get("limit") ?? "50")));
  const offset = (page - 1) * limit;

  const ats    = sp.get("ats")    ?? "";
  const hq     = sp.get("hq")    ?? "";
  const size   = sp.get("size")  ?? "";
  const search = sp.get("search") ?? "";

  const conditions: SQL[] = [];
  if (ats)    conditions.push(eq(datasetRows.atsType, ats));
  if (hq)     conditions.push(ilike(datasetRows.headquarters, `%${hq}%`));
  if (size)   conditions.push(eq(datasetRows.employeeSize, size));
  if (search) conditions.push(ilike(datasetRows.companyName, `%${search}%`));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Fetch page of rows
  const rows = await db
    .select()
    .from(datasetRows)
    .where(where)
    .orderBy(datasetRows.rowNumber)
    .limit(limit)
    .offset(offset);

  // Count total matching rows
  const countResult = await db
    .select({ id: datasetRows.id })
    .from(datasetRows)
    .where(where);
  const total = countResult.length;

  // Check which domains already exist in companies table (for greyed-out status)
  const domains = rows.map(r => r.domain).filter(Boolean);
  const processed = domains.length > 0
    ? await db
        .select({ careerPageUrl: companies.careerPageUrl, scrapeStatus: companies.scrapeStatus, name: companies.name })
        .from(companies)
    : [];

  const processedByUrl = new Map(processed.map(c => [c.careerPageUrl, { status: c.scrapeStatus, name: c.name }]));

  const rowsWithStatus = rows.map(r => ({
    ...r,
    processingStatus: processedByUrl.get(r.careerPageUrl) ?? null,
  }));

  // Filter options for dropdowns (distinct values from full dataset)
  const allAts  = await db.selectDistinct({ val: datasetRows.atsType }).from(datasetRows);
  const allSizes = await db.selectDistinct({ val: datasetRows.employeeSize }).from(datasetRows);

  return NextResponse.json({
    rows:    rowsWithStatus,
    total,
    page,
    pages:   Math.ceil(total / limit),
    filters: {
      atsOptions:  allAts.map(r => r.val).filter(Boolean).sort(),
      sizeOptions: allSizes.map(r => r.val).filter(Boolean).sort(),
    },
  });
}
