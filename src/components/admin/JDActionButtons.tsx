"use client";

import { useState } from "react";

export default function JDActionButtons({ jdId, initialStatus }: { jdId: string; initialStatus: string }) {
  const [status, setStatus] = useState(initialStatus);

  const handleAnalyse = async () => {
    setStatus("pending");
    await fetch(`/api/admin/jd/${jdId}/analyse`, { method: "POST" });
    setStatus("analyzing");
  };

  const handleSkip = async () => {
    setStatus("cancelled");
    await fetch(`/api/admin/jd/${jdId}/skip`, { method: "POST" });
  };

  if (status === "cancelled")
    return <span className="text-xs font-medium" style={{ color: "#9988AA" }}>Skipped</span>;
  if (status === "pending" || status === "analyzing")
    return <span className="text-xs font-medium" style={{ color: "#059669" }}>Queued ✓</span>;
  if (status !== "scraped") return null;

  return (
    <div className="flex gap-2 mt-2">
      <button
        onClick={handleAnalyse}
        className="text-xs px-2.5 py-1 rounded-lg font-medium transition-colors"
        style={{ border: "1px solid #C4B5D0", color: "#220133", background: "#F4EFF6" }}
      >
        Analyse →
      </button>
      <button
        onClick={handleSkip}
        className="text-xs px-2.5 py-1 rounded-lg font-medium transition-colors"
        style={{ border: "1px solid #EAE4EF", color: "#9988AA", background: "#fff" }}
      >
        Skip
      </button>
    </div>
  );
}
