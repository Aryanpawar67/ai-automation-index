export const dynamic = "force-dynamic";

import DashboardView, { type Analysis } from "@/components/DashboardView";
import { db }                           from "@/lib/db/client";
import { analyses, jobDescriptions, companies } from "@/lib/db/schema";
import { verifyReportToken }            from "@/lib/token";
import { eq, and }                      from "drizzle-orm";
import { notFound }                     from "next/navigation";

function ExpiredScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "linear-gradient(160deg, #FFF8F5 0%, #FFFFFF 50%, #F9F7FB 100%)" }}>
      <div className="card p-10 max-w-sm w-full text-center">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: "#fef2f2" }}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="text-lg font-bold mb-2" style={{ color: "#220133" }}>Link expired or invalid</h1>
        <p className="text-sm leading-relaxed" style={{ color: "#9988AA" }}>
          Report links are valid for 7 days. Please contact your iMocha representative for a fresh link.
        </p>
      </div>
    </div>
  );
}

export default async function AnalysisReportPage({
  params,
  searchParams,
}: {
  params:       Promise<{ companyId: string; analysisId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { companyId, analysisId } = await params;
  const { token = "" }            = await searchParams;

  if (!verifyReportToken(companyId, token)) return <ExpiredScreen />;

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
