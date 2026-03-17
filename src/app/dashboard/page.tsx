"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import ScoreRing from "@/components/ScoreRing";

const TasksChart = dynamic(() => import("@/components/TasksChart"), { ssr: false });
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

interface Analysis {
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
  roiHighlights: { hoursReclaimed: number; focusShift: string; productivity_multiplier: string; formula?: string };
}

const impactBadge: Record<string, string> = {
  high: "badge-high", medium: "badge-medium", low: "badge-low",
};
const effortLabel: Record<string, string> = {
  high: "High Effort", medium: "Med Effort", low: "Low Effort",
};

const taskColor = (score: number) =>
  score >= 70 ? "#ef4444" : score >= 40 ? "#f59e0b" : "#10b981";

// iMocha orbit icon (exact brand paths)
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

export default function Dashboard() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [company, setCompany] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "tasks" | "opportunities">("overview");
  const [hoveredKpi, setHoveredKpi] = useState<number | null>(null);
  const [printMode, setPrintMode] = useState(false);

  const handleDownloadPDF = () => {
    setPrintMode(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintMode(false), 500);
    }, 300);
  };

  useEffect(() => {
    const raw = sessionStorage.getItem("analysisResult");
    const co = sessionStorage.getItem("company");
    if (!raw) { router.push("/"); return; }
    try { setAnalysis(JSON.parse(raw)); setCompany(co || ""); }
    catch { router.push("/"); }
  }, [router]);

  if (!analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F9F7FB" }}>
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin w-7 h-7" style={{ color: "#FD5A0F" }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <p className="text-sm" style={{ color: "#9988AA" }}>Loading analysis…</p>
        </div>
      </div>
    );
  }

  const tasksHigh   = analysis.tasks.filter(t => t.automationPotential === "high").length;
  const tasksMedium = analysis.tasks.filter(t => t.automationPotential === "medium").length;
  const tasksLow    = analysis.tasks.length - tasksHigh - tasksMedium;

  // Tooltip calculation helpers
  const scores = analysis.tasks.map(t => t.automationScore);
  const scoreMin = Math.min(...scores);
  const scoreMax = Math.max(...scores);

  const kpis = [
    {
      label: "Automation Score", value: analysis.overallAutomationScore + "%",
      sub: "of tasks automatable", color: "#ef4444", bg: "#fef2f2", icon: "⚡",
      what: "How much of this role's day-to-day work AI can handle today — across every task in the job description.",
      how: `Simple average of all ${analysis.tasks.length} task scores (range: ${scoreMin}–${scoreMax}) → ${analysis.overallAutomationScore}%`,
    },
    {
      label: "Hours Saved/Week", value: analysis.estimatedHoursSavedPerWeek + "h",
      sub: "time reclaimed weekly", color: "#059669", bg: "#ecfdf5", icon: "⏱",
      what: "Hours per week freed up by AI — time this person can redirect to higher-value, strategic work.",
      how: `Per task: 40h × time share × automation score × 65% efficiency factor. All tasks summed, then capped at 12h/week → ${analysis.estimatedHoursSavedPerWeek}h`,
    },
    {
      label: "High-Impact Tasks", value: `${tasksHigh}/${analysis.tasks.length}`,
      sub: `${tasksHigh} highly automatable`, color: "#220133", bg: "#F4EFF6", icon: "🎯",
      what: "Tasks where AI can take over 70%+ of the work — your best starting points for automation.",
      how: `${tasksHigh} of ${analysis.tasks.length} tasks scored ≥70, which is the threshold for "High" automation potential`,
    },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#F9F7FB" }}>

      {/* Nav */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-3.5 no-print"
        style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(16px)", borderBottom: "1px solid #EAE4EF" }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/")} className="flex items-center gap-1.5 transition-colors text-sm" style={{ color: "#9988AA" }}
            onMouseEnter={e => e.currentTarget.style.color = "#220133"} onMouseLeave={e => e.currentTarget.style.color = "#9988AA"}>
            <svg width="15" height="15" fill="none" viewBox="0 0 16 16">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
          </button>
          <span style={{ color: "#D0C8D8" }}>|</span>
          <div className="flex items-center gap-2">
            <IMochaIcon size={24} color="#FD5A0F" />
            <span className="font-bold text-sm" style={{ color: "#220133" }}>iMocha</span>
            <span style={{ color: "#D0C8D8", fontSize: "16px" }}>|</span>
            <span className="font-medium text-sm" style={{ color: "#553366" }}>AI Automation Index</span>
          </div>
        </div>
        <div className="flex items-center gap-3 no-print">
          {company && (
            <span className="text-xs px-3 py-1 rounded-full" style={{ color: "#553366", background: "#F4EFF6", border: "1px solid #EAE4EF" }}>{company}</span>
          )}
          <button onClick={handleDownloadPDF}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5"
            style={{ border: "1px solid #EAE4EF", color: "#553366", background: "#fff" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#F4EFF6"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}>
            <svg width="13" height="13" fill="none" viewBox="0 0 16 16">
              <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Download PDF
          </button>
          <button onClick={() => router.push("/")}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
            style={{ border: "1px solid #FDBB96", color: "#FD5A0F", background: "#FFF0EA" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#FD5A0F"; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#FFF0EA"; (e.currentTarget as HTMLButtonElement).style.color = "#FD5A0F"; }}>
            New Analysis
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* Page header */}
        <div className="mb-8 animate-fade-in-up">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="badge badge-medium">{analysis.department}</span>
                <span style={{ color: "#D0C8D8" }} className="text-xs">·</span>
                <span className="text-xs" style={{ color: "#9988AA" }}>AI Automation Analysis</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#220133" }}>{analysis.jobTitle}</h1>
              {company && <p className="text-sm mt-1" style={{ color: "#9988AA" }}>{company}</p>}
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: "#FFF0EA", border: "1px solid #FDBB96" }}>
              <IMochaIcon size={13} color="#FD5A0F" />
              <span className="text-xs font-medium" style={{ color: "#FD5A0F" }}>Claude Sonnet 4.6</span>
            </div>
          </div>
          {/* Summary */}
          <div className="mt-4 p-4 rounded-xl" style={{ background: "#FAFAFA", border: "1px solid #EAE4EF" }}>
            <p className="text-sm leading-relaxed" style={{ color: "#553366" }}>{analysis.executiveSummary}</p>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {kpis.map((k, i) => (
            <div key={i} className="relative"
              onMouseEnter={() => setHoveredKpi(i)}
              onMouseLeave={() => setHoveredKpi(null)}>
              <div className={`card card-hover p-5 animate-fade-in-up delay-${i + 1} cursor-default transition-all duration-200`}
                style={hoveredKpi === i ? { borderColor: k.color, boxShadow: `0 6px 24px ${k.color}22` } : {}}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xl">{k.icon}</span>
                  <span className="text-2xl font-extrabold score-number" style={{ color: k.color }}>{k.value}</span>
                </div>
                <p className="text-sm font-semibold mb-0.5" style={{ color: "#220133" }}>{k.label}</p>
                <p className="text-xs" style={{ color: "#9988AA" }}>{k.sub}</p>
                {/* Subtle hover hint */}
                <p className="text-xs mt-2 opacity-0 transition-opacity duration-200"
                  style={{ color: k.color, opacity: hoveredKpi === i ? 0.7 : 0 }}>
                  Hover to learn more ↑
                </p>
              </div>

              {/* Tooltip */}
              {hoveredKpi === i && (
                <div className="absolute z-50 w-72 rounded-2xl p-4 animate-fade-in"
                  style={{
                    top: "calc(100% + 10px)",
                    ...(i >= 2 ? { right: 0 } : { left: 0 }),
                    background: "#fff",
                    border: `1px solid ${k.color}33`,
                    boxShadow: `0 12px 40px rgba(34,1,51,0.14), 0 0 0 1px ${k.color}22`,
                  }}>
                  {/* Arrow */}
                  <div className="absolute -top-[7px] w-3 h-3 rotate-45"
                    style={{
                      ...(i >= 2 ? { right: "1.5rem" } : { left: "1.5rem" }),
                      background: "#fff",
                      borderLeft: `1px solid ${k.color}33`,
                      borderTop: `1px solid ${k.color}33`,
                    }} />

                  {/* Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base">{k.icon}</span>
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: k.color }}>{k.label}</span>
                    <span className="ml-auto text-lg font-extrabold score-number" style={{ color: k.color }}>{k.value}</span>
                  </div>

                  {/* What it means */}
                  <p className="text-sm leading-relaxed" style={{ color: "#220133" }}>{k.what}</p>
                  {/* How it was calculated */}
                  <p className="text-xs mt-2 font-mono leading-relaxed" style={{ color: "#9988AA" }}>{k.how}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit bg-white border no-print" style={{ borderColor: "#EAE4EF" }}>
          {(["overview", "tasks", "opportunities"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize"
              style={activeTab === tab
                ? { background: "#FD5A0F", color: "#fff", boxShadow: "0 2px 8px rgba(253,90,15,0.3)" }
                : { color: "#553366" }
              }
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {(activeTab === "overview" || printMode) && (
          <div className="space-y-5 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

              {/* Score rings */}
              <div className="card p-6 flex flex-col items-center gap-5">
                <p className="text-xs font-semibold uppercase tracking-widest self-start" style={{ color: "#9988AA" }}>Score Breakdown</p>
                <div className="flex justify-center">
                  <ScoreRing score={analysis.overallAutomationScore} color="auto" label="Automation" sublabel="Tasks automatable" />
                </div>
                <div className="w-full grid grid-cols-3 gap-2 pt-2 border-t text-center text-xs" style={{ borderColor: "#EAE4EF" }}>
                  <div><p className="text-lg font-bold text-red-500">{tasksHigh}</p><p style={{ color: "#9988AA" }}>High</p></div>
                  <div><p className="text-lg font-bold text-amber-500">{tasksMedium}</p><p style={{ color: "#9988AA" }}>Medium</p></div>
                  <div><p className="text-lg font-bold text-emerald-500">{tasksLow}</p><p style={{ color: "#9988AA" }}>Low</p></div>
                </div>
              </div>

              {/* Radar */}
              <div className="card p-6 md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#9988AA" }}>Automation by Category</p>
                <CategoryRadar data={analysis.automationByCategory} />
              </div>
            </div>

            {/* ROI */}
            <div className="card p-6">
              <p className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: "#9988AA" }}>ROI Highlights</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 divide-x" style={{ borderColor: "#EAE4EF" }}>
                <div className="flex flex-col gap-1">
                  <span className="text-3xl font-extrabold text-emerald-600">{analysis.roiHighlights.hoursReclaimed}h</span>
                  <span className="text-sm font-semibold" style={{ color: "#220133" }}>Weekly Hours Reclaimed</span>
                  <span className="text-xs" style={{ color: "#9988AA" }}>Through AI automation</span>
                </div>
                <div className="flex flex-col gap-1 sm:pl-6">
                  <span className="text-3xl font-extrabold" style={{ color: "#FD5A0F" }}>{analysis.roiHighlights.productivity_multiplier}</span>
                  <span className="text-sm font-semibold" style={{ color: "#220133" }}>Productivity Multiplier</span>
                  <span className="text-xs" style={{ color: "#9988AA" }}>On AI-augmented tasks</span>
                </div>
                <div className="flex flex-col gap-1 sm:pl-6">
                  <span className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#FD5A0F" }}>Focus Shift →</span>
                  <span className="text-sm leading-relaxed" style={{ color: "#553366" }}>{analysis.roiHighlights.focusShift}</span>
                </div>
              </div>
            </div>

            {/* Skills */}
            <div className="card p-6">
              <p className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: "#9988AA" }}>Skills Analysis</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {[
                  { title: "Future-Proof", items: analysis.skillsAnalysis.futureProof, color: "#059669", bg: "#ecfdf5", border: "#a7f3d0", icon: "✓" },
                  { title: "At Risk",      items: analysis.skillsAnalysis.atRisk,      color: "#dc2626", bg: "#fef2f2", border: "#fecaca", icon: "!" },
                  { title: "AI-Augmented",items: analysis.skillsAnalysis.aiAugmented, color: "#FD5A0F", bg: "#FFF0EA", border: "#FDBB96", icon: "↑" },
                ].map(col => (
                  <div key={col.title} className="rounded-xl p-4" style={{ background: col.bg, border: `1px solid ${col.border}` }}>
                    <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: col.color }}>{col.title} Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {col.items.map((s, i) => (
                        <span key={i} className="text-xs px-2.5 py-1 rounded-lg font-medium"
                          style={{ background: col.bg, color: col.color, border: `1px solid ${col.border}` }}>
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

        {/* ── TASKS ── */}
        {(activeTab === "tasks" || printMode) && (
          <div className={`space-y-5 animate-fade-in${printMode ? " print-page-break" : ""}`}>
            {printMode && <p className="text-base font-bold mb-2 print-only" style={{ color: "#220133" }}>Task Automation Breakdown</p>}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#9988AA" }}>Task Automation Potential</p>
                  <p className="text-xs" style={{ color: "#D0C8D8" }}>Sorted by automation score · hover bars for AI opportunity</p>
                </div>
                <div className="flex gap-4 text-xs" style={{ color: "#553366" }}>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block"/>High</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block"/>Medium</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block"/>Low</span>
                </div>
              </div>
              <TasksChart tasks={analysis.tasks} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...analysis.tasks].sort((a, b) => b.automationScore - a.automationScore).map((task, i) => (
                <div key={i} className="card card-hover p-4 animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
                  <div className="flex items-start justify-between mb-2">
                    <span className={`badge ${impactBadge[task.automationPotential]}`}>{task.automationPotential}</span>
                    <span className="text-2xl font-extrabold score-number" style={{ color: taskColor(task.automationScore) }}>{task.automationScore}</span>
                  </div>
                  <p className="text-sm font-semibold mb-0.5" style={{ color: "#220133" }}>{task.name}</p>
                  <p className="text-xs mb-3" style={{ color: "#9988AA" }}>{task.category}</p>
                  <div className="progress-track h-1.5 mb-3">
                    <div className="progress-fill h-1.5" style={{ width: `${task.automationScore}%`, background: taskColor(task.automationScore) }} />
                  </div>
                  <p className="text-xs mb-1" style={{ color: "#FD5A0F" }}>{task.aiOpportunity}</p>
                  {task.scoringRationale && (
                    <p className="text-xs" style={{ color: "#9988AA" }}>
                      {task.scoringRationale.split('. ')[0]}.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── OPPORTUNITIES ── */}
        {(activeTab === "opportunities" || printMode) && (
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in${printMode ? " print-page-break" : ""}`}>
            {printMode && <p className="text-base font-bold mb-2 col-span-2 print-only" style={{ color: "#220133" }}>AI Opportunities</p>}
            {analysis.aiOpportunities.map((opp, i) => (
              <div key={i} className="card card-hover p-5 animate-fade-in-up" style={{ animationDelay: `${i * 0.07}s` }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex gap-2 flex-wrap">
                    <span className={`badge ${impactBadge[opp.impact]}`}>{opp.impact} impact</span>
                    <span className="badge" style={{ background: "#F4EFF6", color: "#553366", border: "1px solid #EAE4EF" }}>{effortLabel[opp.effort]}</span>
                  </div>
                  <span className="text-xs font-semibold text-emerald-600 whitespace-nowrap ml-2">{opp.estimatedTimeSaving}</span>
                </div>
                <h3 className="text-base font-bold mb-2" style={{ color: "#220133" }}>{opp.title}</h3>
                <p className="text-sm mb-4" style={{ color: "#553366" }}>
                  {opp.description}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {opp.tools.map((tool, j) => (
                    <span key={j} className="text-xs px-2.5 py-1 rounded-lg font-medium"
                      style={{ background: "#FFF0EA", border: "1px solid #FDBB96", color: "#FD5A0F" }}>
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

      </main>

      <footer className="text-center py-8 text-xs no-print" style={{ color: "#D0C8D8" }}>
        iMocha AI Automation Index &nbsp;·&nbsp; Analysis by Claude Sonnet 4.6 &nbsp;·&nbsp; Results are indicative
      </footer>
    </div>
  );
}
