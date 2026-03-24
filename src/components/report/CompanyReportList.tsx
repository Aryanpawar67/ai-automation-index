"use client";

import Link from "next/link";
import { useState } from "react";

interface AnalysisRow {
  analysisId:   string;
  jdTitle:      string;
  jdDepartment: string | null;
  overallScore: number | null;
  hoursSaved:   string | null;
  createdAt:    string;
}

type SortKey = "rank" | "jdTitle" | "jdDepartment" | "overallScore" | "hoursSaved";
type SortDir = "asc" | "desc";

function potential(score: number): "high" | "medium" | "low" {
  if (score >= 65) return "high";
  if (score >= 40) return "medium";
  return "low";
}

const POTENTIAL_LABEL: Record<string, string> = {
  high:   "High",
  medium: "Medium",
  low:    "Low",
};

const POTENTIAL_STYLE: Record<string, React.CSSProperties> = {
  high:   { background: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca" },
  medium: { background: "#fef3c7", color: "#d97706", border: "1px solid #fde68a" },
  low:    { background: "#d1fae5", color: "#059669", border: "1px solid #a7f3d0" },
};

const SCORE_BAR: Record<string, string> = {
  high:   "#ef4444",
  medium: "#f59e0b",
  low:    "#10b981",
};

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span style={{ opacity: active ? 1 : 0.3, marginLeft: 4, fontSize: 10 }}>
      {active && dir === "asc" ? "▲" : "▼"}
    </span>
  );
}

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
  const [sortKey, setSortKey] = useState<SortKey>("overallScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...analyses].sort((a, b) => {
    let av: string | number = 0;
    let bv: string | number = 0;
    if (sortKey === "overallScore") {
      av = a.overallScore ?? -1;
      bv = b.overallScore ?? -1;
    } else if (sortKey === "hoursSaved") {
      av = parseFloat(a.hoursSaved ?? "0") || 0;
      bv = parseFloat(b.hoursSaved ?? "0") || 0;
    } else if (sortKey === "jdTitle") {
      av = a.jdTitle.toLowerCase();
      bv = b.jdTitle.toLowerCase();
    } else if (sortKey === "jdDepartment") {
      av = (a.jdDepartment ?? "").toLowerCase();
      bv = (b.jdDepartment ?? "").toLowerCase();
    }
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  // Summary stats
  const scoredRows    = analyses.filter(a => a.overallScore != null);
  const avgScore      = scoredRows.length
    ? Math.round(scoredRows.reduce((s, a) => s + (a.overallScore ?? 0), 0) / scoredRows.length)
    : null;
  const totalHours    = analyses.reduce((s, a) => s + (parseFloat(a.hoursSaved ?? "0") || 0), 0);
  const highCount     = scoredRows.filter(a => potential(a.overallScore!) === "high").length;

  function thProps(key: SortKey) {
    return {
      onClick:   () => handleSort(key),
      style:     { cursor: "pointer", userSelect: "none" as const, whiteSpace: "nowrap" as const },
    };
  }

  return (
    <div className="animate-fade-in">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-1" style={{ color: "#220133" }}>
          {company}
        </h1>
        <p className="text-sm" style={{ color: "#9988AA" }}>
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
        <>
          {/* Summary strip */}
          <div className="card mb-6 px-6 py-4 flex flex-wrap gap-8 items-center">
            <Stat label="Total roles" value={String(analyses.length)} />
            {avgScore != null && (
              <Stat
                label="Avg automation score"
                value={String(avgScore)}
                valueStyle={{ color: avgScore >= 65 ? "#dc2626" : avgScore >= 40 ? "#d97706" : "#059669" }}
              />
            )}
            {totalHours > 0 && (
              <Stat label="Total hrs reclaimed / week" value={`${totalHours}h`} />
            )}
            {highCount > 0 && (
              <Stat
                label="High potential roles"
                value={String(highCount)}
                valueStyle={{ color: "#dc2626" }}
              />
            )}
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #EAE4EF", background: "#FAFAFA" }}>
                    <Th style={{ width: 48, textAlign: "center" }}>#</Th>
                    <Th {...thProps("jdTitle")}>
                      Role <SortIcon active={sortKey === "jdTitle"} dir={sortDir} />
                    </Th>
                    <Th {...thProps("jdDepartment")}>
                      Department <SortIcon active={sortKey === "jdDepartment"} dir={sortDir} />
                    </Th>
                    <Th {...thProps("overallScore")} style={{ width: 180, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
                      Automation Score <SortIcon active={sortKey === "overallScore"} dir={sortDir} />
                    </Th>
                    <Th {...thProps("hoursSaved")} style={{ width: 120, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
                      Hrs / week <SortIcon active={sortKey === "hoursSaved"} dir={sortDir} />
                    </Th>
                    <Th style={{ width: 110 }}>Potential</Th>
                    <Th style={{ width: 80 }} />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((a, i) => {
                    const score = a.overallScore ?? 0;
                    const pot   = potential(score);
                    const hours = a.hoursSaved ? parseFloat(a.hoursSaved) : null;
                    return (
                      <tr
                        key={a.analysisId}
                        style={{ borderBottom: "1px solid #EAE4EF" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#FDFBFE")}
                        onMouseLeave={e => (e.currentTarget.style.background = "")}
                      >
                        {/* Rank */}
                        <td style={{ padding: "14px 12px", textAlign: "center", color: "#9988AA", fontWeight: 500 }}>
                          {i + 1}
                        </td>

                        {/* Role title */}
                        <td style={{ padding: "14px 16px", maxWidth: 320 }}>
                          <span className="font-medium" style={{ color: "#220133", lineHeight: 1.4, display: "block" }}>
                            {a.jdTitle}
                          </span>
                        </td>

                        {/* Department */}
                        <td style={{ padding: "14px 16px", color: "#553366", whiteSpace: "nowrap" }}>
                          {a.jdDepartment ?? <span style={{ color: "#D0C8D8" }}>—</span>}
                        </td>

                        {/* Score + bar */}
                        <td style={{ padding: "14px 16px" }}>
                          {a.overallScore != null ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span className="score-number font-bold" style={{ color: SCORE_BAR[pot], minWidth: 26, fontSize: 14 }}>
                                {score}
                              </span>
                              <div className="progress-track" style={{ flex: 1, height: 5 }}>
                                <div
                                  className="progress-fill"
                                  style={{ width: `${score}%`, background: SCORE_BAR[pot] }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: "#D0C8D8" }}>—</span>
                          )}
                        </td>

                        {/* Hours saved */}
                        <td style={{ padding: "14px 16px", color: "#553366", whiteSpace: "nowrap" }}>
                          {hours != null
                            ? <span className="score-number">{hours}h</span>
                            : <span style={{ color: "#D0C8D8" }}>—</span>
                          }
                        </td>

                        {/* Potential badge */}
                        <td style={{ padding: "14px 16px" }}>
                          {a.overallScore != null && (
                            <span className="badge" style={POTENTIAL_STYLE[pot]}>
                              {POTENTIAL_LABEL[pot]}
                            </span>
                          )}
                        </td>

                        {/* View link */}
                        <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                          <Link
                            href={`/report/${companyId}/${a.analysisId}?token=${token}`}
                            style={{ color: "#FD5A0F", fontWeight: 600, fontSize: 12 }}
                          >
                            View →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Th({
  children,
  style,
  onClick,
}: {
  children?: React.ReactNode;
  style?:    React.CSSProperties;
  onClick?:  () => void;
}) {
  return (
    <th
      onClick={onClick}
      style={{
        padding:       "11px 16px",
        textAlign:     "left",
        fontSize:      11,
        fontWeight:    600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color:         "#9988AA",
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function Stat({
  label,
  value,
  valueStyle,
}: {
  label:       string;
  value:       string;
  valueStyle?: React.CSSProperties;
}) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#9988AA", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 2 }}>
        {label}
      </div>
      <div className="score-number" style={{ fontSize: 22, fontWeight: 700, color: "#220133", ...valueStyle }}>
        {value}
      </div>
    </div>
  );
}
