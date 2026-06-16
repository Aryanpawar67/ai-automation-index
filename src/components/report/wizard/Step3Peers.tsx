"use client";

import type { CompanyWizardData } from "@/lib/report/aggregate";
import WizardRadarChart           from "./WizardRadarChart";

interface Props {
  company:   string;
  data:      CompanyWizardData;
  isMobile?: boolean;
}

export default function Step3Peers({ company, data, isMobile }: Props) {
  const topDept = data.departmentRadar.length > 0
    ? data.departmentRadar.reduce((a, b) => a.score > b.score ? a : b).department
    : null;

  const textBlock = (
    <div style={{ flex: isMobile ? "none" : "0 0 360px" }}>
      <h1 style={{
        fontSize:      "clamp(20px,2.8vw,34px)",
        fontWeight:    800,
        lineHeight:    1.2,
        letterSpacing: -0.3,
        marginBottom:  16,
        color:         "#fff",
      }}>
        How <span style={{ color: "#4ade80" }}>{company}</span> benchmarks against the industry
      </h1>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.75, marginBottom: 14 }}>
        This chart benchmarks {company}&apos;s automation potential across departments, relative to an illustrative industry baseline. Departments further from the center show greater AI opportunity.
      </p>
      {topDept && (
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.75, marginBottom: 14 }}>
          For {company},{" "}
          <span style={{ color: "#4ade80", fontWeight: 600 }}>{topDept}</span>
          {" "}shows greater AI opportunity than the illustrative industry baseline.
        </p>
      )}

      {/* Legend */}
      <div style={{ display: "flex", flexDirection: isMobile ? "row" : "column", gap: isMobile ? 16 : 8, marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FD5A0F", flexShrink: 0 }} />
          {company}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(74,222,128,0.7)", flexShrink: 0 }} />
          Industry avg (illustrative)
        </div>
      </div>

      {!isMobile && (
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", fontStyle: "italic", lineHeight: 1.5, marginTop: 20 }}>
          Note: Axes are scaled for clarity. Industry average is illustrative.
        </p>
      )}
    </div>
  );

  const radarBlock = (
    <div style={{ flex: 1, minWidth: 0 }}>
      <WizardRadarChart
        labels={data.departmentRadar.map(d => d.department)}
        company={data.departmentRadar.map(d => d.score)}
        peers={data.peerBaseline.map(d => d.score)}
      />
    </div>
  );

  return (
    <div style={{
      display:       "flex",
      flexDirection: isMobile ? "column" : "row",
      alignItems:    isMobile ? "stretch" : "center",
      gap:           isMobile ? 16 : 64,
      maxWidth:      1060,
      width:         "100%",
      paddingTop:    isMobile ? 20 : 0,
      paddingBottom: isMobile ? 20 : 0,
    }}>
      {isMobile ? <>{radarBlock}{textBlock}</> : <>{textBlock}{radarBlock}</>}
    </div>
  );
}
