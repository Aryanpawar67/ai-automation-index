"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface HubSpotModalProps {
  onClose:     () => void;
  onSubmitted: (email?: string) => void;
  headline?:   string;
  subline?:    string;
}

export default function HubSpotModal({ onClose, onSubmitted, headline, subline }: HubSpotModalProps) {
  const mounted = useRef(false);

  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Load / re-init HubSpot embed script after the modal div is in the DOM
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    // Remove stale script so it re-executes and discovers the freshly mounted div
    const old = document.querySelector('script[src*="hsforms.net/forms/embed/820873"]');
    if (old) old.remove();

    const script    = document.createElement("script");
    script.src      = "https://js.hsforms.net/forms/embed/820873.js";
    script.async    = true;
    document.head.appendChild(script);

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
          position:       "fixed",
          inset:          0,
          zIndex:         9998,
          background:     "rgba(12, 0, 22, 0.72)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          animation:      "hsBackdropIn 0.2s ease both",
        }}
      />

      {/* Modal card */}
      <div
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        style={{
          position:     "fixed",
          inset:        0,
          zIndex:       9999,
          display:      "flex",
          alignItems:   "center",
          justifyContent: "center",
          padding:      "24px",
          pointerEvents: "none",
        }}
      >
        <div style={{
          pointerEvents:  "auto",
          width:          "100%",
          maxWidth:       480,
          background:     "linear-gradient(150deg, #1E0035 0%, #2D0050 55%, #1A0028 100%)",
          border:         "1px solid rgba(253, 90, 15, 0.25)",
          borderRadius:   24,
          boxShadow:      "0 32px 96px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset",
          padding:        "36px 36px 32px",
          animation:      "hsModalIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) both",
          position:       "relative",
        }}>

          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              position:   "absolute",
              top:        16,
              right:      16,
              width:      32,
              height:     32,
              borderRadius: 8,
              border:     "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.06)",
              color:      "rgba(255,255,255,0.5)",
              cursor:     "pointer",
              display:    "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.15s, color 0.15s",
              flexShrink: 0,
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

          {/* iMocha dot accent */}
          <div style={{
            width:        36,
            height:       36,
            borderRadius: 10,
            background:   "linear-gradient(135deg, #FD5A0F, #FF8C4B)",
            display:      "flex",
            alignItems:   "center",
            justifyContent: "center",
            marginBottom: 20,
            boxShadow:    "0 8px 24px rgba(253,90,15,0.35)",
          }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <h2 style={{
            fontSize:     22,
            fontWeight:   800,
            color:        "#fff",
            marginBottom: 8,
            letterSpacing: "-0.4px",
            lineHeight:   1.25,
          }}>
            {headline ?? "Get your full AI analysis"}
          </h2>

          <p style={{
            fontSize:     14,
            color:        "#C4B5D0",
            lineHeight:   1.6,
            marginBottom: 28,
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
        .hs-form-frame iframe {
          border-radius: 12px !important;
        }
      `}</style>
    </>
  );

  return createPortal(modal, document.body);
}
