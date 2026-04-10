"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import ScoreRing from "@/components/ScoreRing";

const TasksChart    = dynamic(() => import("@/components/TasksChart"),    { ssr: false });
const CategoryRadar = dynamic(() => import("@/components/CategoryRadar"), { ssr: false });

// ─── MOCK DATA ────────────────────────────────────────────────────────────────

const COMPANY = "thyssenkrupp AG";

const ANALYSIS = {
  jobTitle: "HR Working Student / Werkstudent HR Administration",
  department: "Human Resources",
  executiveSummary:
    "67% of tasks in this role are highly automatable using current AI tooling. Resume screening, interview scheduling, and leave request processing can be handled end-to-end by AI agents today — freeing this role to focus on employee relations, GDPR advisory work, and strategic HR initiatives that require human judgment.",
  overallAutomationScore: 67,
  aiReadinessScore: 72,
  estimatedHoursSavedPerWeek: 12,
  tasks: [
    { name: "Resume screening & routing",   automationScore: 92, automationPotential: "high"   as const, category: "Talent Acquisition",    aiOpportunity: "AI can parse, score, and route CVs end-to-end with zero human input.",                                                         scoringRationale: "Highly structured, pattern-based task with clear pass/fail criteria." },
    { name: "Interview scheduling",          automationScore: 88, automationPotential: "high"   as const, category: "Scheduling",              aiOpportunity: "Calendar AI agents can coordinate multi-timezone panel interviews autonomously.",                                               scoringRationale: "Pure scheduling coordination with no judgment required." },
    { name: "Leave request processing",      automationScore: 85, automationPotential: "high"   as const, category: "HR Operations",           aiOpportunity: "Rule-based approval workflows can auto-process 90% of leave requests.",                                                       scoringRationale: "Follows deterministic policy rules available in the employee handbook." },
    { name: "Onboarding doc verification",   automationScore: 78, automationPotential: "high"   as const, category: "HR Operations",           aiOpportunity: "Document AI can verify completeness, flag missing signatures, and chase employees automatically.",                            scoringRationale: "Checklist-driven process with structured document formats." },
    { name: "Monthly HR reporting",          automationScore: 72, automationPotential: "high"   as const, category: "Analytics & Reporting",   aiOpportunity: "BI tools with AI narrative generation can auto-produce dashboard reports on a schedule.",                                     scoringRationale: "Templated report formats pulling from structured HRIS data." },
    { name: "GDPR compliance checks",        automationScore: 45, automationPotential: "medium" as const, category: "Compliance",              aiOpportunity: "AI can flag potential violations but human review is required for final decisions.",                                          scoringRationale: "Requires contextual legal judgment for edge cases and ambiguous situations." },
  ],
  aiOpportunities: [
    {
      title: "AI Resume Screening & Auto-Routing",
      description: "Deploy an AI agent to parse incoming CVs, score against job criteria, and automatically route shortlisted candidates to the correct hiring manager — with zero manual review for 80%+ of applications.",
      impact: "high" as const, effort: "low" as const,
      tools: ["Workday AI", "Greenhouse", "HireVue", "ChatGPT API"],
      estimatedTimeSaving: "3–4h/week",
    },
    {
      title: "Autonomous Interview Scheduling",
      description: "Use a scheduling AI to handle all candidate and panel calendar coordination automatically. The AI negotiates availability and sends confirmations without HR involvement.",
      impact: "high" as const, effort: "low" as const,
      tools: ["Calendly AI", "Reclaim.ai", "Microsoft Copilot", "SAP SuccessFactors"],
      estimatedTimeSaving: "2–3h/week",
    },
    {
      title: "Smart Leave Request Automation",
      description: "Configure rule-based AI workflows in SAP SuccessFactors to auto-approve standard leave requests within policy thresholds, notify managers of edge cases, and update attendance records in real-time.",
      impact: "medium" as const, effort: "low" as const,
      tools: ["SAP SuccessFactors", "Power Automate", "ServiceNow HR"],
      estimatedTimeSaving: "1.5h/week",
    },
    {
      title: "Automated Monthly HR Reporting",
      description: "Connect your HRIS to a BI layer with auto-generated narrative insights via GPT-4. Reports are built, formatted, and distributed to stakeholders on a fixed schedule without any manual assembly.",
      impact: "medium" as const, effort: "medium" as const,
      tools: ["Power BI", "SAP Analytics Cloud", "GPT-4 API", "Tableau"],
      estimatedTimeSaving: "1.5h/week",
    },
  ],
  skillsAnalysis: {
    futureProof: ["Employee Relations", "Strategic HR Planning", "GDPR Advisory", "Stakeholder Communication", "Change Management"],
    atRisk:      ["Manual Resume Screening", "Calendar Management", "Data Entry", "Report Generation", "Document Filing"],
    aiAugmented: ["HR Analytics", "Compliance Monitoring", "Onboarding Coordination", "Workforce Planning", "Talent Pipeline Mgmt"],
  },
  automationByCategory: [
    { category: "Talent Acquisition", score: 92 },
    { category: "Scheduling",         score: 88 },
    { category: "HR Operations",      score: 82 },
    { category: "Reporting",          score: 72 },
    { category: "Compliance",         score: 45 },
  ],
  implementationRoadmap: [
    { phase: "Phase 1", timeline: "0–3 months",  items: ["Deploy resume screening AI", "Set up interview scheduling bot", "Configure leave approval workflows"] },
    { phase: "Phase 2", timeline: "3–6 months",  items: ["Automate monthly HR reporting", "Onboarding document verification AI", "HRIS data quality automation"] },
    { phase: "Phase 3", timeline: "6–12 months", items: ["Full HRIS AI integration", "Predictive attrition analytics", "AI-driven workforce planning dashboard"] },
  ],
  roiHighlights: {
    focusShift: "From administrative processing to strategic HR partnership and talent advisory",
    productivity_multiplier: "2.3x",
    formula: "12h saved/week × 48 weeks × €45/h = ~€25,920 annual value per headcount",
  },
};

// ─── DESIGN HELPERS ───────────────────────────────────────────────────────────

const IMPACT_CFG: Record<string, { text: string; bg: string; border: string }> = {
  high:   { text: "#ef4444", bg: "rgba(239,68,68,0.10)",  border: "rgba(239,68,68,0.25)"  },
  medium: { text: "#d97706", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.25)" },
  low:    { text: "#059669", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.25)" },
};
const EFFORT_LABEL: Record<string, string> = { high: "High Effort", medium: "Med Effort", low: "Low Effort" };
const taskColor = (s: number) => s >= 70 ? "#ef4444" : s >= 40 ? "#f59e0b" : "#10b981";

// ─── ICON ─────────────────────────────────────────────────────────────────────

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

function Badge({ label, cfg }: { label: string; cfg: { text: string; bg: string; border: string } }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "3px 10px", borderRadius: 20,
      fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
      background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}`,
    }}>{label}</span>
  );
}

// ─── SKILLS TOOLTIP ───────────────────────────────────────────────────────────

const SKILLS_TOOLTIP_CONTENT = {
  futureProof: {
    header: "STAYS VALUABLE",
    headerColor: "#059669",
    body: "These skills are unlikely to be automated in the next 3–5 years. They require human judgment, relational intelligence, or creative reasoning — all areas where AI remains weak. Prioritize developing and retaining people with these competencies for this role.",
  },
  atRisk: {
    header: "HIGH AUTOMATION EXPOSURE",
    headerColor: "#dc2626",
    body: "These skills map directly to tasks flagged as highly automatable for this role. People who rely heavily on these skills may find their scope narrow as AI tools are adopted. Use this as a targeted reskilling signal for your L&D roadmap.",
  },
  aiAugmented: {
    header: "AMPLIFIED BY AI",
    headerColor: "#FD5A0F",
    body: "These skills become significantly more powerful when combined with AI tools — not replaced by them. Someone who learns to direct, prompt, or oversee AI in these areas will be substantially more productive. This is your highest-ROI upskilling opportunity.",
  },
};

function SkillsColumnTooltip({
  type, borderColor, visible,
}: {
  type: keyof typeof SKILLS_TOOLTIP_CONTENT;
  borderColor: string;
  visible: boolean;
}) {
  const content = SKILLS_TOOLTIP_CONTENT[type];
  if (!visible) return null;
  return (
    <div style={{
      position: "absolute", zIndex: 100,
      width: 268, borderRadius: 14, padding: "16px 18px",
      top: "calc(100% + 10px)", left: 0,
      background: "#fff",
      border: `1px solid ${borderColor}`,
      boxShadow: "0 12px 40px rgba(34,1,51,0.14)",
      animation: "fadeInUp 0.18s ease both",
      pointerEvents: "none",
    }}>
      {/* caret */}
      <div style={{
        position: "absolute", top: -7, left: 20,
        width: 12, height: 12, transform: "rotate(45deg)",
        background: "#fff",
        borderLeft: `1px solid ${borderColor}`,
        borderTop: `1px solid ${borderColor}`,
      }} />
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: content.headerColor, margin: "0 0 8px" }}>
        {content.header}
      </p>
      <p style={{ fontSize: 12, color: "#220133", margin: 0, lineHeight: 1.65 }}>
        {content.body}
      </p>
    </div>
  );
}

// ─── EMAIL GATE MODAL ─────────────────────────────────────────────────────────

function EmailGateModal({
  roleTitle,
  onClose,
  onSubmit,
}: {
  roleTitle: string;
  onClose: () => void;
  onSubmit: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [focused, setFocused] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return;
    setSubmitted(true);
    setTimeout(() => onSubmit(email), 800);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(15,0,25,0.6)",
      backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
      animation: "fadeIn 0.2s ease",
    }}>
      <div style={{
        background: "#fff", borderRadius: 24, width: "100%", maxWidth: 460,
        overflow: "hidden",
        boxShadow: "0 24px 80px rgba(34,1,51,0.30)",
        animation: "slideUp 0.3s ease",
      }}>
        {/* Top band */}
        <div style={{
          background: "linear-gradient(135deg, #1A0028 0%, #2D0050 100%)",
          padding: "18px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IMochaIcon size={20} color="#FD5A0F" />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#FDBB96" }}>AI Automation Report</span>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 6,
              background: "rgba(255,255,255,0.12)", border: "none",
              color: "rgba(255,255,255,0.6)", fontSize: 16, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.22)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
            title="Close — download will still start"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "28px 32px 32px" }}>
          {submitted ? (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#220133", margin: "0 0 6px" }}>Starting download…</p>
              <p style={{ fontSize: 13, color: "#9988AA", margin: 0 }}>Your report is on its way.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "#220133", margin: "0 0 8px", letterSpacing: "-0.3px" }}>
                Download Your Report
              </h2>
              <p style={{ fontSize: 13, color: "#553366", lineHeight: 1.6, margin: "0 0 22px" }}>
                Drop your work email and we&apos;ll send you a PDF copy — plus insights on next steps for <strong>{roleTitle}</strong>.
              </p>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="you@company.com"
                required
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "12px 16px", borderRadius: 10, fontSize: 14,
                  border: `1.5px solid ${focused ? "#FD5A0F" : "#EAE4EF"}`,
                  outline: "none", marginBottom: 14,
                  transition: "border-color 0.15s",
                  color: "#220133",
                }}
              />
              <button
                type="submit"
                style={{
                  width: "100%", padding: 13, borderRadius: 10,
                  background: "#FD5A0F", color: "#fff", border: "none",
                  fontSize: 14, fontWeight: 700, cursor: "pointer",
                  transition: "background 0.15s, transform 0.1s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#E04E08")}
                onMouseLeave={e => (e.currentTarget.style.background = "#FD5A0F")}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 16 16">
                  <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Send me the PDF
              </button>
              <p style={{ fontSize: 11, color: "#9988AA", margin: "10px 0 0", textAlign: "center" }}>
                No spam. Download starts immediately after submitting.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function PreviewReportPage() {
  const [activeTab, setActiveTab]               = useState<"overview" | "tasks" | "opportunities">("overview");
  const [hoveredKpi, setHoveredKpi]             = useState<number | null>(null);
  const [shimmerDone, setShimmerDone]           = useState(false);
  const [tabsExplored, setTabsExplored]         = useState(false);
  const [hintVisible, setHintVisible]           = useState(true);
  const [skillsTooltip, setSkillsTooltip]       = useState<string | null>(null);
  const [showEmailModal, setShowEmailModal]      = useState(false);
  const [stickyBarVisible, setStickyBarVisible] = useState(false);
  const [stickyBarDismissed, setStickyBarDismissed] = useState(false);
  const [stickyEmail, setStickyEmail]           = useState("");
  const [stickySubmitted, setStickySubmitted]   = useState(false);
  const [fabVisible, setFabVisible]             = useState(false);
  const [showBackTooltip, setShowBackTooltip]   = useState(false);
  const [printMode, setPrintMode]               = useState(false);

  const tasksHigh   = ANALYSIS.tasks.filter(t => t.automationPotential === "high").length;
  const tasksMedium = ANALYSIS.tasks.filter(t => t.automationPotential === "medium").length;
  const tasksLow    = ANALYSIS.tasks.length - tasksHigh - tasksMedium;

  const scores   = ANALYSIS.tasks.map(t => t.automationScore);
  const scoreMin = Math.min(...scores);
  const scoreMax = Math.max(...scores);

  // ── Shimmer: fires once on first visit, via localStorage ──
  useEffect(() => {
    const key = "ux_preview_tabs_shimmer_done";
    const done = localStorage.getItem(key);
    if (done) { setShimmerDone(true); return; }
    const t = setTimeout(() => {
      setShimmerDone(false); // let shimmer run
      localStorage.setItem(key, "1");
      setTimeout(() => setShimmerDone(true), 1600);
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  // ── Hint disappears 8s after mount or when tabs explored ──
  useEffect(() => {
    const t = setTimeout(() => setHintVisible(false), 8000);
    return () => clearTimeout(t);
  }, []);

  // ── Scroll listeners: sticky bar + FAB ──
  useEffect(() => {
    const onScroll = () => {
      const scrollY   = window.scrollY;
      const pageH     = document.body.scrollHeight - window.innerHeight;
      const pct       = pageH > 0 ? scrollY / pageH : 0;

      setFabVisible(scrollY > 100);
      if (!stickyBarDismissed && pct > 0.6) setStickyBarVisible(true);
      if (pct < 0.4) setStickyBarVisible(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [stickyBarDismissed]);

  const handleTabClick = (tab: "overview" | "tasks" | "opportunities") => {
    setActiveTab(tab);
    if (tab !== "overview") {
      setTabsExplored(true);
      setHintVisible(false);
    }
  };

  const triggerDownload = () => {
    const prevTitle = document.title;
    document.title = `${ANALYSIS.jobTitle} – ${COMPANY} | AI Automation Report by iMocha`;
    setPrintMode(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => { setPrintMode(false); document.title = prevTitle; }, 500);
    }, 300);
  };

  const handleDownloadClick = () => setShowEmailModal(true);

  const handleModalSubmit = (_email: string) => {
    setShowEmailModal(false);
    triggerDownload();
  };

  const handleModalClose = () => {
    setShowEmailModal(false);
    triggerDownload(); // soft gate: always download on close too
  };

  const handleStickySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stickyEmail.includes("@")) return;
    setStickySubmitted(true);
    setTimeout(() => { setStickyBarDismissed(true); setStickyBarVisible(false); }, 2500);
  };

  const kpis = [
    {
      label: "Automation Score", value: ANALYSIS.overallAutomationScore + "%",
      sub: "of tasks automatable", color: "#ef4444", bg: "#fef2f2",
      borderColor: "rgba(239,68,68,0.2)", glowColor: "rgba(239,68,68,0.08)", icon: "⚡",
      what: "How much of this role's day-to-day work AI can handle today — across every task in the job description.",
      how: `Simple average of all ${ANALYSIS.tasks.length} task scores (range: ${scoreMin}–${scoreMax}) → ${ANALYSIS.overallAutomationScore}%`,
    },
    {
      label: "Hours Saved/Week", value: ANALYSIS.estimatedHoursSavedPerWeek + "h",
      sub: "time reclaimed weekly", color: "#059669", bg: "#ecfdf5",
      borderColor: "rgba(16,185,129,0.2)", glowColor: "rgba(16,185,129,0.08)", icon: "⏱",
      what: "Hours per week freed up by AI — time this person can redirect to higher-value, strategic work.",
      how: `Per task: 40h × time share × automation score × 65% efficiency factor. Summed and capped at 12h → ${ANALYSIS.estimatedHoursSavedPerWeek}h`,
    },
    {
      label: "High-Impact Tasks", value: `${tasksHigh}/${ANALYSIS.tasks.length}`,
      sub: `${tasksHigh} highly automatable`, color: "#220133", bg: "#F4EFF6",
      borderColor: "rgba(34,1,51,0.15)", glowColor: "rgba(34,1,51,0.05)", icon: "🎯",
      what: "Tasks where AI can take over 70%+ of the work — your best starting points for automation.",
      how: `${tasksHigh} of ${ANALYSIS.tasks.length} tasks scored ≥70, the threshold for "High" automation potential`,
    },
  ];

  const fabBottom = stickyBarVisible ? 96 : 28;

  return (
    <div style={{ minHeight: "100vh", background: "#F4EFF6" }}>

      {/* ── PRINT HEADER ── */}
      <div className="print-only" style={{ display: "none", padding: "18mm 14mm 10mm", background: "#fff", borderBottom: "3px solid #FD5A0F", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <IMochaIcon size={32} color="#FD5A0F" />
            <div style={{ fontSize: 18, fontWeight: 900, color: "#220133" }}>iMocha</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#9988AA" }}>{new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
            <div style={{ fontSize: 11, color: "#553366", fontWeight: 600, marginTop: 2 }}>{COMPANY}</div>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#220133" }}>{ANALYSIS.jobTitle}</div>
          <div style={{ fontSize: 12, color: "#9988AA", marginTop: 3 }}>{ANALYSIS.department}</div>
        </div>
      </div>

      {/* ── NAV ── */}
      <nav className="no-print" style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(255,255,255,0.96)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid #EAE4EF",
        boxShadow: "0 1px 12px rgba(34,1,51,0.06)",
      }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto",
          padding: "0 28px", height: 56,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a
            href="/preview"
            style={{
              display: "flex", alignItems: "center",
              color: "#9988AA", fontWeight: 500,
              textDecoration: "none", transition: "color 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "#220133")}
            onMouseLeave={e => (e.currentTarget.style.color = "#9988AA")}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 16 16">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
          <span style={{ color: "#EAE4EF" }}>|</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IMochaIcon size={22} color="#FD5A0F" />
            <span style={{ fontSize: 13, fontWeight: 800, color: "#220133" }}>iMocha</span>
            <span style={{ color: "#EAE4EF" }}>|</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#553366" }}>AI Automation Index</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontSize: 12, padding: "4px 12px", borderRadius: 20,
            color: "#553366", background: "#F4EFF6", border: "1px solid #EAE4EF", fontWeight: 500,
          }}>
            {COMPANY}
          </span>
          {/* ORANGE download button */}
          <button
            onClick={handleDownloadClick}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 12, padding: "7px 16px", borderRadius: 10,
              fontWeight: 700, color: "#fff", background: "#FD5A0F",
              border: "none", cursor: "pointer",
              boxShadow: "0 2px 10px rgba(253,90,15,0.25)",
              transition: "background 0.15s, box-shadow 0.15s, transform 0.1s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "#E04E08";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 16px rgba(253,90,15,0.40)";
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "#FD5A0F";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 2px 10px rgba(253,90,15,0.25)";
              (e.currentTarget as HTMLButtonElement).style.transform = "";
            }}
          >
            <svg width="13" height="13" fill="none" viewBox="0 0 16 16">
              <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Download PDF
          </button>
        </div>
        </div>
      </nav>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 28px 60px" }}>

        {/* ── HERO ── */}
        <div style={{
          background: "linear-gradient(135deg, #1A0028 0%, #2D0050 100%)",
          borderRadius: 24, padding: "32px 36px", marginBottom: 28,
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 8px 40px rgba(34,1,51,0.18)",
          position: "relative", overflow: "hidden",
          animation: "fadeInUp 0.4s ease both",
        }}>
          <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(253,90,15,0.06)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -60, right: 60, width: 150, height: 150, borderRadius: "50%", background: "rgba(139,92,246,0.05)", pointerEvents: "none" }} />
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "3px 10px", borderRadius: 20, background: "rgba(253,90,15,0.2)", color: "#FDBB96", border: "1px solid rgba(253,90,15,0.3)" }}>
                  {ANALYSIS.department}
                </span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>·</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>AI Automation Analysis</span>
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", margin: "0 0 6px", letterSpacing: "-0.5px", lineHeight: 1.2 }}>
                {ANALYSIS.jobTitle}
              </h1>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: "0 0 16px" }}>{COMPANY}</p>
              <div style={{ padding: "14px 18px", borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(253,90,15,0.8)", margin: "0 0 8px" }}>Impact Summary</p>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", margin: 0, lineHeight: 1.65 }}>{ANALYSIS.executiveSummary}</p>
              </div>
            </div>
            <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 10, background: "rgba(253,90,15,0.15)", border: "1px solid rgba(253,90,15,0.25)" }}>
              <IMochaIcon size={14} color="#FD5A0F" />
              <span style={{ fontSize: 11, fontWeight: 600, color: "#FDBB96" }}>iMocha</span>
            </div>
          </div>
        </div>

        {/* ── KPI CARDS ── */}
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
                boxShadow: hoveredKpi === i ? `0 8px 32px ${k.glowColor}, 0 2px 12px rgba(34,1,51,0.08)` : "0 2px 12px rgba(34,1,51,0.06)",
                transition: "border-color 0.18s, box-shadow 0.18s, transform 0.18s",
                transform: hoveredKpi === i ? "translateY(-3px)" : "none",
                cursor: "default",
                animation: `fadeInUp 0.4s ease ${i * 0.08}s both`,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: k.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, border: `1px solid ${k.borderColor}` }}>
                    {k.icon}
                  </div>
                  <span style={{ fontSize: 36, fontWeight: 800, color: k.color, lineHeight: 1, letterSpacing: "-1px" }}>{k.value}</span>
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#220133", margin: "0 0 3px" }}>{k.label}</p>
                <p style={{ fontSize: 12, color: "#9988AA", margin: 0 }}>{k.sub}</p>
              </div>
              {hoveredKpi === i && (
                <div style={{
                  position: "absolute", zIndex: 50, width: 280, borderRadius: 16, padding: "16px 18px",
                  top: "calc(100% + 12px)", ...(i >= 2 ? { right: 0 } : { left: 0 }),
                  background: "#fff", border: `1px solid ${k.borderColor}`,
                  boxShadow: `0 16px 48px rgba(34,1,51,0.16), 0 0 0 1px ${k.glowColor}`,
                  animation: "fadeInUp 0.18s ease both",
                }}>
                  <div style={{ position: "absolute", top: -7, ...(i >= 2 ? { right: "1.5rem" } : { left: "1.5rem" }), width: 12, height: 12, transform: "rotate(45deg)", background: "#fff", borderLeft: `1px solid ${k.borderColor}`, borderTop: `1px solid ${k.borderColor}` }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 16 }}>{k.icon}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: k.color }}>{k.label}</span>
                    <span style={{ marginLeft: "auto", fontSize: 20, fontWeight: 800, color: k.color }}>{k.value}</span>
                  </div>
                  <p style={{ fontSize: 13, color: "#220133", margin: "0 0 8px", lineHeight: 1.55 }}>{k.what}</p>
                  <p style={{ fontSize: 11, color: "#9988AA", margin: 0, fontFamily: "monospace", lineHeight: 1.5 }}>{k.how}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── ENHANCED TAB BAR (Issue 1) ── */}
        <div className="no-print" style={{ marginBottom: 8 }}>
          <div style={{
            display: "flex", gap: 4, padding: 5,
            background: "#fff", borderRadius: 14, border: "1px solid #EAE4EF",
            boxShadow: "0 2px 8px rgba(34,1,51,0.05)",
            width: "100%",
          }}>
            {(["overview", "tasks", "opportunities"] as const).map(tab => {
              const isActive = activeTab === tab;
              const badgeCount = tab === "tasks" ? ANALYSIS.tasks.length : tab === "opportunities" ? ANALYSIS.aiOpportunities.length : null;
              const showShimmer = !shimmerDone && !isActive && !tabsExplored;

              return (
                <button
                  key={tab}
                  onClick={() => handleTabClick(tab)}
                  style={{
                    flex: 1,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    padding: "9px 20px", borderRadius: 10, border: "none", cursor: "pointer",
                    fontSize: 13, fontWeight: 600, textTransform: "capitalize",
                    transition: "background 0.15s, color 0.15s, box-shadow 0.15s",
                    background: isActive ? "#FD5A0F" : "transparent",
                    color: isActive ? "#fff" : "#553366",
                    boxShadow: isActive ? "0 2px 10px rgba(253,90,15,0.3), 0 0 0 0 rgba(253,90,15,0)" : "none",
                    position: "relative", overflow: "hidden",
                  }}
                  onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = "#FFF8F5"; (e.currentTarget as HTMLButtonElement).style.color = "#FD5A0F"; } }}
                  onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#553366"; } }}
                >
                  {/* One-shot shimmer sweep */}
                  {showShimmer && (
                    <span style={{
                      position: "absolute", inset: 0,
                      background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)",
                      animation: "shimmerSweep 0.7s ease forwards",
                      pointerEvents: "none",
                    }} />
                  )}
                  <span>{tab}</span>
                  {badgeCount !== null && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      minWidth: 20, height: 18, borderRadius: 9,
                      background: isActive ? "rgba(255,255,255,0.25)" : "#FFF0EA",
                      color: isActive ? "#fff" : "#FD5A0F",
                      border: isActive ? "1px solid rgba(255,255,255,0.3)" : "1px solid #FDBB96",
                      fontSize: 9, fontWeight: 700, padding: "0 5px",
                    }}>
                      {badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Animated hint arrow */}
          {hintVisible && !tabsExplored && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "flex-end",
              gap: 4, marginTop: 6, paddingRight: 4,
              animation: "hintPulse 1.2s ease-in-out infinite",
              opacity: hintVisible ? 1 : 0,
              transition: "opacity 0.5s ease",
            }}>
              <span style={{ fontSize: 11, color: "#9988AA" }}>Explore Tasks &amp; Opportunities</span>
              <span style={{ color: "#FD5A0F", fontSize: 13 }}>→</span>
            </div>
          )}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {(activeTab === "overview" || printMode) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeIn 0.25s ease" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
              <div style={{ background: "#fff", border: "1px solid #EAE4EF", borderRadius: 20, padding: 24, boxShadow: "0 2px 12px rgba(34,1,51,0.06)", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9988AA", margin: 0, alignSelf: "flex-start" }}>Score Breakdown</p>
                <ScoreRing score={ANALYSIS.overallAutomationScore} color="auto" label="Automation" sublabel="Tasks automatable" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, width: "100%", paddingTop: 16, borderTop: "1px solid #EAE4EF", textAlign: "center" }}>
                  {[{ count: tasksHigh, label: "High", color: "#ef4444" }, { count: tasksMedium, label: "Medium", color: "#f59e0b" }, { count: tasksLow, label: "Low", color: "#10b981" }].map(item => (
                    <div key={item.label}>
                      <p style={{ fontSize: 22, fontWeight: 800, color: item.color, margin: "0 0 2px" }}>{item.count}</p>
                      <p style={{ fontSize: 11, color: "#9988AA", margin: 0 }}>{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: "#fff", border: "1px solid #EAE4EF", borderRadius: 20, padding: 24, boxShadow: "0 2px 12px rgba(34,1,51,0.06)" }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9988AA", margin: "0 0 16px" }}>Automation by Category</p>
                <CategoryRadar data={ANALYSIS.automationByCategory} />
              </div>
            </div>

            {/* ── ENHANCED SKILLS ANALYSIS (Issue 2) ── */}
            <div style={{ background: "#fff", border: "1px solid #EAE4EF", borderRadius: 20, padding: "24px 28px", boxShadow: "0 2px 12px rgba(34,1,51,0.06)" }}>
              {/* Upgraded section header */}
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#220133", margin: "0 0 3px" }}>Skills Analysis</p>
                <p style={{ fontSize: 12, color: "#9988AA", margin: 0 }}>Classified by exposure to AI automation for this role</p>
              </div>


              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                {[
                  { key: "futureProof" as const, title: "Future-Proof", items: ANALYSIS.skillsAnalysis.futureProof, color: "#059669", bg: "#ecfdf5", border: "#a7f3d0", icon: "✓" },
                  { key: "atRisk"      as const, title: "At Risk",       items: ANALYSIS.skillsAnalysis.atRisk,       color: "#dc2626", bg: "#fef2f2", border: "#fecaca", icon: "!" },
                  { key: "aiAugmented" as const, title: "AI-Augmented",  items: ANALYSIS.skillsAnalysis.aiAugmented,  color: "#FD5A0F", bg: "#FFF0EA", border: "#FDBB96", icon: "↑" },
                ].map(col => (
                  <div key={col.title} style={{ borderRadius: 16, padding: "16px 18px", background: col.bg, border: `1px solid ${col.border}` }}>
                    {/* Column header with ⓘ tooltip */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, position: "relative" }}>
                      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: col.color, margin: 0 }}>
                        {col.title} Skills
                      </p>
                      {/* Info icon */}
                      <button
                        onMouseEnter={() => setSkillsTooltip(col.key)}
                        onMouseLeave={() => setSkillsTooltip(null)}
                        onFocus={() => setSkillsTooltip(col.key)}
                        onBlur={() => setSkillsTooltip(null)}
                        style={{
                          width: 16, height: 16, borderRadius: "50%",
                          background: "rgba(255,255,255,0.7)", border: `1px solid ${col.border}`,
                          color: col.color, fontSize: 10, fontWeight: 700,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: "default", flexShrink: 0,
                          outline: "none",
                        }}
                        aria-label={`What does ${col.title} mean?`}
                      >
                        i
                      </button>
                      <SkillsColumnTooltip type={col.key} borderColor={col.border} visible={skillsTooltip === col.key} />
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {col.items.map((s, i) => (
                        <span key={i} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, fontWeight: 500, background: col.bg, color: col.color, border: `1px solid ${col.border}` }}>
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

        {/* ── TASKS TAB ── */}
        {(activeTab === "tasks" || printMode) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeIn 0.25s ease" }}>
            <div style={{ background: "#fff", border: "1px solid #EAE4EF", borderRadius: 20, padding: "24px 28px", boxShadow: "0 2px 12px rgba(34,1,51,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9988AA", margin: "0 0 4px" }}>Task Automation Potential</p>
                  <p style={{ fontSize: 11, color: "#C4B5D0", margin: 0 }}>Sorted by automation score · hover bars for AI opportunity</p>
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#553366" }}>
                  {[{ label: "High", color: "#f87171" }, { label: "Medium", color: "#fbbf24" }, { label: "Low", color: "#34d399" }].map(item => (
                    <span key={item.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: item.color, display: "inline-block" }} />
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>
              <TasksChart tasks={ANALYSIS.tasks} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {[...ANALYSIS.tasks].sort((a, b) => b.automationScore - a.automationScore).map((task, i) => {
                const color = taskColor(task.automationScore);
                const impactCfg = IMPACT_CFG[task.automationPotential] ?? IMPACT_CFG.low;
                return (
                  <div key={i} style={{
                    background: "#fff", border: "1px solid #EAE4EF", borderRadius: 16, padding: "18px 18px 16px",
                    boxShadow: "0 2px 8px rgba(34,1,51,0.05)",
                    transition: "transform 0.15s, box-shadow 0.15s",
                    animation: `fadeInUp 0.35s ease ${i * 0.04}s both`,
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 24px rgba(34,1,51,0.1)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 8px rgba(34,1,51,0.05)"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <Badge label={task.automationPotential} cfg={impactCfg} />
                      <span style={{ fontSize: 28, fontWeight: 800, color, letterSpacing: "-0.5px", lineHeight: 1 }}>{task.automationScore}</span>
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#220133", margin: "0 0 3px" }}>{task.name}</p>
                    <p style={{ fontSize: 11, color: "#9988AA", margin: "0 0 10px" }}>{task.category}</p>
                    <div style={{ height: 4, borderRadius: 2, background: "#F4EFF6", overflow: "hidden", marginBottom: 10 }}>
                      <div style={{ height: "100%", width: `${task.automationScore}%`, background: color, borderRadius: 2 }} />
                    </div>
                    <p style={{ fontSize: 11, color: "#FD5A0F", margin: "0 0 4px", fontWeight: 500 }}>{task.aiOpportunity}</p>
                    {task.scoringRationale && (
                      <p style={{ fontSize: 11, color: "#9988AA", margin: 0, lineHeight: 1.5 }}>{task.scoringRationale.split(". ")[0]}.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── OPPORTUNITIES TAB ── */}
        {(activeTab === "opportunities" || printMode) && (
          <div style={{ animation: "fadeIn 0.25s ease" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
              {ANALYSIS.aiOpportunities.map((opp, i) => {
                const impactCfg = IMPACT_CFG[opp.impact] ?? IMPACT_CFG.low;
                return (
                  <div key={i} style={{
                    background: "#fff", border: "1px solid #EAE4EF", borderRadius: 20, padding: "22px 24px",
                    boxShadow: "0 2px 12px rgba(34,1,51,0.06)",
                    transition: "transform 0.15s, box-shadow 0.15s",
                    animation: `fadeInUp 0.35s ease ${i * 0.06}s both`,
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 32px rgba(34,1,51,0.1)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 12px rgba(34,1,51,0.06)"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Badge label={`${opp.impact} impact`} cfg={impactCfg} />
                        <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", background: "#F4EFF6", color: "#553366", border: "1px solid #EAE4EF" }}>
                          {EFFORT_LABEL[opp.effort]}
                        </span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#059669", whiteSpace: "nowrap", marginLeft: 8 }}>{opp.estimatedTimeSaving}</span>
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: "#220133", margin: "0 0 8px" }}>{opp.title}</h3>
                    <p style={{ fontSize: 13, color: "#553366", margin: "0 0 16px", lineHeight: 1.6 }}>{opp.description}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {opp.tools.map((tool, j) => (
                        <span key={j} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, fontWeight: 600, background: "#FFF0EA", border: "1px solid #FDBB96", color: "#FD5A0F" }}>{tool}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </main>

      {/* ── FOOTER ── */}
      <footer className="no-print" style={{ textAlign: "center", padding: "24px 0 40px", fontSize: 11, color: "#C4B5D0" }}>
        iMocha AI Automation Index &nbsp;·&nbsp; Powered by iMocha &nbsp;·&nbsp; Results are indicative
        <br />
        <span style={{ color: "#EAE4EF", fontSize: 10 }}>Preview build · feat/ux-report-improvements</span>
      </footer>

      {/* ── FLOATING ACTION BUTTON CLUSTER (Issue 4) ── */}
      <div className="no-print" style={{
        position: "fixed",
        bottom: fabBottom,
        right: 28,
        zIndex: 60,
        display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10,
        transition: "bottom 0.35s ease",
        opacity: fabVisible ? 1 : 0,
        transform: fabVisible ? "translateX(0)" : "translateX(80px)",
        pointerEvents: fabVisible ? "auto" : "none",
        // Delayed entry animation on mount
      }}>
        {/* Back button */}
        <div style={{ position: "relative" }}
          onMouseEnter={() => setShowBackTooltip(true)}
          onMouseLeave={() => setShowBackTooltip(false)}
        >
          {showBackTooltip && (
            <div style={{
              position: "absolute", right: "calc(100% + 10px)", top: "50%",
              transform: "translateY(-50%)",
              background: "#220133", color: "#fff",
              fontSize: 11, fontWeight: 600,
              padding: "5px 10px", borderRadius: 6,
              whiteSpace: "nowrap",
              animation: "fadeIn 0.15s ease",
            }}>
              Back to all roles
              <div style={{ position: "absolute", right: -5, top: "50%", transform: "translateY(-50%) rotate(45deg)", width: 8, height: 8, background: "#220133" }} />
            </div>
          )}
          <a
            href="/preview"
            style={{
              width: 44, height: 44, borderRadius: "50%",
              background: "#fff", border: "1px solid #EAE4EF",
              boxShadow: "0 4px 16px rgba(34,1,51,0.10)",
              display: "flex", alignItems: "center", justifyContent: "center",
              textDecoration: "none", color: "#553366",
              transition: "box-shadow 0.15s, transform 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 6px 24px rgba(34,1,51,0.16)"; (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 4px 16px rgba(34,1,51,0.10)"; (e.currentTarget as HTMLAnchorElement).style.transform = ""; }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 16 16">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </div>

        {/* Download button — orange pill */}
        <button
          onClick={handleDownloadClick}
          style={{
            height: 44, padding: "0 18px", borderRadius: 12,
            background: "#FD5A0F", color: "#fff", border: "none",
            display: "flex", alignItems: "center", gap: 7,
            fontSize: 13, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 6px 20px rgba(253,90,15,0.30)",
            transition: "background 0.15s, box-shadow 0.15s, transform 0.15s",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "#E04E08";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 28px rgba(253,90,15,0.40)";
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "#FD5A0F";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 20px rgba(253,90,15,0.30)";
            (e.currentTarget as HTMLButtonElement).style.transform = "";
          }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 16 16">
            <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Download PDF
        </button>
      </div>

      {/* ── STICKY BOTTOM EMAIL BAR (Issue 3 — secondary capture) ── */}
      <div className="no-print" style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        height: 68, zIndex: 55,
        background: "#fff", borderTop: "1px solid #EAE4EF",
        boxShadow: "0 -4px 20px rgba(34,1,51,0.08)",
        display: "flex", alignItems: "center",
        padding: "0 28px", gap: 16,
        transform: stickyBarVisible ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.35s ease",
        pointerEvents: stickyBarVisible ? "auto" : "none",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <IMochaIcon size={18} color="#FD5A0F" />
          <span style={{ fontSize: 13, color: "#553366", fontWeight: 500 }}>
            Want to share this report with your team?
          </span>
        </div>
        <div style={{ flex: 1 }} />
        {stickySubmitted ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#059669", fontSize: 13, fontWeight: 600 }}>
            <span>✓</span> Sent! Check your inbox.
          </div>
        ) : (
          <form onSubmit={handleStickySubmit} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="email"
              value={stickyEmail}
              onChange={e => setStickyEmail(e.target.value)}
              placeholder="Work email"
              required
              style={{
                width: 220, padding: "8px 14px", borderRadius: 8, fontSize: 13,
                border: "1.5px solid #EAE4EF", outline: "none", color: "#220133",
              }}
              onFocus={e => (e.target.style.borderColor = "#FD5A0F")}
              onBlur={e => (e.target.style.borderColor = "#EAE4EF")}
            />
            <button
              type="submit"
              style={{
                padding: "8px 20px", borderRadius: 8,
                background: "#FD5A0F", color: "#fff", border: "none",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                transition: "background 0.15s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#E04E08")}
              onMouseLeave={e => (e.currentTarget.style.background = "#FD5A0F")}
            >
              Get PDF
            </button>
          </form>
        )}
        <button
          onClick={() => { setStickyBarDismissed(true); setStickyBarVisible(false); }}
          style={{ background: "none", border: "none", color: "#C4B5D0", fontSize: 18, cursor: "pointer", flexShrink: 0, lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      {/* ── EMAIL GATE MODAL (Issue 3 — primary capture) ── */}
      {showEmailModal && (
        <EmailGateModal
          roleTitle={ANALYSIS.jobTitle}
          onClose={handleModalClose}
          onSubmit={handleModalSubmit}
        />
      )}

      {/* ── PRINT FOOTER ── */}
      <div className="print-only" style={{ display: "none", borderTop: "1px solid #EAE4EF", padding: "8mm 14mm", marginTop: 32, background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IMochaIcon size={16} color="#FD5A0F" />
            <span style={{ fontSize: 10, fontWeight: 700, color: "#220133" }}>iMocha</span>
          </div>
          <span style={{ fontSize: 10, color: "#9988AA", fontStyle: "italic" }}>Powered by iMocha · Know Your Workforce, Shape the Future</span>
        </div>
      </div>

      {/* ── GLOBAL STYLES ── */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmerSweep {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes hintPulse {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }
        @media print {
          @page { margin: 0; size: A4; }
          body  { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print    { display: none !important; }
          .print-only  { display: block !important; }
        }
      `}</style>
    </div>
  );
}
