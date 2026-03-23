import Link from "next/link";

interface AnalysisRow {
  analysisId:   string;
  jdTitle:      string;
  jdDepartment: string | null;
  overallScore: number | null;
  hoursSaved:   string | null;
  createdAt:    string;
}

const scoreColor = (s: number) => s >= 70 ? "#ef4444" : s >= 40 ? "#f59e0b" : "#10b981";
const scoreBg    = (s: number) => s >= 70 ? "#fef2f2" : s >= 40 ? "#fffbeb" : "#f0fdf4";

export default function CompanyReportList({
  company,
  analyses,
  companyId,
  token,
}: {
  company:   string;
  analyses:  AnalysisRow[];
  companyId: string;
  token:     string;
}) {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="badge badge-medium">{analyses.length} report{analyses.length !== 1 ? "s" : ""}</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#220133" }}>{company}</h1>
        <p className="text-sm mt-1.5" style={{ color: "#9988AA" }}>
          AI automation analysis across your open roles · Powered by Claude
        </p>
      </div>

      {analyses.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-sm" style={{ color: "#9988AA" }}>
            Analysis is in progress. Check back shortly.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {analyses.map(a => {
            const score = a.overallScore ?? 0;
            return (
              <Link
                key={a.analysisId}
                href={`/report/${companyId}/${a.analysisId}?token=${token}`}
                className="card card-hover p-5 block"
              >
                <div className="flex items-start justify-between mb-3">
                  {a.jdDepartment && (
                    <span className="badge badge-medium">{a.jdDepartment}</span>
                  )}
                  {a.overallScore != null && (
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl ml-auto"
                      style={{ background: scoreBg(score) }}>
                      <span className="text-sm font-extrabold score-number" style={{ color: scoreColor(score) }}>
                        {score}
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-sm font-semibold mb-1 leading-snug" style={{ color: "#220133" }}>
                  {a.jdTitle}
                </p>
                {a.hoursSaved && (
                  <p className="text-xs" style={{ color: "#9988AA" }}>
                    {parseFloat(a.hoursSaved)}h / week reclaimed
                  </p>
                )}
                <p className="text-xs mt-3 font-medium" style={{ color: "#FD5A0F" }}>
                  View full analysis →
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
