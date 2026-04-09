"use client";
import { useState, useEffect } from "react";

// ─── CONFIG (swap per prospect) ───
const COMPANY = "thyssenkrupp AG";
const COMPANY_LOGO = `/api/logo?domain=thyssenkrupp.com`;
const ROLES_ANALYZED = 10;
const TOTAL_ROLES = 100;
const TOP_SCORE = 67;
const HOURS_SAVED = 72;
const ANNUAL_SAVINGS = "€194K";
const REPORT_DATE = "8 Apr 2026";
const DEPT_COUNT = 8;

// ─── iMocha Logo SVG ───
function IMochaLogo({ size = 28 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.25, background: "linear-gradient(135deg,#ff6700,#ff8c3a)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 900, color: "#fff", flexShrink: 0 }}>iM</div>
  );
}

// ─── Live Badge ───
function LiveBadge({ label = "LIVE DATA" }: { label?: string }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, background: "rgba(255,50,50,0.08)", border: "1px solid rgba(255,50,50,0.15)" }}>
      <style>{`@keyframes liveBlink{0%,100%{opacity:1;box-shadow:0 0 6px rgba(255,50,50,0.6)}50%{opacity:0.3;box-shadow:0 0 2px rgba(255,50,50,0.2)}}`}</style>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#ff3333", animation: "liveBlink 1.4s ease-in-out infinite" }} />
      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: "#ff4444" }}>{label}</span>
    </div>
  );
}

// ─── Company Logo ───
function CompanyLogo({ src, name, size = 36 }: { src: string | null; name: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 8, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0, border: "1px solid rgba(255,255,255,0.1)" }}>
      {src
        ? <img src={src} alt={name} style={{ width: "80%", height: "80%", objectFit: "contain" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
        : <span style={{ fontSize: size * 0.3, fontWeight: 800, color: "#333" }}>{name.substring(0, 2).toUpperCase()}</span>}
    </div>
  );
}

// ─── Logo Bar ───
function LogoBar({ dark = true }: { dark?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <CompanyLogo src={COMPANY_LOGO} name={COMPANY} size={32} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
        <div style={{ width: 12, height: 1, background: dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)" }} />
        <span style={{ fontSize: 7, color: dark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)", fontWeight: 600 }}>×</span>
        <div style={{ width: 12, height: 1, background: dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)" }} />
      </div>
      <IMochaLogo size={32} />
    </div>
  );
}

// ─── Live Cost Ticker ───
function CostTicker() {
  const [start] = useState(Date.now());
  const [val, setVal] = useState("0.00");
  useEffect(() => {
    const costPerSec = (HOURS_SAVED * 52) / (40 * 3600);
    const iv = setInterval(() => {
      setVal(((Date.now() - start) / 1000 * costPerSec * 52).toFixed(2));
    }, 50);
    return () => clearInterval(iv);
  }, [start]);
  return <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 900 }}>€{val}</span>;
}

// ═══════════════════════════════════════════
// VARIATION 1 — "THE WAR ROOM"
// For: CHRO / C-Suite
// ═══════════════════════════════════════════
function Variation1() {
  return (
    <div style={{ background: "linear-gradient(160deg, #0c0a12 0%, #12080a 40%, #0a0810 100%)", borderRadius: 20, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)", position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.008) 2px, rgba(255,255,255,0.008) 4px)", pointerEvents: "none", zIndex: 1 }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", borderBottom: "1px solid rgba(255,50,50,0.08)", background: "rgba(255,50,50,0.02)", position: "relative", zIndex: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LiveBadge label="LIVE FROM CAREERS PAGE" />
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", letterSpacing: 0.5 }}>Last scanned: {REPORT_DATE}</span>
        </div>
        <LogoBar />
      </div>

      <div style={{ padding: "32px 24px 28px", position: "relative", zIndex: 2 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 14px", borderRadius: 4, border: "1px solid rgba(255,103,0,0.2)", background: "rgba(255,103,0,0.04)", marginBottom: 16 }}>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: "#ff6700" }}>CONFIDENTIAL WORKFORCE INTELLIGENCE</span>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.15)" }}>•</span>
          <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.25)" }}>PREPARED FOR {COMPANY.toUpperCase()} LEADERSHIP</span>
        </div>

        <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.2, color: "#fff", maxWidth: 560, marginBottom: 8 }}>
          We scraped your careers page.<br />
          <span style={{ color: "#ff4444" }}>{TOTAL_ROLES} roles are bleeding hours</span><br />
          your team doesn&apos;t know about.
        </div>

        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.7, maxWidth: 500, marginBottom: 20 }}>
          Our AI analyzed every open position at {COMPANY} — scoring each role&apos;s automation potential, mapping task-level waste, and calculating the exact cost of inaction. This isn&apos;t a pitch. It&apos;s a mirror.
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
          <div style={{ padding: "10px 16px", borderRadius: 10, background: "rgba(255,50,50,0.06)", border: "1px solid rgba(255,50,50,0.1)", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#ff3333", animation: "liveBlink 1.4s ease-in-out infinite" }} />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Burning right now: </span>
            <span style={{ fontSize: 16, color: "#ff4444" }}><CostTicker /></span>
          </div>
          <div style={{ padding: "10px 16px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Annual exposure: </span>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#ff6700" }}>{ANNUAL_SAVINGS}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <a href="/preview/report" style={{ padding: "15px 28px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#ff3333,#ff6700)", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 30px rgba(255,50,50,0.25)", letterSpacing: 0.3, textDecoration: "none", display: "inline-block" }}>
            See What You&apos;re Losing →
          </a>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", maxWidth: 200 }}>No signup required. Your data is already analyzed.</span>
        </div>
      </div>

      <div style={{ padding: "8px 20px", borderTop: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.01)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative", zIndex: 2 }}>
        <span style={{ fontSize: 8, color: "rgba(255,255,255,0.12)", letterSpacing: 1 }}>REPORT ID: TK-AI-{typeof window !== "undefined" ? Date.now().toString(36).toUpperCase() : "PREVIEW"}</span>
        <span style={{ fontSize: 8, color: "rgba(255,255,255,0.12)", letterSpacing: 1 }}>POWERED BY iMOCHA AI ENGINE</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// VARIATION 2 — "THE BENCHMARK WAKE-UP"
// For: VP HR / SVP HR
// ═══════════════════════════════════════════
function Variation2() {
  return (
    <div style={{ background: "#faf9f7", borderRadius: 20, overflow: "hidden", border: "1px solid #e8e5df", position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", borderBottom: "1px solid #e8e5df" }}>
        <LogoBar dark={false} />
        <LiveBadge label="LIVE ANALYSIS" />
      </div>

      <div style={{ padding: "32px 24px 28px" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
          <div style={{ padding: "4px 12px", borderRadius: 6, background: "#1a1a2e", color: "#fff", fontSize: 9, fontWeight: 700, letterSpacing: 1.5 }}>FOR HR LEADERSHIP</div>
          <div style={{ padding: "4px 12px", borderRadius: 6, background: "rgba(255,103,0,0.08)", border: "1px solid rgba(255,103,0,0.15)", color: "#ff6700", fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>{COMPANY}</div>
        </div>

        <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.15, color: "#1a1a2e", maxWidth: 580, marginBottom: 8, fontFamily: "'Playfair Display','Georgia',serif" }}>
          {HOURS_SAVED} hours every week.<br />
          Your HR team is doing work<br />
          <span style={{ color: "#ff6700", textDecoration: "underline", textDecorationColor: "rgba(255,103,0,0.3)", textUnderlineOffset: 4 }}>that machines already handle.</span>
        </div>

        <div style={{ fontSize: 14, color: "#666", lineHeight: 1.7, maxWidth: 500, marginBottom: 22, fontFamily: "'Source Serif 4','Georgia',serif" }}>
          We analyzed {TOTAL_ROLES} open roles on {COMPANY}&apos;s careers page against industry automation benchmarks. The gap is significant — and every week you don&apos;t act, it costs {ANNUAL_SAVINGS} annually in buried productivity.
        </div>

        <div style={{ display: "flex", gap: 0, marginBottom: 24, maxWidth: 420 }}>
          <div style={{ flex: 1, padding: "14px 16px", background: "rgba(255,103,0,0.05)", borderRadius: "12px 0 0 12px", border: "1px solid rgba(255,103,0,0.1)", borderRight: "none" }}>
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1.5, color: "#999", marginBottom: 6 }}>YOUR SCORE</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#ff6700", fontFamily: "'DM Mono',monospace" }}>{Math.round(ROLES_ANALYZED * TOP_SCORE / ROLES_ANALYZED)}%</div>
            <div style={{ fontSize: 10, color: "#999" }}>automation ready</div>
          </div>
          <div style={{ flex: 1, padding: "14px 16px", background: "rgba(74,222,128,0.04)", borderRadius: "0 12px 12px 0", border: "1px solid rgba(74,222,128,0.1)" }}>
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1.5, color: "#999", marginBottom: 6 }}>INDUSTRY AVG</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#16a34a", fontFamily: "'DM Mono',monospace" }}>78%</div>
            <div style={{ fontSize: 10, color: "#999" }}>automation ready</div>
          </div>
        </div>

        <a href="/preview/report" style={{ padding: "15px 30px", borderRadius: 12, border: "none", background: "#1a1a2e", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", textDecoration: "none", display: "inline-block" }}>
          See Where You Stand — Full Report →
        </a>
        <div style={{ marginTop: 10, fontSize: 11, color: "#aaa" }}>Personalized for {COMPANY} · {TOTAL_ROLES} roles analyzed · No signup needed</div>
      </div>

      <div style={{ padding: "10px 20px", borderTop: "1px solid #e8e5df", background: "#f5f3ef", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 9, color: "#bbb", letterSpacing: 0.5 }}>Data sourced from {COMPANY}&apos;s public careers page · AI analysis by iMocha</span>
        <span style={{ fontSize: 9, color: "#bbb" }}>{REPORT_DATE}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// VARIATION 3 — "THE COUNTDOWN"
// For: CDO / VP Digital Transformation
// ═══════════════════════════════════════════
function Variation3() {
  const [rolesTicked, setRolesTicked] = useState(0);
  useEffect(() => {
    if (rolesTicked >= TOTAL_ROLES) return;
    const t = setTimeout(() => setRolesTicked(r => Math.min(r + 1, TOTAL_ROLES)), 30);
    return () => clearTimeout(t);
  }, [rolesTicked]);

  return (
    <div style={{ background: "linear-gradient(160deg, #020617 0%, #0a0f1e 50%, #081020 100%)", borderRadius: 20, overflow: "hidden", border: "1px solid rgba(56,189,248,0.08)", position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(56,189,248,0.04) 1px, transparent 1px)", backgroundSize: "20px 20px", pointerEvents: "none" }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", borderBottom: "1px solid rgba(56,189,248,0.06)", position: "relative", zIndex: 2 }}>
        <LogoBar />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LiveBadge label="LIVE SCAN" />
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>{DEPT_COUNT} departments mapped</span>
        </div>
      </div>

      <div style={{ padding: "28px 24px 24px", position: "relative", zIndex: 2 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 12px", borderRadius: 6, background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.1)", marginBottom: 16 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: "#38bdf8" }}>DIGITAL TRANSFORMATION INTELLIGENCE</span>
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 20, marginBottom: 12 }}>
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 56, fontWeight: 900, color: "#38bdf8", fontFamily: "'DM Mono',monospace", lineHeight: 1 }}>{rolesTicked}</div>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1.5, color: "rgba(56,189,248,0.4)", marginTop: 2 }}>ROLES SCANNED</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.2, color: "#fff" }}>
              Your digital transformation<br />has a <span style={{ color: "#f97316" }}>workforce blind spot</span>.
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.7, marginTop: 8, maxWidth: 420 }}>
              We mapped every open role at {COMPANY} across {DEPT_COUNT} departments against automation maturity benchmarks. Your tech stack is modern — but your workflows aren&apos;t keeping up.
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 22 }}>
          {(["HR","IT Ops","Finance","Logistics","Quality","Procurement","Marketing","Legal"] as const).map((d, i) => {
            const scores = [67, 42, 38, 45, 35, 33, 28, 22];
            const benchmarks = [72, 68, 58, 65, 55, 52, 48, 40];
            const behind = scores[i] < benchmarks[i];
            return (
              <div key={d} style={{ padding: "8px 12px", borderRadius: 8, background: behind ? "rgba(249,115,22,0.06)" : "rgba(74,222,128,0.06)", border: `1px solid ${behind ? "rgba(249,115,22,0.12)" : "rgba(74,222,128,0.12)"}`, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{d}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: behind ? "#f97316" : "#4ade80", fontFamily: "'DM Mono',monospace" }}>{scores[i]}</span>
                <span style={{ fontSize: 8, color: "rgba(255,255,255,0.2)" }}>/{benchmarks[i]}</span>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <a href="/preview/report" style={{ padding: "15px 28px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#38bdf8,#0ea5e9)", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 30px rgba(56,189,248,0.2)", textDecoration: "none", display: "inline-block" }}>
            View Full Maturity Assessment →
          </a>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>Interactive report · {DEPT_COUNT} departments · {TOTAL_ROLES} roles</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// VARIATION 4 — "THE SKILLS TIME BOMB"
// For: Head of L&D / Talent Development
// ═══════════════════════════════════════════
function Variation4() {
  const atRiskSkills = ["HR Administration", "SAP Data Entry", "ATOSS Time Tracking", "Workday Data Mgmt", "Manual Reporting", "Excel Reconciliation"];
  const futureSkills = ["People Analytics", "AI-Augmented HR", "Workforce Planning", "Change Management"];
  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    if (revealed >= atRiskSkills.length) return;
    const t = setTimeout(() => setRevealed(r => r + 1), 400);
    return () => clearTimeout(t);
  }, [revealed, atRiskSkills.length]);

  return (
    <div style={{ background: "linear-gradient(160deg, #1a0e08 0%, #12080a 50%, #0a0810 100%)", borderRadius: 20, overflow: "hidden", border: "1px solid rgba(255,179,71,0.08)", position: "relative" }}>
      <div style={{ position: "absolute", top: -60, left: "30%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,179,71,0.06),transparent 70%)", pointerEvents: "none" }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", borderBottom: "1px solid rgba(255,179,71,0.06)", position: "relative", zIndex: 2 }}>
        <LogoBar />
        <LiveBadge label="LIVE SKILLS SCAN" />
      </div>

      <div style={{ padding: "28px 24px 24px", position: "relative", zIndex: 2 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <div style={{ padding: "4px 12px", borderRadius: 6, background: "rgba(255,179,71,0.08)", border: "1px solid rgba(255,179,71,0.12)", color: "#ffb347", fontSize: 9, fontWeight: 700, letterSpacing: 1.5 }}>SKILLS INTELLIGENCE REPORT</div>
          <div style={{ padding: "4px 12px", borderRadius: 6, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)", fontSize: 9, fontWeight: 600 }}>FOR L&amp;D LEADERSHIP</div>
        </div>

        <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.2, color: "#fff", maxWidth: 560, marginBottom: 6 }}>
          <span style={{ color: "#ff4444" }}>{atRiskSkills.length} skills</span> across {COMPANY}&apos;s<br />
          workforce are going <span style={{ color: "#ff4444", position: "relative" }}>obsolete
            <span style={{ position: "absolute", bottom: -2, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#ff4444,transparent)", borderRadius: 1 }} />
          </span>.
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.7, maxWidth: 480, marginBottom: 20 }}>
          We scanned every open role and mapped the skills your people are using today vs. what AI will replace in 12–18 months.
        </div>

        <div style={{ display: "flex", gap: 20, marginBottom: 22, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 200px" }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: "#ff4444", marginBottom: 8 }}>⚠ AT-RISK SKILLS DETECTED</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {atRiskSkills.map((skill, i) => (
                <div key={skill} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 8,
                  background: i < revealed ? "rgba(255,68,68,0.06)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${i < revealed ? "rgba(255,68,68,0.12)" : "rgba(255,255,255,0.04)"}`,
                  opacity: i < revealed ? 1 : 0.3,
                  transition: "all 0.5s ease",
                  transform: i < revealed ? "translateX(0)" : "translateX(8px)",
                }}>
                  <span style={{ fontSize: 10, color: i < revealed ? "#ff4444" : "rgba(255,255,255,0.15)" }}>!</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: i < revealed ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.15)", textDecoration: i < revealed ? "line-through" : "none", textDecorationColor: "rgba(255,68,68,0.3)" }}>{skill}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex: "1 1 200px" }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: "#4ade80", marginBottom: 8 }}>✦ RESKILLING OPPORTUNITIES</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {futureSkills.map(skill => (
                <div key={skill} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 8, background: "rgba(74,222,128,0.04)", border: "1px solid rgba(74,222,128,0.08)" }}>
                  <span style={{ fontSize: 10, color: "#4ade80" }}>↑</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(74,222,128,0.6)" }}>{skill}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <a href="/preview/report" style={{ padding: "15px 28px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#ffb347,#ff8c3a)", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 30px rgba(255,179,71,0.2)", textDecoration: "none", display: "inline-block" }}>
            See Full Skills Risk Report →
          </a>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>{TOTAL_ROLES} roles · {atRiskSkills.length} at-risk skills · Reskilling pathways included</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// PAGE — All 4 Variations
// ═══════════════════════════════════════════
export default function PreviewPage() {
  const [active, setActive] = useState(0);
  const variants = [
    { label: "CHRO — War Room",    comp: <Variation1 />, persona: "C-Suite / CHRO" },
    { label: "VP HR — Benchmark",  comp: <Variation2 />, persona: "VP / SVP HR" },
    { label: "CDO — Maturity",     comp: <Variation3 />, persona: "CDO / Digital Transformation" },
    { label: "L&D — Skills",       comp: <Variation4 />, persona: "Head of L&D" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#08060e", padding: "32px 20px", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&family=DM+Mono:wght@400;500&family=Playfair+Display:wght@700;800;900&family=Source+Serif+4:wght@400;600&display=swap');`}</style>

      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2.5, color: "#ff6700", marginBottom: 8 }}>HERO BANNER VARIATIONS</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>4 Persona-Targeted Report Headers</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>Each designed to make a specific persona feel &quot;this was made for me&quot;</div>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap", justifyContent: "center" }}>
          {variants.map((v, i) => (
            <button key={i} onClick={() => setActive(i)} style={{
              padding: "8px 16px", borderRadius: 10, border: "1px solid",
              borderColor: active === i ? "#ff6700" : "rgba(255,255,255,0.08)",
              background: active === i ? "rgba(255,103,0,0.1)" : "transparent",
              color: active === i ? "#ff6700" : "rgba(255,255,255,0.35)",
              fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
            }}>
              {v.label}
            </button>
          ))}
        </div>

        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <span style={{ padding: "4px 14px", borderRadius: 20, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>
            Target: {variants[active].persona}
          </span>
        </div>

        <div key={active}>
          {variants[active].comp}
        </div>

        <div style={{ textAlign: "center", marginTop: 24 }}>
          <a href="/preview/report" style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", textDecoration: "none" }}>
            → View full enhanced report page
          </a>
        </div>
      </div>
    </div>
  );
}
