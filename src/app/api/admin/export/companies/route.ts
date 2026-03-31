import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db/client";
import { batches, companies, pocs, jobDescriptions, analyses } from "@/lib/db/schema";
import { eq, sql }                   from "drizzle-orm";
import * as XLSX                     from "xlsx";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;

  // One row per company per batch — join via pocs
  const rows = await db
    .select({
      companyName:        companies.name,
      atsType:            companies.atsType,
      careerPageUrl:      companies.careerPageUrl,
      scrapeStatus:       companies.scrapeStatus,
      totalJobsAvailable: companies.totalJobsAvailable,
      slug:               companies.slug,
      companyId:          companies.id,
      batchName:          batches.filename,
      batchCustomName:    batches.name,
      batchCreatedAt:     batches.createdAt,
      jdsAnalysed:        sql<number>`COUNT(CASE WHEN ${jobDescriptions.status} = 'complete' THEN 1 END)`.mapWith(Number),
      avgScore:           sql<number>`ROUND(AVG(${analyses.overallScore}))`.mapWith(Number),
      totalHoursSaved:    sql<number>`COALESCE(SUM(${analyses.hoursSaved}), 0)`.mapWith(Number),
    })
    .from(pocs)
    .innerJoin(companies, eq(companies.id, pocs.companyId))
    .innerJoin(batches,   eq(batches.id, pocs.batchId))
    .leftJoin(jobDescriptions, sql`${jobDescriptions.companyId} = ${companies.id} AND ${jobDescriptions.batchId} = ${pocs.batchId}`)
    .leftJoin(analyses, sql`${analyses.companyId} = ${companies.id} AND ${analyses.jobDescriptionId} = ${jobDescriptions.id}`)
    .groupBy(companies.id, batches.id, pocs.batchId)
    .orderBy(sql`${batches.createdAt} DESC`, sql`${companies.name} ASC`);

  if (rows.length === 0)
    return NextResponse.json({ error: "No data to export." }, { status: 404 });

  const ATS_LABELS: Record<string, string> = {
    workday:      "Workday",
    sap_sf:       "SAP SuccessFactors",
    oracle_hcm:   "Oracle HCM",
    oracle_taleo: "Oracle Taleo",
    greenhouse:   "Greenhouse",
    lever:        "Lever",
  };

  const sheetData = rows.map(r => {
    const identifier = r.slug ?? r.companyId;
    const reportUrl  = `${origin}/report/${identifier}`;
    const batchLabel = r.batchCustomName ?? r.batchName;
    const batchDate  = r.batchCreatedAt
      ? new Date(r.batchCreatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
      : "";

    return {
      "Company Name":        r.companyName,
      "ATS / HCM":           ATS_LABELS[r.atsType ?? ""] ?? r.atsType ?? "",
      "Career Page URL":     r.careerPageUrl,
      "Batch":               batchLabel,
      "Batch Run Date":      batchDate,
      "Scrape Status":       r.scrapeStatus,
      "Open Roles":          r.totalJobsAvailable ?? "",
      "JDs Analysed":        r.jdsAnalysed > 0 ? r.jdsAnalysed : "",
      "Avg Automation Score": r.avgScore > 0 ? `${r.avgScore}%` : "",
      "Hours Saved / Week":  r.totalHoursSaved > 0 ? `${Math.round(r.totalHoursSaved)}h` : "",
      "Report URL":          r.jdsAnalysed > 0 ? reportUrl : "",
    };
  });

  const ws = XLSX.utils.json_to_sheet(sheetData);
  XLSX.utils.book_append_sheet(XLSX.utils.book_new(), ws, "Companies");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Companies");

  ws["!cols"] = [
    { wch: 32 },  // Company Name
    { wch: 20 },  // ATS / HCM
    { wch: 55 },  // Career Page URL
    { wch: 28 },  // Batch
    { wch: 16 },  // Batch Run Date
    { wch: 14 },  // Scrape Status
    { wch: 12 },  // Open Roles
    { wch: 14 },  // JDs Analysed
    { wch: 20 },  // Avg Score
    { wch: 18 },  // Hours Saved
    { wch: 60 },  // Report URL
  ];

  const buffer   = Buffer.from(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
  const filename = `imocha-outreach-companies-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length":      String(buffer.length),
    },
  });
}
