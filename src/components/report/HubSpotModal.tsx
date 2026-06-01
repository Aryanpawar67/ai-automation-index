"use client";

import { useEffect, useRef, useState } from "react";
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

const IFRAME_CSS = `
  body, form { background: transparent !important; }
  label, .hs-form-field > label, .field > label {
    color: #fff !important;
    font-size: 13px !important;
    font-weight: 600 !important;
  }
  input[type="text"], input[type="email"], input[type="tel"],
  textarea, select {
    background: rgba(255,255,255,0.1) !important;
    border: 1px solid rgba(255,255,255,0.2) !important;
    border-radius: 10px !important;
    color: #fff !important;
    padding: 11px 14px !important;
    font-size: 14px !important;
    width: 100% !important;
    box-sizing: border-box !important;
  }
  input::placeholder { color: rgba(255,255,255,0.4) !important; }
  input:focus {
    border-color: rgba(253,90,15,0.7) !important;
    background: rgba(255,255,255,0.14) !important;
    outline: none !important;
  }
  .hs-button, input[type="submit"] {
    background: #FD5A0F !important;
    color: #fff !important;
    border: none !important;
    border-radius: 10px !important;
    padding: 12px 28px !important;
    font-weight: 700 !important;
    font-size: 14px !important;
    width: 100% !important;
    cursor: pointer !important;
    margin-top: 8px !important;
  }
  .hs-button:hover, input[type="submit"]:hover {
    background: #e84e0a !important;
  }
  .hs-error-msgs li, .hs-error-msg {
    color: #f87171 !important;
    font-size: 12px !important;
  }
  .legal-consent-container, .hs-richtext {
    color: rgba(255,255,255,0.45) !important;
    font-size: 11px !important;
  }
  /* Success state */
  .submitted-message, .hs-main-font-element {
    color: #fff !important;
  }
  .submitted-message p, .submitted-message h3,
  .submitted-message span {
    color: #fff !important;
  }
`;

function injectIframeStyles(iframe: HTMLIFrameElement) {
  try {
    const doc = iframe.contentDocument;
    if (!doc) return;
    const style = doc.createElement("style");
    style.textContent = IFRAME_CSS;
    doc.head.appendChild(style);
  } catch {
    // cross-origin guard — silently skip if blocked
  }
}

export default function HubSpotModal({ onClose, onSubmitted, headline, subline }: HubSpotModalProps) {
  const [submitted, setSubmitted] = useState(false);
  const listenerAdded  = useRef(false);
  const frameRef       = useRef<HTMLDivElement>(null);
  const submittedEmail = useRef<string | undefined>(undefined);

  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Load HubSpot script once, then watch for iframe insertion to inject styles
  useEffect(() => {
    if (!window.__hsScriptLoaded) {
      window.__hsScriptLoaded = true;
      const script = document.createElement("script");
      script.src   = "https://js.hsforms.net/forms/embed/820873.js";
      script.async = true;
      document.head.appendChild(script);
    }

    // Watch the hs-form-frame container for an iframe being added by HubSpot
    const observer = new MutationObserver(() => {
      const iframe = frameRef.current?.querySelector("iframe") as HTMLIFrameElement | null;
      if (!iframe) return;
      observer.disconnect();
      // Inject immediately if already loaded, else wait for load event
      if (iframe.contentDocument?.readyState === "complete") {
        injectIframeStyles(iframe);
      } else {
        iframe.addEventListener("load", () => injectIframeStyles(iframe), { once: true });
      }
    });

    if (frameRef.current) {
      observer.observe(frameRef.current, { childList: true, subtree: true });
    }

    if (listenerAdded.current) return () => observer.disconnect();
    listenerAdded.current = true;

    const handleMessage = (e: MessageEvent) => {
      if (
        e.data?.type      === "hsFormCallback" &&
        e.data?.eventName === "onFormSubmitted" &&
        e.data?.id        === "5a2ff39f-bcf8-435a-be40-c6f0afdba087"
      ) {
        submittedEmail.current = e.data?.data?.submissionValues?.email as string | undefined;
        setSubmitted(true);
        // Close modal and notify parent after brief success display
        setTimeout(() => onSubmitted(submittedEmail.current), 2000);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      observer.disconnect();
      window.removeEventListener("message", handleMessage);
    };
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

          {submitted ? (
            /* Our own success state — fully white, styled to match the modal */
            <div style={{ textAlign: "center", padding: "24px 0 16px" }}>
              <div style={{
                width:          56,
                height:         56,
                borderRadius:   "50%",
                background:     "rgba(16,185,129,0.15)",
                border:         "1px solid rgba(16,185,129,0.35)",
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                margin:         "0 auto 20px",
              }}>
                <svg width="26" height="26" fill="none" viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7" stroke="#6EE7B7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 10, letterSpacing: "-0.3px" }}>
                You&apos;re all set! 🎉
              </h3>
              <p style={{ fontSize: 14, color: "#fff", lineHeight: 1.6, opacity: 0.85 }}>
                An iMocha expert will contact you soon.
              </p>
            </div>
          ) : (
            <>
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
                ref={frameRef}
                className="hs-form-frame"
                data-region="na1"
                data-form-id="5a2ff39f-bcf8-435a-be40-c6f0afdba087"
                data-portal-id="820873"
              />

              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 16, textAlign: "center" }}>
                No spam. Your data is handled per iMocha&apos;s privacy policy.
              </p>
            </>
          )}
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
        /* Fallback overrides for when form renders directly in DOM (non-iframe) */
        .hs-form-frame form,
        .hs-form-frame .hs-form { background: transparent !important; }
        .hs-form-frame label,
        .hs-form-frame .hs-form-field > label {
          color: #fff !important;
          font-size: 13px !important;
          font-weight: 600 !important;
        }
        .hs-form-frame input[type="text"],
        .hs-form-frame input[type="email"],
        .hs-form-frame input[type="tel"] {
          background: rgba(255,255,255,0.1) !important;
          border: 1px solid rgba(255,255,255,0.2) !important;
          border-radius: 10px !important;
          color: #fff !important;
          padding: 11px 14px !important;
        }
        .hs-form-frame .hs-button,
        .hs-form-frame input[type="submit"] {
          background: #FD5A0F !important;
          color: #fff !important;
          border: none !important;
          border-radius: 10px !important;
          width: 100% !important;
          padding: 12px 28px !important;
          font-weight: 700 !important;
          cursor: pointer !important;
        }
      `}</style>
    </>
  );

  return createPortal(modal, document.body);
}
