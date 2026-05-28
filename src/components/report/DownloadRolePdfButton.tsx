"use client";

import { useState } from "react";

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
  const [state,   setState]   = useState<"idle" | "loading" | "done">("idle");
  const [hovered, setHovered] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (state !== "idle") return;
    setState("loading");

    try {
      const res = await fetch(
        `/api/report/${companyId}/${analysisId}/pdf?token=${encodeURIComponent(token)}`
      );
      if (!res.ok) throw new Error("PDF generation failed");

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${title.replace(/[^a-zA-Z0-9]/g, "_")}_AI_Report.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      setState("done");
      setTimeout(() => setState("idle"), 3000);
    } catch {
      setState("idle");
    }
  };

  const isDone    = state === "done";
  const isLoading = state === "loading";

  const bg    = isDone ? "#ecfdf5" : hovered && !isLoading ? "#FD5A0F" : "#FFF0EA";
  const color = isDone ? "#059669" : hovered && !isLoading ? "#fff"    : "#FD5A0F";
  const border = isDone ? "1px solid #a7f3d0" : "1px solid #FDBB96";

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={isLoading}
      title="Download PDF report"
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
        padding: "7px 16px", borderRadius: 10, border,
        background: bg, color,
        fontSize: 12, fontWeight: 700,
        cursor: isLoading ? "not-allowed" : "pointer",
        opacity: isLoading ? 0.6 : 1,
        transition: "background 0.15s, color 0.15s",
        flexShrink: 0,
      }}
    >
      {isLoading ? (
        <>
          <svg style={{ animation: "spin 0.8s linear infinite" }} width="12" height="12" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.25"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </>
      ) : isDone ? (
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : (
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
          <path d="M12 2v10m0 0l-3-3m3 3l3-3M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
      {isLoading ? "…" : isDone ? "Saved" : "PDF"}
    </button>
  );
}
