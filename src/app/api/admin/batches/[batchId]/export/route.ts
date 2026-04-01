import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db/client";
import { pocs, companies, datasetRows } from "@/lib/db/schema";
import { eq, sql }                   from "drizzle-orm";
import * as XLSX                     from "xlsx";
import { generatePermanentToken }    from "@/lib/token";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  const origin      = req.nextUrl.origin;

  const rows = await db
    .select({
      companyName:   companies.name,
      careerPageUrl: companies.careerPageUrl,
      companyId:     companies.id,
      slug:          companies.slug,
      reportToken:   companies.reportToken,
      pocFirstName:  pocs.firstName,
      pocLastName:   pocs.lastName,
      // datasetRows fields — null if no match
      domain:        datasetRows.domain,
      headquarters:  datasetRows.headquarters,
      employeeSize:  datasetRows.employeeSize,
      hcmRaw:        datasetRows.hcmRaw,
      urlReachable:  datasetRows.urlReachable,
    })
    .from(pocs)
    .innerJoin(companies, eq(pocs.companyId, companies.id))
    .leftJoin(
      datasetRows,
      sql`LOWER(${datasetRows.companyName}) = LOWER(${companies.name})`
    )
    .where(eq(pocs.batchId, batchId));

  if (rows.length === 0)
    return NextResponse.json({ error: "No rows found for this batch." }, { status: 404 });

  // Lazy-generate tokens for any companies missing one
  for (const r of rows) {
    if (!r.reportToken) {
      const token = generatePermanentToken();
      await db.update(companies).set({ reportToken: token }).where(eq(companies.id, r.companyId));
      r.reportToken = token;
    }
  }

  const sheetData = rows.map(r => {
    const identifier  = r.slug ?? r.companyId;
    const reportLink  = r.reportToken
      ? `${origin}/report/${identifier}?token=${r.reportToken}`
      : "";

    return {
      "Company Name":          r.companyName,
      "Domain":                r.domain        ?? "",
      "Headquarters":          r.headquarters  ?? "",
      "Employee Size":         r.employeeSize  ?? "",
      "HCM / HRIS / ATS (Raw)": r.hcmRaw      ?? "",
      "Career Page URL":       r.careerPageUrl,
      "URL Valid":             r.urlReachable === true ? "Yes" : r.urlReachable === false ? "No" : "",
      "POC First Name":        r.pocFirstName,
      "POC Last Name":         r.pocLastName,
      "Report Link":           reportLink,
    };
  });

  const ws = XLSX.utils.json_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Batch");

  ws["!cols"] = [
    { wch: 30 },  // Company Name
    { wch: 25 },  // Domain
    { wch: 20 },  // Headquarters
    { wch: 14 },  // Employee Size
    { wch: 22 },  // HCM Raw
    { wch: 55 },  // Career Page URL
    { wch: 10 },  // URL Valid
    { wch: 16 },  // POC First Name
    { wch: 16 },  // POC Last Name
    { wch: 80 },  // Report Link
  ];

  const buffer   = Buffer.from(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
  const filename = `batch-${batchId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length":      String(buffer.length),
    },
  });
}
