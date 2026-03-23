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
      return;
    }
    setStatus("uploading");
    setError("");
    const fd = new FormData();
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

  return (
    <div
      onClick={() => status !== "uploading" && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      className="card p-10 flex flex-col items-center gap-4 cursor-pointer transition-all duration-200"
      style={{
        borderStyle: "dashed",
        borderColor: drag ? "#FD5A0F" : error ? "#fca5a5" : "#D0C8D8",
        background:  drag ? "#FFF8F5" : "#FAFAFA",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />

      <div className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ background: status === "uploading" ? "#FFF0EA" : "#F4EFF6" }}>
        {status === "uploading" ? (
          <svg className="animate-spin w-5 h-5" style={{ color: "#FD5A0F" }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        ) : (
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
            <path d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              stroke="#9988AA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>

      <div className="text-center">
        <p className="text-sm font-semibold mb-1" style={{ color: "#220133" }}>
          {status === "uploading" ? "Uploading and queuing…" : "Drop your Excel file here"}
        </p>
        <p className="text-xs" style={{ color: "#9988AA" }}>
          or click to browse &nbsp;·&nbsp; .xlsx / .xls
        </p>
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        {["first_name", "last_name", "email", "company_name", "career_page_url"].map(col => (
          <span key={col} className="text-xs px-2 py-0.5 rounded font-mono"
            style={{ background: "#F4EFF6", color: "#553366", border: "1px solid #EAE4EF" }}>
            {col}
          </span>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-600 px-4 py-2 rounded-xl w-full text-center"
          style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
          {error}
        </p>
      )}
    </div>
  );
}
