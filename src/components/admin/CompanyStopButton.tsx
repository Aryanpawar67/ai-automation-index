"use client";

import { useState } from "react";

export default function CompanyStopButton({ batchId, companyId, activeCount }: {
  batchId:     string;
  companyId:   string;
  activeCount: number;
}) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  if (activeCount === 0 || state === "done") return null;

  return (
    <button
      onClick={async () => {
        setState("loading");
        await fetch(`/api/admin/company/${companyId}/stop`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ batchId }),
        });
        setState("done");
      }}
      disabled={state === "loading"}
      style={{
        fontSize: 12, padding: "7px 14px", borderRadius: 10,
        fontWeight: 600, cursor: state === "loading" ? "not-allowed" : "pointer",
        border: "1.5px solid #EAE4EF", background: "#fff", color: "#553366",
        opacity: state === "loading" ? 0.6 : 1,
        transition: "background 0.15s",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={e => { if (state !== "loading") (e.currentTarget as HTMLButtonElement).style.background = "#F4EFF6"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}
    >
      {state === "loading" ? "Stopping…" : "Stop"}
    </button>
  );
}
