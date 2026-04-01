"use client";

import { useState } from "react";

export default function FullAnalysisHeroStrip({
  company,
  companyId,
  totalAvailable,
  analysedCount,
  token,
}: {
  company:        string;
  companyId:      string;
  totalAvailable: number;
  analysedCount:  number;
  token:          string;
}) {
  const [email,   setEmail]   = useState("");
  const [state,   setState]   = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errMsg,  setErrMsg]  = useState("");

  const remaining = totalAvailable - analysedCount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("loading");
    setErrMsg("");
    try {
      const res = await fetch(
        `/api/report/${companyId}/interest?token=${encodeURIComponent(token)}`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ email }),
        }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        setErrMsg(d.error ?? "Something went wrong. Please try again.");
        setState("error");
      } else {
        setState("done");
      }
    } catch {
      setErrMsg("Network error. Please try again.");
      setState("error");
    }
  };

  return (
    <div style={{
      background:    "linear-gradient(135deg, #1A0028 0%, #2D0050 45%, #1A0028 100%)",
      borderRadius:  0,
      padding:       "40px 0",
      marginBottom:  0,
    }}>
      <div style={{ maxWidth: 1152, margin: "0 auto", padding: "0 24px" }}>

        {/* Top label */}
        <p style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase", color: "#FDBB96", marginBottom: 12,
        }}>
          Full analysis available
        </p>

        {/* Headline row */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <span style={{ fontSize: 52, fontWeight: 900, lineHeight: 1, color: "#FD5A0F", letterSpacing: "-2px" }}>
            {totalAvailable}
          </span>
          <span style={{ fontSize: 20, fontWeight: 700, color: "#fff", lineHeight: 1.2, maxWidth: 520 }}>
            open roles at <span style={{ color: "#FDBB96" }}>{company}</span> are ready for AI automation analysis.
          </span>
        </div>

        {/* Sub-copy */}
        <p style={{ fontSize: 14, color: "#C4B5D0", lineHeight: 1.65, marginBottom: 28, maxWidth: 560 }}>
          {analysedCount > 0
            ? `You're viewing a sample of ${analysedCount} role${analysedCount !== 1 ? "s" : ""}. ${remaining > 0 ? `${remaining} more role${remaining !== 1 ? "s" : ""} haven't been touched yet.` : ""} Want the complete picture — every role, every score, every automation opportunity?`
            : `Want to see the complete automation picture across every single one of them?`
          }
        </p>

        {/* CTA area */}
        {state === "done" ? (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 12,
            background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.35)",
            borderRadius: 14, padding: "16px 24px",
          }}>
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
              <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#6EE7B7", marginBottom: 2 }}>
                We&apos;ve got your request.
              </p>
              <p style={{ fontSize: 13, color: "#A7F3D0" }}>
                iMocha will get your complete analysis report in the next 24 hours.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 280px", maxWidth: 380 }}>
              <input
                type="email"
                required
                value={email}
                onChange={e => { setEmail(e.target.value); if (state === "error") setState("idle"); }}
                placeholder="Enter your work email"
                style={{
                  width: "100%", padding: "12px 16px",
                  borderRadius: 10, border: state === "error" ? "1px solid #f87171" : "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.07)", color: "#fff",
                  fontSize: 14, outline: "none",
                  boxSizing: "border-box",
                }}
                onFocus={e  => { e.currentTarget.style.border = "1px solid rgba(253,90,15,0.6)"; e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
                onBlur={e   => { e.currentTarget.style.border = state === "error" ? "1px solid #f87171" : "1px solid rgba(255,255,255,0.15)"; e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
              />
              {state === "error" && errMsg && (
                <p style={{ fontSize: 12, color: "#f87171", margin: 0 }}>{errMsg}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={state === "loading"}
              style={{
                padding: "12px 24px", borderRadius: 10, border: "none",
                background: state === "loading" ? "rgba(253,90,15,0.5)" : "#FD5A0F",
                color: "#fff", fontWeight: 700, fontSize: 14,
                cursor: state === "loading" ? "not-allowed" : "pointer",
                whiteSpace: "nowrap", flexShrink: 0,
                transition: "background 0.15s",
              }}
            >
              {state === "loading" ? "Sending…" : "Reach out to me →"}
            </button>
          </form>
        )}

        {/* Fine print */}
        {state !== "done" && (
          <p style={{ fontSize: 11, color: "#553366", marginTop: 12 }}>
            No spam. An iMocha expert will contact you within 1 business day.
          </p>
        )}
      </div>
    </div>
  );
}
