"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

declare global {
  interface Window { __hsScriptLoaded?: boolean; }
}

interface HubSpotModalProps {
  onClose:     () => void;
  onSubmitted: (email?: string) => void;
  headline?:   string;
  subline?:    string;
}

export default function HubSpotModal({ onClose, onSubmitted, headline, subline }: HubSpotModalProps) {
  const listenerAdded = useRef(false);

  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    // Load script only once across all modal opens — HubSpot uses MutationObserver
    // to discover newly added .hs-form-frame divs, so no re-add needed.
    if (!window.__hsScriptLoaded) {
      window.__hsScriptLoaded = true;
      const script   = document.createElement("script");
      script.src     = "https://js.hsforms.net/forms/embed/820873.js";
      script.async   = true;
      document.head.appendChild(script);
    }

    if (listenerAdded.current) return;
    listenerAdded.current = true;

    const handleMessage = (e: MessageEvent) => {
      if (
        e.data?.type      === "hsFormCallback" &&
        e.data?.eventName === "onFormSubmitted" &&
        e.data?.id        === "5a2ff39f-bcf8-435a-be40-c6f0afdba087"
      ) {
        const email = e.data?.data?.submissionValues?.email as string | undefined;
        onSubmitted(email);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onSubmitted]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const modal = (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position:            "fixed",
          inset:               0,
          zIndex:              9998,
          background:          "rgba(12, 0, 22, 0.72)",
          backdropFilter:      "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          animation:           "hsBackdropIn 0.2s ease both",
        }}
      />

      {/* Modal card */}
      <div
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        style={{
          position:       "fixed",
          inset:          0,
          zIndex:         9999,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          padding:        "24px",
          pointerEvents:  "none",
        }}
      >
        <div style={{
          pointerEvents: "auto",
          width:         "100%",
          maxWidth:      480,
          background:    "linear-gradient(150deg, #1E0035 0%, #2D0050 55%, #1A0028 100%)",
          border:        "1px solid rgba(253, 90, 15, 0.25)",
          borderRadius:  24,
          boxShadow:     "0 32px 96px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset",
          padding:       "36px 36px 32px",
          animation:     "hsModalIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) both",
          position:      "relative",
        }}>

          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              position:       "absolute",
              top:            16,
              right:          16,
              width:          32,
              height:         32,
              borderRadius:   8,
              border:         "1px solid rgba(255,255,255,0.1)",
              background:     "rgba(255,255,255,0.06)",
              color:          "rgba(255,255,255,0.5)",
              cursor:         "pointer",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              transition:     "background 0.15s, color 0.15s",
              flexShrink:     0,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(253,90,15,0.2)";
              (e.currentTarget as HTMLButtonElement).style.color      = "#FD5A0F";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
              (e.currentTarget as HTMLButtonElement).style.color      = "rgba(255,255,255,0.5)";
            }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>

          <h2 style={{
            fontSize:      22,
            fontWeight:    800,
            color:         "#fff",
            marginBottom:  8,
            letterSpacing: "-0.4px",
            lineHeight:    1.25,
          }}>
            {headline ?? "Get your full AI analysis"}
          </h2>

          <p style={{
            fontSize:     14,
            color:        "#C4B5D0",
            lineHeight:   1.6,
            marginBottom: 24,
          }}>
            {subline ?? "An iMocha expert will reach out within 1 business day."}
          </p>

          {/* HubSpot form frame */}
          <div
            className="hs-form-frame"
            data-region="na1"
            data-form-id="5a2ff39f-bcf8-435a-be40-c6f0afdba087"
            data-portal-id="820873"
          />

          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 16, textAlign: "center" }}>
            No spam. Your data is handled per iMocha&apos;s privacy policy.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes hsBackdropIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes hsModalIn {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ── HubSpot form overrides for dark modal ── */
        .hs-form-frame form,
        .hs-form-frame .hs-form {
          background: transparent !important;
        }
        .hs-form-frame .hs-form-field > label,
        .hs-form-frame label {
          color: rgba(255,255,255,0.75) !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          margin-bottom: 6px !important;
        }
        .hs-form-frame input[type="text"],
        .hs-form-frame input[type="email"],
        .hs-form-frame input[type="tel"],
        .hs-form-frame textarea,
        .hs-form-frame select {
          background: rgba(255,255,255,0.08) !important;
          border: 1px solid rgba(255,255,255,0.15) !important;
          border-radius: 10px !important;
          color: #fff !important;
          padding: 11px 14px !important;
          font-size: 14px !important;
          width: 100% !important;
          box-sizing: border-box !important;
          transition: border 0.15s, background 0.15s !important;
        }
        .hs-form-frame input[type="text"]::placeholder,
        .hs-form-frame input[type="email"]::placeholder,
        .hs-form-frame input[type="tel"]::placeholder {
          color: rgba(255,255,255,0.35) !important;
        }
        .hs-form-frame input[type="text"]:focus,
        .hs-form-frame input[type="email"]:focus,
        .hs-form-frame input[type="tel"]:focus {
          border-color: rgba(253,90,15,0.6) !important;
          background: rgba(255,255,255,0.12) !important;
          outline: none !important;
        }
        .hs-form-frame .hs-error-msgs,
        .hs-form-frame .hs-error-msg {
          color: #f87171 !important;
          font-size: 12px !important;
        }
        .hs-form-frame .hs-button,
        .hs-form-frame input[type="submit"] {
          background: #FD5A0F !important;
          color: #fff !important;
          border: none !important;
          border-radius: 10px !important;
          padding: 12px 28px !important;
          font-weight: 700 !important;
          font-size: 14px !important;
          width: 100% !important;
          cursor: pointer !important;
          transition: background 0.15s !important;
          margin-top: 8px !important;
        }
        .hs-form-frame .hs-button:hover,
        .hs-form-frame input[type="submit"]:hover {
          background: #e84e0a !important;
        }
        .hs-form-frame .hs-recaptcha {
          margin-top: 12px !important;
        }
        .hs-form-frame .legal-consent-container,
        .hs-form-frame .hs-richtext {
          color: rgba(255,255,255,0.45) !important;
          font-size: 11px !important;
        }
        .hs-form-frame .hs-form-iframe {
          border-radius: 12px !important;
        }
      `}</style>
    </>
  );

  return createPortal(modal, document.body);
}
