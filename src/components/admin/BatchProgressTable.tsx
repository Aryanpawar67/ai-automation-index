"use client";

import { useEffect, useState } from "react";
import RetryButton             from "./RetryButton";

interface CompanyRow {
  companyId:    string;
  companyName:  string;
  scrapeStatus: string;
  scrapeError:  string | null;
  reportToken:  string | null;
  jds: { total: number; complete: number; failed: number; analyzing: number };
}

const STATUS_BADGE: Record<string, string> = {
  complete:    "badge-low",
  failed:      "badge-high",
  blocked:     "badge-high",
  in_progress: "badge-medium",
  pending:     "badge-medium",
};

export default function BatchProgressTable({ batchId }: { batchId: string }) {
  const [rows, setRows]   = useState<CompanyRow[]>([]);
  const [done, setDone]   = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const es = new EventSource(`/api/admin/batch-progress/${batchId}`);

    es.onmessage = e => {
      try {
        const event = JSON.parse(e.data as string);
        if (event.type === "progress") setRows(event.rows ?? []);
        if (event.type === "complete") { setDone(true); es.close(); }
      } catch { /* malformed event */ }
    };

    es.onerror = () => { setError(true); es.close(); };

    return () => es.close();
  }, [batchId]);

  const totalJDs  = rows.reduce((s, r) => s + (r.jds?.total    ?? 0), 0);
  const doneJDs   = rows.reduce((s, r) => s + (r.jds?.complete ?? 0), 0);
  const failedJDs = rows.reduce((s, r) => s + (r.jds?.failed   ?? 0), 0);
  const pct       = totalJDs ? Math.round((doneJDs / totalJDs) * 100) : 0;

  return (
    <div className="space-y-6">

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between text-xs mb-2" style={{ color: "#9988AA" }}>
          <span>{doneJDs} of {totalJDs} JDs processed{failedJDs > 0 && <span className="text-red-500 ml-2">· {failedJDs} failed</span>}</span>
          <span className="font-bold" style={{ color: "#FD5A0F" }}>{pct}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "#EAE4EF" }}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: "linear-gradient(90deg, #220133, #FD5A0F)" }} />
        </div>
        {done && (
          <div className="flex items-center gap-2 mt-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            <span className="text-xs font-semibold text-emerald-600">Batch complete</span>
          </div>
        )}
        {error && (
          <p className="text-xs text-red-500 mt-2">Connection lost. Refresh to resume monitoring.</p>
        )}
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="text-center py-12">
          <div className="flex justify-center gap-1 mb-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-6 rounded-full animate-bounce-bar"
                style={{ background: "#FD5A0F", animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          <p className="text-sm" style={{ color: "#9988AA" }}>Waiting for scraping to begin…</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ borderBottom: "1px solid #EAE4EF" }}>
                {["Company", "Scrape", "JDs", "Progress", "Report Link"].map(h => (
                  <th key={h} className="pb-3 text-left pr-4 text-xs font-semibold uppercase tracking-widest"
                    style={{ color: "#9988AA" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const jds      = r.jds ?? { total: 0, complete: 0, failed: 0, analyzing: 0 };
                const rowPct   = jds.total ? Math.round((jds.complete / jds.total) * 100) : 0;
                return (
                  <tr key={r.companyId} style={{ borderBottom: "1px solid #F4EFF6" }}>
                    <td className="py-3 pr-4 font-medium" style={{ color: "#220133" }}>
                      {r.companyName}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`badge ${STATUS_BADGE[r.scrapeStatus] ?? "badge-medium"}`}>
                        {r.scrapeStatus}
                      </span>
                      {r.scrapeError && (
                        <p className="text-xs mt-0.5 max-w-[180px] truncate" style={{ color: "#9988AA" }}
                          title={r.scrapeError}>
                          {r.scrapeError}
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-xs" style={{ color: "#553366" }}>
                      <span className="text-emerald-600 font-medium">{jds.complete}</span>
                      <span style={{ color: "#D0C8D8" }}> / {jds.total}</span>
                      {jds.failed > 0 && (
                        <span className="ml-2 text-red-500">{jds.failed} failed</span>
                      )}
                      {jds.analyzing > 0 && (
                        <span className="ml-2" style={{ color: "#f59e0b" }}>{jds.analyzing} running</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: "#EAE4EF" }}>
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${rowPct}%`,
                            background: jds.failed > 0 ? "#f87171" : "#10b981",
                          }} />
                      </div>
                    </td>
                    <td className="py-3">
                      {r.reportToken ? (
                        <a
                          href={`/report/${r.companyId}?token=${r.reportToken}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium hover:underline underline-offset-2"
                          style={{ color: "#FD5A0F" }}
                        >
                          View report ↗
                        </a>
                      ) : (
                        <span className="text-xs" style={{ color: "#D0C8D8" }}>Pending…</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
