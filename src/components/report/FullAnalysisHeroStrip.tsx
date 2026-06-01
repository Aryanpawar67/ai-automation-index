"use client";

import { useState, useEffect, useRef } from "react";

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
  const [state, setState] = useState<"idle" | "done">("idle");
  const scriptLoaded = useRef(false);
  const remaining = totalAvailable - analysedCount;

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

        <p style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase", color: "#FDBB96", marginBottom: 12,
        }}>
          Full analysis available
        </p>

        <p style={{ fontSize: 20, fontWeight: 700, color: "#fff", lineHeight: 1.25, marginBottom: 10, maxWidth: 620 }}>
          <span style={{ fontSize: 32, fontWeight: 900, color: "#FD5A0F", letterSpacing: "-2px", lineHeight: 1, verticalAlign: "baseline" }}>
            {totalAvailable}
          </span>
          {" "}open roles at <span style={{ color: "#FDBB96" }}>{company}</span> are ready for AI automation analysis.
        </p>

        <p style={{ fontSize: 14, color: "#C4B5D0", lineHeight: 1.65, marginBottom: 28, maxWidth: 560 }}>
          {analysedCount > 0
            ? `You're viewing ${analysedCount} of the highest-impact roles.${remaining > 0 ? ` Unlock ${remaining} more to reveal the full automation potential hiding across your open positions.` : ""}`
            : `Want to see the complete automation picture across every single one of them?`
          }
        </p>

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
