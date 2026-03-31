import { NextRequest, NextResponse }          from "next/server";
import { db }                                 from "@/lib/db/client";
import { analyses, jobDescriptions, companies } from "@/lib/db/schema";
import { isValidTitle }                       from "@/lib/validation";
import { eq, and, ne }                        from "drizzle-orm";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId: identifier } = await params;

  // Resolve by slug or UUID
  const [company] = await db
    .select({ id: companies.id, name: companies.name, totalJobsAvailable: companies.totalJobsAvailable })
    .from(companies)
    .where(UUID_RE.test(identifier) ? eq(companies.id, identifier) : eq(companies.slug, identifier));

  if (!company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  const companyId = company.id;

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
      ne(jobDescriptions.status, "invalid"),
    ))
    .orderBy(analyses.createdAt);

  const clean = rows.filter(r => isValidTitle(r.jdTitle));

  return NextResponse.json({
    company:            company.name,
    analyses:           clean,
    totalJobsAvailable: company.totalJobsAvailable,
  });
}
