"use client";

import { useState } from "react";

export default function CompanyAnalyseButton({ batchId, companyId, scrapedCount }: {
  batchId:      string;
  companyId:    string;
  scrapedCount: number;
}) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  if (scrapedCount === 0 || state === "done") return null;

  return (
    <button
      onClick={async () => {
        setState("loading");
        await fetch(`/api/admin/batches/${batchId}/analyse`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ companyId }),
        });
        setState("done");
      }}
      disabled={state === "loading"}
      style={{
        fontSize: 12, padding: "7px 16px", borderRadius: 10,
        fontWeight: 700, color: "#fff", border: "none", cursor: "pointer",
        background: "linear-gradient(135deg, #FD5A0F, #e54d0d)",
        boxShadow: "0 2px 10px rgba(253,90,15,0.3)",
        opacity: state === "loading" ? 0.6 : 1,
        transition: "opacity 0.15s, transform 0.15s",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={e => { if (state !== "loading") (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ""; }}
    >
      {state === "loading" ? "Queuing…" : `Analyse All (${scrapedCount})`}
    </button>
  );
}
