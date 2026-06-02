"use client";

import { useState, useRef, useEffect } from "react";
import { track } from "@/lib/reportTrack";

export default function DownloadRolePdfButton({
  companyId,
  analysisId,
  token,
  title,
  companySlug,
}: {
  companyId:   string;
  analysisId:  string;
  token:       string;
  title:       string;
  companySlug: string;
}) {
  const [state,      setState]      = useState<"idle" | "loading" | "done">("idle");
  const [hovered,    setHovered]    = useState(false);
  const [gated,      setGated]      = useState(false);
  const [inputOpen,  setInputOpen]  = useState(false);
  const [emailError, setEmailError] = useState("");

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);

  // Close input on outside click
  useEffect(() => {
    if (!inputOpen) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setInputOpen(false);
        setEmailError("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [inputOpen]);

  // Auto-focus when input expands
  useEffect(() => {
    if (inputOpen) setTimeout(() => inputRef.current?.focus(), 60);
  }, [inputOpen]);

  const triggerDownload = async () => {
    setState("loading");
    try {
      const res = await fetch(
        `/api/report/${companyId}/${analysisId}/pdf?token=${encodeURIComponent(token)}`
      );
      if (!res.ok) throw new Error("PDF generation failed");

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${title.replace(/[^a-zA-Z0-9]/g, "_")}_AI_Report.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      track("report_downloaded",
        { token, companySlug, reportType: "hub", jobTitle: title },
        { source: "role_card" },
      );

      setState("done");
      setTimeout(() => setState("idle"), 3000);
    } catch {
      setState("idle");
    }
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (state !== "idle") return;
    if (gated) { triggerDownload(); return; }
    setInputOpen(true);
  };

  const handleEmailSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = (inputRef.current?.value ?? "").trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Valid email required");
      return;
    }
    // Save lead fire-and-forget — full verification (Reoon) to be added next session
    fetch(
      `/api/report/${companyId}/interest?token=${encodeURIComponent(token)}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: trimmed }) }
    ).catch(() => {});

    setGated(true);
    setInputOpen(false);
    triggerDownload();
  };

  const isDone    = state === "done";
  const isLoading = state === "loading";
  const bg        = isDone ? "#ecfdf5" : hovered && !isLoading ? "#FD5A0F" : "#FFF0EA";
  const color     = isDone ? "#059669" : hovered && !isLoading ? "#fff"    : "#FD5A0F";
  const border    = isDone ? "1px solid #a7f3d0" : "1px solid #FDBB96";

  // Inline email input — expands in place, same height as button
  if (inputOpen) {
    return (
      <div
        ref={wrapperRef}
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
        style={{ display: "flex", alignItems: "center", gap: 4, animation: "roleInputIn 0.18s cubic-bezier(0.16,1,0.3,1) both" }}
      >
        <form
          onSubmit={handleEmailSubmit}
          style={{ display: "flex", alignItems: "center", gap: 0 }}
        >
          <input
            ref={inputRef}
            type="email"
            defaultValue=""
            placeholder="work email"
            autoComplete="email"
            style={{
              height:       30,
              padding:      "0 10px",
              fontSize:     12,
              border:       `1.5px solid ${emailError ? "#f87171" : "#FDBB96"}`,
              borderRight:  "none",
              borderRadius: "8px 0 0 8px",
              color:        "#1E0035",
              outline:      "none",
              background:   emailError ? "#fff5f5" : "#FFF0EA",
              width:        148,
            }}
            onFocus={e  => { e.currentTarget.style.borderColor = emailError ? "#f87171" : "#FD5A0F"; }}
            onBlur={e   => { e.currentTarget.style.borderColor = emailError ? "#f87171" : "#FDBB96"; }}
            onChange={() => { if (emailError) setEmailError(""); }}
            title={emailError || undefined}
          />
          <button
            type="submit"
            style={{
              height:        30,
              padding:       "0 10px",
              borderRadius:  "0 8px 8px 0",
              border:        `1.5px solid ${emailError ? "#f87171" : "#FD5A0F"}`,
              borderLeft:    "none",
              background:    "#FD5A0F",
              color:         "#fff",
              fontSize:      11,
              fontWeight:    700,
              cursor:        "pointer",
              display:       "flex",
              alignItems:    "center",
              justifyContent:"center",
              flexShrink:    0,
            }}
          >
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24">
              <path d="M12 2v10m0 0l-3-3m3 3l3-3M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </form>

        {/* Cancel — collapse back to button */}
        <button
          onClick={e => { e.stopPropagation(); setInputOpen(false); setEmailError(""); }}
          style={{
            width: 22, height: 22, borderRadius: 6,
            border: "1px solid #EAE4EF", background: "#F4EFF6",
            color: "#9988AA", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, padding: 0,
          }}
        >
          <svg width="9" height="9" fill="none" viewBox="0 0 24 24">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </button>

        <style>{`
          @keyframes rolePdfSpin {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
          }
          @keyframes roleInputIn {
            from { opacity: 0; transform: translateX(6px); }
            to   { opacity: 1; transform: translateX(0); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div ref={wrapperRef}>
      <button
        onClick={handleButtonClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        disabled={isLoading}
        title="Get Report"
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
          padding: "7px 16px", borderRadius: 10, border,
          background: bg, color,
          fontSize: 12, fontWeight: 700,
          cursor: isLoading ? "not-allowed" : "pointer",
          opacity: isLoading ? 0.6 : 1,
          transition: "background 0.15s, color 0.15s",
          flexShrink: 0,
        }}
      >
        {isLoading ? (
          <>
            <svg style={{ animation: "rolePdfSpin 0.8s linear infinite" }} width="12" height="12" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.25"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </>
        ) : isDone ? (
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
            <path d="M12 2v10m0 0l-3-3m3 3l3-3M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
        {isLoading ? "…" : isDone ? "Saved" : "Get Report"}
      </button>
      <style>{`
        @keyframes rolePdfSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
