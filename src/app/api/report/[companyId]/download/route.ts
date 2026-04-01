import { NextRequest, NextResponse }          from "next/server";
import { db }                                 from "@/lib/db/client";
import { analyses, jobDescriptions, companies } from "@/lib/db/schema";
import { isValidTitle }                       from "@/lib/validation";
import { eq, and, ne }                        from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;
  const token         = req.nextUrl.searchParams.get("token") ?? "";

  const [company] = await db.select({ name: companies.name, reportToken: companies.reportToken })
    .from(companies)
    .where(eq(companies.id, companyId));

  if (!company || !company.reportToken || token !== company.reportToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const rows = await db
    .select({
      analysisId:   analyses.id,
      jdTitle:      jobDescriptions.title,
      jdDepartment: jobDescriptions.department,
      overallScore: analyses.overallScore,
      hoursSaved:   analyses.hoursSaved,
      createdAt:    analyses.createdAt,
      result:       analyses.result,
    })
    .from(analyses)
    .innerJoin(jobDescriptions, eq(analyses.jobDescriptionId, jobDescriptions.id))
    .where(and(
      eq(analyses.companyId, companyId),
      ne(jobDescriptions.status, "invalid"),
    ))
    .orderBy(analyses.createdAt);

  const clean = rows.filter(r => isValidTitle(r.jdTitle));

  return NextResponse.json({ company: company.name, analyses: clean });
}
