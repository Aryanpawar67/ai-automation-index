"use client";

import { useState } from "react";

export default function RetryButton({ jobDescriptionId }: { jobDescriptionId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  const handleRetry = async () => {
    setState("loading");
    await fetch("/api/admin/retry", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ jobDescriptionId }),
    });
    setState("done");
  };

  if (state === "done") {
    return <span className="text-xs font-medium" style={{ color: "#059669" }}>Queued ✓</span>;
  }

  return (
    <button
      onClick={handleRetry}
      disabled={state === "loading"}
      className="text-xs px-2.5 py-1 rounded-lg font-medium transition-colors disabled:opacity-50"
      style={{ border: "1px solid #FDBB96", color: "#FD5A0F", background: "#FFF0EA" }}
    >
      {state === "loading" ? "Queuing…" : "Retry"}
    </button>
  );
}
