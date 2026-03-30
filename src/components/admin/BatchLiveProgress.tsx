"use client";

import { useEffect, useState } from "react";

interface Props {
  batchId:          string;
  defaultProcessed: number;
  defaultTotal:     number;
  defaultFailed:    number;
  status:           string;
}

export default function BatchLiveProgress({
  batchId, defaultProcessed, defaultTotal, defaultFailed, status,
}: Props) {
  const [processed, setProcessed] = useState(defaultProcessed);
  const [total,     setTotal]     = useState(defaultTotal);
  const [failed,    setFailed]    = useState(defaultFailed);

  const isActive = status === "scraping" || status === "analyzing";

  useEffect(() => {
    if (!isActive) return;
    const es = new EventSource(`/api/admin/batch-progress/${batchId}`);
    es.onmessage = e => {
      try {
        const event = JSON.parse(e.data as string);
        if (event.type === "progress" && event.rows) {
          const rows = event.rows as { jds: { total: number; complete: number; failed: number } }[];
          const t = rows.reduce((s: number, r) => s + (r.jds?.total    ?? 0), 0);
          const d = rows.reduce((s: number, r) => s + (r.jds?.complete ?? 0), 0);
          const f = rows.reduce((s: number, r) => s + (r.jds?.failed   ?? 0), 0);
          setTotal(t);
          setProcessed(d);
          setFailed(f);
        }
        if (event.type === "complete") es.close();
      } catch { /* skip */ }
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [batchId, isActive]);

  const pct = total ? Math.round((processed / total) * 100) : (defaultTotal === 0 && defaultProcessed > 0 ? 100 : 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>
          {total > 0
            ? <>{processed} of {total} JDs processed</>
            : processed > 0
              ? <>{processed} JDs processed</>
              : <>Processing…</>
          }
          {failed > 0 && (
            <span style={{ color: "#f87171", marginLeft: 8 }}>· {failed} failed</span>
          )}
        </span>
        <span style={{ fontSize: 20, fontWeight: 900, color: "#FD5A0F", letterSpacing: "-0.5px" }}>
          {pct}%
        </span>
      </div>
      <div style={{
        height: 8, borderRadius: 8,
        background: "rgba(255,255,255,0.08)",
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%", borderRadius: 8,
          width: `${pct}%`,
          background: pct === 100
            ? "linear-gradient(90deg, #10b981, #34d399)"
            : "linear-gradient(90deg, #220133, #FD5A0F)",
          transition: "width 0.8s ease",
          position: "relative",
          overflow: "hidden",
        }}>
          {isActive && (
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)",
              animation: "shimmer 1.8s ease-in-out infinite",
            }} />
          )}
        </div>
      </div>
      <style>{`
        @keyframes shimmer {
          from { transform: translateX(-100%); }
          to   { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}
