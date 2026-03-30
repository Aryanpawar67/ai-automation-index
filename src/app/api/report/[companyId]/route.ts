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

  const [company] = await db.select({ name: companies.name, totalJobsAvailable: companies.totalJobsAvailable })
    .from(companies)
    .where(eq(companies.id, companyId));

  if (!company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  const rows = await db
    .select({
      analysisId:   analyses.id,
      jdTitle:      jobDescriptions.title,
      jdDepartment: jobDescriptions.department,
      sourceUrl:    jobDescriptions.sourceUrl,
      overallScore: analyses.overallScore,
      hoursSaved:   analyses.hoursSaved,
      createdAt:    analyses.createdAt,
    })
    .from(analyses)
    .innerJoin(jobDescriptions, eq(analyses.jobDescriptionId, jobDescriptions.id))
    .where(and(
      eq(analyses.companyId, companyId),
      ne(jobDescriptions.status, "invalid"),   // exclude newly-flagged invalid JDs
    ))
    .orderBy(analyses.createdAt);

  // Secondary filter: remove old bad analyses where the title is still a
  // marketing/navigation string (from pre-validation batches).
  const clean = rows.filter(r => isValidTitle(r.jdTitle));

  return NextResponse.json({
    company:            company.name,
    analyses:           clean,
    totalJobsAvailable: company.totalJobsAvailable,
    token,
  });
}
