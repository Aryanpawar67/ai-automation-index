export const dynamic = "force-dynamic";

// ── Daman-only report route ─────────────────────────────────────────────────
// Next.js routing prefers static segments over dynamic ones, so this file
// catches /report/daman-health specifically, while /report/[companyId] keeps
// handling every other company unchanged. Keeps the shareable URL identical
// and leaves the main report flow untouched.

import CompanyReportList from "@/components/report/CompanyReportList";
import CompleteCoverageHeroStrip from "@/components/report/CompleteCoverageHeroStrip";
import FullAnalysisHeroStrip from "@/components/report/FullAnalysisHeroStrip";
import { db }            from "@/lib/db/client";
import { analyses, jobDescriptions, companies } from "@/lib/db/schema";
import { isValidTitle }  from "@/lib/validation";
import { eq, and, ne }   from "drizzle-orm";
import { notFound }      from "next/navigation";

const DAMAN_SLUG = "daman-health-may-2026";

function IMochaLogo() {
  return (
    <img src="/imocha-logo.png" alt="iMocha" style={{ height: 28, width: "auto", display: "block" }} />
  );
}

export default async function DamanReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const { token } = await searchParams;

  const [company] = await db
    .select({
      id: companies.id,
      name: companies.name,
      slug: companies.slug,
      reportToken: companies.reportToken,
      totalJobsAvailable: companies.totalJobsAvailable,
    })
    .from(companies)
    .where(eq(companies.slug, DAMAN_SLUG));

  if (!company) return notFound();
  if (!token || !company.reportToken || token !== company.reportToken) return notFound();

  const rows = await db
    .select({
      analysisId:   analyses.id,
      jdTitle:      jobDescriptions.title,
      jdDepartment: jobDescriptions.department,
      overallScore: analyses.overallScore,
      hoursSaved:   analyses.hoursSaved,
      createdAt:    analyses.createdAt,
    })
    .from(analyses)
    .innerJoin(jobDescriptions, eq(analyses.jobDescriptionId, jobDescriptions.id))
    .where(and(eq(analyses.companyId, company.id), ne(jobDescriptions.status, "invalid")))
    .orderBy(analyses.createdAt);

  const cleanAnalyses = rows
    .filter(r => isValidTitle(r.jdTitle))
    .map(r => ({ ...r, createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt }));

  return (
    <div style={{ minHeight: "100vh", background: "#F4EFF6" }}>
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 28px", height: 56,
        background: "rgba(255,255,255,0.96)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid #EAE4EF",
        boxShadow: "0 1px 12px rgba(34,1,51,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <IMochaLogo />
          <span style={{ color: "#EAE4EF", fontSize: 16 }}>|</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: "#553366" }}>AI Automation Index</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#9988AA" }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%", background: "#34d399",
            display: "inline-block", animation: "pulse 1.4s ease-in-out infinite",
          }} />
          Powered by Claude
        </div>
      </nav>

      {cleanAnalyses.length > 0 && (
        company.totalJobsAvailable != null && cleanAnalyses.length >= company.totalJobsAvailable
          ? <CompleteCoverageHeroStrip
              company={company.name}
              companyId={company.id}
              analysedCount={cleanAnalyses.length}
              token={token}
            />
          : <FullAnalysisHeroStrip
              company={company.name}
              companyId={company.id}
              totalAvailable={company.totalJobsAvailable ?? cleanAnalyses.length}
              analysedCount={cleanAnalyses.length}
              token={token}
            />
      )}

      <main style={{ maxWidth: 1152, margin: "0 auto", padding: "36px 28px 60px" }}>
        <CompanyReportList
          company={company.name}
          analyses={cleanAnalyses}
          companyId={company.id}
          identifier={company.slug ?? company.id}
          token={token as string}
        />
      </main>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
