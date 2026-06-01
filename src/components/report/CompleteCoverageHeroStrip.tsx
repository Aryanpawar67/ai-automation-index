"use client";

// ── Complete-coverage hero ──────────────────────────────────────────────────
// Rendered in place of FullAnalysisHeroStrip when analysedCount >=
// totalAvailable, i.e. the report covers every open role at the company.
// Also used by the static /report/daman-health page.

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const HubSpotModal = dynamic(() => import("./HubSpotModal"), { ssr: false });

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
  const [showModal, setShowModal] = useState(false);
  const [done,      setDone]      = useState(false);
  const [hovered,   setHovered]   = useState(false);

  useEffect(() => {
    if (window.__hsScriptLoaded) return;
    window.__hsScriptLoaded = true;
    const s = document.createElement("script");
    s.src   = "https://js.hsforms.net/forms/embed/820873.js";
    s.async = true;
    document.head.appendChild(s);
  }, []);

  const handleSubmitted = (email?: string) => {
    setShowModal(false);
    setDone(true);
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
  };

  return (
    <>
      <div style={{
        background:   "linear-gradient(135deg, #1A0028 0%, #2D0050 45%, #1A0028 100%)",
        borderRadius: 0,
        padding:      "40px 0",
        marginBottom: 0,
      }}>
        <div style={{ maxWidth: 1152, margin: "0 auto", padding: "0 24px" }}>

          <p style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
            textTransform: "uppercase", color: "#6EE7B7", marginBottom: 12,
          }}>
            Complete coverage
          </p>

          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
            <span style={{ fontSize: 52, fontWeight: 900, lineHeight: 1, color: "#FD5A0F", letterSpacing: "-2px" }}>
              100%
            </span>
            <span style={{ fontSize: 20, fontWeight: 700, color: "#fff", lineHeight: 1.25, maxWidth: 620 }}>
              career-site coverage at <span style={{ color: "#FDBB96" }}>{company}</span> — all {analysedCount} open roles fully analysed for AI automation readiness.
            </span>
          </div>

          <p style={{ fontSize: 14, color: "#C4B5D0", lineHeight: 1.65, marginBottom: 28, maxWidth: 620 }}>
            Every role at {company} has been scored, ranked, and mapped to AI-powered skill assessments. Want iMocha&apos;s concierge walk-through to plan the rollout — priority roles, time-to-hire impact, and where to start first?
          </p>

          {done ? (
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
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={() => setShowModal(true)}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                  display:       "inline-flex",
                  alignItems:    "center",
                  gap:           8,
                  padding:       "13px 28px",
                  borderRadius:  12,
                  border:        "none",
                  background:    hovered ? "#e84e0a" : "#FD5A0F",
                  color:         "#fff",
                  fontWeight:    700,
                  fontSize:      15,
                  cursor:        "pointer",
                  whiteSpace:    "nowrap",
                  alignSelf:     "flex-start",
                  boxShadow:     hovered ? "0 8px 28px rgba(253,90,15,0.5)" : "0 4px 16px rgba(253,90,15,0.3)",
                  transition:    "background 0.15s, box-shadow 0.15s",
                  letterSpacing: "-0.2px",
                }}
              >
                Reach out to me
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", margin: 0 }}>
                No spam. An iMocha expert will contact you within 1 business day.
              </p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <HubSpotModal
          onClose={() => setShowModal(false)}
          onSubmitted={handleSubmitted}
          headline="Book your walk-through"
          subline={`Get iMocha's concierge rollout plan for all ${analysedCount} roles at ${company}.`}
        />
      )}
    </>
  );
}
