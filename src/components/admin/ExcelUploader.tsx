"use client";

import { useState, useRef, DragEvent } from "react";
import { useRouter }                    from "next/navigation";

export default function ExcelUploader() {
  const router   = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [error,  setError]  = useState("");
  const [drag,   setDrag]   = useState(false);

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setError("Please upload an .xlsx or .xls file.");
      setStatus("error");
      return;
    }
    setStatus("uploading");
    setError("");
    const fd  = new FormData();
    fd.append("file", file);
    const res  = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) {
      setStatus("error");
      setError(data.error ?? "Upload failed.");
      return;
    }
    router.push(`/admin/batches/${data.batchId}`);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const isActive  = drag && status !== "uploading";
  const isError   = status === "error";
  const isLoading = status === "uploading";

  return (
    <div
      onClick={() => !isLoading && inputRef.current?.click()}
      onDragOver={e  => { e.preventDefault(); if (!isLoading) setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      style={{
        position:      "relative",
        borderRadius:  20,
        border:        `2px dashed ${isActive ? "#FD5A0F" : isError ? "#f87171" : "#D0C8D8"}`,
        background:    isActive ? "#FFF8F5" : isError ? "#fff5f5" : "#FAFAFA",
        padding:       "44px 32px",
        cursor:        isLoading ? "default" : "pointer",
        transition:    "border-color 0.2s, background 0.2s, box-shadow 0.2s",
        boxShadow:     isActive ? "0 0 0 4px rgba(253,90,15,0.12)" : "none",
        display:       "flex",
        flexDirection: "column",
        alignItems:    "center",
        gap:           20,
        minHeight:     280,
        justifyContent: "center",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />

      {/* Icon */}
      <div style={{
        width:        72, height: 72, borderRadius: 20,
        background:   isLoading ? "#FFF0EA" : isActive ? "#FFF0EA" : "#F4EFF6",
        border:       `1.5px solid ${isActive ? "#FDBB96" : "#EAE4EF"}`,
        display:      "flex", alignItems: "center", justifyContent: "center",
        transition:   "all 0.2s",
        boxShadow:    isActive ? "0 4px 20px rgba(253,90,15,0.2)" : "none",
        flexShrink:   0,
      }}>
        {isLoading ? (
          <svg style={{ animation: "spin 0.9s linear infinite", color: "#FD5A0F" }} width="28" height="28" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.2"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        ) : isError ? (
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          <svg width="30" height="30" fill="none" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
              stroke={isActive ? "#FD5A0F" : "#9988AA"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 2v6h6M12 11v6m0 0l-2.5-2.5M12 17l2.5-2.5"
              stroke={isActive ? "#FD5A0F" : "#9988AA"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>

      {/* Text */}
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: "#220133", margin: "0 0 6px" }}>
          {isLoading ? "Uploading and queuing…" : isActive ? "Release to upload" : "Drop your Excel file here"}
        </p>
        {!isLoading && (
          <p style={{ fontSize: 13, color: "#9988AA", margin: 0 }}>
            or <span style={{ color: "#FD5A0F", fontWeight: 600 }}>click to browse</span> &nbsp;·&nbsp; .xlsx / .xls only
          </p>
        )}
        {isLoading && (
          <p style={{ fontSize: 13, color: "#9988AA", margin: 0 }}>
            Reading companies and queueing scrape jobs…
          </p>
        )}
      </div>

      {/* Required columns */}
      {!isLoading && (
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#C4B5D0", textAlign: "center", marginBottom: 8 }}>
            Required columns
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
            {["first_name", "last_name", "email", "company_name", "career_page_url"].map(col => (
              <span key={col} style={{
                fontSize: 11, padding: "3px 9px", borderRadius: 6,
                fontFamily: "monospace", fontWeight: 600,
                background: "#F4EFF6", color: "#553366", border: "1px solid #EAE4EF",
              }}>
                {col}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {isError && error && (
        <div style={{
          width: "100%", padding: "10px 16px", borderRadius: 10,
          background: "#fef2f2", border: "1px solid #fecaca",
          fontSize: 13, color: "#dc2626", fontWeight: 500, textAlign: "center",
        }}>
          {error}
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
