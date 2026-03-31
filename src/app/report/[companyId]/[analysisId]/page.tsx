export const dynamic = "force-dynamic";

import DashboardView, { type Analysis } from "@/components/DashboardView";
import { db }                           from "@/lib/db/client";
import { analyses, jobDescriptions, companies } from "@/lib/db/schema";
import { eq, and }                      from "drizzle-orm";
import { notFound }                     from "next/navigation";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AnalysisReportPage({
  params,
}: {
  params: Promise<{ companyId: string; analysisId: string }>;
}) {
  const { companyId: identifier, analysisId } = await params;

  // Resolve company by slug or UUID
  const [company] = await db
    .select({ id: companies.id, name: companies.name, slug: companies.slug })
    .from(companies)
    .where(UUID_RE.test(identifier) ? eq(companies.id, identifier) : eq(companies.slug, identifier));

  if (!company) return notFound();

  const companyId = company.id;

  const [row] = await db
    .select({ result: analyses.result, companyName: companies.name })
    .from(analyses)
    .innerJoin(companies, eq(analyses.companyId, companies.id))
    .where(and(eq(analyses.id, analysisId), eq(analyses.companyId, companyId)));

  if (!row) notFound();

  const analysis = row.result as Analysis;
  const publicIdentifier = company.slug ?? companyId;
  const backHref = `/report/${publicIdentifier}`;

  return (
    <DashboardView
      analysis={analysis}
      company={row.companyName}
      backHref={backHref}
    />
  );
}
