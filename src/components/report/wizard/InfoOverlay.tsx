"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

export type InfoPage = "vision" | "how-it-works";

interface Props {
  page:    InfoPage;
  onClose: () => void;
}

// ── shared primitives ──────────────────────────────────────────────────────────
const S = {
  label: { display: "inline-block", fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase" as const, color: "#4ade80", marginBottom: 12 } as React.CSSProperties,
  h1:    { fontSize: "clamp(26px,3.5vw,40px)", fontWeight: 900, letterSpacing: "-0.8px", lineHeight: 1.1, marginBottom: 20 } as React.CSSProperties,
  h2:    { fontSize: 20, fontWeight: 800, letterSpacing: "-0.4px", marginBottom: 12, marginTop: 40 } as React.CSSProperties,
  h3:    { fontSize: 16, fontWeight: 700, marginBottom: 8 } as React.CSSProperties,
  p:     { color: "rgba(255,255,255,0.7)", lineHeight: 1.7, marginBottom: 12, fontSize: 14 } as React.CSSProperties,
  card:  { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "22px 26px", marginBottom: 12 } as React.CSSProperties,
};

function Pill({ children, color = "#4ade80" }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ display: "inline-block", fontSize: 12, fontWeight: 600, padding: "3px 11px", borderRadius: 20, border: `1px solid ${color}40`, background: `${color}12`, color, marginRight: 6, marginBottom: 6 }}>
      {children}
    </span>
  );
}

function StepCard({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 20, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "24px 26px", marginBottom: 12 }}>
      <div style={{ flexShrink: 0, width: 34, height: 34, borderRadius: "50%", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#4ade80", marginTop: 2 }}>
        {num}
      </div>
      <div>
        <p style={{ ...S.h3, color: "#fff" }}>{title}</p>
        {children}
      </div>
    </div>
  );
}

// ── VISION content ─────────────────────────────────────────────────────────────
function VisionContent() {
  return (
    <>
      <span style={S.label}>Our Vision</span>
      <h1 style={S.h1}><span style={{ color: "#FD5A0F" }}>Why we built the</span><br /><span style={{ color: "#4ade80" }}>AI Automation Readiness Report</span></h1>
      <p style={{ ...S.p, fontSize: 16, color: "rgba(255,255,255,0.75)" }}>
        AI is reshaping every industry — but most organisations are navigating its impact without a clear picture of what it means for their specific workforce. Generic market reports don&apos;t answer the questions HR and business leaders actually face: <em>Which roles are changing? Where is the risk? Where is the opportunity?</em>
      </p>

      <div style={S.card}>
        <p style={{ ...S.h3, color: "#fff" }}>Organisations are flying blind</p>
        <p style={S.p}>The vast majority of AI transformation decisions are made on intuition, analyst averages, or industry benchmarks that don&apos;t reflect a company&apos;s actual job architecture. An &quot;average&quot; automation score for &quot;Financial Services&quot; tells you very little about the specific mix of roles your organisation employs today.</p>
        <p style={{ ...S.p, marginBottom: 0 }}>Business leaders deserve role-level intelligence — grounded in their own job descriptions, not someone else&apos;s workforce.</p>
      </div>

      <div style={S.card}>
        <p style={{ ...S.h3, color: "#fff" }}>The gap between potential and readiness</p>
        <p style={S.p}>Most AI adoption frameworks focus on technology selection. Very few start from the workforce itself: which skills are durable, which tasks can be augmented, and where upskilling investment should be concentrated.</p>
        <p style={{ ...S.p, marginBottom: 0 }}>We built this report to close that gap — turning publicly available job posting data into a structured, company-specific AI readiness picture that organisations can act on immediately.</p>
      </div>

      <div style={S.card}>
        <p style={{ ...S.h3, color: "#fff" }}>iMocha&apos;s role: skills intelligence at scale</p>
        <p style={S.p}>iMocha&apos;s core platform has assessed skill proficiency for millions of professionals across enterprises worldwide. We apply the same rigour to the AI transition — using our deep skills taxonomy and AI analysis pipeline to evaluate automation potential at the task and role level.</p>
        <p style={{ ...S.p, marginBottom: 0 }}>The AI Automation Readiness Report is our commitment to making that intelligence accessible: a free, company-specific analysis that gives HR leaders a credible starting point for their AI workforce strategy.</p>
      </div>

      <div style={{ borderLeft: "3px solid #4ade80", padding: "14px 20px", background: "rgba(74,222,128,0.05)", borderRadius: "0 10px 10px 0", margin: "20px 0" }}>
        <p style={{ ...S.p, marginBottom: 0, fontStyle: "italic" }}>&quot;Every role in your organisation sits somewhere on the spectrum from fully human to highly automatable. Knowing where — before your competitors do — is the defining strategic advantage of the next decade.&quot;</p>
      </div>

      <h2 style={S.h2}>What we stand for</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          { color: "#4ade80", title: "Transparency",   body: "Every estimate comes from analysis of real, publicly available job postings — not invented benchmarks. We tell you exactly what we analysed." },
          { color: "#6094FF", title: "Specificity",    body: "Your report reflects your organisation's actual role mix, not an industry average. Scores are computed from your job descriptions only." },
          { color: "#FD5A0F", title: "Actionability",  body: "We surface the roles, tasks, and skills that matter most for upskilling investment — ranked so HR leaders know where to start." },
          { color: "#fbbf24", title: "Responsibility", body: "AI scores are estimates, not verdicts. We present insights as a strategic starting point and recommend human validation before any workforce decision." },
        ].map(v => (
          <div key={v.title} style={S.card}>
            <p style={{ ...S.h3, color: v.color, fontSize: 13, marginBottom: 6 }}>{v.title}</p>
            <p style={{ ...S.p, fontSize: 13, marginBottom: 0 }}>{v.body}</p>
          </div>
        ))}
      </div>
    </>
  );
}

// ── HOW IT WORKS content ───────────────────────────────────────────────────────
function HowItWorksContent() {
  return (
    <>
      <span style={S.label}>Methodology</span>
      <h1 style={S.h1}><span style={{ color: "#fff" }}>How the</span><br /><span style={{ color: "#FD5A0F" }}>AI Automation Readiness Report</span><br /><span style={{ color: "#fff" }}>is built</span></h1>
      <p style={{ ...S.p, fontSize: 16, color: "rgba(255,255,255,0.75)" }}>
        Every report is generated through a four-stage pipeline that turns publicly available job posting data into structured, role-level AI automation intelligence — specific to your organisation.
      </p>

      <StepCard num={1} title="Data sourcing — public job postings">
        <p style={S.p}>We collect publicly available job postings associated with your organisation&apos;s careers page. These postings are the authoritative, up-to-date description of what your organisation actually needs from its workforce — more current than internal job catalogues and more specific than industry surveys.</p>
        <p style={{ ...S.p, marginBottom: 8 }}>We do not use confidential HR data, internal salary information, or any non-public employee records. The analysis is built entirely from information your organisation has already made public.</p>
        <div><Pill>Public careers pages</Pill><Pill>Job descriptions</Pill><Pill>No proprietary data required</Pill></div>
      </StepCard>

      <StepCard num={2} title="Task & skill extraction">
        <p style={S.p}>Each job description is processed by iMocha&apos;s AI analysis pipeline, which decomposes the role into its constituent tasks, required skills, and implied responsibilities. Tasks are normalised across roles so equivalent activities described differently across multiple postings are mapped to a consistent underlying activity.</p>
        <p style={{ ...S.p, marginBottom: 8 }}>Skills are mapped to iMocha&apos;s proprietary skills taxonomy — classifying competencies across technical, cognitive, interpersonal, and domain-specific dimensions.</p>
        <div><Pill color="#6094FF">Task decomposition</Pill><Pill color="#6094FF">Skill mapping</Pill><Pill color="#6094FF">Cross-role normalisation</Pill></div>
      </StepCard>

      <StepCard num={3} title="Automation scoring">
        <p style={S.p}>Each extracted task is evaluated against a multi-factor automation model that considers cognitive complexity, predictability, data intensity, human interaction requirement, and the current state of commercially available AI tools.</p>
        <p style={{ ...S.p, marginBottom: 10 }}>Tasks are classified into three categories:</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 10 }}>
          {[
            { color: "#4ade80", label: "Low potential",   body: "Relies on judgment, creativity, or relational skills. AI assists but cannot replace the core activity." },
            { color: "#fbbf24", label: "AI-augmentable",  body: "AI accelerates output and reduces error, but human oversight and interpretation remain essential." },
            { color: "#FD5A0F", label: "High potential",  body: "Structured, rule-based tasks that current AI systems can perform with minimal human intervention." },
          ].map(c => (
            <div key={c.label} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "14px 16px" }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: c.color, marginBottom: 6 }}>{c.label}</p>
              <p style={{ ...S.p, fontSize: 12, marginBottom: 0 }}>{c.body}</p>
            </div>
          ))}
        </div>
      </StepCard>

      <StepCard num={4} title="Company-level aggregation">
        <p style={S.p}>Individual role scores are aggregated across your organisation&apos;s full job architecture to produce the headline metrics shown in your report.</p>
        <div style={{ marginBottom: 10 }}>
          <Pill>AI Implementation Opportunity</Pill>
          <Pill color="#fbbf24">Task Automation Potential</Pill>
          <Pill color="#6094FF">Workforce Upskilling Needs</Pill>
          <Pill color="#FD5A0F">Hours Reclaimed / Week</Pill>
        </div>
        <p style={{ ...S.p, marginBottom: 0 }}>Department breakdowns group roles by the function indicated in each posting. Peer comparisons use an illustrative industry baseline — they are not derived from confidential competitor data. All figures are estimates based on job description analysis at a point in time and should be treated as indicative insights, not precise operational measurements.</p>
      </StepCard>

      <h2 style={{ ...S.h2, marginTop: 32 }}>What we <span style={{ color: "#FD5A0F" }}>don&apos;t</span> do</h2>
      {[
        { text: "We do not access internal HR systems or proprietary employee data. The analysis is based solely on publicly available job postings." },
        { text: "We do not make predictions about specific employees. Scores apply to roles and tasks — never to individuals." },
        { text: "We do not guarantee specific business outcomes. Estimated hours saved and efficiency gains are modelled projections, not guaranteed results." },
        { text: "We do not claim that AI will replace specific roles. Automation scores reflect task-level potential — how AI can augment or assist, not a headcount forecast." },
      ].map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "16px 20px", marginBottom: 8 }}>
          <span style={{ color: "#FD5A0F", fontSize: 16, flexShrink: 0, marginTop: 1 }}>✕</span>
          <p style={{ ...S.p, marginBottom: 0 }}>{item.text}</p>
        </div>
      ))}

      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "18px 22px", marginTop: 24 }}>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.7, marginBottom: 0 }}>
          <strong style={{ color: "rgba(255,255,255,0.45)" }}>Disclaimer.</strong> The iMocha AI Automation Readiness Report is an informational tool intended to support strategic workforce planning discussions. All scores, estimates, and projections are derived from AI-assisted analysis of publicly available job postings and should be treated as indicative rather than definitive. iMocha makes no representations or warranties regarding accuracy, completeness, or fitness for a particular purpose. The report does not constitute legal, financial, employment, or HR advice.
        </p>
      </div>
    </>
  );
}

// ── OVERLAY shell ──────────────────────────────────────────────────────────────
export default function InfoOverlay({ page, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const overlay = (
    <div style={{ position: "fixed", inset: 0, zIndex: 9995, display: "flex", flexDirection: "column", background: "#0e0e10", color: "#fff" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", height: 56, borderBottom: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>
          {page === "vision" ? "Vision" : "How it works"}
        </span>
        <button
          onClick={onClose}
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "rgba(255,255,255,0.6)", cursor: "pointer", padding: "6px 14px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, transition: "background .15s" }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          Close
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "56px 40px 80px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          {page === "vision" ? <VisionContent /> : <HowItWorksContent />}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
