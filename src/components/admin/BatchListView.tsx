"use client";

import React, { useState } from "react";
import Link from "next/link";
import DeleteBatchButton from "./DeleteBatchButton";
import { CopyButton }          from "@/components/ui/copy-button";
import { GenerateEmailButton } from "@/components/ui/generate-email-button";

export interface BatchItem {
  id:              string;
  filename:        string;
  name:            string | null;
  status:          string;
  totalPocs:       number;
  createdAt:       string;
  completedAt:     string | null;
  totalJds:        number;
  processedJds:    number;
  failedJds:       number;
  effectiveStatus: string;
  atsTypes:        string[];
  totalAvailable:  number;
  industries:      string[];
  reportLink:       string | null;
  emailCompanyName: string | null;
  pocFirstName:     string | null;
  pocLastName:      string | null;
}

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

// ── ATS badge config ──────────────────────────────────────────────────────────

const ATS_BADGE_CFG: Record<string, { label: string; bg: string; color: string }> = {
  workday:      { label: "Workday",    bg: "#E8F4FD", color: "#0078D4" },
  sap_sf:       { label: "SAP SF",     bg: "#E8F2F8", color: "#007DB8" },
  oracle_hcm:   { label: "Oracle HCM", bg: "#FDF0EE", color: "#C74634" },
  oracle_taleo: { label: "Taleo",      bg: "#FDF0EE", color: "#C74634" },
  greenhouse:   { label: "Greenhouse", bg: "#EAF7ED", color: "#24A148" },
  lever:        { label: "Lever",      bg: "#EEF5FB", color: "#4A90D9" },
};

// ── Main component ─────────────────────────────────────────────────────────────

export default function BatchListView({
  batches,
  completeCount,
  activeCount,
  failedCount,
}: {
  batches:       BatchItem[];
  completeCount: number;
  activeCount:   number;
  failedCount:   number;
}) {
  const [search,          setSearch]          = useState("");
  const [filterStatus,    setFilterStatus]    = useState("all");
  const [filterAts,       setFilterAts]       = useState("all");
  const [filterIndustry,  setFilterIndustry]  = useState("all");

  const uniqueAts = Array.from(new Set(batches.flatMap(b => b.atsTypes))).sort();
  const uniqueIndustries = Array.from(new Set(batches.flatMap(b => b.industries))).sort();

  const filtered = batches.filter(b => {
    if (filterStatus   !== "all" && b.effectiveStatus !== filterStatus)          return false;
    if (filterAts      !== "all" && !b.atsTypes.includes(filterAts))             return false;
    if (filterIndustry !== "all" && !b.industries.includes(filterIndustry))      return false;
    if (search && !b.filename.toLowerCase().includes(search.toLowerCase()))      return false;
    return true;
  });

  const selectStyle: React.CSSProperties = {
    border: "1px solid #EAE4EF", borderRadius: 8, padding: "7px 10px",
    fontSize: 12, color: "#220133", background: "#fff", cursor: "pointer",
    outline: "none",
  };

  return (
    <>
      {/* ── Summary strip ── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "Complete", count: completeCount, color: "#10b981", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.25)", icon: "✅" },
          { label: "Active",   count: activeCount,   color: "#FD5A0F", bg: "rgba(253,90,15,0.1)",  border: "rgba(253,90,15,0.25)",  icon: "⚡" },
          { label: "Failed",   count: failedCount,   color: "#ef4444", bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.25)",  icon: "⚠️" },
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

      {/* ── Filter bar ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        marginBottom: 16,
      }}>
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search batch name…"
          style={{ ...selectStyle, padding: "7px 12px", fontSize: 13, minWidth: 200, flex: 1 }}
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
          <option value="all">All Statuses</option>
          <option value="complete">Complete</option>
          <option value="partial_failure">Partial Failure</option>
          <option value="scraping">Scraping</option>
          <option value="analyzing">Analyzing</option>
          <option value="pending">Pending</option>
          <option value="stopped">Stopped</option>
        </select>
        {uniqueAts.length > 0 && (
          <select value={filterAts} onChange={e => setFilterAts(e.target.value)} style={selectStyle}>
            <option value="all">All ATS</option>
            {uniqueAts.map(a => (
              <option key={a} value={a}>{ATS_BADGE_CFG[a]?.label ?? a}</option>
            ))}
          </select>
        )}
        {uniqueIndustries.length > 0 && (
          <select value={filterIndustry} onChange={e => setFilterIndustry(e.target.value)} style={selectStyle}>
            <option value="all">All Industries</option>
            {uniqueIndustries.map(i => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        )}
        <span style={{ fontSize: 12, color: "#9988AA", whiteSpace: "nowrap" }}>
          {filtered.length} of {batches.length} batches
        </span>
      </div>

      {/* ── Batch list ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.map((b, i) => {
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
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: "#9988AA", marginBottom: 8 }}>
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

                  {/* Tag row — ATS + industry pills */}
                  {(b.atsTypes.length > 0 || b.industries.length > 0) && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                      {b.atsTypes.map(a => {
                        const cfg = ATS_BADGE_CFG[a];
                        return (
                          <span key={a} style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "3px 9px", borderRadius: 20,
                            fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
                            background: cfg?.bg ?? "#F4EFF6",
                            color: cfg?.color ?? "#553366",
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg?.color ?? "#553366", flexShrink: 0 }} />
                            {cfg?.label ?? a}
                          </span>
                        );
                      })}
                      {b.atsTypes.length > 0 && b.industries.length > 0 && (
                        <span style={{ width: 1, height: 14, background: "#EAE4EF", display: "inline-block", alignSelf: "center", flexShrink: 0 }} />
                      )}
                      {b.industries.slice(0, 3).map(ind => (
                        <span key={ind} style={{
                          display: "inline-flex", alignItems: "center",
                          padding: "3px 9px", borderRadius: 20,
                          fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
                          background: "rgba(5,150,105,0.08)", color: "#059669",
                          border: "1px solid rgba(5,150,105,0.18)",
                        }}>
                          {ind}
                        </span>
                      ))}
                      {b.industries.length > 3 && (
                        <span style={{
                          padding: "3px 9px", borderRadius: 20,
                          fontSize: 11, fontWeight: 700,
                          background: "#F4EFF6", color: "#7C5C99",
                        }}>
                          +{b.industries.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Right — open roles + actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  {b.totalAvailable > 0 && (
                    <div style={{
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      padding: "8px 14px", borderRadius: 10, minWidth: 80, textAlign: "center",
                      background: "#F4EFF6", border: "1.5px solid #C4B5D030",
                    }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: "#220133", lineHeight: 1 }}>
                        {b.totalAvailable.toLocaleString()}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 500, color: "#9988AA", marginTop: 2 }}>
                        open roles
                      </span>
                    </div>
                  )}

                  <div className="batch-row-actions" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {b.reportLink && b.processedJds > 0 && (
                      <CopyButton
                        content={typeof window !== "undefined"
                          ? `${window.location.origin}${b.reportLink}`
                          : b.reportLink}
                      />
                    )}
                    {b.reportLink && pct >= 60 && (
                      <GenerateEmailButton
                        companyName={b.emailCompanyName ?? b.name ?? b.filename}
                        reportLink={typeof window !== "undefined"
                          ? `${window.location.origin}${b.reportLink}`
                          : b.reportLink}
                        pocFirstName={b.pocFirstName}
                        pocLastName={b.pocLastName}
                      />
                    )}
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
              </div>

              {/* ── Bottom progress bar ── */}
              <div style={{ height: 6, background: "#F0EBF4", position: "relative", overflow: "hidden", borderRadius: "0 0 16px 16px" }}>
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

        {filtered.length === 0 && (
          <div style={{
            background: "#fff", border: "1px solid #EAE4EF", borderRadius: 16,
            padding: "40px 24px", textAlign: "center",
          }}>
            <p style={{ fontSize: 14, color: "#9988AA", margin: 0 }}>No batches match your filters.</p>
          </div>
        )}
      </div>

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
    </>
  );
}
