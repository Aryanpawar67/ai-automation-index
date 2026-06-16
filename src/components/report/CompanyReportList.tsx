"use client";

import Link from "next/link";
import { useState } from "react";
import DownloadAllButton from "./DownloadAllButton";

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

const POTENTIAL_CFG: Record<string, { label: string; text: string; bg: string; border: string }> = {
  high:   { label: "High",   text: "#dc2626", bg: "rgba(239,68,68,0.10)",  border: "rgba(239,68,68,0.25)"  },
  medium: { label: "Medium", text: "#d97706", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.25)" },
  low:    { label: "Low",    text: "#059669", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.25)" },
};

const SCORE_COLOR = (score: number) =>
  score >= 65 ? "#ef4444" : score >= 40 ? "#f59e0b" : "#10b981";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "overallScore", label: "Score"      },
  { key: "hoursSaved",   label: "Hours/wk"   },
  { key: "jdTitle",      label: "Title A–Z"  },
  { key: "jdDepartment", label: "Department" },
];

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

  const scoredRows = analyses.filter(a => a.overallScore != null);
  const avgScore   = scoredRows.length
    ? Math.round(scoredRows.reduce((s, a) => s + (a.overallScore ?? 0), 0) / scoredRows.length)
    : null;
  const totalHours = analyses.reduce((s, a) => s + (parseFloat(a.hoursSaved ?? "0") || 0), 0);
  const highCount  = scoredRows.filter(a => potential(a.overallScore!) === "high").length;

  return (
    <div style={{ animation: "fadeInUp 0.4s ease both" }}>

      {/* Page header */}
      <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        gap: 16, marginBottom: 28, flexWrap: "wrap",
      }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#220133", margin: "0 0 5px", letterSpacing: "-0.5px" }}>
            {company}
          </h1>
          <p style={{ fontSize: 13, color: "#9988AA", margin: 0 }}>
            AI automation analysis across your open roles · Powered by Claude
          </p>
        </div>
        {analyses.length > 0 && (
          <DownloadAllButton
            companyId={companyId}
            company={company}
            count={analyses.length}
          />
        )}
      </div>

      {analyses.length === 0 ? (
        <div style={{
          background: "#fff", border: "1px solid #EAE4EF", borderRadius: 20,
          padding: "60px 40px", textAlign: "center",
          boxShadow: "0 2px 12px rgba(34,1,51,0.06)",
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#553366", margin: "0 0 6px" }}>Analysis in progress</p>
          <p style={{ fontSize: 13, color: "#9988AA", margin: 0 }}>Check back shortly — roles are being scored now.</p>
        </div>
      ) : (
        <>
          {/* Summary strip */}
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 24,
          }}>
            <StatChip label="Total roles" value={String(analyses.length)} color="#220133" bg="#F4EFF6" border="#EAE4EF" />
            {avgScore != null && (
              <StatChip
                label="Avg automation score" value={`${avgScore}%`}
                color={SCORE_COLOR(avgScore)} bg={avgScore >= 65 ? "rgba(239,68,68,0.08)" : avgScore >= 40 ? "rgba(245,158,11,0.08)" : "rgba(16,185,129,0.08)"}
                border={avgScore >= 65 ? "rgba(239,68,68,0.2)" : avgScore >= 40 ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)"}
              />
            )}
            {totalHours > 0 && (
              <StatChip label="Total hrs reclaimed/wk" value={`${totalHours}h`} color="#059669" bg="rgba(16,185,129,0.08)" border="rgba(16,185,129,0.2)" />
            )}
            {highCount > 0 && (
              <StatChip label="High potential roles" value={String(highCount)} color="#dc2626" bg="rgba(239,68,68,0.08)" border="rgba(239,68,68,0.2)" />
            )}
          </div>

          {/* Sort bar */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 18, flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#9988AA", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Sort by
            </span>
            {SORT_OPTIONS.map(opt => {
              const isActive = sortKey === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => handleSort(opt.key)}
                  style={{
                    padding: "5px 14px", borderRadius: 20, cursor: "pointer",
                    fontSize: 12, fontWeight: 600,
                    background: isActive ? "#FD5A0F" : "#fff",
                    color: isActive ? "#fff" : "#553366",
                    border: isActive ? "1px solid transparent" : "1px solid #EAE4EF",
                    boxShadow: isActive ? "0 2px 8px rgba(253,90,15,0.25)" : "none",
                    transition: "all 0.15s",
                    display: "flex", alignItems: "center", gap: 4,
                  } as React.CSSProperties}
                >
                  {opt.label}
                  {isActive && (
                    <span style={{ fontSize: 9 }}>{sortDir === "asc" ? "▲" : "▼"}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Role cards grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginBottom: 32 }}>
            {sorted.map((a, i) => {
              const score    = a.overallScore ?? 0;
              const pot      = a.overallScore != null ? potential(score) : null;
              const potCfg   = pot ? POTENTIAL_CFG[pot] : null;
              const scoreCol = SCORE_COLOR(score);
              const hours    = a.hoursSaved ? parseFloat(a.hoursSaved) : null;

              return (
                <RoleCard
                  key={a.analysisId}
                  rank={i + 1}
                  title={a.jdTitle}
                  department={a.jdDepartment}
                  score={a.overallScore}
                  scoreColor={scoreCol}
                  hours={hours}
                  potCfg={potCfg}
                  href={`/report/${companyId}/${a.analysisId}?token=${token}`}
                  delay={i * 0.05}
                />
              );
            })}
          </div>

          {/* CEO value proposition */}
          <div style={{
            background: "linear-gradient(135deg, #220133 0%, #3D0060 50%, #220133 100%)",
            border: "1px solid #3D0060", borderRadius: 24, overflow: "hidden",
          }}>
            <div style={{ padding: "36px 40px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <p style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                    color: "#FDBB96", margin: "0 0 10px",
                  }}>
                    Your next competitive advantage
                  </p>
                  <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1.3, margin: "0 0 14px" }}>
                    While others are still screening résumés, your top candidates are being hired.
                  </h2>
                  <p style={{ fontSize: 14, color: "#C4B5D0", lineHeight: 1.7, margin: "0 0 20px" }}>
                    iMocha&apos;s AI-powered skills intelligence helps leading enterprises cut time-to-hire by{" "}
                    <strong style={{ color: "#FDBB96" }}>up to 40%</strong>, identify automation-ready talent
                    before competitors do, and build workforce strategies that compound in value year over year.
                  </p>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {[
                      { icon: "⚡", text: "Skills-first hiring"   },
                      { icon: "🎯", text: "Predictive talent fit" },
                      { icon: "📈", text: "AI-readiness scoring"  },
                    ].map(item => (
                      <span key={item.text} style={{
                        display: "flex", alignItems: "center", gap: 6,
                        fontSize: 12, fontWeight: 600, color: "#fff",
                        background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 8, padding: "6px 12px",
                      }}>
                        {item.icon} {item.text}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{
                  background: "rgba(253,90,15,0.12)", border: "1px solid rgba(253,90,15,0.3)",
                  borderRadius: 18, padding: "22px 24px", minWidth: 200, maxWidth: 260, flexShrink: 0,
                }}>
                  <p style={{ fontSize: 13, color: "#FDBB96", fontStyle: "italic", lineHeight: 1.65, margin: "0 0 16px" }}>
                    &ldquo;The automation opportunity in your workforce isn&apos;t a future threat — it&apos;s today&apos;s competitive edge. The question is who acts first.&rdquo;
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: "50%",
                      background: "linear-gradient(135deg, #FD5A0F, #FDBB96)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, fontWeight: 800, color: "#fff",
                    }}>i</div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", margin: 0 }}>iMocha Intelligence</p>
                      <p style={{ fontSize: 11, color: "#9988AA", margin: 0 }}>AI Workforce Insights</p>
                    </div>
                  </div>
                  <a
                    href="https://www.imocha.io/contact"
                    target="_blank" rel="noreferrer"
                    style={{
                      display: "block", textAlign: "center",
                      background: "#FD5A0F", color: "#fff",
                      fontWeight: 700, fontSize: 13, borderRadius: 10,
                      padding: "10px 0", textDecoration: "none",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#e54d0d")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#FD5A0F")}
                  >
                    Talk to us →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatChip({ label, value, color, bg, border }: {
  label: string; value: string; color: string; bg: string; border: string;
}) {
  return (
    <div style={{
      padding: "10px 18px", borderRadius: 16,
      background: bg, border: `1px solid ${border}`,
      display: "flex", flexDirection: "column", gap: 2,
    }}>
      <span style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 11, color: "#9988AA", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </span>
    </div>
  );
}

function RoleCard({ rank, title, department, score, scoreColor, hours, potCfg, href, delay }: {
  rank:       number;
  title:      string;
  department: string | null;
  score:      number | null;
  scoreColor: string;
  hours:      number | null;
  potCfg:     { label: string; text: string; bg: string; border: string } | null;
  href:       string;
  delay:      number;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#fff",
        border: `1px solid ${hovered ? "#EAE4EF" : "#EAE4EF"}`,
        borderRadius: 20,
        padding: "20px 22px",
        boxShadow: hovered
          ? "0 8px 32px rgba(34,1,51,0.10)"
          : "0 2px 12px rgba(34,1,51,0.06)",
        transform: hovered ? "translateY(-2px)" : "none",
        transition: "box-shadow 0.18s, transform 0.18s",
        animation: `fadeInUp 0.35s ease ${delay}s both`,
        display: "flex", flexDirection: "column", gap: 12,
      }}
    >
      {/* Top row: rank + score */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            width: 22, height: 22, borderRadius: "50%",
            background: "#F4EFF6", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700, color: "#9988AA", flexShrink: 0,
          }}>
            {rank}
          </span>
          {potCfg && (
            <span style={{
              padding: "3px 9px", borderRadius: 20,
              fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
              background: potCfg.bg, color: potCfg.text, border: `1px solid ${potCfg.border}`,
            }}>
              {potCfg.label}
            </span>
          )}
        </div>
        {score != null && (
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: scoreColor, lineHeight: 1, letterSpacing: "-1px" }}>
              {score}
            </span>
            <span style={{ fontSize: 12, color: "#9988AA" }}>/100</span>
          </div>
        )}
      </div>

      {/* Title + department */}
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: "#220133", margin: "0 0 4px", lineHeight: 1.3 }}>
          {title}
        </p>
        {department && (
          <p style={{ fontSize: 12, color: "#9988AA", margin: 0 }}>{department}</p>
        )}
      </div>

      {/* Progress bar */}
      {score != null && (
        <div style={{ height: 4, borderRadius: 2, background: "#F4EFF6", overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${score}%`,
            background: scoreColor, borderRadius: 2,
            transition: "width 0.6s ease",
          }} />
        </div>
      )}

      {/* Bottom row: hours + CTA */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        {hours != null ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#059669" }}>{hours}h</span>
            <span style={{ fontSize: 11, color: "#9988AA" }}>saved/wk</span>
          </div>
        ) : (
          <div />
        )}
        <Link
          href={href}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "7px 16px", borderRadius: 10,
            fontSize: 12, fontWeight: 700,
            background: hovered ? "#FD5A0F" : "#FFF0EA",
            color: hovered ? "#fff" : "#FD5A0F",
            border: "1px solid #FDBB96",
            textDecoration: "none",
            transition: "background 0.15s, color 0.15s",
            flexShrink: 0,
          }}
        >
          View report
          <svg width="10" height="10" fill="none" viewBox="0 0 16 16">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      </div>
    </div>
  );
}
