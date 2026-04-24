"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter }         from "next/navigation";
import FlushDatasetButton    from "./FlushDatasetButton";
import { ATS_OPTIONS, resolveAtsValue } from "@/lib/ats";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProcessingStatus { status: string; name: string }

interface DatasetRow {
  id:              string;
  rowNumber:       number | null;
  companyName:     string;
  domain:          string;
  headquarters:    string | null;
  employeeSize:    string | null;
  hcmRaw:          string | null;
  atsType:         string | null;
  careerPageUrl:   string;
  sourceFile:      string | null;
  processingStatus: ProcessingStatus | null;
  // Persisted URL validation fields
  urlReachable:    boolean | null;
  urlConfidence:   string | null;
  urlDetectedAts:  string | null;
  urlSuggestedUrl: string | null;
  urlIsCareerPage: boolean | null;
  urlReason:       string | null;
  urlValidatedAt:  string | null;
  // POC contact fields
  pocFirstName:    string | null;
  pocLastName:     string | null;
  pocEmail:        string | null;
  // Enrichment fields
  hrStackStatus:      string | null;
  hrStack:            {
    ats?:  { vendor: string; confidence: number; source: string } | null;
    hcm?:  { vendor: string; confidence: number; source: string } | null;
    lxp?:  { vendor: string; confidence: number; source: string } | null;
    hris?: { vendor: string; confidence: number; source: string } | null;
  } | null;
  linkedinUrl:        string | null;
  linkedinConfidence: number | null;
  linkedinStatus:     string | null;
  industry:           string | null;
  industryStatus:     string | null;
}

interface ApiResponse {
  rows:    DatasetRow[];
  total:   number;
  page:    number;
  pages:   number;
  filters: { atsOptions: string[]; sizeOptions: string[]; industryOptions: string[] };
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const ATS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  workday:      { label: "Workday",      color: "#1d4ed8", bg: "rgba(37,99,235,0.1)",   border: "rgba(37,99,235,0.25)"  },
  oracle_hcm:   { label: "Oracle HCM",   color: "#b91c1c", bg: "rgba(220,38,38,0.09)",  border: "rgba(220,38,38,0.22)"  },
  oracle_taleo: { label: "Oracle Taleo", color: "#b45309", bg: "rgba(217,119,6,0.09)",  border: "rgba(217,119,6,0.22)"  },
  sap_sf:       { label: "SAP SF",       color: "#047857", bg: "rgba(5,150,105,0.09)",  border: "rgba(5,150,105,0.22)"  },
};

const STATUS_CFG: Record<string, { color: string; bg: string }> = {
  complete:    { color: "#059669", bg: "rgba(16,185,129,0.1)"  },
  in_progress: { color: "#d97706", bg: "rgba(245,158,11,0.1)"  },
  failed:      { color: "#dc2626", bg: "rgba(239,68,68,0.1)"   },
  blocked:     { color: "#dc2626", bg: "rgba(239,68,68,0.1)"   },
  pending:     { color: "#6b7280", bg: "rgba(156,163,175,0.1)" },
};

// Deterministic avatar color
const PALETTE = ["#7c3aed","#2563eb","#059669","#d97706","#dc2626","#0891b2","#be185d","#4f46e5"];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return PALETTE[h % PALETTE.length];
}

// ── Upload Modal ──────────────────────────────────────────────────────────────

interface ManualRow {
  companyName:   string;
  careerPageUrl: string;
  atsType:       string;
  headquarters:  string;
  employeeSize:  string;
  pocFirstName:  string;
  pocLastName:   string;
  pocEmail:      string;
  _errors?:      Partial<Record<keyof ManualRow, string>>;
}

function emptyManualRow(): ManualRow {
  return {
    companyName: "", careerPageUrl: "", atsType: "",
    headquarters: "", employeeSize: "",
    pocFirstName: "", pocLastName: "", pocEmail: "",
  };
}

type ManualField = Exclude<keyof ManualRow, "_errors">;

// Column order used when pasting TSV/CSV blobs from Excel/Sheets.
// Must match the visible header order in ManualEntryTable.
const MANUAL_COLS: readonly ManualField[] = [
  "companyName", "careerPageUrl", "atsType",
  "headquarters", "employeeSize",
  "pocFirstName", "pocLastName", "pocEmail",
];

function UploadModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [mode,  setMode]  = useState<"file" | "manual">("file");
  const [stage, setStage] = useState<"pick" | "preview" | "uploading" | "done">("pick");
  const [stats, setStats] = useState<{ total: number; newRows: number; duplicates: number; existingInDb: number } | null>(null);
  const [file,  setFile]  = useState<File | null>(null);
  const [error, setError] = useState("");
  const [drag,  setDrag]  = useState(false);
  const [manualRows, setManualRows] = useState<ManualRow[]>([emptyManualRow()]);
  const inputRef          = useRef<HTMLInputElement>(null);

  const handleFile = async (f: File) => {
    if (!f.name.match(/\.(xlsx|xls)$/i)) { setError("Please upload an .xlsx or .xls file."); return; }
    setFile(f); setError(""); setStage("uploading");
    const fd  = new FormData(); fd.append("file", f);
    const res = await fetch("/api/admin/dataset/upload?dryRun=true", { method: "POST", body: fd });
    const d   = await res.json();
    if (!res.ok) { setError(d.error ?? "Parse failed."); setStage("pick"); return; }
    setStats(d); setStage("preview");
  };

  const handleConfirm = async () => {
    if (mode === "manual") return handleManualConfirm();
    if (!file) return;
    setStage("uploading");
    const fd  = new FormData(); fd.append("file", file);
    const res = await fetch("/api/admin/dataset/upload", { method: "POST", body: fd });
    const d   = await res.json();
    if (!res.ok) { setError(d.error ?? "Upload failed."); setStage("preview"); return; }
    setStage("done");
    setTimeout(() => { onDone(); onClose(); }, 1200);
  };

  // ── Manual entry helpers ────────────────────────────────────────────────────
  const updateManualRow = (i: number, patch: Partial<ManualRow>) => {
    setManualRows(rows => rows.map((r, idx) => {
      if (idx !== i) return r;
      const next = { ...r, ...patch };
      if (next._errors) {
        const cleared = { ...next._errors };
        for (const key of Object.keys(patch) as (keyof ManualRow)[]) delete cleared[key];
        next._errors = cleared;
      }
      return next;
    }));
  };

  const addManualRow    = () => setManualRows(rows => [...rows, emptyManualRow()]);
  const removeManualRow = (i: number) => setManualRows(rows => rows.length <= 1 ? rows : rows.filter((_, idx) => idx !== i));

  // Excel/Sheets paste: TSV with \n row delimiter and \t cell delimiter.
  // Anchor at the cell the user pasted into, fill rightwards + downwards,
  // auto-adding rows as needed. Header row (first cell starts with "company") is skipped.
  const handlePaste = (rowIndex: number, colIndex: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const raw = e.clipboardData.getData("text");
    if (!raw.includes("\n") && !raw.includes("\t")) return; // single-cell paste — native

    e.preventDefault();

    const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.length > 0);
    if (lines.length === 0) return;

    const firstCell = (lines[0].split("\t")[0] ?? "").trim().toLowerCase();
    const dataLines = firstCell.startsWith("company") ? lines.slice(1) : lines;
    if (dataLines.length === 0) return;

    const patches: Partial<ManualRow>[] = dataLines.map(line => {
      const cells = line.split("\t");
      const patch: Partial<ManualRow> = {};
      for (let i = 0; i < cells.length; i++) {
        const target = colIndex + i;
        if (target >= MANUAL_COLS.length) break;
        const field = MANUAL_COLS[target];
        let value = (cells[i] ?? "").trim();
        if (field === "atsType") value = resolveAtsValue(value) ?? "";
        (patch as Record<string, string>)[field] = value;
      }
      return patch;
    });

    setManualRows(rows => {
      const needed = rowIndex + patches.length;
      const next = rows.length < needed
        ? [...rows, ...Array.from({ length: needed - rows.length }, () => emptyManualRow())]
        : [...rows];
      for (let i = 0; i < patches.length; i++) {
        const target = rowIndex + i;
        next[target] = { ...next[target], ...patches[i], _errors: {} };
      }
      return next;
    });
  };

  const validateManualRows = (): { valid: boolean; rows: ManualRow[] } => {
    let valid = true;
    const validated = manualRows.map(r => {
      const errs: Partial<Record<keyof ManualRow, string>> = {};
      if (!r.companyName.trim())   { errs.companyName   = "Required"; valid = false; }
      if (!r.careerPageUrl.trim()) { errs.careerPageUrl = "Required"; valid = false; }
      else {
        try { new URL(r.careerPageUrl.trim()); }
        catch { errs.careerPageUrl = "Invalid URL"; valid = false; }
      }
      if (!r.atsType.trim()) { errs.atsType = "Required"; valid = false; }
      return { ...r, _errors: errs };
    });
    return { valid, rows: validated };
  };

  const stripErrors = (rows: ManualRow[]) => rows.map(({ _errors, ...rest }) => rest); // eslint-disable-line @typescript-eslint/no-unused-vars

  const handleManualSubmit = async () => {
    setError("");
    const { valid, rows } = validateManualRows();
    setManualRows(rows);
    if (!valid) { setError("Please fix the highlighted fields."); return; }
    setStage("uploading");
    const res = await fetch("/api/admin/dataset/manual?dryRun=true", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ rows: stripErrors(rows) }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error ?? "Validation failed.");
      setStage("pick");
      return;
    }
    setStats(d); setStage("preview");
  };

  const handleManualConfirm = async () => {
    setStage("uploading");
    const res = await fetch("/api/admin/dataset/manual", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ rows: stripErrors(manualRows) }),
    });
    const d = await res.json();
    if (!res.ok) { setError(d.error ?? "Save failed."); setStage("preview"); return; }
    setStage("done");
    setTimeout(() => { onDone(); onClose(); }, 1200);
  };

  const inPick          = stage === "pick";
  const modalMaxWidth   = mode === "manual" && inPick ? 960 : 500;
  const totalManualRows = manualRows.length;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(22,0,34,0.6)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{
        width: "100%", maxWidth: modalMaxWidth, background: "#fff",
        borderRadius: 20, boxShadow: "0 24px 60px rgba(34,1,51,0.25)",
        padding: 32, animation: "modalIn 0.22s ease",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#220133", margin: "0 0 4px" }}>
              {mode === "manual" ? "Add Companies Manually" : "Upload Dataset"}
            </h2>
            <p style={{ fontSize: 12, color: "#9988AA", margin: 0 }}>
              New companies are appended. Duplicates (matched by domain) are skipped.
            </p>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #EAE4EF", background: "#F9F7FB", cursor: "pointer", fontSize: 16, color: "#9988AA", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        {/* Mode tabs — only shown on pick stage */}
        {inPick && (
          <div style={{ display: "flex", gap: 6, marginBottom: 18, padding: 4, background: "#F4EFF6", borderRadius: 12, border: "1px solid #EAE4EF" }}>
            {(["file", "manual"] as const).map(m => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(""); }}
                  style={{
                    flex: 1, padding: "9px 0", borderRadius: 9, border: "none",
                    background: active ? "#fff" : "transparent",
                    boxShadow:  active ? "0 2px 6px rgba(34,1,51,0.08)" : "none",
                    color:      active ? "#220133" : "#9988AA",
                    fontSize:   13, fontWeight: 700, cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {m === "file" ? "📂 Upload File" : "✍️ Enter Manually"}
                </button>
              );
            })}
          </div>
        )}

        <div style={{ background: "#F4EFF6", borderRadius: 10, padding: "10px 14px", marginBottom: 20, fontSize: 12, color: "#553366", lineHeight: 1.6 }}>
          <strong>How it works:</strong> Your existing dataset is preserved. Only companies with a domain not already in the dataset will be added.
        </div>

        {/* Pick — File mode */}
        {inPick && mode === "file" && (
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            style={{
              borderRadius: 14, border: `2px dashed ${drag ? "#FD5A0F" : "#D0C8D8"}`,
              background: drag ? "#FFF8F5" : "#FAFAFA",
              padding: "32px 24px", textAlign: "center", cursor: "pointer",
              transition: "all 0.2s", boxShadow: drag ? "0 0 0 4px rgba(253,90,15,0.1)" : "none",
            }}
          >
            <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            <div style={{ fontSize: 28, marginBottom: 10 }}>📂</div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#220133", margin: "0 0 4px" }}>Drop your Excel file here</p>
            <p style={{ fontSize: 12, color: "#9988AA", margin: 0 }}>or <span style={{ color: "#FD5A0F", fontWeight: 600 }}>click to browse</span> · .xlsx / .xls</p>
          </div>
        )}

        {/* Pick — Manual mode */}
        {inPick && mode === "manual" && (
          <div>
            <div style={{ overflowX: "auto", border: "1px solid #EAE4EF", borderRadius: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#FAFAFA", borderBottom: "1px solid #EAE4EF" }}>
                    {[
                      { label: "Company Name *",   width: 150 },
                      { label: "Career URL *",     width: 190 },
                      { label: "HCM / ATS *",      width: 130 },
                      { label: "Headquarters",     width: 120 },
                      { label: "Employee Size",    width: 100 },
                      { label: "POC First",        width: 100 },
                      { label: "POC Last",         width: 100 },
                      { label: "POC Email",        width: 150 },
                      { label: "",                 width: 36  },
                    ].map(h => (
                      <th key={h.label} style={{ padding: "10px 10px", textAlign: "left", fontWeight: 700, color: "#553366", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", minWidth: h.width }}>
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {manualRows.map((row, i) => {
                    const err = row._errors ?? {};
                    const inputStyle = (hasError: boolean): React.CSSProperties => ({
                      width: "100%", padding: "7px 9px", fontSize: 12,
                      borderRadius: 7, boxSizing: "border-box",
                      border: `1px solid ${hasError ? "#dc2626" : "#EAE4EF"}`,
                      background: hasError ? "#fef2f2" : "#fff",
                      color: "#220133", outline: "none",
                      transition: "border-color 0.15s",
                    });
                    return (
                      <tr key={i} style={{ borderBottom: i === manualRows.length - 1 ? "none" : "1px solid #F4EFF6" }}>
                        <td style={{ padding: "8px 8px", verticalAlign: "top" }}>
                          <input value={row.companyName} onChange={e => updateManualRow(i, { companyName: e.target.value })} onPaste={e => handlePaste(i, 0, e)} placeholder="Acme Co" style={inputStyle(!!err.companyName)} />
                          {err.companyName && <div style={{ fontSize: 10, color: "#dc2626", marginTop: 3 }}>{err.companyName}</div>}
                        </td>
                        <td style={{ padding: "8px 8px", verticalAlign: "top" }}>
                          <input value={row.careerPageUrl} onChange={e => updateManualRow(i, { careerPageUrl: e.target.value })} onPaste={e => handlePaste(i, 1, e)} placeholder="https://jobs.example.com" style={inputStyle(!!err.careerPageUrl)} />
                          {err.careerPageUrl && <div style={{ fontSize: 10, color: "#dc2626", marginTop: 3 }}>{err.careerPageUrl}</div>}
                        </td>
                        <td style={{ padding: "8px 8px", verticalAlign: "top" }}>
                          <select value={row.atsType} onChange={e => updateManualRow(i, { atsType: e.target.value })} style={inputStyle(!!err.atsType)}>
                            <option value="">— select —</option>
                            {ATS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          {err.atsType && <div style={{ fontSize: 10, color: "#dc2626", marginTop: 3 }}>{err.atsType}</div>}
                        </td>
                        <td style={{ padding: "8px 8px", verticalAlign: "top" }}>
                          <input value={row.headquarters} onChange={e => updateManualRow(i, { headquarters: e.target.value })} onPaste={e => handlePaste(i, 3, e)} placeholder="London, UK" style={inputStyle(false)} />
                        </td>
                        <td style={{ padding: "8px 8px", verticalAlign: "top" }}>
                          <input value={row.employeeSize} onChange={e => updateManualRow(i, { employeeSize: e.target.value })} onPaste={e => handlePaste(i, 4, e)} placeholder="1000-5000" style={inputStyle(false)} />
                        </td>
                        <td style={{ padding: "8px 8px", verticalAlign: "top" }}>
                          <input value={row.pocFirstName} onChange={e => updateManualRow(i, { pocFirstName: e.target.value })} onPaste={e => handlePaste(i, 5, e)} placeholder="Jane" style={inputStyle(false)} />
                        </td>
                        <td style={{ padding: "8px 8px", verticalAlign: "top" }}>
                          <input value={row.pocLastName} onChange={e => updateManualRow(i, { pocLastName: e.target.value })} onPaste={e => handlePaste(i, 6, e)} placeholder="Doe" style={inputStyle(false)} />
                        </td>
                        <td style={{ padding: "8px 8px", verticalAlign: "top" }}>
                          <input type="email" value={row.pocEmail} onChange={e => updateManualRow(i, { pocEmail: e.target.value })} onPaste={e => handlePaste(i, 7, e)} placeholder="jane@example.com" style={inputStyle(false)} />
                        </td>
                        <td style={{ padding: "8px 6px", verticalAlign: "top", textAlign: "center" }}>
                          <button
                            onClick={() => removeManualRow(i)}
                            disabled={manualRows.length <= 1}
                            title="Delete row"
                            style={{
                              width: 26, height: 26, borderRadius: 7, fontSize: 13,
                              border: "1px solid #EAE4EF",
                              background: manualRows.length <= 1 ? "#F9F7FB" : "#fff",
                              color:      manualRows.length <= 1 ? "#D0C8D8" : "#dc2626",
                              cursor:     manualRows.length <= 1 ? "not-allowed" : "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto",
                            }}
                          >✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, gap: 12 }}>
              <button
                onClick={addManualRow}
                style={{ padding: "8px 14px", borderRadius: 8, border: "1px dashed #FD5A0F", background: "#FFF8F5", color: "#FD5A0F", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >+ Add row</button>
              <div style={{ fontSize: 11, color: "#9988AA", textAlign: "right", lineHeight: 1.5 }}>
                {totalManualRows} row{totalManualRows === 1 ? "" : "s"} · * = required<br />
                <span style={{ color: "#7c3aed" }}>Tip:</span> copy cells from Excel/Sheets and paste into any text cell.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={onClose} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "1px solid #EAE4EF", background: "#fff", fontSize: 13, fontWeight: 600, color: "#553366", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleManualSubmit} style={{ flex: 2, padding: "11px 0", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #220133, #FD5A0F)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(253,90,15,0.3)" }}>
                Review {totalManualRows} {totalManualRows === 1 ? "entry" : "entries"} →
              </button>
            </div>
          </div>
        )}

        {/* Uploading */}
        {stage === "uploading" && (
          <div style={{ textAlign: "center", padding: "36px 0" }}>
            <svg style={{ animation: "spin 0.9s linear infinite", color: "#FD5A0F", display: "inline-block" }} width="32" height="32" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.2"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            <p style={{ fontSize: 13, color: "#9988AA", marginTop: 12 }}>{mode === "manual" ? "Validating entries…" : "Analysing file…"}</p>
          </div>
        )}

        {/* Preview */}
        {stage === "preview" && stats && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
              {[
                { label: mode === "manual" ? "Rows submitted" : "Rows in file", value: stats.total, color: "#220133" },
                { label: "New to add",          value: stats.newRows,       color: "#059669" },
                { label: "Already in DB",       value: stats.existingInDb,  color: "#9988AA" },
                { label: "Duplicates skipped",  value: stats.duplicates,    color: "#d97706" },
              ].map(s => (
                <div key={s.label} style={{ background: "#F9F7FB", borderRadius: 12, padding: "14px 16px", border: "1px solid #EAE4EF" }}>
                  <div style={{ fontSize: 10, color: "#9988AA", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: s.color, letterSpacing: "-0.5px" }}>{s.value}</div>
                </div>
              ))}
            </div>
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#92400e", marginBottom: 18 }}>
              <strong>Confirm:</strong> {stats.newRows} new companies will be added to your dataset.
              {stats.duplicates > 0 && ` ${stats.duplicates} duplicate domain(s) will be skipped.`}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "1px solid #EAE4EF", background: "#fff", fontSize: 13, fontWeight: 600, color: "#553366", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleConfirm} style={{ flex: 2, padding: "11px 0", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #220133, #FD5A0F)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(253,90,15,0.3)" }}>
                Append {stats.newRows} companies →
              </button>
            </div>
          </div>
        )}

        {/* Done */}
        {stage === "done" && (
          <div style={{ textAlign: "center", padding: "28px 0" }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>✅</div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#059669" }}>Dataset updated!</p>
          </div>
        )}

        {error && (
          <p style={{ marginTop: 12, fontSize: 12, color: "#dc2626", background: "#fef2f2", padding: "8px 12px", borderRadius: 8, border: "1px solid #fecaca" }}>{error}</p>
        )}
      </div>
    </div>
  );
}

// ── Reprocess Warning ─────────────────────────────────────────────────────────

function ReprocessWarning({ company, batchName, onConfirm, onCancel }: { company: string; batchName: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(22,0,34,0.6)", backdropFilter: "blur(6px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 20, boxShadow: "0 24px 60px rgba(34,1,51,0.25)", padding: 28, animation: "modalIn 0.22s ease" }}>
        <div style={{ fontSize: 36, marginBottom: 14 }}>⚠️</div>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: "#220133", marginBottom: 8 }}>Already processed</h3>
        <p style={{ fontSize: 13, color: "#553366", lineHeight: 1.65, marginBottom: 22 }}>
          <strong>{company}</strong> was already processed in batch <strong>{batchName}</strong>.
          Adding it again will re-scrape the career page and re-run the full analysis. Previous results will remain in the database.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid #EAE4EF", background: "#fff", fontSize: 13, fontWeight: 600, color: "#553366", cursor: "pointer" }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex: 2, padding: "10px 0", borderRadius: 10, border: "none", background: "#ef4444", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(239,68,68,0.3)" }}>Reprocess anyway</button>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow({ i }: { i: number }) {
  return (
    <tr style={{ borderBottom: "1px solid #F4EFF6", animation: `fadeIn 0.3s ease ${i * 0.04}s both` }}>
      {[40, 30, 160, 130, 90, 80, 70, 80, 140, 50, 80].map((w, j) => (
        <td key={j} style={{ padding: "16px 16px" }}>
          <div style={{ height: 11, borderRadius: 6, background: "linear-gradient(90deg, #EAE4EF, #F4EFF6, #EAE4EF)", backgroundSize: "200% 100%", animation: "shimmer 1.6s ease-in-out infinite", width: w }} />
        </td>
      ))}
    </tr>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

// ── Validation types ──────────────────────────────────────────────────────────

interface RowValidation {
  reachable:    boolean;
  confidence:   string;
  reason:       string;
  detectedAts:  string | null;
  suggestedUrl: string | null;
  isCareerPage: boolean | null;
  validatedAt:  string | null;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DatasetTable() {
  const router = useRouter();

  const [data,        setData]        = useState<ApiResponse | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [page,        setPage]        = useState(1);
  const [filters,     setFilters]     = useState({ ats: "", hq: "", size: "", search: "", enriched: "", industry: "" });
  const [searchInput, setSearchInput] = useState("");   // live input value (debounced into filters.search)
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  const [showEnrichment, setShowEnrichment] = useState(() => {
    try { return localStorage.getItem("showEnrichment") === "true"; } catch { return false; }
  });

  const [showUpload,   setShowUpload]   = useState(false);
  const [creating,     setCreating]     = useState(false);
  const [reprocess,    setReprocess]    = useState<DatasetRow | null>(null);

  // Validation state: rowId → result or "loading"
  const [validationMap,  setValidationMap]  = useState<Record<string, RowValidation | "loading">>({});
  const [validatingAll,  setValidatingAll]  = useState(false);

  // Inline URL edit state
  const [editingRow,   setEditingRow]   = useState<string | null>(null);
  const [editUrlValue, setEditUrlValue] = useState("");
  const [editAtsValue, setEditAtsValue] = useState("");
  const [saving,       setSaving]       = useState(false);

  // Batch creation error (URL validation failures)
  const [batchError, setBatchError] = useState<{ message: string; failed: { url: string; company: string; reason: string }[] } | null>(null);

  const fetchData = useCallback(async () => {
    // Cancel any in-flight request to prevent race conditions
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50", ats: filters.ats, hq: filters.hq, size: filters.size, search: filters.search, enriched: filters.enriched, industry: filters.industry });
      const res  = await fetch(`/api/admin/dataset?${params}`, { signal: controller.signal });
      const json = await res.json() as ApiResponse;

      setData(json);
      setValidationMap(prev => {
        const next = { ...prev };
        for (const row of json.rows) {
          if (row.urlValidatedAt && !(row.id in next)) {
            next[row.id] = {
              reachable:    row.urlReachable ?? false,
              confidence:   row.urlConfidence ?? "low",
              reason:       row.urlReason ?? "",
              detectedAts:  row.urlDetectedAts ?? null,
              suggestedUrl: row.urlSuggestedUrl ?? null,
              isCareerPage: row.urlIsCareerPage ?? null,
              validatedAt:  row.urlValidatedAt,
            };
          }
        }
        return next;
      });
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return; // stale request — ignore
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Debounce search input → update filters.search after 350 ms of inactivity
  // Also reset page to 1 whenever any filter changes (combined to avoid double fetch)
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters(f => ({ ...f, search: searchInput }));
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset page when non-search filters change
  const prevFiltersRef = useRef(filters);
  useEffect(() => {
    const prev = prevFiltersRef.current;
    if (prev.ats !== filters.ats || prev.hq !== filters.hq || prev.size !== filters.size || prev.enriched !== filters.enriched || prev.industry !== filters.industry) {
      setPage(1);
    }
    prevFiltersRef.current = filters;
  }, [filters]);

  function toggleSelect(id: string, row: DatasetRow) {
    if (selected.has(id)) {
      const next = new Set(selected); next.delete(id); setSelected(next); return;
    }
    if (row.processingStatus?.status === "complete") { setReprocess(row); return; }
    const next = new Set(selected); next.add(id); setSelected(next);
  }

  function toggleSelectAll() {
    if (!data) return;
    const ids = data.rows.map(r => r.id);
    if (ids.every(id => selected.has(id))) {
      const next = new Set(selected); ids.forEach(id => next.delete(id)); setSelected(next);
    } else {
      const next = new Set(selected); ids.forEach(id => next.add(id)); setSelected(next);
    }
  }

  async function handleCreateBatch() {
    if (selected.size === 0 || creating) return;
    setCreating(true); setBatchError(null);
    try {
      const res = await fetch("/api/admin/dataset/batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rowIds: Array.from(selected) }) });
      const text = await res.text();
      const d = text ? JSON.parse(text) : {};
      setCreating(false);
      if (res.ok) {
        setSelected(new Set());
        const batchIds: string[] = Array.isArray(d.batchIds) ? d.batchIds : (d.batchId ? [d.batchId] : []);
        if (batchIds.length === 1) router.push(`/admin/batches/${batchIds[0]}`);
        else                       router.push(`/admin/batches`);
        return;
      }
      if (d.error === "URL_VALIDATION_FAILED") {
        setBatchError({ message: d.message, failed: d.failed });
      } else {
        setBatchError({ message: d.error ?? `Server error (${res.status}). Check console for details.`, failed: [] });
      }
    } catch (err) {
      setCreating(false);
      setBatchError({ message: "Unexpected error creating batch. Please try again.", failed: [] });
      console.error("[handleCreateBatch]", err);
    }
  }

  async function handleValidateAll(forceAll = false) {
    if (!data) return;
    const targetIds = selected.size > 0 ? Array.from(selected) : data.rows.map(r => r.id);
    if (targetIds.length > 500) {
      alert("Too many rows to validate at once. Filter or select fewer than 500 rows.");
      return;
    }

    // Smart skip: separate already-validated from pending
    const alreadyDone  = targetIds.filter(id => {
      const row = data.rows.find(r => r.id === id);
      return row?.urlValidatedAt != null;
    });
    const needsCheck   = forceAll ? targetIds : targetIds.filter(id => {
      const row = data.rows.find(r => r.id === id);
      return row?.urlValidatedAt == null;
    });

    if (needsCheck.length === 0) {
      const rerun = confirm(
        `All ${alreadyDone.length} rows are already validated.\n\nRe-validate all anyway?`
      );
      if (!rerun) return;
      return handleValidateAll(true);
    }

    const skipMsg  = alreadyDone.length > 0 ? ` · ${alreadyDone.length} already validated (skipped)` : "";
    const confirmed = confirm(
      `Validating ${needsCheck.length} URL(s)${skipMsg}.\n\n` +
      `Requests are rate-limited (5 concurrent, 300ms delay) to avoid IP bans.\n\nContinue?`
    );
    if (!confirmed) return;

    setValidatingAll(true);
    // Set only the rows being validated to loading state (already-done rows keep their badge)
    setValidationMap(prev => {
      const next = { ...prev };
      needsCheck.forEach(id => { next[id] = "loading"; });
      return next;
    });

    try {
      const res = await fetch("/api/admin/dataset/validate-all", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ rowIds: needsCheck }),
      });
      const d = await res.json();
      if (res.ok) {
        const next: Record<string, RowValidation> = {};
        for (const r of d.rows as { id: string; reachable: boolean; confidence: string; reason: string; detectedAts: string | null; suggestedUrl: string | null; isCareerPage: boolean | null; validatedAt: string }[]) {
          next[r.id] = {
            reachable:    r.reachable,
            confidence:   r.confidence,
            reason:       r.reason,
            detectedAts:  r.detectedAts,
            suggestedUrl: r.suggestedUrl,
            isCareerPage: r.isCareerPage,
            validatedAt:  r.validatedAt,
          };
        }
        setValidationMap(prev => ({ ...prev, ...next }));
      }
    } finally {
      setValidatingAll(false);
    }
  }

  async function handleSaveEdit(rowId: string) {
    setSaving(true);
    const res = await fetch(`/api/admin/dataset/rows/${rowId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ careerPageUrl: editUrlValue, atsType: editAtsValue || null }),
    });
    setSaving(false);
    if (res.ok) {
      setEditingRow(null);
      // Clear stale validation for this row
      setValidationMap(prev => { const next = { ...prev }; delete next[rowId]; return next; });
      fetchData();
    }
  }

  const rows    = data?.rows ?? [];
  const isEmpty = !loading && rows.length === 0 && !Object.values(filters).some(Boolean);
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div style={{ animation: "fadeIn 0.35s ease" }}>

      {/* Modals */}
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onDone={() => { setSelected(new Set()); fetchData(); }} />}

      {/* Batch creation URL validation error */}
      {batchError && (
        <div style={{
          marginBottom: 16, padding: "14px 18px", borderRadius: 12,
          background: "#fef2f2", border: "1px solid #fecaca",
          animation: "fadeIn 0.2s ease",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#dc2626", margin: "0 0 6px" }}>
                Cannot create batch — {batchError.failed.length} URL(s) unreachable
              </p>
              <p style={{ fontSize: 12, color: "#553366", margin: "0 0 8px" }}>{batchError.message}</p>
              <ul style={{ margin: 0, padding: "0 0 0 16px", listStyle: "disc" }}>
                {batchError.failed.map((f, i) => (
                  <li key={i} style={{ fontSize: 11, color: "#553366", marginBottom: 2 }}>
                    <strong>{f.company}</strong>: {f.url} — <span style={{ color: "#dc2626" }}>{f.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
            <button onClick={() => setBatchError(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#9988AA", marginLeft: 12 }}>✕</button>
          </div>
        </div>
      )}
      {reprocess  && (
        <ReprocessWarning
          company={reprocess.companyName}
          batchName={reprocess.processingStatus?.name ?? "a previous batch"}
          onCancel={() => setReprocess(null)}
          onConfirm={() => { const next = new Set(selected); next.add(reprocess.id); setSelected(next); setReprocess(null); }}
        />
      )}

      {/* ── Page header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#220133", margin: "0 0 4px", letterSpacing: "-0.5px" }}>Prospect Dataset</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <p style={{ fontSize: 13, color: "#9988AA", margin: 0 }}>
              {data ? `${data.total.toLocaleString()} companies` : "Loading…"}
            </p>
            {selected.size > 0 && (
              <span style={{
                fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                background: "rgba(253,90,15,0.12)", color: "#FD5A0F",
                border: "1px solid rgba(253,90,15,0.25)", animation: "fadeIn 0.2s ease",
              }}>
                {selected.size} selected
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <FlushDatasetButton onFlushed={() => { setSelected(new Set()); fetchData(); }} />
          {/* Validate URLs */}
          <button
            onClick={() => handleValidateAll()}
            disabled={validatingAll || loading}
            style={{
              padding: "9px 18px", borderRadius: 10, border: "1.5px solid #EAE4EF",
              background: "#fff", fontSize: 13, fontWeight: 600,
              color: validatingAll ? "#9988AA" : "#553366",
              cursor: validatingAll ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
            }}
            onMouseEnter={e => { if (!validatingAll) (e.currentTarget as HTMLButtonElement).style.background = "#F4EFF6"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}
          >
            {validatingAll
              ? <svg style={{ animation: "spin 0.9s linear infinite" }} width="12" height="12" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
              : "🔍"
            }
            {validatingAll ? "Validating…" : selected.size > 0 ? `Validate (${selected.size})` : "Validate URLs"}
          </button>
          {/* Export XLSX */}
          <button
            onClick={() => {
              const ids = selected.size > 0 ? Array.from(selected).join(",") : "";
              window.open(`/api/admin/dataset/export${ids ? `?rowIds=${ids}` : ""}`, "_blank");
            }}
            style={{
              padding: "9px 18px", borderRadius: 10, border: "1.5px solid #EAE4EF",
              background: "#fff", fontSize: 13, fontWeight: 600, color: "#553366",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#F4EFF6"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}
          >
            ⬇ Export XLSX
          </button>
          <button
            onClick={() => setShowUpload(true)}
            style={{
              padding: "9px 18px", borderRadius: 10, border: "1.5px solid #EAE4EF",
              background: "#fff", fontSize: 13, fontWeight: 600, color: "#553366",
              cursor: "pointer", transition: "all 0.15s",
              display: "flex", alignItems: "center", gap: 6,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#F4EFF6"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#C4B5D0"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#EAE4EF"; }}
          >
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
              <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Upload / Append
          </button>
          {selected.size > 0 && (
            <button
              onClick={handleCreateBatch}
              disabled={creating}
              style={{
                padding: "9px 20px", borderRadius: 10, border: "none",
                background: "linear-gradient(135deg, #220133, #FD5A0F)",
                color: "#fff", fontSize: 13, fontWeight: 700,
                cursor: creating ? "not-allowed" : "pointer",
                opacity: creating ? 0.7 : 1,
                boxShadow: "0 4px 16px rgba(253,90,15,0.35)",
                transition: "transform 0.15s, box-shadow 0.15s",
                animation: "fadeIn 0.2s ease",
                display: "flex", alignItems: "center", gap: 6,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.03)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 22px rgba(253,90,15,0.5)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 16px rgba(253,90,15,0.35)"; }}
            >
              🚀 {creating ? "Starting…" : `Start (${selected.size})`}
            </button>
          )}
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div style={{
        background: "#fff", border: "1px solid #EAE4EF", borderRadius: 16,
        padding: "14px 20px", marginBottom: 16,
        display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center",
        boxShadow: "0 1px 4px rgba(34,1,51,0.04)",
      }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 180px" }}>
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9988AA" }}>
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search company…"
            style={{ width: "100%", padding: "8px 12px 8px 30px", borderRadius: 8, border: "1px solid #EAE4EF", fontSize: 13, color: "#220133", outline: "none", background: "#FAFAFA", boxSizing: "border-box", transition: "border-color 0.15s" }}
            onFocus={e  => { e.currentTarget.style.borderColor = "#FD5A0F"; e.currentTarget.style.background = "#fff"; }}
            onBlur={e   => { e.currentTarget.style.borderColor = "#EAE4EF"; e.currentTarget.style.background = "#FAFAFA"; }}
          />
        </div>

        <select value={filters.ats} onChange={e => setFilters(f => ({ ...f, ats: e.target.value }))}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #EAE4EF", fontSize: 13, color: "#220133", outline: "none", background: "#FAFAFA", cursor: "pointer", flex: "0 0 auto" }}>
          <option value="">All ATS / HCM</option>
          {data?.filters.atsOptions.map(a => <option key={a} value={a}>{ATS_CFG[a]?.label ?? a}</option>)}
        </select>

        <div style={{ position: "relative", flex: "0 1 160px" }}>
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9988AA" }}>
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth="1.8"/>
          </svg>
          <input
            value={filters.hq}
            onChange={e => setFilters(f => ({ ...f, hq: e.target.value }))}
            placeholder="HQ city / country…"
            style={{ width: "100%", padding: "8px 12px 8px 28px", borderRadius: 8, border: "1px solid #EAE4EF", fontSize: 13, color: "#220133", outline: "none", background: "#FAFAFA", boxSizing: "border-box", transition: "border-color 0.15s" }}
            onFocus={e  => { e.currentTarget.style.borderColor = "#FD5A0F"; e.currentTarget.style.background = "#fff"; }}
            onBlur={e   => { e.currentTarget.style.borderColor = "#EAE4EF"; e.currentTarget.style.background = "#FAFAFA"; }}
          />
        </div>

        <select value={filters.size} onChange={e => setFilters(f => ({ ...f, size: e.target.value }))}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #EAE4EF", fontSize: 13, color: "#220133", outline: "none", background: "#FAFAFA", cursor: "pointer", flex: "0 0 auto" }}>
          <option value="">All sizes</option>
          {data?.filters.sizeOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={filters.enriched} onChange={e => setFilters(f => ({ ...f, enriched: e.target.value }))}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #EAE4EF", fontSize: 13, color: "#220133", outline: "none", background: "#FAFAFA", cursor: "pointer", flex: "0 0 auto" }}>
          <option value="">All enrichment</option>
          <option value="hr">HR Stack enriched</option>
          <option value="linkedin">LinkedIn found</option>
        </select>

        <select value={filters.industry} onChange={e => setFilters(f => ({ ...f, industry: e.target.value }))}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #EAE4EF", fontSize: 13, color: "#220133", outline: "none", background: "#FAFAFA", cursor: "pointer", flex: "0 0 auto" }}>
          <option value="">All industries</option>
          {data?.filters.industryOptions.map(i => <option key={i} value={i}>{i}</option>)}
        </select>

        {hasFilters && (
          <button onClick={() => { setFilters({ ats: "", hq: "", size: "", search: "", enriched: "", industry: "" }); setSearchInput(""); }}
            style={{ fontSize: 12, color: "#FD5A0F", background: "none", border: "none", cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
            ✕ Clear filters
          </button>
        )}

        {/* Enrichment column toggle */}
        <button
          onClick={() => setShowEnrichment(v => {
            try { localStorage.setItem("showEnrichment", String(!v)); } catch {}
            return !v;
          })}
          style={{
            marginLeft:   "auto",
            padding:      "0 14px",
            height:       36,
            borderRadius: 8,
            border:       `1.5px solid ${showEnrichment ? "#7c3aed" : "#E8DFF0"}`,
            background:   showEnrichment ? "#f3e8ff" : "#fff",
            color:        showEnrichment ? "#7c3aed" : "#9988AA",
            fontSize:     12,
            fontWeight:   700,
            cursor:       "pointer",
            whiteSpace:   "nowrap",
            display:      "flex",
            alignItems:   "center",
            gap:          6,
            transition:   "all 0.15s",
            flexShrink:   0,
          }}
        >
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          {showEnrichment ? "Hide enrichment" : "Enrichment"}
        </button>
      </div>

      {/* ── Table card ── */}
      <div style={{ background: "#fff", border: "1px solid #EAE4EF", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 12px rgba(34,1,51,0.06)" }}>
        {isEmpty ? (
          <div style={{ padding: "72px 32px", textAlign: "center" }}>
            <div style={{ fontSize: 52, marginBottom: 16, opacity: 0.35 }}>🗃️</div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "#220133", marginBottom: 8 }}>No companies yet</h3>
            <p style={{ fontSize: 13, color: "#9988AA", marginBottom: 24 }}>Upload an Excel file to populate your prospect dataset.</p>
            <button onClick={() => setShowUpload(true)} style={{ padding: "12px 28px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #220133, #FD5A0F)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(253,90,15,0.35)" }}>
              Upload your first file →
            </button>
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #F4EFF6", background: "#FAFAFA", position: "sticky", top: 0, zIndex: 2 }}>
                    <th style={{ padding: "13px 16px", width: 44 }}>
                      <input type="checkbox"
                        checked={rows.length > 0 && rows.every(r => selected.has(r.id))}
                        onChange={toggleSelectAll}
                        style={{ cursor: "pointer", accentColor: "#FD5A0F", width: 15, height: 15 }}
                      />
                    </th>
                    {["#", "Company", "Contact", "HQ", "Size", "ATS / HCM", "Career URL", "Valid?", "Status"].map(h => (
                      <th key={h} style={{ padding: "13px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9988AA", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                    {showEnrichment && (
                      <th style={{ padding: "13px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#7c3aed", whiteSpace: "nowrap" }}>
                        HR Stack
                      </th>
                    )}
                    {showEnrichment && (
                      <th style={{ padding: "13px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#0077b5", whiteSpace: "nowrap" }}>
                        LinkedIn
                      </th>
                    )}
                    {showEnrichment && (
                      <th style={{ padding: "13px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#059669", whiteSpace: "nowrap" }}>
                        Industry
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} i={i} />)
                    : rows.map((row, idx) => {
                        const isSelected  = selected.has(row.id);
                        const isProcessed = row.processingStatus?.status === "complete";
                        const color       = avatarColor(row.companyName);
                        const initial     = row.companyName.trim()[0]?.toUpperCase() ?? "?";
                        const ats         = row.atsType ? ATS_CFG[row.atsType] : null;
                        const sc          = row.processingStatus ? STATUS_CFG[row.processingStatus.status] ?? STATUS_CFG.pending : null;

                        return (
                          <tr
                            key={row.id}
                            style={{
                              borderBottom: idx < rows.length - 1 ? "1px solid #F4EFF6" : "none",
                              background:   isSelected ? "#FFF8F5" : "",
                              borderLeft:   isSelected ? "3px solid #FD5A0F" : "3px solid transparent",
                              opacity:      isProcessed && !isSelected ? 0.55 : 1,
                              transition:   "background 0.12s, border-color 0.12s",
                              animation:    `fadeInUp 0.3s ease ${idx * 0.025}s both`,
                            }}
                            onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = "#FDFBFE"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = isSelected ? "#FFF8F5" : ""; }}
                          >
                            {/* Checkbox */}
                            <td style={{ padding: "14px 16px" }}>
                              <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(row.id, row)}
                                style={{ cursor: "pointer", accentColor: "#FD5A0F", width: 15, height: 15 }} />
                            </td>

                            {/* # */}
                            <td style={{ padding: "14px 16px", color: "#C4B5D0", fontWeight: 500, fontSize: 12 }}>
                              {row.rowNumber ?? "—"}
                            </td>

                            {/* Company */}
                            <td style={{ padding: "14px 16px", minWidth: 200 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, border: `1.5px solid ${color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color, flexShrink: 0 }}>
                                  {initial}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <p style={{ fontSize: 13, fontWeight: 700, color: "#220133", margin: "0 0 1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{row.companyName}</p>
                                  <p style={{ fontSize: 11, color: "#9988AA", margin: 0 }}>{row.domain || "—"}</p>
                                </div>
                              </div>
                            </td>

                            {/* Contact (POC) */}
                            <td style={{ padding: "14px 16px", minWidth: 140 }}>
                              {row.pocEmail ? (
                                <div>
                                  <p style={{ fontSize: 12, fontWeight: 600, color: "#220133", margin: "0 0 1px", whiteSpace: "nowrap" }}>
                                    {[row.pocFirstName, row.pocLastName].filter(Boolean).join(" ") || "—"}
                                  </p>
                                  <a
                                    href={`mailto:${row.pocEmail}`}
                                    style={{ fontSize: 11, color: "#9988AA", textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}
                                    title={row.pocEmail}
                                  >
                                    {row.pocEmail}
                                  </a>
                                </div>
                              ) : (
                                <span style={{ color: "#D0C8D8", fontSize: 12 }}>—</span>
                              )}
                            </td>

                            {/* HQ */}
                            <td style={{ padding: "14px 16px", color: "#553366", whiteSpace: "nowrap", fontSize: 12 }}>
                              {row.headquarters || <span style={{ color: "#D0C8D8" }}>—</span>}
                            </td>

                            {/* Size */}
                            <td style={{ padding: "14px 16px", whiteSpace: "nowrap", fontSize: 12 }}>
                              {row.employeeSize
                                ? <span style={{ padding: "2px 8px", borderRadius: 6, background: "#F4EFF6", color: "#553366", fontSize: 11, fontWeight: 600 }}>{row.employeeSize}</span>
                                : <span style={{ color: "#D0C8D8" }}>—</span>
                              }
                            </td>

                            {/* ATS — task 32: orange highlight on mismatch */}
                            {(() => {
                              const v = validationMap[row.id];
                              const detectedAts = v && v !== "loading" ? v.detectedAts : null;
                              const hasMismatch = !!(detectedAts && row.atsType && detectedAts !== row.atsType);
                              const mismatchTitle = hasMismatch ? `Declared: ${row.atsType} — but URL pattern detected: ${detectedAts}` : undefined;
                              return (
                                <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }} title={mismatchTitle}>
                                  {hasMismatch && (
                                    <div style={{ fontSize: 9, fontWeight: 700, color: "#d97706", marginBottom: 2, letterSpacing: "0.04em" }}>
                                      ⚠ ATS MISMATCH
                                    </div>
                                  )}
                                  {ats
                                    ? <span style={{ padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: hasMismatch ? "rgba(217,119,6,0.12)" : ats.bg, color: hasMismatch ? "#d97706" : ats.color, border: `1px solid ${hasMismatch ? "rgba(217,119,6,0.35)" : ats.border}` }}>{ats.label}</span>
                                    : row.hcmRaw
                                      ? <span style={{ fontSize: 11, color: "#9988AA" }}>{row.hcmRaw}</span>
                                      : <span style={{ color: "#D0C8D8" }}>—</span>
                                  }
                                  {hasMismatch && detectedAts && (
                                    <div style={{ fontSize: 9, color: "#d97706", marginTop: 2 }}>detected: {detectedAts}</div>
                                  )}
                                </td>
                              );
                            })()}

                            {/* Career URL — with inline edit */}
                            <td style={{ padding: "14px 16px", maxWidth: 220 }}>
                              {editingRow === row.id ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                  <input
                                    autoFocus
                                    value={editUrlValue}
                                    onChange={e => setEditUrlValue(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter") handleSaveEdit(row.id); if (e.key === "Escape") setEditingRow(null); }}
                                    style={{ fontSize: 11, padding: "5px 8px", borderRadius: 6, border: "1.5px solid #FD5A0F", outline: "none", width: "100%", boxSizing: "border-box" }}
                                  />
                                  <select
                                    value={editAtsValue}
                                    onChange={e => setEditAtsValue(e.target.value)}
                                    style={{ fontSize: 11, padding: "4px 6px", borderRadius: 6, border: "1px solid #EAE4EF", outline: "none", background: "#FAFAFA" }}
                                  >
                                    <option value="">Unknown ATS</option>
                                    <option value="workday">Workday</option>
                                    <option value="oracle_hcm">Oracle HCM</option>
                                    <option value="oracle_taleo">Oracle Taleo</option>
                                    <option value="sap_sf">SAP SuccessFactors</option>
                                  </select>
                                  <div style={{ display: "flex", gap: 4 }}>
                                    <button
                                      onClick={() => handleSaveEdit(row.id)}
                                      disabled={saving}
                                      style={{ fontSize: 10, padding: "3px 10px", borderRadius: 5, border: "none", background: "#FD5A0F", color: "#fff", cursor: "pointer", fontWeight: 700 }}
                                    >{saving ? "…" : "Save"}</button>
                                    <button
                                      onClick={() => setEditingRow(null)}
                                      style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, border: "1px solid #EAE4EF", background: "#fff", color: "#553366", cursor: "pointer" }}
                                    >Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <a href={row.careerPageUrl} target="_blank" rel="noreferrer"
                                    style={{ fontSize: 11, color: "#FD5A0F", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500, flex: 1, minWidth: 0, display: "block" }}>
                                    {row.careerPageUrl.replace(/^https?:\/\//, "")}
                                  </a>
                                  <button
                                    onClick={e => { e.stopPropagation(); setEditingRow(row.id); setEditUrlValue(row.careerPageUrl); setEditAtsValue(row.atsType ?? ""); }}
                                    title="Edit URL"
                                    style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 5, border: "1px solid #EAE4EF", background: "#F9F7FB", cursor: "pointer", fontSize: 11, color: "#9988AA", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                                  >✏</button>
                                </div>
                              )}
                            </td>

                            {/* Valid? — tasks 30/31/33 */}
                            <td style={{ padding: "14px 16px", minWidth: 120 }}>
                              {(() => {
                                const v = validationMap[row.id];
                                if (!v) return <span style={{ fontSize: 10, color: "#D0C8D8" }}>—</span>;
                                if (v === "loading") return (
                                  <svg style={{ animation: "spin 0.9s linear infinite", color: "#9988AA" }} width="12" height="12" fill="none" viewBox="0 0 24 24">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.2"/>
                                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                                  </svg>
                                );

                                // Badge config — task 30: blocked state
                                type BadgeState = "valid" | "ok" | "notCareer" | "blocked" | "dead";
                                let state: BadgeState;
                                if (!v.reachable && v.confidence === "blocked")   state = "blocked";
                                else if (!v.reachable)                             state = "dead";
                                else if (v.isCareerPage === false)                 state = "notCareer";
                                else if (v.confidence === "high")                  state = "valid";
                                else                                               state = "ok";

                                const BADGE: Record<BadgeState, { label: string; color: string; bg: string }> = {
                                  valid:     { label: "✓ Valid",    color: "#059669", bg: "rgba(5,150,105,0.1)"   },
                                  ok:        { label: "~ OK",       color: "#0891b2", bg: "rgba(8,145,178,0.1)"   },
                                  notCareer: { label: "~ Reachable",color: "#d97706", bg: "rgba(217,119,6,0.1)"   },
                                  blocked:   { label: "⚠ Blocked",  color: "#d97706", bg: "rgba(217,119,6,0.1)"  },
                                  dead:      { label: "✗ Dead",     color: "#dc2626", bg: "rgba(239,68,68,0.1)"   },
                                };
                                const badge = BADGE[state];

                                // "Last checked" from validatedAt
                                const checkedAgo = v.validatedAt
                                  ? (() => {
                                      const mins = Math.round((Date.now() - new Date(v.validatedAt).getTime()) / 60000);
                                      if (mins < 1)   return "just now";
                                      if (mins < 60)  return `${mins}m ago`;
                                      const hrs = Math.round(mins / 60);
                                      if (hrs < 24)   return `${hrs}h ago`;
                                      return `${Math.round(hrs / 24)}d ago`;
                                    })()
                                  : null;

                                const tooltipText = [
                                  v.reason || null,
                                  state === "notCareer" ? "Page is reachable but doesn't appear to be a careers page." : null,
                                  state === "blocked"   ? "Likely bot-detection block — try opening in browser." : null,
                                  checkedAgo ? `Last checked: ${checkedAgo}` : null,
                                ].filter(Boolean).join(" · ");

                                return (
                                  <div>
                                    <span
                                      title={tooltipText}
                                      style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: badge.bg, color: badge.color, cursor: "help", whiteSpace: "nowrap" }}
                                    >
                                      {badge.label}
                                    </span>
                                    {checkedAgo && (
                                      <div style={{ fontSize: 9, color: "#C4B5D0", marginTop: 2 }}>
                                        {checkedAgo}
                                      </div>
                                    )}
                                    {/* task 31: suggestedUrl one-click apply */}
                                    {!v.reachable && v.suggestedUrl && (
                                      <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                                        <span style={{ fontSize: 9, color: "#9988AA", whiteSpace: "nowrap" }}>Suggested:</span>
                                        <a
                                          href={v.suggestedUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          style={{ fontSize: 9, color: "#FD5A0F", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100, display: "inline-block" }}
                                          title={v.suggestedUrl}
                                        >
                                          {v.suggestedUrl.replace(/^https?:\/\//, "")}
                                        </a>
                                        <button
                                          onClick={async () => {
                                            const res = await fetch(`/api/admin/dataset/rows/${row.id}`, {
                                              method:  "PATCH",
                                              headers: { "Content-Type": "application/json" },
                                              body:    JSON.stringify({ careerPageUrl: v.suggestedUrl }),
                                            });
                                            if (res.ok) {
                                              setValidationMap(prev => { const next = { ...prev }; delete next[row.id]; return next; });
                                              fetchData();
                                            }
                                          }}
                                          style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, border: "1px solid #FD5A0F", background: "#FFF0EA", color: "#FD5A0F", cursor: "pointer", fontWeight: 700, flexShrink: 0 }}
                                        >
                                          Apply
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>

                            {/* Status */}
                            <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                              {sc ? (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color }}>
                                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: sc.color, display: "inline-block" }} />
                                  {row.processingStatus!.status}
                                </span>
                              ) : (
                                <span style={{ fontSize: 11, color: "#D0C8D8" }}>Not processed</span>
                              )}
                            </td>

                            {/* HR Stack (enrichment column — toggle-hidden) */}
                            {showEnrichment && (
                              <td style={{ padding: "14px 16px", minWidth: 200 }}>
                                {row.hrStack && Object.values(row.hrStack).some(v => v) ? (
                                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                    {(["ats", "hcm", "lxp", "hris"] as const).map(cat => {
                                      const v = row.hrStack?.[cat];
                                      if (!v) return null;
                                      const clr = v.confidence >= 80 ? "#22c55e" : v.confidence >= 55 ? "#f59e0b" : "#9988AA";
                                      return (
                                        <div key={cat}>
                                          <span style={{
                                            display:    "inline-flex", alignItems: "center", gap: 5,
                                            padding:    "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                                            background: `${clr}18`, color: clr, border: `1px solid ${clr}40`,
                                            whiteSpace: "nowrap",
                                          }}>
                                            <span style={{ fontSize: 9, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.06em" }}>{cat}</span>
                                            {v.vendor}
                                            <span style={{ fontSize: 10, opacity: 0.8 }}>{v.confidence}%</span>
                                          </span>
                                          <p style={{ margin: "2px 0 0", fontSize: 10, color: "#9988AA", lineHeight: 1.3, maxWidth: 200 }}>
                                            {v.source}
                                          </p>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : row.hrStackStatus === "running" ? (
                                  <span style={{ color: "#f59e0b", fontSize: 12 }}>Scanning…</span>
                                ) : (
                                  <span style={{ color: "#D0C8D8", fontSize: 12 }}>—</span>
                                )}
                              </td>
                            )}

                            {/* LinkedIn (enrichment column — toggle-hidden) */}
                            {showEnrichment && (
                              <td style={{ padding: "14px 16px", minWidth: 130 }}>
                                {row.linkedinUrl ? (
                                  <div>
                                    <a
                                      href={row.linkedinUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{ fontSize: 12, color: "#0077b5", fontWeight: 700, textDecoration: "none" }}
                                    >
                                      View Profile
                                    </a>
                                    {row.linkedinConfidence != null && (
                                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9988AA" }}>
                                        {row.linkedinConfidence}% confident
                                      </p>
                                    )}
                                  </div>
                                ) : row.linkedinStatus === "running" ? (
                                  <span style={{ color: "#f59e0b", fontSize: 12 }}>Searching…</span>
                                ) : (
                                  <span style={{ color: "#D0C8D8", fontSize: 12 }}>—</span>
                                )}
                              </td>
                            )}

                            {/* Industry (enrichment column — toggle-hidden) */}
                            {showEnrichment && (
                              <td style={{ padding: "14px 16px", minWidth: 140 }}>
                                {row.industry ? (
                                  <span style={{
                                    padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                                    background: "rgba(5,150,105,0.1)", color: "#059669",
                                    border: "1px solid rgba(5,150,105,0.25)", whiteSpace: "nowrap",
                                  }}>
                                    {row.industry}
                                  </span>
                                ) : row.industryStatus === "running" ? (
                                  <span style={{ color: "#f59e0b", fontSize: 12 }}>Detecting…</span>
                                ) : (
                                  <span style={{ color: "#D0C8D8", fontSize: 12 }}>—</span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })
                  }
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data && data.pages > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderTop: "1px solid #F4EFF6", background: "#FAFAFA" }}>
                <span style={{ fontSize: 12, color: "#9988AA" }}>
                  Page <strong style={{ color: "#553366" }}>{data.page}</strong> of {data.pages} · {data.total.toLocaleString()} results
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #EAE4EF", background: "#fff", fontSize: 12, fontWeight: 600, color: "#553366", cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1, transition: "all 0.12s" }}>
                    ← Prev
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(data.pages, p + 1))}
                    disabled={page === data.pages}
                    style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #EAE4EF", background: "#fff", fontSize: 12, fontWeight: 600, color: "#553366", cursor: page === data.pages ? "not-allowed" : "pointer", opacity: page === data.pages ? 0.4 : 1, transition: "all 0.12s" }}>
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes fadeIn    { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp  { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin      { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes shimmer   { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes modalIn   { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </div>
  );
}
