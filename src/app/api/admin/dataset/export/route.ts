import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db/client";
import { datasetRows }               from "@/lib/db/schema";
import { inArray }                   from "drizzle-orm";
import * as XLSX                     from "xlsx";

// GET ?rowIds=id1,id2,id3  — exports selected rows
// GET (no params)           — exports all rows
export async function GET(req: NextRequest) {
  const rowIdsParam = req.nextUrl.searchParams.get("rowIds");
  const rowIds      = rowIdsParam ? rowIdsParam.split(",").filter(Boolean) : [];

  const rows = rowIds.length > 0
    ? await db.select().from(datasetRows).where(inArray(datasetRows.id, rowIds))
    : await db.select().from(datasetRows);

  if (rows.length === 0)
    return NextResponse.json({ error: "No rows to export." }, { status: 404 });

  // Helper: flatten hrStack jsonb into readable strings
  function hrField(r: typeof rows[0], cat: "ats" | "hcm" | "lxp" | "hris") {
    const v = (r.hrStack as Record<string, { vendor?: string; confidence?: number; source?: string } | null> | null)?.[cat];
    if (!v?.vendor) return "";
    return `${v.vendor} (${v.confidence ?? 0}%)`;
  }
  function hrSource(r: typeof rows[0], cat: "ats" | "hcm" | "lxp" | "hris") {
    const v = (r.hrStack as Record<string, { vendor?: string; confidence?: number; source?: string } | null> | null)?.[cat];
    return v?.source ?? "";
  }

  // Build worksheet with all enriched columns
  const sheetData = rows.map(r => ({
    "#":                      r.rowNumber ?? "",
    "Company Name":           r.companyName,
    "Domain":                 r.domain,
    "Headquarters":           r.headquarters ?? "",
    "Employee Size":          r.employeeSize ?? "",
    "HCM / HRIS / ATS (Raw)": r.hcmRaw ?? "",
    "ATS Type (Detected)":    r.urlDetectedAts ?? r.atsType ?? "",
    "Career Page URL":        r.careerPageUrl,
    "URL Valid":              r.urlReachable === true ? "Yes" : r.urlReachable === false ? "No" : "",
    "URL Confidence":         r.urlConfidence ?? "",
    "URL Validation Notes":   r.urlReason ?? "",
    // POC contact
    "POC First Name":         r.pocFirstName ?? "",
    "POC Last Name":          r.pocLastName  ?? "",
    "POC Email":              r.pocEmail     ?? "",
    // LinkedIn
    "LinkedIn URL":           r.linkedinUrl         ?? "",
    "LinkedIn Confidence":    r.linkedinConfidence != null ? `${r.linkedinConfidence}%` : "",
    // HR Stack enrichment
    "HR Stack — ATS":         hrField(r, "ats"),
    "HR Stack — ATS Source":  hrSource(r, "ats"),
    "HR Stack — HCM":         hrField(r, "hcm"),
    "HR Stack — HCM Source":  hrSource(r, "hcm"),
    "HR Stack — LXP":         hrField(r, "lxp"),
    "HR Stack — LXP Source":  hrSource(r, "lxp"),
    "HR Stack — HRIS":        hrField(r, "hris"),
    "HR Stack — HRIS Source": hrSource(r, "hris"),
    "HR Stack Enriched At":   r.hrStackDiscoveredAt ? new Date(r.hrStackDiscoveredAt).toISOString().slice(0, 10) : "",
  }));

  const ws = XLSX.utils.json_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dataset");

  ws["!cols"] = [
    { wch: 6  },  // #
    { wch: 30 },  // Company Name
    { wch: 25 },  // Domain
    { wch: 20 },  // Headquarters
    { wch: 14 },  // Employee Size
    { wch: 20 },  // HCM Raw
    { wch: 18 },  // ATS Detected
    { wch: 60 },  // Career Page URL
    { wch: 10 },  // URL Valid
    { wch: 12 },  // URL Confidence
    { wch: 40 },  // URL Notes
    { wch: 16 },  // POC First
    { wch: 16 },  // POC Last
    { wch: 30 },  // POC Email
    { wch: 45 },  // LinkedIn URL
    { wch: 12 },  // LinkedIn Confidence
    { wch: 22 },  // HR ATS
    { wch: 40 },  // HR ATS Source
    { wch: 22 },  // HR HCM
    { wch: 40 },  // HR HCM Source
    { wch: 22 },  // HR LXP
    { wch: 40 },  // HR LXP Source
    { wch: 22 },  // HR HRIS
    { wch: 40 },  // HR HRIS Source
    { wch: 14 },  // Enriched At
  ];

  const buffer   = Buffer.from(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
  const filename = `career-urls-corrected-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length":      String(buffer.length),
    },
  });
}
