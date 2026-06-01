"use client";

// ── Complete-coverage hero ──────────────────────────────────────────────────
// Rendered in place of FullAnalysisHeroStrip when analysedCount >=
// totalAvailable, i.e. the report covers every open role at the company.
// Also used by the static /report/daman-health page.

import { useState, useEffect, useRef } from "react";

export default function CompleteCoverageHeroStrip({
  company,
  companyId,
  analysedCount,
  token,
}: {
  company:        string;
  companyId:      string;
  analysedCount:  number;
  token:          string;
}) {
  const [state, setState] = useState<"idle" | "done">("idle");
  const scriptLoaded = useRef(false);

  useEffect(() => {
    if (scriptLoaded.current) return;
    scriptLoaded.current = true;

    const script = document.createElement("script");
    script.src   = "https://js.hsforms.net/forms/embed/820873.js";
    script.defer = true;
    document.head.appendChild(script);

    const handleMessage = (e: MessageEvent) => {
      if (
        e.data?.type === "hsFormCallback" &&
        e.data?.eventName === "onFormSubmitted" &&
        e.data?.id === "5a2ff39f-bcf8-435a-be40-c6f0afdba087"
      ) {
        const email = e.data?.data?.submissionValues?.email;
        setState("done");

        // Mirror submission to our own report_leads table
        if (email) {
          fetch(
            `/api/report/${companyId}/interest?token=${encodeURIComponent(token)}`,
            {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({ email }),
            }
          ).catch(() => {});
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [companyId, token]);

  return (
    <div style={{
      background:   "linear-gradient(135deg, #1A0028 0%, #2D0050 45%, #1A0028 100%)",
      borderRadius: 0,
      padding:      "40px 0",
      marginBottom: 0,
    }}>
      <div style={{ maxWidth: 1152, margin: "0 auto", padding: "0 24px" }}>

        {/* Top label */}
        <p style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase", color: "#6EE7B7", marginBottom: 12,
        }}>
          Complete coverage
        </p>

        {/* Headline row */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
          <span style={{ fontSize: 52, fontWeight: 900, lineHeight: 1, color: "#FD5A0F", letterSpacing: "-2px" }}>
            100%
          </span>
          <span style={{ fontSize: 20, fontWeight: 700, color: "#fff", lineHeight: 1.25, maxWidth: 620 }}>
            career-site coverage at <span style={{ color: "#FDBB96" }}>{company}</span> — all {analysedCount} open roles fully analysed for AI automation readiness.
          </span>
        </div>

        {/* Sub-copy */}
        <p style={{ fontSize: 14, color: "#C4B5D0", lineHeight: 1.65, marginBottom: 28, maxWidth: 620 }}>
          Every role at {company} has been scored, ranked, and mapped to AI-powered skill assessments. Want iMocha&apos;s concierge walk-through to plan the rollout — priority roles, time-to-hire impact, and where to start first?
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
                iMocha will reach out within 1 business day to schedule your walk-through.
              </p>
            </div>
          </div>
        ) : (
          <div>
            <div
              className="hs-form-frame"
              data-region="na1"
              data-form-id="5a2ff39f-bcf8-435a-be40-c6f0afdba087"
              data-portal-id="820873"
            />
            <p style={{ fontSize: 11, color: "#fff", marginTop: 12 }}>
              No spam. An iMocha expert will contact you within 1 business day.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
