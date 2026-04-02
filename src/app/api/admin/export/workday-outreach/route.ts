import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db/client";
import { companies, pocs, jobDescriptions } from "@/lib/db/schema";
import { eq, and, sql }              from "drizzle-orm";
import * as XLSX                     from "xlsx";

export const dynamic = "force-dynamic";

function buildEmailText(
  companyName:  string,
  reportLink:   string,
  pocFirstName: string,
): string {
  const greeting = pocFirstName ? `Hi ${pocFirstName},` : "Hi there,";
  return `Subject: Your AI Automation Readiness Report — ${companyName}

${greeting}

I hope this message finds you well.

We recently conducted an AI Automation Readiness analysis for ${companyName} and we'd love to share the insights with you.

Your personalized report is ready here:
${reportLink}

The report breaks down ${companyName}'s open roles by automation readiness, highlights where AI-powered skill assessments could reduce time-to-hire, and identifies high-impact positions for immediate ROI.

We'd love to walk you through the findings and explore how iMocha can support ${companyName}'s hiring goals. Would you be open to a 20-minute call this week?

Looking forward to connecting.

Warm regards,
The iMocha Team
imocha.io | AI-Powered Skill Intelligence`;
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;

  // Workday companies that have a reportToken and at least one completed JD
  const rows = await db
    .select({
      companyId:          companies.id,
      companyName:        companies.name,
      slug:               companies.slug,
      atsType:            companies.atsType,
      totalJobsAvailable: companies.totalJobsAvailable,
      reportToken:        companies.reportToken,
      pocFirstName:       pocs.firstName,
      pocLastName:        pocs.lastName,
      analysedJds:        sql<number>`COUNT(CASE WHEN ${jobDescriptions.status} = 'complete' THEN 1 END)`.mapWith(Number),
    })
    .from(companies)
    .innerJoin(pocs, eq(pocs.companyId, companies.id))
    .leftJoin(jobDescriptions, eq(jobDescriptions.companyId, companies.id))
    .where(and(
      eq(companies.atsType, "workday"),
      sql`${companies.reportToken} IS NOT NULL`,
    ))
    .groupBy(companies.id, companies.name, companies.slug, companies.atsType, companies.totalJobsAvailable, companies.reportToken, pocs.firstName, pocs.lastName)
    .orderBy(companies.name);

  // Filter to only companies with at least one completed JD
  const ready = rows.filter(r => r.analysedJds > 0);

  const sheetData = ready.map(r => {
    const identifier  = r.slug ?? r.companyId;
    const reportLink  = `${origin}/report/${identifier}?token=${r.reportToken}`;
    const rolesCell   = r.totalJobsAvailable
      ? `${r.analysedJds} / ${r.totalJobsAvailable}`
      : `${r.analysedJds}`;

    return {
      "Company Name":           r.companyName,
      "POC First Name":         r.pocFirstName,
      "POC Last Name":          r.pocLastName,
      "ATS / HCM":              "Workday",
      "Roles Analysed / Available": rolesCell,
      "Report Link":            reportLink,
      "Email Text":             buildEmailText(r.companyName, reportLink, r.pocFirstName),
    };
  });

  const wb  = XLSX.utils.book_new();
  const ws  = XLSX.utils.json_to_sheet(sheetData);

  // Column widths
  ws["!cols"] = [
    { wch: 30 },  // Company Name
    { wch: 18 },  // POC First Name
    { wch: 18 },  // POC Last Name
    { wch: 14 },  // ATS / HCM
    { wch: 26 },  // Roles
    { wch: 80 },  // Report Link
    { wch: 100 }, // Email Text
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Workday Outreach");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="workday-outreach-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
