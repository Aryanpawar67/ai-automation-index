"use client";

import { useState } from "react";
import type { CompanyWizardData, WizardRole } from "@/lib/report/aggregate";

interface Props {
  company:             string;
  data:                CompanyWizardData;
  activeRole:          WizardRole | null;
  isMobile?:           boolean;
  onRoleSelect:        (role: WizardRole | null) => void;
  onRequestAnalysis:   () => void;
}

function scoreColor(s: number) {
  return s >= 66 ? "#f87171" : s >= 33 ? "#fbbf24" : "#4ade80";
}

const LEVEL_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const EFFORT_LABEL: Record<string, string> = { high: "High Effort", medium: "Med Effort", low: "Low Effort" };

// ── Role list ──────────────────────────────────────────────────────────────────
function RoleList({ company, data, onRoleSelect, isMobile }: {
  company:     string;
  data:        CompanyWizardData;
  isMobile?:   boolean;
  onRoleSelect: (role: WizardRole) => void;
}) {
  return (
    <>
      <h1 style={{ fontSize: "clamp(19px,2.4vw,28px)", fontWeight: 800, lineHeight: 1.2, letterSpacing: -0.3, marginBottom: 4, textAlign: "center", color: "#fff" }}>
        AI opportunities for specific roles at <span style={{ color: "#4ade80" }}>{company}</span>
      </h1>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", textAlign: "center", marginBottom: 20 }}>
        Based on iMocha&apos;s AI analysis of publicly available job postings · Tap any role to see tasks, skills and AI tools
      </p>

      {/* Mini stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 10, marginBottom: 18 }}>
        {[
          { label: "AI Implementation Opportunity", value: `${data.aiImplementationOpportunity}%`, cap: "of workforce can use AI to boost productivity" },
          { label: "Task Automation Potential",      value: `${data.taskAutomationPotential}%`,     cap: "of tasks could be enhanced with AI" },
          { label: "Hours Reclaimed / Week",          value: `${data.totalHoursSavedPerWeek}h`,      cap: "estimated across all analyzed roles", green: true },
        ].map(s => (
          <div key={s.label} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: isMobile ? "10px 14px" : "14px 18px", display: "flex", flexDirection: isMobile ? "row" : "column", alignItems: "center", gap: isMobile ? 10 : 3, textAlign: isMobile ? "left" : "center" }}>
            <p style={{ fontSize: isMobile ? 22 : 26, fontWeight: 900, color: s.green ? "#4ade80" : "#fff", letterSpacing: -1, lineHeight: 1.1, flexShrink: 0 }}>{s.value}</p>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.65)", lineHeight: 1.4 }}>{s.label}</p>
              {!isMobile && <p style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", lineHeight: 1.4 }}>{s.cap}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Snapshot table */}
      <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, overflow: "hidden" }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.85)", padding: "14px 18px 12px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          Snapshot of roles and their AI automation scores
        </p>
        {(data.roles ?? []).map(role => {
          const color = scoreColor(role.overallAutomationScore);
          // Task mix → stacked distribution bar (manual / augmentable / automatable)
          const tot   = role.tasks.length;
          const lowP  = tot ? Math.round(role.tasks.filter(t => t.automationPotential === "low").length    / tot * 100) : 0;
          const medP  = tot ? Math.round(role.tasks.filter(t => t.automationPotential === "medium").length / tot * 100) : 0;
          const highP = tot ? 100 - lowP - medP : 0;
          const distTitle = `Task mix · ${lowP}% manual · ${medP}% AI-augmentable · ${highP}% automatable`;
          return (
            <div
              key={role.analysisId}
              onClick={() => onRoleSelect(role)}
              style={{
                display:     "flex",
                alignItems:  "center",
                padding:     isMobile ? "12px 14px" : "10px 18px",
                gap:         isMobile ? 10 : 14,
                cursor:      "pointer",
                borderTop:   "1px solid rgba(255,255,255,0.05)",
                transition:  "background .12s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {role.jobTitle}
              </span>
              {!isMobile && (
                <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "2px 8px", whiteSpace: "nowrap" }}>
                  {role.department}
                </span>
              )}
              {!isMobile && (
                <span style={{ flexShrink: 0, fontSize: 11, color: "#4ade80", fontWeight: 600, whiteSpace: "nowrap" }}>
                  {role.estimatedHoursSavedPerWeek}h/wk
                </span>
              )}
              <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, width: 30, textAlign: "right", color }}>
                {role.overallAutomationScore}
              </span>
              {!isMobile && (
                <div title={distTitle} style={{ flex: "0 0 96px", height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden", display: "flex", cursor: "help" }}>
                  <div style={{ height: "100%", width: `${lowP}%`,  background: "#4ade80" }} />
                  <div style={{ height: "100%", width: `${medP}%`,  background: "#fbbf24" }} />
                  <div style={{ height: "100%", width: `${highP}%`, background: "#f87171" }} />
                </div>
              )}
              <span style={{ flexShrink: 0, color: "#FD5A0F", fontSize: 17, fontWeight: 700, lineHeight: 1, textShadow: "0 0 8px rgba(253,90,15,0.75), 0 0 2px rgba(253,90,15,0.9)" }}>›</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── AI opportunity card (expandable description) ─────────────────────────────────
function OpportunityCard({ opp }: { opp: WizardRole["aiOpportunities"][number] }) {
  const [expanded, setExpanded] = useState(false);
  const impColor = opp.impact === "high" ? "#f87171" : opp.impact === "medium" ? "#fbbf24" : "#4ade80";
  const impBd    = opp.impact === "high" ? "rgba(248,113,113,0.25)" : opp.impact === "medium" ? "rgba(251,191,36,0.25)" : "rgba(74,222,128,0.25)";
  // Only offer the toggle when the text would actually clamp (~3 lines).
  const isLong = opp.description.length > 150;
  const clamp  = isLong && !expanded;

  return (
    <div
      style={{
        background:    "rgba(255,255,255,0.04)",
        border:        "1px solid rgba(255,255,255,0.09)",
        borderRadius:  12,
        padding:       16,
        display:       "flex",
        flexDirection: "column",
        gap:           8,
        transition:    "transform .15s, border-color .15s",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform   = "translateY(-2px)";
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.16)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform   = "translateY(0)";
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.09)";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, borderRadius: 4, padding: "2px 8px", background: "transparent", color: impColor, border: `1px solid ${impBd}` }}>
          {opp.impact} impact
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, borderRadius: 4, padding: "2px 8px", background: "transparent", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.12)" }}>
          {EFFORT_LABEL[opp.effort]}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "#4ade80" }}>{opp.estimatedTimeSaving}</span>
      </div>
      <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.4 }}>{opp.title}</p>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.65, ...(clamp ? { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" } : {}) }}>
        {opp.description}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(v => !v)}
          style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.5)", transition: "color .12s" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
        >
          {expanded ? "Show less" : "Show more"}
          <span style={{ fontSize: 9, transform: expanded ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▾</span>
        </button>
      )}
      {opp.tools.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 2 }}>
          {opp.tools.map(t => (
            <span key={t} style={{ fontSize: 10, fontWeight: 600, background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", borderRadius: 4, padding: "2px 8px" }}>
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Role detail ────────────────────────────────────────────────────────────────
function RoleDetail({ role, onBack, isMobile }: { role: WizardRole; onBack: () => void; isMobile?: boolean }) {
  const [sort, setSort] = useState<"score" | "level">("score");

  const highCount = role.tasks.filter(t => t.automationPotential === "high").length;
  const total     = role.tasks.length;
  const lowPct    = total > 0 ? Math.round(role.tasks.filter(t => t.automationPotential === "low").length    / total * 100) : 0;
  const medPct    = total > 0 ? Math.round(role.tasks.filter(t => t.automationPotential === "medium").length / total * 100) : 0;
  const highPct   = 100 - lowPct - medPct;

  const sortedTasks = [...role.tasks].sort((a, b) =>
    sort === "score"
      ? b.automationScore - a.automationScore
      : LEVEL_ORDER[a.automationPotential] - LEVEL_ORDER[b.automationPotential]
  );

  return (
    <>
      <button
        onClick={onBack}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", padding: "0 0 4px", transition: "color .12s" }}
        onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
        onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
      >
        ← Back to roles
      </button>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "10px 0 10px", flexWrap: "wrap" }}>
        <h2 style={{ fontSize: "clamp(18px,2.4vw,26px)", fontWeight: 800, letterSpacing: -0.3, color: "#fff" }}>
          {role.jobTitle}
        </h2>
        <span style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 20, padding: "3px 12px", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>
          {role.department}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
          AI Readiness{" "}
          <strong style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{role.aiReadinessScore}%</strong>
        </div>
      </div>

      {/* KPI chips */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { val: `${role.estimatedHoursSavedPerWeek}h`, color: "#4ade80", label: "estimated hours\nsaved per week" },
          { val: `${highCount}/${total}`,               color: "#f87171", label: "high-automation\ntasks" },
          { val: `${role.aiReadinessScore}%`,           color: "#6094FF", label: "AI readiness\nscore" },
        ].map(c => (
          <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 13px" }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: c.color }}>{c.val}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.4, whiteSpace: "pre-line" }}>{c.label}</span>
          </div>
        ))}
      </div>

      {/* Executive summary */}
      {role.executiveSummary && (
        <div style={{ background: "rgba(96,148,255,0.06)", border: "1px solid rgba(96,148,255,0.2)", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#6094FF", marginBottom: 6 }}>AI Impact Summary</p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.7 }}>{role.executiveSummary}</p>
        </div>
      )}

      {/* Skills snapshot */}
      <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Skills Snapshot</p>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 12 }}>
          {([
            { label: "Future-Proof", skills: role.skillsAnalysis.futureProof,  cls: "#4ade80" },
            { label: "AI-Augmented", skills: role.skillsAnalysis.aiAugmented,   cls: "#fbbf24" },
            { label: "At Risk",      skills: role.skillsAnalysis.atRisk,        cls: "#f87171" },
          ] as const).map(g => (
            <div key={g.label}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: g.cls, marginBottom: 6 }}>{g.label}</p>
              {g.skills.length === 0
                ? <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>—</span>
                : g.skills.map(s => (
                    <span key={s} style={{ display: "inline-block", fontSize: 12, margin: "2px 14px 2px 0", lineHeight: 1.7, color: "#fff" }}>
                      {s}
                    </span>
                  ))
              }
            </div>
          ))}
        </div>
      </div>

      {/* Automation by category */}
      {role.automationByCategory.length > 0 && (
        <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Automation by Task Category</p>
          {role.automationByCategory.map(c => {
            const col = scoreColor(c.score);
            return (
              <div key={c.category} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", flex: "0 0 160px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.category}</span>
                <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 3, width: `${c.score}%`, background: col, transition: "width .6s ease" }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: col, flexShrink: 0, width: 30, textAlign: "right" }}>{c.score}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Task automation section */}
      <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, color: "#fff" }}>Task Automation Potential</p>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 12, lineHeight: 1.5 }}>Sorted by automation score. Each task scored 0–100.</p>

      {/* Stacked bar */}
      <div style={{ height: 8, borderRadius: 4, overflow: "hidden", display: "flex", marginBottom: 10 }}>
        <div style={{ width: `${lowPct}%`,  background: "#4ade80" }} />
        <div style={{ width: `${medPct}%`,  background: "#fbbf24" }} />
        <div style={{ width: `${highPct}%`, background: "#f87171" }} />
      </div>

      {/* Legend + sort */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { color: "#4ade80", label: `${lowPct}% Low` },
          { color: "#fbbf24", label: `${medPct}% Medium` },
          { color: "#f87171", label: `${highPct}% High` },
        ].map(l => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: l.color, flexShrink: 0 }} />
            {l.label}
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
          Sort by:
          {(["score", "level"] as const).map(s => (
            <button
              key={s}
              onClick={() => setSort(s)}
              style={{
                background:   sort === s ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)",
                border:       sort === s ? "1px solid rgba(255,255,255,0.25)" : "1px solid rgba(255,255,255,0.12)",
                borderRadius: 5,
                padding:      "3px 9px",
                fontSize:     11,
                fontWeight:   600,
                color:        sort === s ? "#fff" : "rgba(255,255,255,0.6)",
                cursor:       "pointer",
                transition:   "background .12s, color .12s",
              }}
            >
              {s === "score" ? "Score" : "Level"}
            </button>
          ))}
        </div>
      </div>

      {/* Task cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 24 }}>
        {sortedTasks.map((task, i) => {
          const pot = task.automationPotential;
          const borderColor = pot === "high" ? "#f87171" : pot === "medium" ? "#fbbf24" : "#4ade80";
          const badgeBg     = pot === "high" ? "rgba(248,113,113,0.12)" : pot === "medium" ? "rgba(251,191,36,0.12)" : "rgba(74,222,128,0.12)";
          const badgeBorder = pot === "high" ? "rgba(248,113,113,0.25)" : pot === "medium" ? "rgba(251,191,36,0.25)" : "rgba(74,222,128,0.25)";
          return (
            <div
              key={i}
              style={{
                background:   "rgba(255,255,255,0.04)",
                border:       "1px solid rgba(255,255,255,0.09)",
                borderTop:    `3px solid ${borderColor}`,
                borderRadius: 12,
                padding:      16,
                display:      "flex",
                flexDirection: "column",
                gap:          8,
                transition:   "transform .15s, border-color .15s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.transform    = "translateY(-2px)";
                (e.currentTarget as HTMLDivElement).style.borderColor  = "rgba(255,255,255,0.16)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.transform    = "translateY(0)";
                (e.currentTarget as HTMLDivElement).style.borderColor  = "rgba(255,255,255,0.09)";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, borderRadius: 5, padding: "3px 9px", background: badgeBg, color: borderColor, border: `1px solid ${badgeBorder}` }}>
                  {pot}
                </span>
                <span style={{ fontSize: 26, fontWeight: 900, lineHeight: 1, letterSpacing: -1, color: borderColor }}>
                  {task.automationScore}
                </span>
              </div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.4 }}>{task.name}</p>
              <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.4 }}>{task.category}</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {task.aiOpportunity}
              </p>
              {task.scoringRationale && (
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", lineHeight: 1.5, fontStyle: "italic", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 6, marginTop: 2 }}>
                  {task.scoringRationale}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* AI Opportunities */}
      {role.aiOpportunities.length > 0 && (
        <>
          <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: "#fff" }}>AI Implementation Opportunities</p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 14, lineHeight: 1.5 }}>
            Highest-value AI tools and strategies for this role, ranked by potential impact.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
            {role.aiOpportunities.map((opp, i) => (
              <OpportunityCard key={i} opp={opp} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────
export default function Step4Roles({ company, data, activeRole, isMobile, onRoleSelect, onRequestAnalysis }: Props) {
  void onRequestAnalysis;

  return (
    <div style={{
      flex:       1,
      width:      "100%",
      height:     "100%",
      overflowY:  "auto",
      padding:    isMobile ? "20px 16px 0" : "28px 40px 0",
      scrollbarWidth: "thin",
      scrollbarColor: "rgba(255,255,255,0.15) transparent",
    }}>
      <div style={{ width: "100%", maxWidth: 880, margin: "0 auto", paddingBottom: 28 }}>
        {activeRole
          ? <RoleDetail role={activeRole} onBack={() => onRoleSelect(null)} isMobile={isMobile} />
          : <RoleList   company={company} data={data} onRoleSelect={onRoleSelect} isMobile={isMobile} />
        }
      </div>
    </div>
  );
}
