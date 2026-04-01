import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db/client";
import { datasetRows, companies }    from "@/lib/db/schema";
import { inArray, eq, sql }          from "drizzle-orm";
import * as XLSX                     from "xlsx";
import { generatePermanentToken }    from "@/lib/token";

// GET ?rowIds=id1,id2,id3  — exports selected rows
// GET (no params)           — exports all rows
export async function GET(req: NextRequest) {
  const rowIdsParam = req.nextUrl.searchParams.get("rowIds");
  const rowIds      = rowIdsParam ? rowIdsParam.split(",").filter(Boolean) : [];
  const origin      = req.nextUrl.origin;

  const rows = rowIds.length > 0
    ? await db
        .select({
          companyName:  datasetRows.companyName,
          domain:       datasetRows.domain,
          headquarters: datasetRows.headquarters,
          employeeSize: datasetRows.employeeSize,
          hcmRaw:       datasetRows.hcmRaw,
          careerPageUrl: datasetRows.careerPageUrl,
          urlReachable:  datasetRows.urlReachable,
          pocFirstName:  datasetRows.pocFirstName,
          pocLastName:   datasetRows.pocLastName,
          // company fields for report link
          companySlug:   companies.slug,
          companyId:     companies.id,
          reportToken:   companies.reportToken,
        })
        .from(datasetRows)
        .leftJoin(companies, eq(companies.careerPageUrl, datasetRows.careerPageUrl))
        .where(inArray(datasetRows.id, rowIds))
    : await db
        .select({
          companyName:  datasetRows.companyName,
          domain:       datasetRows.domain,
          headquarters: datasetRows.headquarters,
          employeeSize: datasetRows.employeeSize,
          hcmRaw:       datasetRows.hcmRaw,
          careerPageUrl: datasetRows.careerPageUrl,
          urlReachable:  datasetRows.urlReachable,
          pocFirstName:  datasetRows.pocFirstName,
          pocLastName:   datasetRows.pocLastName,
          companySlug:   companies.slug,
          companyId:     companies.id,
          reportToken:   companies.reportToken,
        })
        .from(datasetRows)
        .leftJoin(companies, eq(companies.careerPageUrl, datasetRows.careerPageUrl))
        .orderBy(sql`${datasetRows.rowNumber} ASC NULLS LAST`);

  if (rows.length === 0)
    return NextResponse.json({ error: "No rows to export." }, { status: 404 });

  // Lazy-generate tokens for companies that don't have one yet
  for (const r of rows) {
    if (r.companyId && !r.reportToken) {
      const token = generatePermanentToken();
      await db.update(companies).set({ reportToken: token }).where(eq(companies.id, r.companyId));
      r.reportToken = token;
    }
  }

  const sheetData = rows.map(r => {
    const identifier = r.companySlug ?? r.companyId;
    const reportLink = identifier && r.reportToken
      ? `${origin}/report/${identifier}?token=${r.reportToken}`
      : "";

    return {
      "Company Name":            r.companyName,
      "Domain":                  r.domain       ?? "",
      "Headquarters":            r.headquarters ?? "",
      "Employee Size":           r.employeeSize ?? "",
      "HCM / HRIS / ATS (Raw)":  r.hcmRaw      ?? "",
      "Career Page URL":         r.careerPageUrl,
      "URL Valid":               r.urlReachable === true ? "Yes" : r.urlReachable === false ? "No" : "",
      "POC First Name":          r.pocFirstName  ?? "",
      "POC Last Name":           r.pocLastName   ?? "",
      "Report Link":             reportLink,
    };
  });

  const ws = XLSX.utils.json_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dataset");

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
  const filename = `imocha-outreach-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length":      String(buffer.length),
    },
  });
}
