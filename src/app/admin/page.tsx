export const dynamic = "force-dynamic";

import Link          from "next/link";
import ExcelUploader from "@/components/admin/ExcelUploader";
import { db }        from "@/lib/db/client";
import { batches }   from "@/lib/db/schema";
import { desc }      from "drizzle-orm";

const STATUS_CFG: Record<string, { text: string; bg: string; border: string; dot: boolean }> = {
  complete:        { text: "#059669", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.25)",  dot: false },
  partial_failure: { text: "#d97706", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.25)",  dot: false },
  scraping:        { text: "#FD5A0F", bg: "rgba(253,90,15,0.1)",   border: "rgba(253,90,15,0.25)",   dot: true  },
  analyzing:       { text: "#8b5cf6", bg: "rgba(139,92,246,0.1)",  border: "rgba(139,92,246,0.25)",  dot: true  },
  pending:         { text: "#6b7280", bg: "rgba(156,163,175,0.1)", border: "rgba(156,163,175,0.2)",  dot: false },
  stopped:         { text: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.25)",   dot: false },
};

const STEPS = [
  { n: "1", icon: "📤", label: "Upload Excel",     sub: "POC list with career URLs"    },
  { n: "2", icon: "🔍", label: "Scrape Listings",  sub: "Fetch open roles automatically" },
  { n: "3", icon: "🤖", label: "AI Analysis",      sub: "Claude scores each role"       },
  { n: "4", icon: "📊", label: "Share Report",     sub: "Tokenised link per company"    },
];

function relativeTime(date: Date): string {
  const diff  = Date.now() - date.getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 7)  return `${days}d ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default async function AdminHome() {
  const recent = await db.select().from(batches).orderBy(desc(batches.createdAt)).limit(5);

  return (
    <div>
      {/* ── Page header ── */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#220133", margin: "0 0 4px", letterSpacing: "-0.5px" }}>
          Quick Upload
        </h1>
        <p style={{ fontSize: 13, color: "#9988AA", margin: 0 }}>
          Upload a POC Excel and queue all companies for scraping immediately.
        </p>
      </div>

      {/* ── Main two-column layout ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24, alignItems: "start" }}>

        {/* ── LEFT: Upload zone + how it works ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Upload card */}
          <div style={{
            background: "#fff", border: "1px solid #EAE4EF", borderRadius: 20,
            padding: "28px 28px 24px",
            boxShadow: "0 2px 12px rgba(34,1,51,0.06)",
          }}>
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9988AA", margin: "0 0 6px" }}>
                Upload file
              </p>
              <p style={{ fontSize: 13, color: "#553366", margin: 0 }}>
                All companies are queued for scraping immediately. Use the{" "}
                <Link href="/admin/dataset" style={{ color: "#FD5A0F", fontWeight: 600, textDecoration: "none" }}>
                  Dataset Manager
                </Link>{" "}
                to filter and select before processing.
              </p>
            </div>
            <ExcelUploader />
          </div>

          {/* How it works */}
          <div style={{
            background: "#fff", border: "1px solid #EAE4EF", borderRadius: 20,
            padding: "24px 28px",
            boxShadow: "0 2px 12px rgba(34,1,51,0.06)",
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9988AA", margin: "0 0 20px" }}>
              How it works
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {STEPS.map((step, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10, position: "relative" }}>
                  {/* Connector line */}
                  {i < STEPS.length - 1 && (
                    <div style={{
                      position: "absolute", top: 20, left: "calc(50% + 22px)",
                      width: "calc(100% - 44px)", height: 1,
                      background: "linear-gradient(90deg, #EAE4EF, transparent)",
                    }} />
                  )}
                  <div style={{
                    width: 42, height: 42, borderRadius: 12,
                    background: "linear-gradient(135deg, #F4EFF6, #fff)",
                    border: "1.5px solid #EAE4EF",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, position: "relative", zIndex: 1,
                    boxShadow: "0 2px 8px rgba(34,1,51,0.06)",
                  }}>
                    {step.icon}
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#220133", margin: "0 0 2px" }}>{step.label}</p>
                    <p style={{ fontSize: 11, color: "#9988AA", margin: 0, lineHeight: 1.4 }}>{step.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Dataset CTA + Recent activity ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Dataset Manager CTA */}
          <Link href="/admin/dataset" style={{ textDecoration: "none" }}>
            <div className="dataset-cta-card" style={{
              background:   "linear-gradient(135deg, #1A0028 0%, #2D0050 100%)",
              borderRadius: 16,
              padding:      "20px 22px",
              border:       "1px solid rgba(255,255,255,0.07)",
              boxShadow:    "0 4px 20px rgba(34,1,51,0.2)",
              cursor:       "pointer",
              transition:   "transform 0.18s, box-shadow 0.18s",
              position:     "relative",
              overflow:     "hidden",
            }}>
              <div style={{
                position: "absolute", top: -20, right: -20,
                width: 100, height: 100, borderRadius: "50%",
                background: "rgba(253,90,15,0.08)",
                pointerEvents: "none",
              }} />
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                  padding: "3px 9px", borderRadius: 20,
                  background: "rgba(253,90,15,0.2)", color: "#FDBB96",
                  border: "1px solid rgba(253,90,15,0.3)",
                }}>
                  Recommended
                </span>
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: "#fff", margin: "0 0 5px" }}>
                Prospect Dataset Manager
              </h3>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "0 0 14px", lineHeight: 1.5 }}>
                Upload, filter by ATS / HQ / size, select companies and create named batches.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "#FD5A0F" }}>
                Open Dataset Manager
                <svg width="12" height="12" fill="none" viewBox="0 0 16 16">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </Link>

          {/* Recent activity */}
          {recent.length > 0 && (
            <div style={{
              background: "#fff", border: "1px solid #EAE4EF", borderRadius: 16,
              padding: "20px",
              boxShadow: "0 2px 12px rgba(34,1,51,0.06)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9988AA", margin: 0 }}>
                  Recent Batches
                </p>
                <Link href="/admin/batches" style={{ fontSize: 11, fontWeight: 700, color: "#FD5A0F", textDecoration: "none" }}>
                  View all →
                </Link>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {recent.map((b, i) => {
                  const sc  = STATUS_CFG[b.status] ?? STATUS_CFG.pending;
                  const ago = relativeTime(new Date(b.createdAt));
                  return (
                    <Link key={b.id} href={`/admin/batches/${b.id}`} style={{ textDecoration: "none" }}>
                      <div className="recent-batch-row" style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 12px", borderRadius: 10,
                        transition: "background 0.12s",
                        animation: `fadeInUp 0.35s ease ${i * 0.05}s both`,
                      }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#220133", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {b.filename}
                          </p>
                          <p style={{ fontSize: 11, color: "#9988AA", margin: 0 }}>
                            {ago}
                            {b.processedJds > 0 && <span style={{ color: "#10b981", fontWeight: 600 }}> · {b.processedJds} done</span>}
                          </p>
                        </div>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0, marginLeft: 10,
                          padding: "3px 9px", borderRadius: 20,
                          fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
                          background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`,
                        }}>
                          {sc.dot && (
                            <span style={{
                              width: 4, height: 4, borderRadius: "50%",
                              background: sc.text, display: "inline-block",
                              animation: "pulse 1.4s ease-in-out infinite",
                            }} />
                          )}
                          {b.status}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.4); }
        }
        .dataset-cta-card:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(34,1,51,0.3) !important; }
        .recent-batch-row:hover { background: #F9F7FB; }
      `}</style>
    </div>
  );
}
