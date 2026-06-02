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
  const [showPopover,setShowPopover]= useState(false);
  const [email,      setEmail]      = useState("");
  const [validating, setValidating] = useState(false);
  const [emailError, setEmailError] = useState("");

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!showPopover) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowPopover(false);
        setEmailError("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPopover]);

  // Focus input when popover opens
  useEffect(() => {
    if (showPopover) setTimeout(() => inputRef.current?.focus(), 50);
  }, [showPopover]);

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
    if (gated) {
      triggerDownload();
    } else {
      setShowPopover(v => !v);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Enter a valid email");
      return;
    }
    setValidating(true);
    setEmailError("");
    try {
      const vRes = await fetch("/api/preview/validate-email", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: trimmed }),
      });
      const vData = await vRes.json();
      if (!vRes.ok) { setEmailError(vData.error ?? "Invalid email"); setValidating(false); return; }

      // Save lead
      await fetch(
        `/api/report/${companyId}/interest?token=${encodeURIComponent(token)}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: trimmed }) }
      ).catch(() => {});

      setGated(true);
      setShowPopover(false);
      triggerDownload();
    } catch {
      setEmailError("Something went wrong. Try again.");
    } finally {
      setValidating(false);
    }
  };

  const isDone    = state === "done";
  const isLoading = state === "loading";

  const bg    = isDone ? "#ecfdf5" : hovered && !isLoading ? "#FD5A0F" : "#FFF0EA";
  const color = isDone ? "#059669" : hovered && !isLoading ? "#fff"    : "#FD5A0F";
  const border = isDone ? "1px solid #a7f3d0" : "1px solid #FDBB96";

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
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
            <svg style={{ animation: "spin 0.8s linear infinite" }} width="12" height="12" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.25"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
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

      {showPopover && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position:    "absolute",
            top:         "calc(100% + 8px)",
            right:       0,
            zIndex:      100,
            width:       272,
            background:  "#fff",
            border:      "1px solid #FDBB96",
            borderRadius: 12,
            boxShadow:   "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(253,90,15,0.08)",
            padding:     "14px 14px 12px",
            animation:   "popoverIn 0.15s cubic-bezier(0.16,1,0.3,1) both",
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 700, color: "#1E0035", marginBottom: 4 }}>
            Enter your work email to download
          </p>
          <p style={{ fontSize: 11, color: "#9B8AAB", marginBottom: 10, lineHeight: 1.45 }}>
            Free. An iMocha expert may follow up.
          </p>
          <form onSubmit={handleEmailSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              ref={inputRef}
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setEmailError(""); }}
              placeholder="you@company.com"
              style={{
                width: "100%", padding: "8px 10px", fontSize: 13,
                border: `1.5px solid ${emailError ? "#f87171" : "#DDD0E8"}`,
                borderRadius: 8, color: "#1E0035", outline: "none",
                background: "#F8F4FC", boxSizing: "border-box",
                transition: "border-color 0.15s",
              }}
              onFocus={e  => (e.target.style.borderColor = emailError ? "#f87171" : "#FD5A0F")}
              onBlur={e   => (e.target.style.borderColor = emailError ? "#f87171" : "#DDD0E8")}
            />
            {emailError && (
              <p style={{ fontSize: 11, color: "#f87171", margin: "-4px 0 0" }}>{emailError}</p>
            )}
            <button
              type="submit"
              disabled={validating}
              style={{
                width: "100%", padding: "8px 0", borderRadius: 8, border: "none",
                background: validating ? "rgba(253,90,15,0.5)" : "#FD5A0F",
                color: "#fff", fontSize: 13, fontWeight: 700,
                cursor: validating ? "not-allowed" : "pointer",
                transition: "background 0.15s",
              }}
            >
              {validating ? "Checking…" : "Download PDF →"}
            </button>
          </form>
          <style>{`
            @keyframes popoverIn {
              from { opacity: 0; transform: translateY(-6px) scale(0.97); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
