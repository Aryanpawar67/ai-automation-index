"use client";

import { mapToCluster, type CompanyWizardData } from "@/lib/report/aggregate";
import WizardRadarChart           from "./WizardRadarChart";

interface Props {
  company:   string;
  data:      CompanyWizardData;
  isMobile?: boolean;
}

export default function Step3Peers({ company, data, isMobile }: Props) {
  // Build the headline from the company's REAL analysed functions only — never
  // from the hardcoded fallback axes (clusters with no roles), and avoiding
  // single-role flukes. The wording is driven by the ACTUAL plotted gap
  // (company score vs the industry-average line) so the writeup can never
  // contradict what the chart shows.
  const baselineFor = (dept: string) =>
    data.peerBaseline.find(p => p.department === dept)?.score ?? 55;

  const clusterStats = new Map<string, { count: number; hours: number }>();
  for (const r of data.roles) {
    const c = mapToCluster(r.department);
    const s = clusterStats.get(c) ?? { count: 0, hours: 0 };
    s.count += 1;
    s.hours += r.estimatedHoursSavedPerWeek || 0;
    clusterStats.set(c, s);
  }

  const realClusters = data.departmentRadar
    .map(d => {
      const stat     = clusterStats.get(d.department) ?? { count: 0, hours: 0 };
      const baseline = baselineFor(d.department);
      return { dept: d.department, score: d.score, baseline, count: stat.count, hours: stat.hours, gap: d.score - baseline };
    })
    .filter(d => d.count > 0);

  // Prefer well-supported clusters (>= 2 roles) so a lone role can't headline;
  // fall back to all real clusters if none reach the threshold.
  const supported = realClusters.filter(d => d.count >= 2);
  const pool      = supported.length > 0 ? supported : realClusters;
  const headline  = pool.length > 0
    ? [...pool].sort((a, b) => b.gap - a.gap || b.count - a.count || b.score - a.score)[0]
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
      {headline && (
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.75, marginBottom: 14 }}>
          {(() => {
            const name    = <span style={{ color: "#4ade80", fontWeight: 600 }}>{headline.dept}</span>;
            const roleTxt = `${headline.count} role${headline.count === 1 ? "" : "s"} analysed`;
            const hrs     = Math.round(headline.hours);
            const hrTxt   = hrs > 0 ? `, ~${hrs} hrs/week recoverable` : "";
            if (headline.gap >= 3) {
              return <>For {company}, {name} shows greater AI-automation potential than the illustrative industry average — its strongest opportunity ({roleTxt}{hrTxt}).</>;
            }
            if (headline.gap > -3) {
              return <>For {company}, {name} tracks in line with the illustrative industry average and is its most automatable function ({roleTxt}{hrTxt}).</>;
            }
            return <>For {company}, {name} concentrates the most analysed roles ({roleTxt}{hrTxt}) — a near-term automation focus, with room to close the gap to the industry average.</>;
          })()}
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
