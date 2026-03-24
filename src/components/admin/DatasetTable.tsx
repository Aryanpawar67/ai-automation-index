"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProcessingStatus { status: string; name: string }

interface DatasetRow {
  id:            string;
  rowNumber:     number | null;
  companyName:   string;
  domain:        string;
  headquarters:  string | null;
  employeeSize:  string | null;
  hcmRaw:        string | null;
  atsType:       string | null;
  careerPageUrl: string;
  jobPreview:    string[] | null;
  sourceFile:    string | null;
  processingStatus: ProcessingStatus | null;
}

interface ApiResponse {
  rows:    DatasetRow[];
  total:   number;
  page:    number;
  pages:   number;
  filters: { atsOptions: string[]; sizeOptions: string[] };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ATS_LABEL: Record<string, string> = {
  workday:      "Workday",
  oracle_hcm:   "Oracle HCM",
  oracle_taleo: "Oracle Taleo",
  sap_sf:       "SAP SF",
};

const STATUS_DOT: Record<string, string> = {
  complete:    "#10b981",
  in_progress: "#f59e0b",
  failed:      "#ef4444",
  blocked:     "#ef4444",
  pending:     "#9988AA",
};

function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 999,
      fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
      background: bg, color, border: `1px solid ${color}22`,
    }}>
      {label}
    </span>
  );
}

// ── Upload Modal ──────────────────────────────────────────────────────────────

function UploadModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [stage, setStage]   = useState<"pick" | "preview" | "uploading" | "done">("pick");
  const [stats, setStats]   = useState<{ total: number; newRows: number; duplicates: number; existingInDb: number } | null>(null);
  const [file, setFile]     = useState<File | null>(null);
  const [error, setError]   = useState("");
  const [drag, setDrag]     = useState(false);
  const inputRef            = useRef<HTMLInputElement>(null);

  const handleFile = async (f: File) => {
    if (!f.name.match(/\.(xlsx|xls)$/i)) { setError("Please upload an .xlsx or .xls file."); return; }
    setFile(f);
    setError("");
    setStage("uploading");
    const fd = new FormData();
    fd.append("file", f);
    const res  = await fetch("/api/admin/dataset/upload?dryRun=true", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Parse failed."); setStage("pick"); return; }
    setStats(data);
    setStage("preview");
  };

  const handleConfirm = async () => {
    if (!file) return;
    setStage("uploading");
    const fd = new FormData();
    fd.append("file", file);
    const res  = await fetch("/api/admin/dataset/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Upload failed."); setStage("preview"); return; }
    setStage("done");
    setTimeout(() => { onDone(); onClose(); }, 1200);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(34,1,51,0.45)", zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div className="card" style={{ width: "100%", maxWidth: 480, padding: 32 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#220133" }}>Upload Dataset</h2>
            <p style={{ fontSize: 12, color: "#9988AA", marginTop: 3 }}>
              New companies are appended. Duplicates (matched by domain) are skipped.
            </p>
          </div>
          <button onClick={onClose} style={{ color: "#9988AA", fontSize: 18, lineHeight: 1, cursor: "pointer", background: "none", border: "none" }}>✕</button>
        </div>

        {/* Info box */}
        <div style={{ background: "#F4EFF6", borderRadius: 10, padding: "10px 14px", marginBottom: 20, fontSize: 12, color: "#553366", lineHeight: 1.6 }}>
          <strong>How it works:</strong> Your existing dataset is preserved. Only companies with a
          domain not already in the dataset will be added. No data is deleted or replaced.
        </div>

        {/* Pick stage */}
        {(stage === "pick" || stage === "uploading") && stage !== "uploading" && (
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            className="card"
            style={{
              padding: 32, textAlign: "center", cursor: "pointer",
              borderStyle: "dashed", borderColor: drag ? "#FD5A0F" : "#D0C8D8",
              background: drag ? "#FFF8F5" : "#FAFAFA",
            }}
          >
            <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: "#220133", marginBottom: 4 }}>Drop your Excel file here</div>
            <div style={{ fontSize: 12, color: "#9988AA" }}>or click to browse · .xlsx / .xls</div>
          </div>
        )}

        {/* Uploading spinner */}
        {stage === "uploading" && (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <svg className="animate-spin" style={{ width: 28, height: 28, color: "#FD5A0F", margin: "0 auto 12px" }} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <p style={{ fontSize: 13, color: "#9988AA" }}>Analysing file…</p>
          </div>
        )}

        {/* Preview / consent stage */}
        {stage === "preview" && stats && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              {[
                { label: "Rows in file",    value: stats.total,      color: "#220133" },
                { label: "New to add",      value: stats.newRows,    color: "#059669" },
                { label: "Already in DB",   value: stats.existingInDb, color: "#9988AA" },
                { label: "Duplicates skipped", value: stats.duplicates, color: "#d97706" },
              ].map(s => (
                <div key={s.label} style={{ background: "#F9F7FB", borderRadius: 10, padding: "12px 16px", border: "1px solid #EAE4EF" }}>
                  <div style={{ fontSize: 11, color: "#9988AA", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#92400e", marginBottom: 20 }}>
              <strong>Confirm:</strong> {stats.newRows} new companies will be added to your dataset.
              {stats.duplicates > 0 && ` ${stats.duplicates} duplicate domain(s) will be skipped.`} Your existing data will not be affected.
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onClose}
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid #EAE4EF", background: "#fff", fontSize: 13, fontWeight: 600, color: "#553366", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleConfirm}
                className="gradient-btn"
                style={{ flex: 2, padding: "10px 0", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Append {stats.newRows} companies →
              </button>
            </div>
          </div>
        )}

        {/* Done */}
        {stage === "done" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#059669" }}>Dataset updated!</p>
          </div>
        )}

        {error && (
          <p style={{ marginTop: 12, fontSize: 12, color: "#dc2626", background: "#fef2f2", padding: "8px 12px", borderRadius: 8 }}>{error}</p>
        )}
      </div>
    </div>
  );
}

// ── Batch Modal ───────────────────────────────────────────────────────────────

function BatchModal({ count, onClose, onConfirm }: { count: number; onClose: () => void; onConfirm: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(34,1,51,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card" style={{ width: "100%", maxWidth: 420, padding: 32 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: "#220133", marginBottom: 6 }}>Create Batch</h2>
        <p style={{ fontSize: 12, color: "#9988AA", marginBottom: 20 }}>
          {count} compan{count === 1 ? "y" : "ies"} selected · give this batch a name so you can find it later.
        </p>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && name.trim() && onConfirm(name.trim())}
          placeholder="e.g. Workday Q1 2026"
          style={{
            width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 13,
            border: "1.5px solid #EAE4EF", color: "#220133", outline: "none",
            background: "#FAFAFA", boxSizing: "border-box", marginBottom: 16,
          }}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid #EAE4EF", background: "#fff", fontSize: 13, fontWeight: 600, color: "#553366", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            onClick={() => name.trim() && onConfirm(name.trim())}
            disabled={!name.trim()}
            className="gradient-btn"
            style={{ flex: 2, padding: "10px 0", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600, cursor: name.trim() ? "pointer" : "not-allowed", opacity: name.trim() ? 1 : 0.5 }}>
            Create Batch →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reprocess Warning ─────────────────────────────────────────────────────────

function ReprocessWarning({ company, batchName, onConfirm, onCancel }: { company: string; batchName: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(34,1,51,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card" style={{ width: "100%", maxWidth: 400, padding: 28 }}>
        <div style={{ fontSize: 24, marginBottom: 12 }}>⚠️</div>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#220133", marginBottom: 8 }}>Already processed</h3>
        <p style={{ fontSize: 13, color: "#553366", lineHeight: 1.6, marginBottom: 20 }}>
          <strong>{company}</strong> was already processed in batch <strong>{batchName}</strong>.
          Adding it again will re-scrape the career page and re-run the full analysis.
          Previous results will remain in the database.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel}
            style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "1px solid #EAE4EF", background: "#fff", fontSize: 13, fontWeight: 600, color: "#553366", cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={onConfirm}
            style={{ flex: 2, padding: "9px 0", borderRadius: 10, border: "none", background: "#ef4444", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Reprocess anyway
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DatasetTable() {
  const router = useRouter();

  const [data,     setData]     = useState<ApiResponse | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [page,     setPage]     = useState(1);
  const [filters,  setFilters]  = useState({ ats: "", hq: "", size: "", search: "" });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [showUpload,   setShowUpload]   = useState(false);
  const [showBatch,    setShowBatch]    = useState(false);
  const [creating,     setCreating]     = useState(false);
  const [reprocess,    setReprocess]    = useState<DatasetRow | null>(null);

  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page:   String(page),
      limit:  "50",
      ats:    filters.ats,
      hq:     filters.hq,
      size:   filters.size,
      search: filters.search,
    });
    const res  = await fetch(`/api/admin/dataset?${params}`);
    const json = await res.json() as ApiResponse;
    setData(json);
    setLoading(false);
  }, [page, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [filters]);

  function toggleSelect(id: string, row: DatasetRow) {
    if (selected.has(id)) {
      const next = new Set(selected);
      next.delete(id);
      setSelected(next);
      return;
    }
    // Already processed — show warning first
    if (row.processingStatus?.status === "complete") {
      setReprocess(row);
      return;
    }
    const next = new Set(selected);
    next.add(id);
    setSelected(next);
  }

  function toggleSelectAll() {
    if (!data) return;
    const ids = data.rows.map(r => r.id);
    if (ids.every(id => selected.has(id))) {
      const next = new Set(selected);
      ids.forEach(id => next.delete(id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      ids.forEach(id => next.add(id));
      setSelected(next);
    }
  }

  async function handleCreateBatch(name: string) {
    setShowBatch(false);
    setCreating(true);
    const res  = await fetch("/api/admin/dataset/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rowIds: Array.from(selected), name }),
    });
    const data = await res.json();
    setCreating(false);
    if (res.ok) {
      setSelected(new Set());
      router.push(`/admin/batches/${data.batchId}`);
    }
  }

  const rows    = data?.rows ?? [];
  const isEmpty = !loading && rows.length === 0 && !Object.values(filters).some(Boolean);

  return (
    <div className="animate-fade-in">

      {/* Modals */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onDone={() => { setSelected(new Set()); fetchData(); }}
        />
      )}
      {showBatch && (
        <BatchModal
          count={selected.size}
          onClose={() => setShowBatch(false)}
          onConfirm={handleCreateBatch}
        />
      )}
      {reprocess && (
        <ReprocessWarning
          company={reprocess.companyName}
          batchName={reprocess.processingStatus?.name ?? "a previous batch"}
          onCancel={() => setReprocess(null)}
          onConfirm={() => {
            const next = new Set(selected);
            next.add(reprocess.id);
            setSelected(next);
            setReprocess(null);
          }}
        />
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#220133", marginBottom: 4 }}>Prospect Dataset</h1>
          <p style={{ fontSize: 13, color: "#9988AA" }}>
            {data ? `${data.total.toLocaleString()} companies` : "Loading…"}
            {selected.size > 0 && <span style={{ color: "#FD5A0F", fontWeight: 600 }}> · {selected.size} selected</span>}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={() => setShowUpload(true)}
            style={{ padding: "9px 16px", borderRadius: 10, border: "1.5px solid #EAE4EF", background: "#fff", fontSize: 13, fontWeight: 600, color: "#553366", cursor: "pointer" }}>
            + Upload / Append
          </button>
          {selected.size > 0 && (
            <button
              onClick={() => setShowBatch(true)}
              disabled={creating}
              className="gradient-btn"
              style={{ padding: "9px 18px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {creating ? "Creating…" : `Create Batch (${selected.size})`}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: "14px 16px", marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={filters.search}
          onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
          placeholder="Search company…"
          style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #EAE4EF", fontSize: 13, color: "#220133", outline: "none", minWidth: 180 }}
        />
        <select value={filters.ats} onChange={e => setFilters(f => ({ ...f, ats: e.target.value }))}
          style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #EAE4EF", fontSize: 13, color: "#220133", outline: "none", background: "#fff" }}>
          <option value="">All ATS / HCM</option>
          {data?.filters.atsOptions.map(a => (
            <option key={a} value={a}>{ATS_LABEL[a] ?? a}</option>
          ))}
        </select>
        <input
          value={filters.hq}
          onChange={e => setFilters(f => ({ ...f, hq: e.target.value }))}
          placeholder="HQ city / country…"
          style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #EAE4EF", fontSize: 13, color: "#220133", outline: "none", minWidth: 160 }}
        />
        <select value={filters.size} onChange={e => setFilters(f => ({ ...f, size: e.target.value }))}
          style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #EAE4EF", fontSize: 13, color: "#220133", outline: "none", background: "#fff" }}>
          <option value="">All sizes</option>
          {data?.filters.sizeOptions.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {Object.values(filters).some(Boolean) && (
          <button onClick={() => setFilters({ ats: "", hq: "", size: "", search: "" })}
            style={{ fontSize: 12, color: "#FD5A0F", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
            Clear filters ✕
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        {isEmpty ? (
          <div style={{ padding: "64px 0", textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "#9988AA", marginBottom: 16 }}>No companies in dataset yet.</p>
            <button onClick={() => setShowUpload(true)} className="gradient-btn"
              style={{ padding: "10px 24px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Upload your first file →
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #EAE4EF", background: "#FAFAFA" }}>
                  <th style={{ padding: "10px 14px", width: 40 }}>
                    <input type="checkbox"
                      checked={rows.length > 0 && rows.every(r => selected.has(r.id))}
                      onChange={toggleSelectAll}
                      style={{ cursor: "pointer", accentColor: "#FD5A0F" }}
                    />
                  </th>
                  {["#", "Company", "Domain", "HQ", "Size", "ATS / HCM", "Career URL", "Prev. Jobs", "Status"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9988AA", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #EAE4EF" }}>
                      {Array.from({ length: 10 }).map((_, j) => (
                        <td key={j} style={{ padding: "12px 14px" }}>
                          <div style={{ height: 12, borderRadius: 6, background: "#EAE4EF", width: j === 1 ? 120 : 60 }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : rows.map(row => {
                  const isSelected   = selected.has(row.id);
                  const isProcessed  = row.processingStatus?.status === "complete";
                  const jobsExpanded = expandedJobs.has(row.id);

                  return (
                    <tr
                      key={row.id}
                      style={{
                        borderBottom: "1px solid #EAE4EF",
                        background: isSelected ? "#FFF8F5" : isProcessed ? "#FAFAFA" : "",
                        opacity: isProcessed && !isSelected ? 0.55 : 1,
                        transition: "background 0.12s",
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#FDFBFE"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = isSelected ? "#FFF8F5" : isProcessed ? "#FAFAFA" : ""; }}
                    >
                      {/* Checkbox */}
                      <td style={{ padding: "12px 14px" }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(row.id, row)}
                          style={{ cursor: "pointer", accentColor: "#FD5A0F" }}
                        />
                      </td>

                      {/* # */}
                      <td style={{ padding: "12px 14px", color: "#9988AA", fontWeight: 500, whiteSpace: "nowrap" }}>
                        {row.rowNumber ?? "—"}
                      </td>

                      {/* Company name */}
                      <td style={{ padding: "12px 14px", maxWidth: 220 }}>
                        <span style={{ fontWeight: 600, color: "#220133", display: "block", lineHeight: 1.4 }}>
                          {row.companyName}
                        </span>
                      </td>

                      {/* Domain */}
                      <td style={{ padding: "12px 14px", color: "#553366", whiteSpace: "nowrap" }}>
                        {row.domain || <span style={{ color: "#D0C8D8" }}>—</span>}
                      </td>

                      {/* HQ */}
                      <td style={{ padding: "12px 14px", color: "#553366", whiteSpace: "nowrap" }}>
                        {row.headquarters || <span style={{ color: "#D0C8D8" }}>—</span>}
                      </td>

                      {/* Size */}
                      <td style={{ padding: "12px 14px", color: "#553366", whiteSpace: "nowrap" }}>
                        {row.employeeSize || <span style={{ color: "#D0C8D8" }}>—</span>}
                      </td>

                      {/* ATS */}
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        {row.atsType
                          ? <Pill label={ATS_LABEL[row.atsType] ?? row.atsType} color="#553366" bg="#F4EFF6" />
                          : row.hcmRaw
                            ? <span style={{ fontSize: 12, color: "#9988AA" }}>{row.hcmRaw}</span>
                            : <span style={{ color: "#D0C8D8" }}>—</span>
                        }
                      </td>

                      {/* Career URL */}
                      <td style={{ padding: "12px 14px", maxWidth: 200 }}>
                        <a href={row.careerPageUrl} target="_blank" rel="noreferrer"
                          style={{ fontSize: 12, color: "#FD5A0F", textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {row.careerPageUrl.replace(/^https?:\/\//, "")}
                        </a>
                      </td>

                      {/* Previous jobs */}
                      <td style={{ padding: "12px 14px", maxWidth: 220 }}>
                        {row.jobPreview && row.jobPreview.length > 0 ? (
                          <div>
                            {(jobsExpanded ? row.jobPreview : row.jobPreview.slice(0, 2)).map((j, i) => (
                              <div key={i} style={{ fontSize: 11, color: "#553366", lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{j}</div>
                            ))}
                            {row.jobPreview.length > 2 && (
                              <button
                                onClick={() => {
                                  const next = new Set(expandedJobs);
                                  if (jobsExpanded) next.delete(row.id); else next.add(row.id);
                                  setExpandedJobs(next);
                                }}
                                style={{ fontSize: 11, color: "#FD5A0F", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600, marginTop: 2 }}>
                                {jobsExpanded ? "Show less" : `+${row.jobPreview.length - 2} more`}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "#D0C8D8", fontSize: 12 }}>—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        {row.processingStatus ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_DOT[row.processingStatus.status] ?? "#9988AA", flexShrink: 0 }} />
                            <span style={{ fontSize: 11, color: "#553366", fontWeight: 600, textTransform: "capitalize" }}>
                              {row.processingStatus.status}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: "#D0C8D8" }}>Not processed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: "1px solid #EAE4EF" }}>
            <span style={{ fontSize: 12, color: "#9988AA" }}>
              Page {data.page} of {data.pages} · {data.total.toLocaleString()} results
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #EAE4EF", background: "#fff", fontSize: 12, fontWeight: 600, color: "#553366", cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1 }}>
                ← Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(data.pages, p + 1))}
                disabled={page === data.pages}
                style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #EAE4EF", background: "#fff", fontSize: 12, fontWeight: 600, color: "#553366", cursor: page === data.pages ? "not-allowed" : "pointer", opacity: page === data.pages ? 0.4 : 1 }}>
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
