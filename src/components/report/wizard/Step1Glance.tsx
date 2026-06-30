"use client";

import { useEffect, useState } from "react";
import type { CompanyWizardData } from "@/lib/report/aggregate";

function useCountUp(target: number, duration = 1200, delay = 300) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => {
      const start = performance.now();
      function tick(now: number) {
        const t = Math.min((now - start) / duration, 1);
        setValue(Math.round((1 - Math.pow(1 - t, 3)) * target));
        if (t < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(id);
  }, [target, duration, delay]);
  return value;
}

interface Props {
  company:   string;
  data:      CompanyWizardData;
  isMobile?: boolean;
}

function StatCard({ label, value, suffix, caption, isMobile }: { label: string; value: number; suffix: string; caption: string; isMobile?: boolean }) {
  const animated = useCountUp(value);
  return (
    <div
      style={{
        background:    "rgba(255,255,255,0.05)",
        border:        "1px solid rgba(255,255,255,0.1)",
        borderRadius:  16,
        padding:       isMobile ? "18px 16px" : "32px 28px",
        display:       "flex",
        flexDirection: "column",
        alignItems:    "center",
        textAlign:     "center",
        gap:           16,
        transition:    "border-color .2s, background .2s, transform .2s",
        cursor:        "default",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor  = "rgba(74,222,128,0.3)";
        (e.currentTarget as HTMLDivElement).style.background   = "rgba(74,222,128,0.04)";
        (e.currentTarget as HTMLDivElement).style.transform    = "translateY(-2px)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor  = "rgba(255,255,255,0.1)";
        (e.currentTarget as HTMLDivElement).style.background   = "rgba(255,255,255,0.05)";
        (e.currentTarget as HTMLDivElement).style.transform    = "translateY(0)";
      }}
    >
      <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.8)", lineHeight: 1.45 }}>{label}</p>
      <p style={{ fontSize: "clamp(48px,6vw,68px)", fontWeight: 900, color: "#4ade80", lineHeight: 1, letterSpacing: -2 }}>
        {animated}{suffix}
      </p>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.55 }}>{caption}</p>
    </div>
  );
}

export default function Step1Glance({ company, data, isMobile }: Props) {
  const hoursAnimated = useCountUp(data.totalHoursSavedPerWeek);
  const isComplete = data.analysisType === "complete";

  return (
    <div style={{ width: "100%", maxWidth: 960, paddingTop: isMobile ? 24 : 0, paddingBottom: isMobile ? 24 : 0 }}>
      <h1 style={{
        fontSize:      "clamp(22px,3.5vw,40px)",
        fontWeight:    800,
        lineHeight:    1.18,
        letterSpacing: -0.4,
        marginBottom:  12,
        color:         "#fff",
      }}>
        Hi <span style={{ color: "#4ade80" }}>{company}</span>, here&apos;s your {isComplete ? "complete " : ""}AI Readiness Assessment Report
      </h1>
      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, maxWidth: 640, marginBottom: isMobile ? 20 : 36 }}>
        {isComplete ? (
          <>
            {company}&apos;s full-workforce AI readiness profile covers{" "}
            <span style={{ color: "#f59e0b", fontWeight: 500 }}>all {data.totalRolesAnalyzed} active roles</span>
            {data.functionsRepresented > 0 && (
              <> across <span style={{ color: "#f59e0b", fontWeight: 500 }}>{data.functionsRepresented} function {data.functionsRepresented === 1 ? "area" : "areas"}</span></>
            )}
            {" "}— complete coverage benchmarked for automation potential, skill disruption risk, and projected weekly time reclaimed.
          </>
        ) : (
          <>
            {company}&apos;s AI readiness profile spans{" "}
            <span style={{ color: "#4ade80", fontWeight: 500 }}>{data.totalRolesAnalyzed} roles</span>
            {data.functionsRepresented > 0 && (
              <> across <span style={{ color: "#4ade80", fontWeight: 500 }}>{data.functionsRepresented} function {data.functionsRepresented === 1 ? "area" : "areas"}</span></>
            )}
            {" "}— benchmarked for automation potential, skill disruption risk, and projected weekly time reclaimed.
          </>
        )}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: isMobile ? 12 : 20, maxWidth: 900 }}>
        <StatCard
          label="AI Implementation Opportunity"
          value={data.aiImplementationOpportunity}
          suffix="%"
          caption={`average AI readiness score across ${data.totalRolesAnalyzed} analyzed roles`}
          isMobile={isMobile}
        />
        <StatCard
          label="Task Automation Potential"
          value={data.taskAutomationPotential}
          suffix="%"
          caption="of tasks in analyzed roles identified as AI-enhanceable"
          isMobile={isMobile}
        />
        <StatCard
          label="Role Skill Adaptation Rate"
          value={data.workforceUpskillingNeeds}
          suffix="%"
          caption="of skills in analyzed job descriptions flagged as AI-augmented or at-risk"
          isMobile={isMobile}
        />
      </div>

      {/* Hours banner */}
      <div style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        gap:            14,
        marginTop:      18,
        background:     "rgba(74,222,128,0.07)",
        border:         "1px solid rgba(74,222,128,0.2)",
        borderRadius:   12,
        padding:        isMobile ? "14px 16px" : "14px 28px",
      }}>
        <span style={{ fontSize: 28, fontWeight: 900, color: "#4ade80", letterSpacing: -1, flexShrink: 0 }}>
          {hoursAnimated}h
        </span>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.55 }}>
          <strong style={{ color: "#fff", fontWeight: 600 }}>estimated hours reclaimed per week</strong>
          {" "}across all analyzed roles — time redirected to higher-value, uniquely human work
        </span>
      </div>
    </div>
  );
}
