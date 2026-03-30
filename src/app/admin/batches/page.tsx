export const dynamic = "force-dynamic";

import Link              from "next/link";
import { db }            from "@/lib/db/client";
import { batches, jobDescriptions } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import DeleteBatchButton from "@/components/admin/DeleteBatchButton";

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; text: string; bg: string; border: string; glow: string; barColor: string; rowBorder: string; dot: boolean }> = {
  complete:        { label: "Complete",        text: "#059669", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.25)",  glow: "rgba(16,185,129,0.2)",  barColor: "#10b981", rowBorder: "#10b981", dot: false },
  partial_failure: { label: "Partial Failure", text: "#d97706", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.25)",  glow: "rgba(245,158,11,0.2)",  barColor: "#f59e0b", rowBorder: "#f59e0b", dot: false },
  scraping:        { label: "Scraping",        text: "#FD5A0F", bg: "rgba(253,90,15,0.1)",   border: "rgba(253,90,15,0.25)",   glow: "rgba(253,90,15,0.25)",  barColor: "#FD5A0F", rowBorder: "#FD5A0F", dot: true  },
  analyzing:       { label: "Analyzing",       text: "#8b5cf6", bg: "rgba(139,92,246,0.1)",  border: "rgba(139,92,246,0.25)",  glow: "rgba(139,92,246,0.2)",  barColor: "#8b5cf6", rowBorder: "#8b5cf6", dot: true  },
  pending:         { label: "Pending",         text: "#6b7280", bg: "rgba(156,163,175,0.1)", border: "rgba(156,163,175,0.2)",  glow: "none",                  barColor: "#9ca3af", rowBorder: "#D0C8D8", dot: false },
  stopped:         { label: "Stopped",         text: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.25)",   glow: "rgba(239,68,68,0.2)",   barColor: "#ef4444", rowBorder: "#ef4444", dot: false },
};

function getStatusCfg(status: string) {
  return STATUS_CFG[status] ?? STATUS_CFG.pending;
}

// Relative time helper
function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)   return "just now";
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 7)   return `${days}d ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function BatchesPage() {
  // Compute JD counts live from jobDescriptions — the cached batches.totalJds/processedJds/failedJds
  // columns are unreliable (scrapeCompany never updated totalJds). Live counts fix all existing batches.
  const rows = await db
    .select({
      id:          batches.id,
      filename:    batches.filename,
      name:        batches.name,
      status:      batches.status,
      totalPocs:   batches.totalPocs,
      createdAt:   batches.createdAt,
      completedAt: batches.completedAt,
      // Live counts — COUNT(CASE …) returns 0 even with no matching JDs (LEFT JOIN)
      totalJds:     sql<number>`COUNT(CASE WHEN ${jobDescriptions.status} NOT IN ('invalid','cancelled') THEN 1 END)`.mapWith(Number),
      processedJds: sql<number>`COUNT(CASE WHEN ${jobDescriptions.status} = 'complete' THEN 1 END)`.mapWith(Number),
      failedJds:    sql<number>`COUNT(CASE WHEN ${jobDescriptions.status} = 'failed' THEN 1 END)`.mapWith(Number),
    })
    .from(batches)
    .leftJoin(jobDescriptions, eq(jobDescriptions.batchId, batches.id))
    .groupBy(batches.id)
    .orderBy(desc(batches.createdAt));

  // Derive effective status from live JD counts — a batch is "complete" when all JDs
  // are processed, regardless of what the stale status column says.
  const withEffectiveStatus = rows.map(r => {
    let effectiveStatus = r.status;
    if (r.totalJds > 0 && r.processedJds + r.failedJds >= r.totalJds) {
      effectiveStatus = r.failedJds > 0 ? "partial_failure" : "complete";
    }
    return { ...r, effectiveStatus };
  });

  const completeCount = withEffectiveStatus.filter(r => r.effectiveStatus === "complete").length;
  const activeCount   = withEffectiveStatus.filter(r => ["scraping", "analyzing", "pending"].includes(r.effectiveStatus)).length;
  const failedCount   = withEffectiveStatus.filter(r => ["stopped", "partial_failure"].includes(r.effectiveStatus)).length;

  return (
    <div>
      {/* ── Page header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#220133", margin: "0 0 4px", letterSpacing: "-0.5px" }}>
            All Batches
          </h1>
          <p style={{ fontSize: 13, color: "#9988AA", margin: 0 }}>{rows.length} total upload{rows.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/admin" className="new-batch-btn" style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          padding: "10px 22px", borderRadius: 12,
          background: "linear-gradient(135deg, #220133, #FD5A0F)",
          color: "#fff", fontWeight: 700, fontSize: 13,
          textDecoration: "none", boxShadow: "0 4px 16px rgba(253,90,15,0.35)",
          transition: "transform 0.15s, box-shadow 0.15s",
        }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
          New Batch
        </Link>
      </div>

      {/* ── Summary strip ── */}
      {rows.length > 0 && (
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          {[
            { label: "Complete",   count: completeCount, color: "#10b981", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.25)",  icon: "✅" },
            { label: "Active",     count: activeCount,   color: "#FD5A0F", bg: "rgba(253,90,15,0.1)",   border: "rgba(253,90,15,0.25)",   icon: "⚡" },
            { label: "Failed",     count: failedCount,   color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.25)",   icon: "⚠️" },
          ].map(chip => (
            <div key={chip.label} style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "8px 16px", borderRadius: 24,
              background: chip.bg, border: `1px solid ${chip.border}`,
              fontSize: 13, fontWeight: 600, color: chip.color,
            }}>
              <span style={{ fontSize: 14 }}>{chip.icon}</span>
              <span style={{ fontSize: 18, fontWeight: 800 }}>{chip.count}</span>
              <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.8 }}>{chip.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {rows.length === 0 ? (
        <div style={{
          background: "#fff", border: "1px solid #EAE4EF", borderRadius: 20,
          padding: "64px 32px", textAlign: "center",
          boxShadow: "0 2px 12px rgba(34,1,51,0.06)",
        }}>
          <div style={{ marginBottom: 20 }}>
            <svg width="56" height="56" fill="none" viewBox="0 0 24 24" style={{ opacity: 0.25, display: "inline-block" }}>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="#FD5A0F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M17 8l-5-5-5 5M12 3v12" stroke="#FD5A0F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#220133", marginBottom: 8 }}>No batches yet</h2>
          <p style={{ fontSize: 14, color: "#9988AA", marginBottom: 24 }}>Upload an Excel file to kick off your first analysis batch.</p>
          <Link href="/admin" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "12px 28px", borderRadius: 12,
            background: "linear-gradient(135deg, #220133, #FD5A0F)",
            color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none",
            boxShadow: "0 4px 16px rgba(253,90,15,0.35)",
          }}>
            Upload first batch →
          </Link>
        </div>
      ) : (

        /* ── Batch rows ── */
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {withEffectiveStatus.map((b, i) => {
            const sc  = getStatusCfg(b.effectiveStatus);
            const pct = b.totalJds ? Math.round((b.processedJds / b.totalJds) * 100) : 0;
            const ago = relativeTime(new Date(b.createdAt));
            const fullDate = new Date(b.createdAt).toLocaleString("en-GB", {
              day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
            });

            return (
              <div
                key={b.id}
                className="batch-row"
                style={{
                  background:   "#fff",
                  borderRadius: 16,
                  border:       "1px solid #EAE4EF",
                  borderLeft:   `4px solid ${sc.rowBorder}`,
                  boxShadow:    "0 1px 4px rgba(34,1,51,0.05)",
                  animation:    `fadeInUp 0.4s ease ${i * 0.06}s both`,
                  transition:   "box-shadow 0.18s ease",
                }}
              >
                <div style={{ padding: "18px 24px 14px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>

                  {/* File icon */}
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: `${sc.rowBorder}18`, border: `1.5px solid ${sc.rowBorder}33`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke={sc.rowBorder} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={sc.rowBorder} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>

                  {/* Name + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                      <Link href={`/admin/batches/${b.id}`} className="batch-filename-link" style={{
                        fontSize: 16, fontWeight: 800, color: "#220133",
                        textDecoration: "none", letterSpacing: "-0.2px",
                      }}>
                        {b.filename}
                      </Link>
                      {/* Status badge */}
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "3px 10px", borderRadius: 20,
                        fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                        background: sc.bg, color: sc.text,
                        border: `1px solid ${sc.border}`,
                        boxShadow: sc.glow !== "none" ? `0 0 10px ${sc.glow}` : "none",
                      }}>
                        {sc.dot && (
                          <span style={{
                            width: 5, height: 5, borderRadius: "50%",
                            background: sc.text, display: "inline-block",
                            animation: "pulse 1.4s ease-in-out infinite",
                          }} />
                        )}
                        {sc.label}
                      </span>
                    </div>

                    {/* Meta row */}
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: "#9988AA" }}>
                      <span title={fullDate} style={{ cursor: "default" }}>🕐 {ago}</span>
                      <span>👤 {b.totalPocs} POC{b.totalPocs !== 1 ? "s" : ""}</span>
                      <span style={{ color: "#10b981", fontWeight: 600 }}>✓ {b.processedJds} done</span>
                      {b.failedJds > 0 && (
                        <span style={{ color: "#ef4444", fontWeight: 600 }}>✕ {b.failedJds} failed</span>
                      )}
                      <span>📄 {b.totalJds} total JDs</span>
                      {b.totalJds > 0 && (
                        <span style={{ fontWeight: 700, color: pct === 100 ? "#10b981" : "#9988AA" }}>
                          {pct}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right actions — delete fades in on hover via CSS */}
                  <div className="batch-row-actions" style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <Link href={`/admin/batches/${b.id}`} className="batch-view-link" style={{
                      padding: "7px 16px", borderRadius: 9,
                      fontSize: 12, fontWeight: 700,
                      background: "#F4EFF6", color: "#553366",
                      border: "1px solid #EAE4EF", textDecoration: "none",
                      transition: "background 0.15s, color 0.15s",
                    }}>
                      View →
                    </Link>
                    <div className="delete-btn-wrap">
                      <DeleteBatchButton batchId={b.id} filename={b.filename} />
                    </div>
                  </div>
                </div>

                {/* ── Bottom progress bar ── */}
                <div style={{ height: 6, background: "#F0EBF4", position: "relative", overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: pct === 100
                      ? "linear-gradient(90deg, #059669, #10b981, #34d399)"
                      : `linear-gradient(90deg, #220133, ${sc.barColor})`,
                    boxShadow: pct === 100 ? "0 0 8px rgba(16,185,129,0.6)" : "none",
                    transition: "width 0.8s ease",
                    position: "relative", overflow: "hidden",
                  }}>
                    {sc.dot && (
                      <div style={{
                        position: "absolute", inset: 0,
                        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
                        animation: "shimmer 1.8s ease-in-out infinite",
                      }} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.4); }
        }
        @keyframes shimmer {
          from { transform: translateX(-100%); }
          to   { transform: translateX(200%); }
        }
        .batch-row:hover { box-shadow: 0 8px 28px rgba(34,1,51,0.12) !important; }
        .batch-row .delete-btn-wrap { opacity: 0; transition: opacity 0.18s ease; }
        .batch-row:hover .delete-btn-wrap { opacity: 1; }
        .new-batch-btn:hover { transform: scale(1.03); box-shadow: 0 6px 24px rgba(253,90,15,0.5) !important; }
        .batch-filename-link:hover { color: #FD5A0F !important; }
        .batch-view-link:hover { background: #220133 !important; color: #fff !important; }
      `}</style>
    </div>
  );
}
