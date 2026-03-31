"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import ScoreRing from "@/components/ScoreRing";

const TasksChart    = dynamic(() => import("@/components/TasksChart"),    { ssr: false });
const CategoryRadar = dynamic(() => import("@/components/CategoryRadar"), { ssr: false });

interface Task {
  name: string;
  automationScore: number;
  automationPotential: "high" | "medium" | "low";
  category: string;
  aiOpportunity: string;
  scoringRationale?: string;
}

interface Opportunity {
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  effort: "high" | "medium" | "low";
  tools: string[];
  estimatedTimeSaving: string;
}

interface RoadmapPhase {
  phase: string;
  timeline: string;
  items: string[];
}

export interface Analysis {
  jobTitle: string;
  department: string;
  executiveSummary: string;
  overallAutomationScore: number;
  aiReadinessScore: number;
  estimatedHoursSavedPerWeek: number;
  tasks: Task[];
  aiOpportunities: Opportunity[];
  skillsAnalysis: { futureProof: string[]; atRisk: string[]; aiAugmented: string[] };
  automationByCategory: { category: string; score: number }[];
  implementationRoadmap: RoadmapPhase[];
  roiHighlights: { focusShift: string; productivity_multiplier: string; formula?: string };
}

// ── Design helpers ────────────────────────────────────────────────────────────

const IMPACT_CFG: Record<string, { text: string; bg: string; border: string }> = {
  high:   { text: "#ef4444", bg: "rgba(239,68,68,0.10)",    border: "rgba(239,68,68,0.25)"    },
  medium: { text: "#d97706", bg: "rgba(245,158,11,0.10)",   border: "rgba(245,158,11,0.25)"   },
  low:    { text: "#059669", bg: "rgba(16,185,129,0.10)",   border: "rgba(16,185,129,0.25)"   },
};

const EFFORT_LABEL: Record<string, string> = {
  high: "High Effort", medium: "Med Effort", low: "Low Effort",
};

const taskColor = (score: number) =>
  score >= 70 ? "#ef4444" : score >= 40 ? "#f59e0b" : "#10b981";

function IMochaIcon({ size = 28, color = "#FD5A0F" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 51 51" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M50.085 20.368C49.736 18.111 48.861 15.855 47.812 13.772C46.762 14.466 45.538 14.813 44.139 14.813C40.29 14.813 37.142 11.689 37.142 7.871C37.142 6.308 37.667 4.92 38.541 3.705C35.743 1.969 32.769 0.754 29.446 0.06C28.046 -0.287 26.822 0.928 26.822 2.316V8.218C26.822 9.259 27.522 10.3 28.571 10.474C33.819 11.863 38.017 15.855 39.416 21.062C39.766 22.103 40.64 22.798 41.69 22.798H47.637C49.211 23.145 50.435 21.756 50.085 20.368Z" fill={color}/>
      <path d="M10.73 21.409C12.129 16.202 16.327 12.036 21.575 10.821C22.624 10.474 23.324 9.606 23.324 8.565V2.49C23.324 1.101 21.925 -0.114 20.7 0.234C10.205 2.143 1.984 10.127 0.06 20.368C-0.289 21.756 0.935 23.145 2.334 23.145H8.456C9.506 23.145 10.555 22.277 10.73 21.409Z" fill={color}/>
      <path d="M21.575 39.46C16.327 38.072 12.129 34.08 10.73 28.873C10.38 27.831 9.506 27.137 8.456 27.137H2.334C0.935 27.137 -0.289 28.525 0.06 29.914C1.984 40.154 10.205 48.139 20.525 50.048C21.925 50.395 23.149 49.18 23.149 47.792V41.89C23.324 40.502 22.624 39.634 21.575 39.46Z" fill={color}/>
      <path d="M39.591 28.699C38.192 33.906 33.994 37.898 28.746 39.287C27.697 39.634 26.997 40.502 26.997 41.543V47.444C26.997 48.833 28.396 50.048 29.621 49.701C39.941 47.792 48.162 39.807 50.086 29.567C50.436 28.178 49.211 26.79 47.812 26.79H41.69C40.64 26.963 39.766 27.658 39.591 28.699Z" fill={color}/>
      <path d="M44.314 1.101C42.04 1.101 40.116 2.143 38.891 3.705C42.739 6.135 45.888 9.606 47.987 13.772C49.911 12.557 51.31 10.301 51.31 7.871C51.31 4.226 48.162 1.101 44.314 1.101Z" fill={color}/>
    </svg>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────

function Badge({ label, cfg }: { label: string; cfg: { text: string; bg: string; border: string } }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "3px 10px", borderRadius: 20,
      fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
      background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}`,
    }}>
      {label}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DashboardView({
  analysis,
  company,
  backHref,
  showNewAnalysis = false,
}: {
  analysis: Analysis;
  company: string;
  backHref: string;
  showNewAnalysis?: boolean;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab]   = useState<"overview" | "tasks" | "opportunities">("overview");
  const [hoveredKpi, setHoveredKpi] = useState<number | null>(null);
  const [printMode, setPrintMode]   = useState(false);

  const handleDownloadPDF = () => {
    const prevTitle = document.title;
    document.title = `${analysis.jobTitle} – ${company} | AI Automation Report by iMocha`;
    setPrintMode(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setPrintMode(false);
        document.title = prevTitle;
      }, 500);
    }, 300);
  };

  const tasksHigh   = analysis.tasks.filter(t => t.automationPotential === "high").length;
  const tasksMedium = analysis.tasks.filter(t => t.automationPotential === "medium").length;
  const tasksLow    = analysis.tasks.length - tasksHigh - tasksMedium;

  const scores   = analysis.tasks.map(t => t.automationScore);
  const scoreMin = Math.min(...scores);
  const scoreMax = Math.max(...scores);

  const kpis = [
    {
      label: "Automation Score", value: analysis.overallAutomationScore + "%",
      sub: "of tasks automatable", color: "#ef4444", bg: "#fef2f2",
      borderColor: "rgba(239,68,68,0.2)", glowColor: "rgba(239,68,68,0.08)", icon: "⚡",
      what: "How much of this role's day-to-day work AI can handle today — across every task in the job description.",
      how: `Simple average of all ${analysis.tasks.length} task scores (range: ${scoreMin}–${scoreMax}) → ${analysis.overallAutomationScore}%`,
    },
    {
      label: "Hours Saved/Week", value: analysis.estimatedHoursSavedPerWeek + "h",
      sub: "time reclaimed weekly", color: "#059669", bg: "#ecfdf5",
      borderColor: "rgba(16,185,129,0.2)", glowColor: "rgba(16,185,129,0.08)", icon: "⏱",
      what: "Hours per week freed up by AI — time this person can redirect to higher-value, strategic work.",
      how: `Per task: 40h × time share × automation score × 65% efficiency factor. All tasks summed, then capped at 12h/week → ${analysis.estimatedHoursSavedPerWeek}h`,
    },
    {
      label: "High-Impact Tasks", value: `${tasksHigh}/${analysis.tasks.length}`,
      sub: `${tasksHigh} highly automatable`, color: "#220133", bg: "#F4EFF6",
      borderColor: "rgba(34,1,51,0.15)", glowColor: "rgba(34,1,51,0.05)", icon: "🎯",
      what: "Tasks where AI can take over 70%+ of the work — your best starting points for automation.",
      how: `${tasksHigh} of ${analysis.tasks.length} tasks scored ≥70, which is the threshold for "High" automation potential`,
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#F4EFF6" }}>

      {/* ── Print-only branded header ── */}
      <div className="print-only" style={{
        display: "none",
        padding: "18mm 14mm 10mm",
        background: "#fff",
        borderBottom: "3px solid #FD5A0F",
        marginBottom: 24,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Logo + wordmark */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <IMochaIcon size={32} color="#FD5A0F" />
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#220133", letterSpacing: "-0.3px" }}>iMocha</div>
            </div>
          </div>
          {/* Report meta */}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#9988AA" }}>{new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
            <div style={{ fontSize: 11, color: "#553366", fontWeight: 600, marginTop: 2 }}>{company}</div>
          </div>
        </div>
        {/* Role title */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#220133", letterSpacing: "-0.3px" }}>{analysis.jobTitle}</div>
          {analysis.department && (
            <div style={{ fontSize: 12, color: "#9988AA", marginTop: 3 }}>{analysis.department}</div>
          )}
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="no-print" style={{
        position: "sticky", top: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 28px", height: 56,
        background: "rgba(255,255,255,0.96)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid #EAE4EF",
        boxShadow: "0 1px 12px rgba(34,1,51,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={() => router.push(backHref)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              fontSize: 13, color: "#9988AA", fontWeight: 500,
              background: "none", border: "none", cursor: "pointer", padding: 0,
              transition: "color 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "#220133")}
            onMouseLeave={e => (e.currentTarget.style.color = "#9988AA")}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 16 16">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
          </button>
          <span style={{ color: "#EAE4EF" }}>|</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IMochaIcon size={22} color="#FD5A0F" />
            <span style={{ fontSize: 13, fontWeight: 800, color: "#220133" }}>iMocha</span>
            <span style={{ color: "#EAE4EF" }}>|</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#553366" }}>AI Automation Index</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {company && (
            <span style={{
              fontSize: 12, padding: "4px 12px", borderRadius: 20,
              color: "#553366", background: "#F4EFF6", border: "1px solid #EAE4EF",
              fontWeight: 500,
            }}>
              {company}
            </span>
          )}
          <button
            onClick={handleDownloadPDF}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 12, padding: "6px 14px", borderRadius: 10,
              fontWeight: 600, color: "#553366", background: "#fff",
              border: "1px solid #EAE4EF", cursor: "pointer",
              transition: "background 0.15s, border-color 0.15s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "#F4EFF6";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#D0C8D8";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "#fff";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#EAE4EF";
            }}
          >
            <svg width="13" height="13" fill="none" viewBox="0 0 16 16">
              <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Download PDF
          </button>
          {showNewAnalysis && (
            <button
              onClick={() => router.push("/")}
              style={{
                fontSize: 12, padding: "6px 14px", borderRadius: 10,
                fontWeight: 700, color: "#FD5A0F", background: "#FFF0EA",
                border: "1px solid #FDBB96", cursor: "pointer",
                transition: "background 0.15s, color 0.15s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "#FD5A0F";
                (e.currentTarget as HTMLButtonElement).style.color = "#fff";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "#FFF0EA";
                (e.currentTarget as HTMLButtonElement).style.color = "#FD5A0F";
              }}
            >
              New Analysis
            </button>
          )}
        </div>
      </nav>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 28px 60px" }}>

        {/* ── Hero / Page header ── */}
        <div style={{
          background: "linear-gradient(135deg, #1A0028 0%, #2D0050 100%)",
          borderRadius: 24, padding: "32px 36px", marginBottom: 28,
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 8px 40px rgba(34,1,51,0.18)",
          position: "relative", overflow: "hidden",
          animation: "fadeInUp 0.4s ease both",
        }}>
          {/* Decorative circles */}
          <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(253,90,15,0.06)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -60, right: 60, width: 150, height: 150, borderRadius: "50%", background: "rgba(139,92,246,0.05)", pointerEvents: "none" }} />

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                  padding: "3px 10px", borderRadius: 20,
                  background: "rgba(253,90,15,0.2)", color: "#FDBB96",
                  border: "1px solid rgba(253,90,15,0.3)",
                }}>
                  {analysis.department}
                </span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>·</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>AI Automation Analysis</span>
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", margin: "0 0 6px", letterSpacing: "-0.5px", lineHeight: 1.2 }}>
                {analysis.jobTitle}
              </h1>
              {company && (
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: "0 0 16px" }}>{company}</p>
              )}
              <div style={{
                padding: "14px 18px", borderRadius: 14,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
              }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(253,90,15,0.8)", margin: "0 0 8px" }}>
                  Impact Summary
                </p>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", margin: 0, lineHeight: 1.65 }}>
                  {analysis.executiveSummary}
                </p>
              </div>
            </div>
            <div style={{
              flexShrink: 0,
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 10,
              background: "rgba(253,90,15,0.15)", border: "1px solid rgba(253,90,15,0.25)",
            }}>
              <IMochaIcon size={14} color="#FD5A0F" />
              <span style={{ fontSize: 11, fontWeight: 600, color: "#FDBB96" }}>iMocha</span>
            </div>
          </div>
        </div>

        {/* ── KPI cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
          {kpis.map((k, i) => (
            <div key={i} style={{ position: "relative" }}
              onMouseEnter={() => setHoveredKpi(i)}
              onMouseLeave={() => setHoveredKpi(null)}
            >
              <div style={{
                background: "#fff",
                border: `1px solid ${hoveredKpi === i ? k.borderColor : "#EAE4EF"}`,
                borderRadius: 20, padding: "24px 24px 20px",
                boxShadow: hoveredKpi === i
                  ? `0 8px 32px ${k.glowColor}, 0 2px 12px rgba(34,1,51,0.08)`
                  : "0 2px 12px rgba(34,1,51,0.06)",
                transition: "border-color 0.18s, box-shadow 0.18s, transform 0.18s",
                transform: hoveredKpi === i ? "translateY(-3px)" : "none",
                cursor: "default",
                animation: `fadeInUp 0.4s ease ${i * 0.08}s both`,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: k.bg, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18,
                    border: `1px solid ${k.borderColor}`,
                  }}>
                    {k.icon}
                  </div>
                  <span style={{ fontSize: 36, fontWeight: 800, color: k.color, lineHeight: 1, letterSpacing: "-1px" }}>
                    {k.value}
                  </span>
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#220133", margin: "0 0 3px" }}>{k.label}</p>
                <p style={{ fontSize: 12, color: "#9988AA", margin: 0 }}>{k.sub}</p>
              </div>

              {/* Tooltip */}
              {hoveredKpi === i && (
                <div style={{
                  position: "absolute", zIndex: 50,
                  width: 280, borderRadius: 16, padding: "16px 18px",
                  top: "calc(100% + 12px)",
                  ...(i >= 2 ? { right: 0 } : { left: 0 }),
                  background: "#fff",
                  border: `1px solid ${k.borderColor}`,
                  boxShadow: `0 16px 48px rgba(34,1,51,0.16), 0 0 0 1px ${k.glowColor}`,
                  animation: "fadeInUp 0.18s ease both",
                }}>
                  <div style={{
                    position: "absolute", top: -7,
                    ...(i >= 2 ? { right: "1.5rem" } : { left: "1.5rem" }),
                    width: 12, height: 12, transform: "rotate(45deg)",
                    background: "#fff",
                    borderLeft: `1px solid ${k.borderColor}`,
                    borderTop: `1px solid ${k.borderColor}`,
                  }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 16 }}>{k.icon}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: k.color }}>
                      {k.label}
                    </span>
                    <span style={{ marginLeft: "auto", fontSize: 20, fontWeight: 800, color: k.color }}>{k.value}</span>
                  </div>
                  <p style={{ fontSize: 13, color: "#220133", margin: "0 0 8px", lineHeight: 1.55 }}>{k.what}</p>
                  <p style={{ fontSize: 11, color: "#9988AA", margin: 0, fontFamily: "monospace", lineHeight: 1.5 }}>{k.how}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Tab bar ── */}
        <div className="no-print" style={{
          display: "inline-flex", gap: 4, padding: 5,
          background: "#fff", borderRadius: 14, border: "1px solid #EAE4EF",
          marginBottom: 24,
          boxShadow: "0 2px 8px rgba(34,1,51,0.05)",
        }}>
          {(["overview", "tasks", "opportunities"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "8px 20px", borderRadius: 10, border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 600, textTransform: "capitalize",
                transition: "background 0.15s, color 0.15s, box-shadow 0.15s",
                background: activeTab === tab ? "#FD5A0F" : "transparent",
                color: activeTab === tab ? "#fff" : "#553366",
                boxShadow: activeTab === tab ? "0 2px 10px rgba(253,90,15,0.3)" : "none",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW tab ── */}
        {(activeTab === "overview" || printMode) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeIn 0.25s ease" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>

              {/* Score ring card */}
              <div style={{
                background: "#fff", border: "1px solid #EAE4EF", borderRadius: 20,
                padding: "24px", boxShadow: "0 2px 12px rgba(34,1,51,0.06)",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
                breakInside: "avoid", pageBreakInside: "avoid",
              }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9988AA", margin: 0, alignSelf: "flex-start" }}>
                  Score Breakdown
                </p>
                <ScoreRing score={analysis.overallAutomationScore} color="auto" label="Automation" sublabel="Tasks automatable" />
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8,
                  width: "100%", paddingTop: 16, borderTop: "1px solid #EAE4EF",
                  textAlign: "center",
                }}>
                  {[
                    { count: tasksHigh,   label: "High",   color: "#ef4444" },
                    { count: tasksMedium, label: "Medium", color: "#f59e0b" },
                    { count: tasksLow,    label: "Low",    color: "#10b981" },
                  ].map(item => (
                    <div key={item.label}>
                      <p style={{ fontSize: 22, fontWeight: 800, color: item.color, margin: "0 0 2px" }}>{item.count}</p>
                      <p style={{ fontSize: 11, color: "#9988AA", margin: 0 }}>{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Category radar */}
              <div style={{
                background: "#fff", border: "1px solid #EAE4EF", borderRadius: 20,
                padding: "24px", boxShadow: "0 2px 12px rgba(34,1,51,0.06)",
                breakInside: "avoid", pageBreakInside: "avoid",
              }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9988AA", margin: "0 0 16px" }}>
                  Automation by Category
                </p>
                <CategoryRadar data={analysis.automationByCategory} />
              </div>
            </div>

            {/* Skills analysis */}
            <div style={{
              background: "#fff", border: "1px solid #EAE4EF", borderRadius: 20,
              padding: "24px 28px", boxShadow: "0 2px 12px rgba(34,1,51,0.06)",
              breakInside: "avoid", pageBreakInside: "avoid",
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9988AA", margin: "0 0 20px" }}>
                Skills Analysis
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                {[
                  { title: "Future-Proof", items: analysis.skillsAnalysis.futureProof, color: "#059669", bg: "#ecfdf5", border: "#a7f3d0", icon: "✓" },
                  { title: "At Risk",       items: analysis.skillsAnalysis.atRisk,       color: "#dc2626", bg: "#fef2f2", border: "#fecaca", icon: "!" },
                  { title: "AI-Augmented",  items: analysis.skillsAnalysis.aiAugmented,  color: "#FD5A0F", bg: "#FFF0EA", border: "#FDBB96", icon: "↑" },
                ].map(col => (
                  <div key={col.title} style={{
                    borderRadius: 16, padding: "16px 18px",
                    background: col.bg, border: `1px solid ${col.border}`,
                  }}>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: col.color, margin: "0 0 12px" }}>
                      {col.title} Skills
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {col.items.map((s, i) => (
                        <span key={i} style={{
                          fontSize: 11, padding: "4px 10px", borderRadius: 8, fontWeight: 500,
                          background: col.bg, color: col.color, border: `1px solid ${col.border}`,
                        }}>
                          {col.icon} {s}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TASKS tab ── */}
        {(activeTab === "tasks" || printMode) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeIn 0.25s ease", breakBefore: printMode ? "page" : "auto", pageBreakBefore: printMode ? "always" : "auto" }}>
            {printMode && (
              <p className="print-only" style={{ fontSize: 15, fontWeight: 800, color: "#220133", margin: "0 0 4px" }}>
                Task Automation Breakdown
              </p>
            )}

            {/* Chart card */}
            <div style={{
              background: "#fff", border: "1px solid #EAE4EF", borderRadius: 20,
              padding: "24px 28px", boxShadow: "0 2px 12px rgba(34,1,51,0.06)",
              breakInside: "avoid", pageBreakInside: "avoid",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9988AA", margin: "0 0 4px" }}>
                    Task Automation Potential
                  </p>
                  <p style={{ fontSize: 11, color: "#C4B5D0", margin: 0 }}>Sorted by automation score · hover bars for AI opportunity</p>
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#553366" }}>
                  {[
                    { label: "High",   color: "#f87171" },
                    { label: "Medium", color: "#fbbf24" },
                    { label: "Low",    color: "#34d399" },
                  ].map(item => (
                    <span key={item.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: item.color, display: "inline-block" }} />
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>
              <TasksChart tasks={analysis.tasks} />
            </div>

            {/* Task cards grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {[...analysis.tasks].sort((a, b) => b.automationScore - a.automationScore).map((task, i) => {
                const color = taskColor(task.automationScore);
                const impactCfg = IMPACT_CFG[task.automationPotential] ?? IMPACT_CFG.low;
                return (
                  <div key={i} style={{
                    background: "#fff", border: "1px solid #EAE4EF", borderRadius: 16,
                    padding: "18px 18px 16px",
                    boxShadow: "0 2px 8px rgba(34,1,51,0.05)",
                    transition: "transform 0.15s, box-shadow 0.15s, border-color 0.15s",
                    animation: `fadeInUp 0.35s ease ${i * 0.04}s both`,
                    cursor: "default",
                    breakInside: "avoid", pageBreakInside: "avoid",
                  }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                      (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 24px rgba(34,1,51,0.1)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLDivElement).style.transform = "";
                      (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 8px rgba(34,1,51,0.05)";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <Badge label={task.automationPotential} cfg={impactCfg} />
                      <span style={{ fontSize: 28, fontWeight: 800, color, letterSpacing: "-0.5px", lineHeight: 1 }}>
                        {task.automationScore}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#220133", margin: "0 0 3px" }}>{task.name}</p>
                    <p style={{ fontSize: 11, color: "#9988AA", margin: "0 0 10px" }}>{task.category}</p>
                    <div style={{
                      height: 4, borderRadius: 2, background: "#F4EFF6", overflow: "hidden", marginBottom: 10,
                    }}>
                      <div style={{
                        height: "100%", width: `${task.automationScore}%`,
                        background: color, borderRadius: 2,
                      }} />
                    </div>
                    <p style={{ fontSize: 11, color: "#FD5A0F", margin: "0 0 4px", fontWeight: 500 }}>{task.aiOpportunity}</p>
                    {task.scoringRationale && (
                      <p style={{ fontSize: 11, color: "#9988AA", margin: 0, lineHeight: 1.5 }}>
                        {task.scoringRationale.split(". ")[0]}.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── OPPORTUNITIES tab ── */}
        {(activeTab === "opportunities" || printMode) && (
          <div style={{ animation: "fadeIn 0.25s ease", breakBefore: printMode ? "page" : "auto", pageBreakBefore: printMode ? "always" : "auto" }}>
            {printMode && (
              <p className="print-only" style={{ fontSize: 15, fontWeight: 800, color: "#220133", margin: "0 0 16px" }}>
                AI Opportunities
              </p>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
              {analysis.aiOpportunities.map((opp, i) => {
                const impactCfg  = IMPACT_CFG[opp.impact]  ?? IMPACT_CFG.low;
                return (
                  <div key={i} style={{
                    background: "#fff", border: "1px solid #EAE4EF", borderRadius: 20,
                    padding: "22px 24px",
                    boxShadow: "0 2px 12px rgba(34,1,51,0.06)",
                    transition: "transform 0.15s, box-shadow 0.15s",
                    animation: `fadeInUp 0.35s ease ${i * 0.06}s both`,
                    cursor: "default",
                    breakInside: "avoid", pageBreakInside: "avoid",
                  }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                      (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 32px rgba(34,1,51,0.1)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLDivElement).style.transform = "";
                      (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 12px rgba(34,1,51,0.06)";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Badge label={`${opp.impact} impact`} cfg={impactCfg} />
                        <span style={{
                          display: "inline-flex", alignItems: "center",
                          padding: "3px 10px", borderRadius: 20,
                          fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
                          background: "#F4EFF6", color: "#553366", border: "1px solid #EAE4EF",
                        }}>
                          {EFFORT_LABEL[opp.effort]}
                        </span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#059669", whiteSpace: "nowrap", marginLeft: 8 }}>
                        {opp.estimatedTimeSaving}
                      </span>
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: "#220133", margin: "0 0 8px" }}>{opp.title}</h3>
                    <p style={{ fontSize: 13, color: "#553366", margin: "0 0 16px", lineHeight: 1.6 }}>{opp.description}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {opp.tools.map((tool, j) => (
                        <span key={j} style={{
                          fontSize: 11, padding: "4px 10px", borderRadius: 8, fontWeight: 600,
                          background: "#FFF0EA", border: "1px solid #FDBB96", color: "#FD5A0F",
                        }}>
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </main>

      {/* ── Print-only branded footer ── */}
      <div className="print-only" style={{
        display: "none",
        borderTop: "1px solid #EAE4EF",
        padding: "8mm 14mm",
        marginTop: 32,
        background: "#fff",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IMochaIcon size={16} color="#FD5A0F" />
            <span style={{ fontSize: 10, fontWeight: 700, color: "#220133" }}>iMocha</span>
          </div>
          <span style={{ fontSize: 10, color: "#9988AA", fontStyle: "italic" }}>Powered by iMocha · Know Your Workforce, Shape the Future</span>
        </div>
      </div>

      <footer className="no-print" style={{ textAlign: "center", padding: "24px 0 32px", fontSize: 11, color: "#C4B5D0" }}>
        iMocha AI Automation Index &nbsp;·&nbsp; Powered by iMocha &nbsp;·&nbsp; Results are indicative
      </footer>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @media print {
          @page { margin: 0; size: A4; }
          body  { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
        }
      `}</style>
    </div>
  );
}
