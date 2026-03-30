"use client";

import { useState } from "react";
import Link from "next/link";
import JDActionButtons from "@/components/admin/JDActionButtons";
import CompanyAnalyseButton from "@/components/admin/CompanyAnalyseButton";

export interface JDWithAnalysis {
  id:         string;
  title:      string;
  department: string | null;
  rawText:    string;
  status:     string;
  companyId?: string;
  analysis?:  { overallScore: number | null; hoursSaved: string | null } | null;
}

export interface CompanyMeta {
  id:                 string;
  name:               string;
  careerPageUrl:      string;
  totalJobsAvailable: number | null;
}

interface Props {
  batchId:    string;
  batch:      { filename: string };
  company:    CompanyMeta;
  companies?: CompanyMeta[];
  jds:        JDWithAnalysis[];
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, {
  label: string; text: string; bg: string; border: string; glow: string; dot: boolean;
}> = {
  complete:  { label: "analysed",  text: "#059669", bg: "rgba(16,185,129,0.10)",  border: "rgba(16,185,129,0.25)",  glow: "rgba(16,185,129,0.15)",  dot: false },
  pending:   { label: "queued",    text: "#6b7280", bg: "rgba(156,163,175,0.10)", border: "rgba(156,163,175,0.20)", glow: "transparent",             dot: false },
  analyzing: { label: "analysing", text: "#8b5cf6", bg: "rgba(139,92,246,0.10)",  border: "rgba(139,92,246,0.25)",  glow: "rgba(139,92,246,0.15)",   dot: true  },
  scraped:   { label: "scraped",   text: "#FD5A0F", bg: "rgba(253,90,15,0.08)",   border: "rgba(253,90,15,0.22)",   glow: "rgba(253,90,15,0.12)",    dot: false },
  failed:    { label: "failed",    text: "#ef4444", bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.25)",   glow: "rgba(239,68,68,0.15)",    dot: false },
  invalid:   { label: "invalid",   text: "#9988AA", bg: "rgba(153,136,170,0.08)", border: "rgba(153,136,170,0.18)", glow: "transparent",             dot: false },
  cancelled: { label: "skipped",   text: "#9988AA", bg: "rgba(153,136,170,0.08)", border: "rgba(153,136,170,0.18)", glow: "transparent",             dot: false },
};

const STATUS_BORDER: Record<string, string> = {
  complete:  "#10b981",
  analyzing: "#8b5cf6",
  pending:   "#C4B5D0",
  scraped:   "#FD5A0F",
  failed:    "#ef4444",
  invalid:   "#D0C8D8",
  cancelled: "#D0C8D8",
};

// ── JD text formatter ─────────────────────────────────────────────────────────

type JDBlock =
  | { type: "heading";   text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullets";   items: string[] };

function formatJDText(raw: string): JDBlock[] {
  const normalised = raw
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const chunks = normalised.split(/\n\n+/);
  const blocks: JDBlock[] = [];

  for (const chunk of chunks) {
    const lines = chunk.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    if (lines.length === 1) {
      const l = lines[0];
      const isAllCaps  = l === l.toUpperCase() && /[A-Z]/.test(l) && l.length <= 80;
      const endsColon  = l.endsWith(":") && l.length <= 80;
      const titleShort = l.length <= 60 && l.split(/\s+/).length <= 7 &&
                         /^[A-Z]/.test(l) && !/[.?!,]$/.test(l);
      if (isAllCaps || endsColon || titleShort) {
        blocks.push({ type: "heading", text: l.replace(/:$/, "") });
        continue;
      }
    }

    const BULLET_RE = /^[-•·▪▸*–]\s+|^\d+[.)]\s+/;
    const bulletCount = lines.filter(l => BULLET_RE.test(l)).length;
    if (bulletCount >= Math.max(2, lines.length * 0.6)) {
      const items = lines.map(l => l.replace(BULLET_RE, "").trim()).filter(Boolean);
      blocks.push({ type: "bullets", items });
      continue;
    }

    blocks.push({ type: "paragraph", text: lines.join(" ") });
  }

  return blocks;
}

function FormattedJD({ rawText }: { rawText: string }) {
  const blocks = formatJDText(rawText);
  return (
    <div style={{ color: "#553366", fontSize: 12, lineHeight: 1.7 }}>
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          return (
            <p key={i} style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
              textTransform: "uppercase", color: "#220133",
              margin: i === 0 ? "0 0 8px" : "20px 0 8px",
            }}>
              {block.text}
            </p>
          );
        }
        if (block.type === "bullets") {
          return (
            <ul key={i} style={{ margin: "0 0 10px", padding: 0, listStyle: "none" }}>
              {block.items.map((item, j) => (
                <li key={j} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                  <span style={{ color: "#FDBB96", fontWeight: 700, flexShrink: 0, marginTop: 1 }}>›</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        }
        return <p key={i} style={{ margin: "0 0 10px" }}>{block.text}</p>;
      })}
    </div>
  );
}

// ── Key point extractor ───────────────────────────────────────────────────────

function extractKeyPoints(rawText: string): string[] {
  const lines = rawText
    .split(/\n/)
    .map(l => l.trim())
    .filter(l => l.length > 30 && l.length < 200);
  const bullets = lines.filter(l =>
    /^[-•·▪▸*]\s/.test(l) ||
    /^(Develop|Design|Lead|Manage|Build|Collaborate|Ensure|Drive|Support|Create|Define|Own|Partner|Work|Analyse|Analyze|Implement|Deliver)/i.test(l)
  );
  const pool = bullets.length >= 3 ? bullets : lines;
  return pool.slice(0, 6);
}

// ── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.pending;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 9px", borderRadius: 20,
      fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
      background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}`,
      boxShadow: `0 0 0 3px ${cfg.glow}`,
    }}>
      {cfg.dot && (
        <span style={{
          width: 4, height: 4, borderRadius: "50%",
          background: cfg.text, display: "inline-block",
          animation: "pulse 1.4s ease-in-out infinite",
        }} />
      )}
      {cfg.label}
    </span>
  );
}

// ── Role list item ────────────────────────────────────────────────────────────

function RoleListItem({
  jd, isSelected, companyLabel, onClick,
}: {
  jd:            JDWithAnalysis;
  isSelected:    boolean;
  companyLabel?: string;
  onClick:       () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const borderColor = isSelected ? "#FD5A0F" : (STATUS_BORDER[jd.status] ?? "#D0C8D8");
  const cfg = STATUS_CFG[jd.status] ?? STATUS_CFG.pending;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%", textAlign: "left",
        padding: "12px 14px 10px 14px",
        borderLeft: `3px solid ${borderColor}`,
        borderBottom: "1px solid #F0EBF4",
        background: isSelected ? "#FFF8F5" : hovered ? "#F9F7FB" : "transparent",
        cursor: "pointer",
        transition: "background 0.12s, border-left-color 0.12s",
        display: "block",
      }}
    >
      <p style={{
        fontSize: 12, fontWeight: 600,
        color: isSelected ? "#220133" : "#553366",
        margin: "0 0 3px",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}
        title={jd.title}
      >
        {jd.title.length > 44 ? jd.title.slice(0, 44) + "…" : jd.title}
      </p>

      {(jd.department || companyLabel) && (
        <p style={{ fontSize: 10, color: "#9988AA", margin: "0 0 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {jd.department}
          {jd.department && companyLabel && <span style={{ color: "#C4B5D0" }}> · </span>}
          {companyLabel && <span style={{ color: "#C4B5D0" }}>{companyLabel}</span>}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          padding: "2px 7px", borderRadius: 20,
          fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
          background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}`,
        }}>
          {cfg.dot && (
            <span style={{
              width: 3, height: 3, borderRadius: "50%",
              background: cfg.text, display: "inline-block",
              animation: "pulse 1.4s ease-in-out infinite",
            }} />
          )}
          {cfg.label}
        </span>
        {jd.analysis?.overallScore != null && (
          <span style={{ fontSize: 11, fontWeight: 700, color: "#FD5A0F" }}>
            {jd.analysis.overallScore}
            <span style={{ color: "#9988AA", fontWeight: 400 }}>/100</span>
          </span>
        )}
      </div>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CompanyJDSplitView({ batchId, batch, company, companies, jds }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(jds.length > 0 ? jds[0].id : null);
  const [collapsed, setCollapsed]   = useState<Set<string>>(new Set());
  const [showFullJD, setShowFullJD] = useState(false);

  // Career URL inline edit
  const [editingUrl,   setEditingUrl]   = useState(false);
  const [urlDraft,     setUrlDraft]     = useState(company.careerPageUrl);
  const [savingUrl,    setSavingUrl]    = useState(false);
  const [urlError,     setUrlError]     = useState("");
  const [rescrapeNote, setRescrapeNote] = useState(false);

  async function handleSaveUrl() {
    if (!urlDraft.trim() || urlDraft.trim() === company.careerPageUrl) {
      setEditingUrl(false); return;
    }
    setSavingUrl(true); setUrlError("");
    const res = await fetch(`/api/admin/companies/${company.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ careerPageUrl: urlDraft.trim() }),
    });
    const d = await res.json() as { error?: string; requiresRescrape?: boolean };
    setSavingUrl(false);
    if (!res.ok) { setUrlError(d.error ?? "Save failed."); return; }
    if (d.requiresRescrape) setRescrapeNote(true);
    setEditingUrl(false);
    // Reload to reflect new URL in page title / links
    window.location.reload();
  }

  const allCompanies = companies && companies.length > 1 ? companies : null;
  const companyMap   = Object.fromEntries((companies ?? [company]).map(c => [c.id, c]));
  const isMulti      = !!allCompanies;

  const selected  = jds.find(j => j.id === selectedId) ?? null;
  const keyPoints = selected ? extractKeyPoints(selected.rawText) : [];

  const scrapedCount = jds.filter(j => j.status === "scraped").length;
  const validCount   = jds.filter(j => j.status !== "invalid" && j.status !== "cancelled").length;
  const invalidCount = jds.filter(j => j.status === "invalid" || j.status === "cancelled").length;
  const doneCount    = jds.filter(j => j.status === "complete").length;

  function toggleCompany(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const selectedCompany = selected?.companyId
    ? (companyMap[selected.companyId] ?? company)
    : company;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 136px)", minHeight: 400 }}>

      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, fontSize: 12, color: "#9988AA", flexShrink: 0 }}>
        <Link href="/admin/batches" style={{ color: "#9988AA", textDecoration: "none" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#553366")}
          onMouseLeave={e => (e.currentTarget.style.color = "#9988AA")}>
          Batches
        </Link>
        <span style={{ color: "#C4B5D0" }}>›</span>
        <Link href={`/admin/batches/${batchId}`}
          style={{ color: "#9988AA", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}
          onMouseEnter={e => (e.currentTarget.style.color = "#553366")}
          onMouseLeave={e => (e.currentTarget.style.color = "#9988AA")}>
          {batch.filename}
        </Link>
        <span style={{ color: "#C4B5D0" }}>›</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200, color: "#553366", fontWeight: 600 }}>
          {isMulti ? "All roles" : company.name}
        </span>
      </div>

      {/* Page header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        marginBottom: 16, flexShrink: 0,
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#220133", margin: "0 0 4px", letterSpacing: "-0.4px" }}>
            {isMulti ? batch.filename : company.name}
          </h1>
          {!isMulti && (
            <div style={{ marginTop: 2 }}>
              {editingUrl ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 5, maxWidth: 500 }}>
                  <input
                    autoFocus
                    value={urlDraft}
                    onChange={e => setUrlDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSaveUrl(); if (e.key === "Escape") setEditingUrl(false); }}
                    style={{ fontSize: 12, padding: "5px 10px", borderRadius: 7, border: "1.5px solid #FD5A0F", outline: "none", width: "100%", boxSizing: "border-box" }}
                  />
                  {urlError && <p style={{ fontSize: 11, color: "#dc2626", margin: 0 }}>{urlError}</p>}
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={handleSaveUrl} disabled={savingUrl}
                      style={{ fontSize: 11, padding: "4px 12px", borderRadius: 6, border: "none", background: "#FD5A0F", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
                      {savingUrl ? "Saving…" : "Save"}
                    </button>
                    <button onClick={() => { setEditingUrl(false); setUrlDraft(company.careerPageUrl); setUrlError(""); }}
                      style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid #EAE4EF", background: "#fff", color: "#553366", cursor: "pointer" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <a href={company.careerPageUrl} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: "#9988AA", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 460 }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#FD5A0F")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#9988AA")}>
                    {company.careerPageUrl} ↗
                  </a>
                  <button
                    onClick={() => { setEditingUrl(true); setUrlDraft(company.careerPageUrl); }}
                    title="Edit career page URL"
                    style={{ flexShrink: 0, fontSize: 10, padding: "2px 8px", borderRadius: 5, border: "1px solid #EAE4EF", background: "#F9F7FB", cursor: "pointer", color: "#9988AA", fontWeight: 600 }}>
                    ✏ Edit
                  </button>
                </div>
              )}
              {rescrapeNote && (
                <div style={{ marginTop: 6, padding: "7px 10px", borderRadius: 7, background: "#fffbeb", border: "1px solid #fde68a", fontSize: 11, color: "#92400e" }}>
                  URL updated. Scrape status reset — trigger a re-scrape from the batch view to fetch JDs from the corrected URL.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stat chips */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {isMulti && (
            <div style={{ padding: "6px 14px", borderRadius: 20, background: "#F4EFF6", border: "1px solid #EAE4EF" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#220133" }}>{allCompanies!.length}</span>
              <span style={{ fontSize: 11, color: "#9988AA", marginLeft: 4 }}>companies</span>
            </div>
          )}
          <div style={{ padding: "6px 14px", borderRadius: 20, background: "#F4EFF6", border: "1px solid #EAE4EF" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#220133" }}>{jds.length}</span>
            <span style={{ fontSize: 11, color: "#9988AA", marginLeft: 4 }}>roles</span>
          </div>
          {doneCount > 0 && (
            <div style={{ padding: "6px 14px", borderRadius: 20, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>{doneCount}</span>
              <span style={{ fontSize: 11, color: "#059669", marginLeft: 4, opacity: 0.8 }}>analysed</span>
            </div>
          )}
          {scrapedCount > 0 && (
            <div style={{ padding: "6px 14px", borderRadius: 20, background: "rgba(253,90,15,0.08)", border: "1px solid rgba(253,90,15,0.2)" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#FD5A0F" }}>{scrapedCount}</span>
              <span style={{ fontSize: 11, color: "#FD5A0F", marginLeft: 4, opacity: 0.8 }}>awaiting</span>
            </div>
          )}
          {invalidCount > 0 && (
            <div style={{ padding: "6px 14px", borderRadius: 20, background: "rgba(156,163,175,0.08)", border: "1px solid rgba(156,163,175,0.2)" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#6b7280" }}>{invalidCount}</span>
              <span style={{ fontSize: 11, color: "#6b7280", marginLeft: 4, opacity: 0.8 }}>skipped</span>
            </div>
          )}
          {!isMulti && (
            <CompanyAnalyseButton batchId={batchId} companyId={company.id} scrapedCount={scrapedCount} />
          )}
        </div>
      </div>

      {/* Split panel */}
      {jds.length === 0 ? (
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          background: "#fff", borderRadius: 20, border: "1px solid #EAE4EF",
          boxShadow: "0 2px 12px rgba(34,1,51,0.06)",
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#553366", margin: "0 0 4px" }}>No job descriptions collected</p>
            <p style={{ fontSize: 12, color: "#9988AA", margin: 0 }}>Scraping may still be in progress.</p>
          </div>
        </div>
      ) : (
        <div style={{
          display: "flex", flex: 1, minHeight: 0,
          borderRadius: 20, overflow: "hidden",
          border: "1px solid #EAE4EF",
          boxShadow: "0 2px 12px rgba(34,1,51,0.06)",
        }}>

          {/* ── Left: role list ── */}
          <div style={{
            width: 280, flexShrink: 0, overflowY: "auto",
            borderRight: "1px solid #EAE4EF",
            background: "#FDFCFE",
          }}>
            {isMulti ? (
              allCompanies!.map(co => {
                const coJds       = jds.filter(j => j.companyId === co.id);
                const isCollapsed  = collapsed.has(co.id);
                const coAnalysed  = coJds.filter(j => j.status === "complete").length;
                const coScraped   = coJds.filter(j => j.status === "scraped").length;
                return (
                  <div key={co.id}>
                    <button
                      onClick={() => toggleCompany(co.id)}
                      style={{
                        width: "100%", textAlign: "left",
                        padding: "8px 12px 7px",
                        background: "#F4EFF6",
                        borderBottom: "1px solid #EAE4EF",
                        borderTop: "1px solid #EAE4EF",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        position: "sticky", top: 0, zIndex: 2,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#220133", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {co.name}
                        </p>
                        <p style={{ fontSize: 10, color: "#9988AA", margin: 0 }}>
                          {coJds.length} roles
                          {co.totalJobsAvailable ? ` · ${co.totalJobsAvailable} avail` : ""}
                          {coAnalysed > 0 ? ` · ${coAnalysed} done` : ""}
                          {coScraped  > 0 ? ` · ${coScraped} scraped` : ""}
                        </p>
                      </div>
                      <span style={{
                        color: "#9988AA", fontSize: 10, marginLeft: 8, flexShrink: 0,
                        display: "inline-block",
                        transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                        transition: "transform 0.18s",
                      }}>
                        ▾
                      </span>
                    </button>
                    {!isCollapsed && coJds.map(jd => (
                      <RoleListItem
                        key={jd.id}
                        jd={jd}
                        isSelected={jd.id === selectedId}
                        companyLabel={co.name}
                        onClick={() => { setSelectedId(jd.id); setShowFullJD(false); }}
                      />
                    ))}
                  </div>
                );
              })
            ) : (
              jds.map(jd => (
                <RoleListItem
                  key={jd.id}
                  jd={jd}
                  isSelected={jd.id === selectedId}
                  onClick={() => { setSelectedId(jd.id); setShowFullJD(false); }}
                />
              ))
            )}
          </div>

          {/* ── Right: detail panel ── */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#fff" }}>
            {!selected ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.4 }}>👈</div>
                  <p style={{ fontSize: 13, color: "#9988AA" }}>Select a role to review</p>
                </div>
              </div>
            ) : (
              <>
                {/* Detail header */}
                <div style={{
                  padding: "18px 22px 14px",
                  borderBottom: "1px solid #EAE4EF",
                  flexShrink: 0,
                  background: "linear-gradient(180deg, #FDFCFE 0%, #fff 100%)",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h2 style={{ fontSize: 15, fontWeight: 800, color: "#220133", margin: "0 0 4px", lineHeight: 1.3 }}>
                        {selected.title}
                      </h2>
                      {(selected.department || (isMulti && selectedCompany.name)) && (
                        <p style={{ fontSize: 11, color: "#9988AA", margin: 0 }}>
                          {[selected.department, isMulti ? selectedCompany.name : null].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      {selected.analysis?.overallScore != null && (
                        <div style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "6px 12px", borderRadius: 12,
                          background: "linear-gradient(135deg, #FFF8F5, #FFF0EA)",
                          border: "1px solid rgba(253,90,15,0.2)",
                        }}>
                          <div>
                            <span style={{ fontSize: 18, fontWeight: 800, color: "#FD5A0F" }}>
                              {selected.analysis.overallScore}
                            </span>
                            <span style={{ fontSize: 11, color: "#9988AA" }}>/100</span>
                          </div>
                          {selected.analysis.hoursSaved && (
                            <div style={{ borderLeft: "1px solid rgba(253,90,15,0.2)", paddingLeft: 8 }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: "#553366" }}>
                                {Number(selected.analysis.hoursSaved).toFixed(0)}h
                              </span>
                              <span style={{ fontSize: 10, color: "#9988AA" }}>/wk</span>
                            </div>
                          )}
                        </div>
                      )}
                      <StatusPill status={selected.status} />
                    </div>
                  </div>
                  <p style={{ fontSize: 10, color: "#C4B5D0", margin: "8px 0 0" }}>
                    {selected.rawText.split(/\s+/).filter(Boolean).length} words extracted
                  </p>
                </div>

                {/* Detail body */}
                <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
                  {selected.status === "invalid" ? (
                    <div style={{
                      padding: "14px 16px", borderRadius: 12,
                      background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
                    }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#ef4444", margin: "0 0 4px" }}>
                        Skipped — validation failed
                      </p>
                      <p style={{ fontSize: 11, color: "#9988AA", margin: 0, lineHeight: 1.5 }}>
                        Did not pass content validation: missing required keywords or detected as a generic marketing title.
                      </p>
                    </div>
                  ) : selected.status === "cancelled" ? (
                    <div style={{
                      padding: "14px 16px", borderRadius: 12,
                      background: "rgba(156,163,175,0.06)", border: "1px solid rgba(156,163,175,0.2)",
                    }}>
                      <p style={{ fontSize: 12, color: "#9988AA", margin: 0 }}>This role was manually skipped.</p>
                    </div>
                  ) : (
                    <>
                      {!showFullJD && (
                        keyPoints.length > 0 ? (
                          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                            {keyPoints.map((point, i) => (
                              <li key={i} style={{ display: "flex", gap: 10, fontSize: 12, color: "#553366", animation: `fadeInUp 0.3s ease ${i * 0.05}s both` }}>
                                <span style={{ color: "#FDBB96", fontWeight: 700, flexShrink: 0, marginTop: 2 }}>›</span>
                                <span style={{ lineHeight: 1.6 }}>{point.replace(/^[-•·▪▸*]\s*/, "")}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p style={{ fontSize: 12, color: "#553366", lineHeight: 1.7, margin: 0 }}>
                            {selected.rawText.slice(0, 400)}{selected.rawText.length > 400 ? "…" : ""}
                          </p>
                        )
                      )}

                      {showFullJD && <FormattedJD rawText={selected.rawText} />}

                      <button
                        onClick={() => setShowFullJD(v => !v)}
                        style={{
                          marginTop: 16, display: "inline-flex", alignItems: "center", gap: 5,
                          fontSize: 11, fontWeight: 600, color: "#9988AA",
                          background: "none", border: "none", cursor: "pointer", padding: 0,
                          transition: "color 0.15s",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#553366")}
                        onMouseLeave={e => (e.currentTarget.style.color = "#9988AA")}
                      >
                        <span style={{
                          display: "inline-block", fontSize: 9,
                          transform: showFullJD ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.18s",
                        }}>▾</span>
                        {showFullJD ? "Collapse description" : "Show full description"}
                      </button>
                    </>
                  )}
                </div>

                {/* Action bar */}
                <div style={{
                  padding: "12px 22px",
                  borderTop: "1px solid #EAE4EF",
                  background: "#FDFCFE",
                  flexShrink: 0,
                }}>
                  <JDActionButtons jdId={selected.id} initialStatus={selected.status} />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}
