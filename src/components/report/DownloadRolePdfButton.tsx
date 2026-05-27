"use client";

import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import RolePdfDocument, { type PdfAnalysis } from "./RolePdfDocument";

export default function DownloadRolePdfButton({
  companyId,
  analysisId,
  token,
  title,
}: {
  companyId:  string;
  analysisId: string;
  token:      string;
  title:      string;
}) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (state !== "idle") return;
    setState("loading");

    try {
      const res  = await fetch(`/api/report/${companyId}/${analysisId}?token=${encodeURIComponent(token)}`);
      if (!res.ok) throw new Error("Failed to fetch analysis");
      const data = await res.json() as { company: string; analysis: { result: PdfAnalysis; createdAt: string } };

      const analysis    = data.analysis.result;
      const generatedAt = new Date(data.analysis.createdAt).toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric",
      });

      const blob     = await pdf(
        <RolePdfDocument company={data.company} analysis={analysis} generatedAt={generatedAt} />
      ).toBlob();

      const url      = URL.createObjectURL(blob);
      const a        = document.createElement("a");
      a.href         = url;
      a.download     = `${data.company.replace(/[^a-zA-Z0-9]/g, "_")}_${title.replace(/[^a-zA-Z0-9]/g, "_")}_AI_Report.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      setState("done");
      setTimeout(() => setState("idle"), 3000);
    } catch {
      setState("idle");
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={state === "loading"}
      title="Download PDF report"
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
        padding: "7px 10px", borderRadius: 10, border: "1px solid #EAE4EF",
        background: state === "done" ? "#ecfdf5" : "#fff",
        color: state === "done" ? "#059669" : "#553366",
        fontSize: 11, fontWeight: 600, cursor: state === "loading" ? "not-allowed" : "pointer",
        opacity: state === "loading" ? 0.6 : 1,
        transition: "background 0.15s, color 0.15s",
        flexShrink: 0,
      }}
    >
      {state === "loading" ? (
        <>
          <svg style={{ animation: "spin 0.8s linear infinite" }} width="12" height="12" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.25"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </>
      ) : state === "done" ? (
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : (
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
          <path d="M12 2v10m0 0l-3-3m3 3l3-3M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
      {state === "loading" ? "…" : state === "done" ? "Saved" : "PDF"}
    </button>
  );
}
