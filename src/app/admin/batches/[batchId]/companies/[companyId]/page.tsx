export const dynamic = "force-dynamic";

import { db }               from "@/lib/db/client";
import { companies, jobDescriptions, batches, analyses } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { notFound }         from "next/navigation";
import CompanyJDSplitView   from "@/components/admin/CompanyJDSplitView";

export default async function CompanyJDsPage({
  params,
}: {
  params: Promise<{ batchId: string; companyId: string }>;
}) {
  const { batchId, companyId } = await params;

  const [[batch], [company], jds] = await Promise.all([
    db.select().from(batches).where(eq(batches.id, batchId)),
    db.select().from(companies).where(eq(companies.id, companyId)),
    db.select().from(jobDescriptions).where(
      and(
        eq(jobDescriptions.batchId, batchId),
        eq(jobDescriptions.companyId, companyId),
      )
    ).orderBy(jobDescriptions.createdAt),
  ]);

  if (!batch || !company) notFound();

  // Load analyses for complete JDs
  const completeJdIds = jds.filter(j => j.status === "complete").map(j => j.id);
  const analysisRows  = completeJdIds.length > 0
    ? await db.select({
        jobDescriptionId: analyses.jobDescriptionId,
        overallScore:     analyses.overallScore,
        hoursSaved:       analyses.hoursSaved,
      }).from(analyses).where(inArray(analyses.jobDescriptionId, completeJdIds))
    : [];
  const analysisMap = Object.fromEntries(analysisRows.map(a => [a.jobDescriptionId, a]));

  const jdsWithAnalysis = jds.map(jd => ({
    id:         jd.id,
    title:      jd.title,
    department: jd.department,
    rawText:    jd.rawText,
    status:     jd.status,
    analysis:   analysisMap[jd.id] ?? null,
  }));

  return (
    <CompanyJDSplitView
      batchId={batchId}
      batch={{ filename: batch.filename }}
      company={{
        id:                 company.id,
        name:               company.name,
        careerPageUrl:      company.careerPageUrl,
        totalJobsAvailable: company.totalJobsAvailable ?? null,
      }}
      jds={jdsWithAnalysis}
    />
  );
}
