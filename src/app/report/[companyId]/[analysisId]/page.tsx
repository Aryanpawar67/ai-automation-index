export const dynamic = "force-dynamic";

import DashboardView, { type Analysis } from "@/components/DashboardView";
import { db }                           from "@/lib/db/client";
import { analyses, jobDescriptions, companies } from "@/lib/db/schema";
import { verifyReportToken }            from "@/lib/token";
import { eq, and }                      from "drizzle-orm";
import { notFound }                     from "next/navigation";

function ExpiredScreen() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      padding: "0 16px",
      background: "linear-gradient(160deg, #FFF8F5 0%, #FFFFFF 50%, #F4EFF6 100%)",
    }}>
      <div style={{
        background: "#fff", border: "1px solid #EAE4EF", borderRadius: 24,
        padding: "40px 36px", maxWidth: 380, width: "100%", textAlign: "center",
        boxShadow: "0 4px 24px rgba(34,1,51,0.08)",
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 16,
          background: "#fef2f2", border: "1px solid #fecaca",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px",
        }}>
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: "#220133", margin: "0 0 8px" }}>
          Link expired or invalid
        </h1>
        <p style={{ fontSize: 13, color: "#9988AA", margin: 0, lineHeight: 1.6 }}>
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
