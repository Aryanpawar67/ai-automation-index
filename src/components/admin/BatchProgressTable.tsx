"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

interface CompanyRow {
  companyId:          string;
  companyName:        string;
  scrapeStatus:       string;
  scrapeError:        string | null;
  reportToken:        string | null;
  totalJobsAvailable: number | null;
  careerPageUrl:      string;
  atsType:            string | null;
  slug:               string | null;
  jdTitles:           string[];
  jds: { total: number; complete: number; failed: number; analyzing: number; invalid: number; scraped: number; cancelled: number };
}

function isDirectApiUrl(url: string, atsType: string | null): boolean {
  if (!atsType || !url) return true;
  const u = url.toLowerCase();
  switch (atsType) {
    case "workday":      return /myworkdayjobs\.com/.test(u);
    case "oracle_hcm":   return /\.fa\.[a-z0-9]+\.oraclecloud\.com/.test(u);
    case "oracle_taleo": return /\.taleo\.net/.test(u);
    case "sap_sf":       return /\.jobs2web\.com|successfactors\.com|sapsf\.com/.test(u);
    default:             return true;
  }
}

const ATS_URL_FORMAT: Record<string, string> = {
  workday:      "{tenant}.wd{N}.myworkdayjobs.com/...",
  oracle_hcm:   "{pod}.fa.{region}.oraclecloud.com/hcmUI/...",
  oracle_taleo: "{tenant}.taleo.net",
  sap_sf:       "{tenant}.jobs2web.com  or  career10.successfactors.com?company={id}",
};

// Deterministic avatar color from name
const AVATAR_PALETTE = ["#7c3aed","#2563eb","#059669","#d97706","#dc2626","#0891b2","#be185d","#4f46e5"];
function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { bg: string; text: string; label: string; dot?: boolean }> = {
  complete:    { bg: "rgba(16,185,129,0.12)",  text: "#059669", label: "Complete"    },
  failed:      { bg: "rgba(239,68,68,0.1)",    text: "#dc2626", label: "Failed"      },
  blocked:     { bg: "rgba(239,68,68,0.1)",    text: "#dc2626", label: "Blocked"     },
  in_progress: { bg: "rgba(253,90,15,0.1)",    text: "#FD5A0F", label: "In Progress", dot: true },
  pending:     { bg: "rgba(156,163,175,0.1)",  text: "#6b7280", label: "Pending"     },
  scraped:     { bg: "rgba(59,130,246,0.1)",   text: "#2563eb", label: "Scraped"     },
};

// ── Action buttons ─────────────────────────────────────────────────────────────

function ApproveCompanyButton({ companyId, batchId, onQueued }: {
  companyId: string; batchId: string; onQueued?: () => void;
}) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const handle = async () => {
    setState("loading");
    await fetch(`/api/admin/batches/${batchId}/analyse`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId }),
    });
    setState("done");
    onQueued?.();
  };
  if (state === "done") return <span style={{ fontSize: 11, fontWeight: 700, color: "#059669" }}>Queued ✓</span>;
  return (
    <button onClick={handle} disabled={state === "loading"}
      style={{
        fontSize: 11, padding: "5px 12px", borderRadius: 8, fontWeight: 700,
        border: "1px solid #C4B5D0", color: "#220133", background: "#F4EFF6",
        cursor: "pointer", opacity: state === "loading" ? 0.5 : 1, transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#EAE4EF"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#F4EFF6"; }}
    >
      {state === "loading" ? "Queuing…" : "Analyse →"}
    </button>
  );
}

function RetryScrapeButton({ companyId, batchId, onQueued }: {
  companyId: string; batchId: string; onQueued?: () => void;
}) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const handleRetry = async () => {
    setState("loading");
    await fetch(`/api/admin/company/${companyId}/retry-scrape`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchId }),
    });
    setState("done");
    onQueued?.();
  };
  if (state === "done") return <span style={{ fontSize: 11, fontWeight: 700, color: "#059669" }}>Queued ✓</span>;
  return (
    <button onClick={handleRetry} disabled={state === "loading"}
      style={{
        fontSize: 11, padding: "5px 12px", borderRadius: 8, fontWeight: 700,
        border: "1px solid #FDBB96", color: "#FD5A0F", background: "#FFF0EA",
        cursor: "pointer", opacity: state === "loading" ? 0.5 : 1, transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#FDBB9622"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#FFF0EA"; }}
    >
      {state === "loading" ? "Queuing…" : "↺ Retry scrape"}
    </button>
  );
}

// ── Inline JD list (expanded per company row) ──────────────────────────────────

interface InlineJD {
  id: string; title: string; status: string;
  overallScore: number | null; hoursSaved: string | null;
}

function InlineJDList({ batchId, companyId }: { batchId: string; companyId: string }) {
  const [jds,     setJds]     = useState<InlineJD[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/batches/${batchId}/companies/${companyId}/jds`)
      .then(r => r.json())
      .then(data => { setJds(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [batchId, companyId]);

  if (loading) return (
    <div style={{ padding: "10px 20px 10px 68px" }}>
      <p style={{ fontSize: 12, color: "#9988AA", margin: 0 }}>Loading…</p>
    </div>
  );
  if (!jds || jds.length === 0) return null;

  const complete = jds.filter(j => j.status === "complete");

  return (
    <div style={{
      padding: "0 20px 14px 68px",
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      {complete.map(jd => {
        const score = jd.overallScore;
        const scoreColor = score == null ? "#9988AA" : score >= 70 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
        return (
          <a
            key={jd.id}
            href={`/report/${companyId}?jd=${jd.id}`}
            target="_blank" rel="noreferrer"
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "7px 12px", borderRadius: 8,
              border: "1px solid #EAE4EF", background: "#FAFAFA",
              textDecoration: "none",
              transition: "border-color 0.12s, background 0.12s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLAnchorElement).style.background = "#FFF8F5";
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "#FDBB96";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLAnchorElement).style.background = "#FAFAFA";
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "#EAE4EF";
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "#220133", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {jd.title}
            </span>
            {score != null && (
              <span style={{ fontSize: 13, fontWeight: 800, color: scoreColor, flexShrink: 0 }}>
                {score}<span style={{ fontSize: 10, fontWeight: 500, color: "#9988AA" }}>/100</span>
              </span>
            )}
            {jd.hoursSaved && (
              <span style={{ fontSize: 11, color: "#9988AA", flexShrink: 0 }}>{jd.hoursSaved}h/wk</span>
            )}
            <svg width="12" height="12" fill="none" viewBox="0 0 16 16" style={{ flexShrink: 0, color: "#9988AA" }}>
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        );
      })}
      {jds.length > complete.length && (
        <p style={{ fontSize: 11, color: "#9988AA", margin: "2px 0 0", paddingLeft: 4 }}>
          + {jds.length - complete.length} pending analysis
        </p>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function BatchProgressTable({ batchId }: { batchId: string }) {
  const [retriedIds,    setRetriedIds]    = useState<Set<string>>(new Set());
  const [expandedIds,   setExpandedIds]   = useState<Set<string>>(new Set());
  const [rows,          setRows]          = useState<CompanyRow[]>([]);
  const [done,          setDone]          = useState(false);
  const [error,         setError]         = useState(false);
  const [analyseAllState, setAnalyseAllState] = useState<"idle" | "loading" | "done">("idle");

  function toggleExpand(companyId: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(companyId) ? next.delete(companyId) : next.add(companyId);
      return next;
    });
  }

  useEffect(() => {
    const es = new EventSource(`/api/admin/batch-progress/${batchId}`);
    es.onmessage = e => {
      try {
        const event = JSON.parse(e.data as string);
        if (event.type === "progress") setRows(event.rows ?? []);
        if (event.type === "complete") { setDone(true); es.close(); }
      } catch { /* skip malformed */ }
    };
    es.onerror = () => { setError(true); es.close(); };
    return () => es.close();
  }, [batchId]);

  const totalJDs   = rows.reduce((s, r) => s + (r.jds?.total    ?? 0), 0);
  const doneJDs    = rows.reduce((s, r) => s + (r.jds?.complete ?? 0), 0);
  const failedJDs  = rows.reduce((s, r) => s + (r.jds?.failed   ?? 0), 0);
  const scrapedJDs = rows.reduce((s, r) => s + (r.jds?.scraped  ?? 0), 0);

  // ── Empty / loading state ──
  if (rows.length === 0) {
    return (
      <div style={{ padding: "48px 28px", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 14 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 6, height: 28, borderRadius: 3,
              background: "#FD5A0F", opacity: 0.7,
              animation: `bounceBar 0.75s ease-in-out infinite`,
              animationDelay: `${i * 0.15}s`,
            }} />
          ))}
        </div>
        <p style={{ fontSize: 13, color: "#9988AA" }}>Waiting for scraping to begin…</p>
      </div>
    );
  }

  return (
    <div>
      {/* ── Analyse All banner ── */}
      {scrapedJDs > 0 && analyseAllState !== "done" && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          margin: "16px 24px", padding: "14px 20px", borderRadius: 12,
          background: "#FFF0EA", border: "1px solid #FDBB96",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>⚡</span>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#FD5A0F", margin: 0 }}>
              {scrapedJDs} JD{scrapedJDs !== 1 ? "s" : ""} scraped and ready for analysis
            </p>
          </div>
          <button
            onClick={async () => {
              setAnalyseAllState("loading");
              await fetch(`/api/admin/batches/${batchId}/analyse`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
              });
              setAnalyseAllState("done");
            }}
            disabled={analyseAllState === "loading"}
            style={{
              padding: "8px 18px", borderRadius: 10, border: "none",
              background: "#FD5A0F", color: "#fff", fontWeight: 700, fontSize: 12,
              cursor: "pointer", opacity: analyseAllState === "loading" ? 0.6 : 1,
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.03)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
          >
            {analyseAllState === "loading" ? "Queuing…" : "Analyse All →"}
          </button>
        </div>
      )}

      {/* ── Live status bar ── */}
      <div style={{ padding: "10px 28px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, color: "#9988AA" }}>
          <span style={{ fontWeight: 600, color: "#220133" }}>{doneJDs}</span> of{" "}
          <span style={{ fontWeight: 600, color: "#220133" }}>{totalJDs}</span> JDs processed
          {failedJDs > 0 && <span style={{ color: "#ef4444", fontWeight: 600, marginLeft: 8 }}>· {failedJDs} failed</span>}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {done && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#10b981" }}>Batch complete</span>
            </div>
          )}
          {error && <span style={{ fontSize: 12, color: "#f87171" }}>Connection lost — refresh to resume</span>}
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #F4EFF6", background: "#FAFAFA" }}>
              {["Company", "Scrape", "Available", "JDs", "Progress", "Report"].map(h => (
                <th key={h} style={{
                  padding: "12px 20px", textAlign: "left",
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.07em",
                  textTransform: "uppercase", color: "#9988AA",
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const jds        = r.jds ?? { total: 0, complete: 0, failed: 0, analyzing: 0, invalid: 0, scraped: 0, cancelled: 0 };
              const validTotal = jds.total - (jds.invalid ?? 0);
              const rowPct     = validTotal ? Math.round((jds.complete / validTotal) * 100) : 0;
              const sc         = STATUS_CFG[r.scrapeStatus] ?? STATUS_CFG.pending;
              const color      = avatarColor(r.companyName);
              const initial    = r.companyName.trim()[0]?.toUpperCase() ?? "?";
              const hasUrl     = r.atsType && !isDirectApiUrl(r.careerPageUrl, r.atsType);
              const isExpanded = expandedIds.has(r.companyId);
              const canExpand  = jds.complete > 0;
              const isLast     = idx === rows.length - 1;

              return (
                <React.Fragment key={r.companyId}>
                <tr
                  style={{
                    borderBottom: (isLast && !isExpanded) ? "none" : "1px solid #F4EFF6",
                    transition: "background 0.12s",
                    borderLeft: "3px solid transparent",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLTableRowElement).style.background = "#FDFBFE";
                    (e.currentTarget as HTMLTableRowElement).style.borderLeft = "3px solid #FD5A0F44";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLTableRowElement).style.background = "";
                    (e.currentTarget as HTMLTableRowElement).style.borderLeft = "3px solid transparent";
                  }}
                >
                  {/* ── Company ── */}
                  <td style={{ padding: "16px 20px", minWidth: 240 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      {/* Avatar */}
                      <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: `${color}22`, border: `1.5px solid ${color}44`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, fontWeight: 800, color, flexShrink: 0,
                      }}>
                        {initial}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "#220133", margin: "0 0 3px", lineHeight: 1.3 }}>
                          {r.companyName}
                          {hasUrl && (
                            <span title={`Generic landing page URL — expected: ${ATS_URL_FORMAT[r.atsType!] ?? "direct ATS URL"}\nCurrent: ${r.careerPageUrl}`}
                              style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: "#FFF0EA", color: "#C2440C", border: "1px solid #FDBB96", cursor: "help" }}>
                              ⚠ URL
                            </span>
                          )}
                        </p>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {canExpand ? (
                            <button
                              onClick={() => toggleExpand(r.companyId)}
                              style={{
                                fontSize: 12, fontWeight: 600, color: "#FD5A0F",
                                background: "none", border: "none", padding: 0,
                                cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                              }}
                            >
                              <svg width="10" height="10" fill="none" viewBox="0 0 16 16"
                                style={{ transition: "transform 0.15s", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>
                                <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              {isExpanded ? "Hide" : `Show ${jds.complete} role${jds.complete !== 1 ? "s" : ""}`}
                            </button>
                          ) : (
                            <Link href={`/admin/batches/${batchId}/companies/${r.companyId}`}
                              style={{ fontSize: 12, color: "#9988AA", textDecoration: "none", fontWeight: 500 }}
                              onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => e.currentTarget.style.color = "#FD5A0F"}
                              onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => e.currentTarget.style.color = "#9988AA"}
                            >
                              View JDs →
                            </Link>
                          )}
                          {canExpand && (
                            <Link href={`/admin/batches/${batchId}/companies/${r.companyId}`}
                              style={{ fontSize: 11, color: "#C4B5D0", textDecoration: "none" }}
                              onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => e.currentTarget.style.color = "#9988AA"}
                              onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => e.currentTarget.style.color = "#C4B5D0"}
                            >
                              Full view ↗
                            </Link>
                          )}
                        </div>
                        {r.jdTitles && r.jdTitles.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                            {r.jdTitles.slice(0, 3).map((t, i) => (
                              <span key={i} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "#F4EFF6", color: "#553366", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {t}
                              </span>
                            ))}
                            {r.jdTitles.length > 3 && (
                              <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "#F4EFF6", color: "#9988AA" }}>
                                +{r.jdTitles.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* ── Scrape status ── */}
                  <td style={{ padding: "16px 20px", verticalAlign: "top" }}>
                    <div>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "4px 10px", borderRadius: 20,
                        fontSize: 11, fontWeight: 700,
                        background: sc.bg, color: sc.text,
                        border: `1px solid ${sc.text}22`,
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
                      {r.scrapeError && !retriedIds.has(r.companyId) && (
                        <p style={{ fontSize: 10, color: "#9988AA", margin: "4px 0 0", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                          title={r.scrapeError}>
                          {r.scrapeError}
                        </p>
                      )}
                      {(r.scrapeStatus === "failed" || r.scrapeStatus === "blocked") && !retriedIds.has(r.companyId) && (
                        <div style={{ marginTop: 6 }}>
                          <RetryScrapeButton companyId={r.companyId} batchId={batchId}
                            onQueued={() => setRetriedIds(prev => new Set(prev).add(r.companyId))} />
                        </div>
                      )}
                      {r.scrapeStatus === "complete" && (jds?.scraped ?? 0) > 0 && (
                        <div style={{ marginTop: 6 }}>
                          <ApproveCompanyButton companyId={r.companyId} batchId={batchId} />
                        </div>
                      )}
                    </div>
                  </td>

                  {/* ── Available ── */}
                  <td style={{ padding: "16px 20px", verticalAlign: "top" }}>
                    {r.totalJobsAvailable
                      ? <span style={{ fontSize: 16, fontWeight: 800, color: "#553366" }}>{r.totalJobsAvailable}</span>
                      : <span style={{ color: "#D0C8D8", fontSize: 14 }}>—</span>
                    }
                  </td>

                  {/* ── JD counts ── */}
                  <td style={{ padding: "16px 20px", verticalAlign: "top" }}>
                    <div>
                      <span style={{ fontSize: 15, fontWeight: 800, color: "#10b981" }}>{jds.complete}</span>
                      <span style={{ fontSize: 14, color: "#D0C8D8" }}> / {validTotal}</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                        {jds.scraped   > 0 && <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 5, background: "#F4EFF6",             color: "#9988AA" }}>{jds.scraped} awaiting</span>}
                        {jds.analyzing > 0 && <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 5, background: "#fef3c7",             color: "#d97706" }}>{jds.analyzing} running</span>}
                        {jds.failed    > 0 && <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 5, background: "rgba(239,68,68,0.1)", color: "#dc2626" }}>{jds.failed} failed</span>}
                        {jds.invalid   > 0 && <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 5, background: "rgba(239,68,68,0.08)", color: "#f87171" }}>{jds.invalid} invalid</span>}
                        {jds.cancelled > 0 && <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 5, background: "#f3f4f6",              color: "#9ca3af" }}>{jds.cancelled} skipped</span>}
                      </div>
                    </div>
                  </td>

                  {/* ── Progress bar ── */}
                  <td style={{ padding: "16px 20px", verticalAlign: "top" }}>
                    <div style={{ width: 110 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: jds.failed > 0 ? "#ef4444" : "#10b981" }}>
                          {rowPct}%
                        </span>
                      </div>
                      <div style={{ height: 6, borderRadius: 4, background: "#EAE4EF", overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 4,
                          width: `${rowPct}%`,
                          background: jds.failed > 0
                            ? "linear-gradient(90deg, #f87171, #ef4444)"
                            : "linear-gradient(90deg, #34d399, #10b981)",
                          transition: "width 0.5s ease",
                        }} />
                      </div>
                    </div>
                  </td>

                  {/* ── Report link ── */}
                  <td style={{ padding: "16px 20px", verticalAlign: "top" }}>
                    {r.reportToken ? (
                      <a
                        href={`/report/${r.slug ?? r.companyId}`}
                        target="_blank" rel="noreferrer"
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "7px 14px", borderRadius: 8,
                          fontSize: 12, fontWeight: 700,
                          background: "#FFF0EA", color: "#FD5A0F",
                          border: "1px solid #FDBB96", textDecoration: "none",
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLAnchorElement).style.background = "#FD5A0F";
                          (e.currentTarget as HTMLAnchorElement).style.color = "#fff";
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLAnchorElement).style.background = "#FFF0EA";
                          (e.currentTarget as HTMLAnchorElement).style.color = "#FD5A0F";
                        }}
                      >
                        View ↗
                      </a>
                    ) : (
                      <span style={{ fontSize: 12, color: "#D0C8D8" }}>Pending…</span>
                    )}
                  </td>
                </tr>
                {/* ── Inline JD expansion row ── */}
                {isExpanded && canExpand && (
                  <tr key={`${r.companyId}-jds`} style={{ borderBottom: isLast ? "none" : "1px solid #F4EFF6", background: "#FDFBFE" }}>
                    <td colSpan={6} style={{ padding: 0 }}>
                      <InlineJDList batchId={batchId} companyId={r.companyId} />
                    </td>
                  </tr>
                )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <style>{`
        @keyframes bounceBar {
          0%, 100% { transform: scaleY(0.35); }
          50%       { transform: scaleY(1); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}
