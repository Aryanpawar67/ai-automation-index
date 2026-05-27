import { NextRequest, NextResponse }               from "next/server";
import { db }                                      from "@/lib/db/client";
import { analyses, jobDescriptions, companies }    from "@/lib/db/schema";
import { eq, and }                                 from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string; analysisId: string }> }
) {
  const { companyId, analysisId } = await params;
  const token = req.nextUrl.searchParams.get("token") ?? "";

  const [company] = await db
    .select({ name: companies.name, reportToken: companies.reportToken })
    .from(companies)
    .where(eq(companies.id, companyId));

  if (!company || !company.reportToken || token !== company.reportToken)
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const [row] = await db
    .select({
      jdTitle:      jobDescriptions.title,
      jdDepartment: jobDescriptions.department,
      overallScore: analyses.overallScore,
      hoursSaved:   analyses.hoursSaved,
      createdAt:    analyses.createdAt,
      result:       analyses.result,
    })
    .from(analyses)
    .innerJoin(jobDescriptions, eq(analyses.jobDescriptionId, jobDescriptions.id))
    .where(and(eq(analyses.id, analysisId), eq(analyses.companyId, companyId)));

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ company: company.name, analysis: row });
}
