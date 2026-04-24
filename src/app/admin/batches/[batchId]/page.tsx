export const dynamic = "force-dynamic";

import Link               from "next/link";
import BatchProgressTable from "@/components/admin/BatchProgressTable";
import BatchActionButtons from "@/components/admin/BatchActionButtons";
import BatchLiveProgress  from "@/components/admin/BatchLiveProgress";
import { db }             from "@/lib/db/client";
import { batches, companies, jobDescriptions } from "@/lib/db/schema";
import { eq, count, sql } from "drizzle-orm";
import { notFound }       from "next/navigation";

const STATUS_COLOR: Record<string, { bg: string; text: string; glow: string; dot: boolean }> = {
  complete:        { bg: "rgba(16,185,129,0.15)",  text: "#10b981", glow: "rgba(16,185,129,0.3)",  dot: false },
  partial_failure: { bg: "rgba(239,68,68,0.12)",   text: "#ef4444", glow: "rgba(239,68,68,0.25)",  dot: false },
  scraping:        { bg: "rgba(253,90,15,0.12)",   text: "#FD5A0F", glow: "rgba(253,90,15,0.25)",  dot: true  },
  analyzing:       { bg: "rgba(139,92,246,0.12)",  text: "#8b5cf6", glow: "rgba(139,92,246,0.25)", dot: true  },
  pending:         { bg: "rgba(156,163,175,0.12)", text: "#9ca3af", glow: "none",                  dot: false },
  stopped:         { bg: "rgba(239,68,68,0.12)",   text: "#ef4444", glow: "rgba(239,68,68,0.25)",  dot: false },
};

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const [batch]     = await db.select().from(batches).where(eq(batches.id, batchId));
  if (!batch) notFound();

  // Companies in this batch (via jobDescriptions linkage)
  const batchCompanies = await db
    .selectDistinct({ companyId: jobDescriptions.companyId })
    .from(jobDescriptions)
    .where(eq(jobDescriptions.batchId, batchId));
  const companiesInBatch = batchCompanies.length;

  // Live JD counts — always accurate, independent of stale batch counter columns
  const [jdCounts] = await db
    .select({
      totalJds:     sql<number>`COUNT(CASE WHEN ${jobDescriptions.status} NOT IN ('invalid','cancelled') THEN 1 END)`.mapWith(Number),
      processedJds: sql<number>`COUNT(CASE WHEN ${jobDescriptions.status} = 'complete' THEN 1 END)`.mapWith(Number),
      failedJds:    sql<number>`COUNT(CASE WHEN ${jobDescriptions.status} = 'failed' THEN 1 END)`.mapWith(Number),
    })
    .from(jobDescriptions)
    .where(eq(jobDescriptions.batchId, batchId));

  const liveTotal     = jdCounts?.totalJds     ?? 0;
  const liveProcessed = jdCounts?.processedJds ?? 0;
  const liveFailed    = jdCounts?.failedJds    ?? 0;

  const sc = STATUS_COLOR[batch.status] ?? STATUS_COLOR.pending;

  return (
    <div style={{ minHeight: "100vh" }}>

      {/* ── Breadcrumb ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
        <Link href="/admin/batches"
          className="breadcrumb-link"
          style={{ color: "rgba(153,136,170,0.8)", textDecoration: "none", fontWeight: 500 }}
        >
          Batches
        </Link>
        <svg width="12" height="12" fill="none" viewBox="0 0 16 16">
          <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span style={{ color: "#553366", fontWeight: 500 }} className="truncate">{batch.filename}</span>
      </div>

      {/* ── Hero banner ── */}
      <div style={{
        background:   "linear-gradient(135deg, #1A0028 0%, #2D0050 60%, #220133 100%)",
        borderRadius: 20,
        padding:      "28px 32px 24px",
        marginBottom: 24,
        border:       "1px solid rgba(255,255,255,0.07)",
        boxShadow:    "0 8px 40px rgba(34,1,51,0.25)",
        position:     "relative",
        overflow:     "hidden",
      }}>
        {/* subtle grid pattern overlay */}
        <div style={{
          position:   "absolute", inset: 0, opacity: 0.03,
          backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          pointerEvents: "none",
        }} />

        <div style={{ position: "relative" }}>
          {/* Title row */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.5px" }}>
                  {batch.filename}
                </h1>
                {/* Status badge */}
                <span style={{
                  display:      "inline-flex",
                  alignItems:   "center",
                  gap:          6,
                  padding:      "4px 12px",
                  borderRadius: 20,
                  fontSize:     11,
                  fontWeight:   700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  background:   sc.bg,
                  color:        sc.text,
                  border:       `1px solid ${sc.text}33`,
                  boxShadow:    sc.glow !== "none" ? `0 0 12px ${sc.glow}` : "none",
                }}>
                  {sc.dot && (
                    <span style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: sc.text,
                      boxShadow: `0 0 6px ${sc.text}`,
                      animation: "pulse 1.5s ease-in-out infinite",
                      display: "inline-block",
                    }} />
                  )}
                  {batch.status}
                </span>
              </div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: 0 }}>
                Uploaded {(() => { const d = new Date(batch.createdAt); return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}`; })()}
                &nbsp;·&nbsp; {batch.totalPocs} POC{batch.totalPocs !== 1 ? "s" : ""}
                &nbsp;·&nbsp; {companiesInBatch} {companiesInBatch === 1 ? "company" : "companies"}
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
              <a
                href={`/api/admin/batches/${batchId}/export`}
                download
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "6px 14px", borderRadius: 10, fontSize: 12,
                  fontWeight: 600, color: "rgba(255,255,255,0.7)",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  textDecoration: "none", transition: "background 0.15s",
                }}
              >
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                  <path d="M12 2v10m0 0l-3-3m3 3l3-3M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Export XLSX
              </a>
              <BatchActionButtons batchId={batchId} status={batch.status} />
            </div>
          </div>

          {/* Progress bar section — live via SSE */}
          <BatchLiveProgress
            batchId={batchId}
            defaultProcessed={liveProcessed}
            defaultTotal={liveTotal}
            defaultFailed={liveFailed}
            status={batch.status}
          />
        </div>
      </div>

      {/* ── Stats tiles ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Companies",      value: companiesInBatch, icon: "🏢", color: "#8b5cf6" },
          { label: "Total JDs",      value: liveTotal,        icon: "📄", color: "#3b82f6" },
          { label: "Processed",      value: liveProcessed,    icon: "✅", color: "#10b981" },
          { label: "Failed",         value: liveFailed,       icon: "⚠️", color: liveFailed > 0 ? "#ef4444" : "#9ca3af" },
        ].map((tile, i) => (
          <div key={i} className="stat-tile" style={{
            background:   "#fff",
            border:       "1px solid #EAE4EF",
            borderRadius: 16,
            padding:      "20px 24px",
            boxShadow:    "0 1px 4px rgba(34,1,51,0.05)",
            transition:   "transform 0.18s ease, box-shadow 0.18s ease",
            animation:    `fadeInUp 0.4s ease ${i * 0.07}s both`,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>{tile.icon}</span>
              <span style={{ fontSize: 28, fontWeight: 900, color: tile.color, letterSpacing: "-1px", lineHeight: 1 }}>
                {tile.value}
              </span>
            </div>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#9988AA", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
              {tile.label}
            </p>
          </div>
        ))}
      </div>

      {/* ── Live progress table ── */}
      <div style={{
        background:   "#fff",
        border:       "1px solid #EAE4EF",
        borderRadius: 20,
        overflow:     "hidden",
        boxShadow:    "0 2px 12px rgba(34,1,51,0.06)",
      }}>
        <div style={{ padding: "20px 28px 0", borderBottom: "1px solid #F4EFF6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9988AA", margin: "0 0 16px" }}>
            Live Progress
          </p>
        </div>
        <div style={{ padding: "0 0 8px" }}>
          <BatchProgressTable batchId={batchId} />
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.3); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          from { transform: translateX(-100%); }
          to   { transform: translateX(200%); }
        }
        .breadcrumb-link:hover { color: #FD5A0F !important; }
        .stat-tile:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(34,1,51,0.1) !important; }
      `}</style>
    </div>
  );
}
