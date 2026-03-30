export const dynamic = "force-dynamic";

import DashboardView, { type Analysis } from "@/components/DashboardView";
import { db }                           from "@/lib/db/client";
import { analyses, jobDescriptions, companies } from "@/lib/db/schema";
import { eq, and }                      from "drizzle-orm";
import { notFound }                     from "next/navigation";

export default async function AnalysisReportPage({
  params,
  searchParams,
}: {
  params:       Promise<{ companyId: string; analysisId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { companyId, analysisId } = await params;
  const { token = "" }            = await searchParams;


  const [row] = await db
    .select({
      result:      analyses.result,
      companyName: companies.name,
    })
    .from(analyses)
    .innerJoin(companies, eq(analyses.companyId, companies.id))
    .where(and(eq(analyses.id, analysisId), eq(analyses.companyId, companyId)));

  if (!row) notFound();

  const analysis = row.result as Analysis;
  const backHref = `/report/${companyId}?token=${encodeURIComponent(token)}`;

  return (
    <DashboardView
      analysis={analysis}
      company={row.companyName}
      backHref={backHref}
    />
  );
}
