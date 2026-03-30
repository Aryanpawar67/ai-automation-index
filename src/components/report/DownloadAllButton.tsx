"use client";

import { useState } from "react";
import JSZip from "jszip";

interface AnalysisRow {
  analysisId:   string;
  jdTitle:      string;
  jdDepartment: string | null;
  overallScore: number | null;
  hoursSaved:   string | null;
  createdAt:    string;
  result:       Record<string, unknown>;
}

function sanitiseFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9 _-]/g, "").replace(/\s+/g, "_").slice(0, 80);
}

function formatAnalysisText(company: string, row: AnalysisRow): string {
  const r = row.result as {
    jobTitle?: string;
    department?: string;
    executiveSummary?: string;
    overallAutomationScore?: number;
    estimatedHoursSavedPerWeek?: number;
    tasks?: Array<{ name: string; automationScore: number; automationPotential: string; aiOpportunity?: string }>;
    aiOpportunities?: Array<{ title: string; description: string; impact: string; effort: string; estimatedTimeSaving: string; tools?: string[] }>;
    skillsAnalysis?: { futureProof?: string[]; atRisk?: string[]; aiAugmented?: string[] };
    implementationRoadmap?: Array<{ phase: string; timeline: string; items: string[] }>;
    roiHighlights?: { hoursReclaimed?: number; productivity_multiplier?: string; focusShift?: string };
  };

  const lines: string[] = [];
  const line = (s = "") => lines.push(s);
  const rule = (char = "─", n = 60) => lines.push(char.repeat(n));

  line(`${company} — AI Automation Report`);
  line("Powered by iMocha · Discover where AI creates the most impact across your workforce");
  rule("═");
  line(`Company    : ${company}`);
  line(`Role       : ${r.jobTitle ?? row.jdTitle}`);
  line(`Department : ${r.department ?? row.jdDepartment ?? "—"}`);
  line(`Generated  : ${new Date(row.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`);
  rule();
  line();

  line("SUMMARY");
  rule("─", 30);
  line(`Overall Automation Score  : ${r.overallAutomationScore ?? row.overallScore ?? "—"}%`);
  line(`Estimated Hours Saved/Week: ${r.estimatedHoursSavedPerWeek ?? row.hoursSaved ?? "—"}h`);
  line();

  if (r.executiveSummary) {
    line("EXECUTIVE SUMMARY");
    rule("─", 30);
    line(r.executiveSummary);
    line();
  }

  if (r.tasks && r.tasks.length > 0) {
    line("TASK AUTOMATION BREAKDOWN");
    rule("─", 30);
    const sorted = [...r.tasks].sort((a, b) => b.automationScore - a.automationScore);
    for (const t of sorted) {
      line(`  [${String(t.automationScore).padStart(3)}%] ${t.automationPotential.toUpperCase().padEnd(7)} ${t.name}`);
      if (t.aiOpportunity) line(`         → ${t.aiOpportunity}`);
    }
    line();
  }

  if (r.aiOpportunities && r.aiOpportunities.length > 0) {
    line("AI OPPORTUNITIES");
    rule("─", 30);
    for (const opp of r.aiOpportunities) {
      line(`  ${opp.title}`);
      line(`  Impact: ${opp.impact}  |  Effort: ${opp.effort}  |  Saving: ${opp.estimatedTimeSaving}`);
      line(`  ${opp.description}`);
      if (opp.tools && opp.tools.length > 0) line(`  Tools: ${opp.tools.join(", ")}`);
      line();
    }
  }

  if (r.skillsAnalysis) {
    line("SKILLS ANALYSIS");
    rule("─", 30);
    if (r.skillsAnalysis.futureProof?.length)  line(`  Future-Proof : ${r.skillsAnalysis.futureProof.join(", ")}`);
    if (r.skillsAnalysis.atRisk?.length)        line(`  At Risk      : ${r.skillsAnalysis.atRisk.join(", ")}`);
    if (r.skillsAnalysis.aiAugmented?.length)   line(`  AI-Augmented : ${r.skillsAnalysis.aiAugmented.join(", ")}`);
    line();
  }

  rule("═");
  line(`${company} AI Automation Report  ·  Powered by iMocha  ·  Results are indicative`);
  line("Discover how iMocha can transform your talent strategy — imocha.io");

  return lines.join("\n");
}

export default function DownloadAllButton({
  companyId,
  company,
  token,
  count,
}: {
  companyId: string;
  company:   string;
  token:     string;
  count:     number;
}) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  const handleDownload = async () => {
    setState("loading");
    try {
      const res  = await fetch(`/api/report/${companyId}/download?token=${encodeURIComponent(token)}`);
      const data = await res.json() as { company: string; analyses: AnalysisRow[] };

      const zip        = new JSZip();
      const folderName = sanitiseFilename(data.company);
      const folder     = zip.folder(folderName)!;

      // Summary CSV
      const csvLines = [
        "Role,Department,Automation Score (%),Hours Saved / Week,Potential",
        ...data.analyses.map(a => {
          const score = a.overallScore ?? 0;
          const pot   = score >= 65 ? "High" : score >= 40 ? "Medium" : "Low";
          return `"${a.jdTitle}","${a.jdDepartment ?? ""}",${score},${a.hoursSaved ?? ""},${pot}`;
        }),
      ];
      folder.file("00_Summary.csv", csvLines.join("\n"));

      // One text file per role
      data.analyses.forEach((row, i) => {
        const filename = `${String(i + 1).padStart(2, "0")}_${sanitiseFilename(row.jdTitle)}.txt`;
        folder.file(filename, formatAnalysisText(data.company, row));
      });

      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${folderName}_AI_Automation_Index.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setState("done");
      setTimeout(() => setState("idle"), 3000);
    } catch {
      setState("idle");
    }
  };

  return (
    <>
    <button
      onClick={handleDownload}
      disabled={state === "loading" || count === 0}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        fontSize: 13, padding: "7px 16px", borderRadius: 12,
        fontWeight: 600, color: "#553366", background: "#fff",
        border: "1px solid #EAE4EF", cursor: "pointer",
        opacity: state === "loading" || count === 0 ? 0.5 : 1,
        transition: "background 0.15s",
      }}
      onMouseEnter={e => { if (state === "idle") (e.currentTarget as HTMLButtonElement).style.background = "#F4EFF6"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}
    >
      {state === "loading" ? (
        <>
          <svg style={{ animation: "spin 0.8s linear infinite" }} width="14" height="14" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.25"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          Preparing…
        </>
      ) : state === "done" ? (
        <>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
            <path d="M5 13l4 4L19 7" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ color: "#059669" }}>Downloaded!</span>
        </>
      ) : (
        <>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
            <path d="M12 2v10m0 0l-3-3m3 3l3-3M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Download All ({count})
        </>
      )}
    </button>
    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
