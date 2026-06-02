"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

declare global {
  interface Window {
    __hsScriptLoaded?: boolean;
    hbspt?: { forms: { create: (opts: Record<string, unknown>) => void } };
  }
}

interface HubSpotModalProps {
  onClose:     () => void;
  onSubmitted: (email?: string) => void;
  headline?:   string;
  subline?:    string;
}

const IFRAME_CSS = `
  body, form { background: transparent !important; }
  .hs-button, input[type="submit"] {
    background: #FD5A0F !important;
    color: #fff !important;
    border: none !important;
    border-radius: 8px !important;
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
  input[type="text"]:focus, input[type="email"]:focus, input[type="tel"]:focus {
    border-color: #FD5A0F !important;
    outline: none !important;
    box-shadow: 0 0 0 2px rgba(253,90,15,0.15) !important;
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

  // Explicitly call hbspt.forms.create() as a backup for HubSpot's built-in
  // hs-form-frame auto-detection (which works but can race with dynamic mounting).
  useEffect(() => {
    const tryCreate = () => {
      if (!window.hbspt || !frameRef.current) return false;
      if (frameRef.current.hasChildNodes()) return true; // auto-detect already fired
      window.hbspt.forms.create({
        portalId: "820873",
        formId:   "5a2ff39f-bcf8-435a-be40-c6f0afdba087",
        target:   "#hs-form-target",
      });
      return true;
    };

    if (!tryCreate()) {
      const poll = setInterval(() => { if (tryCreate()) clearInterval(poll); }, 100);
      return () => clearInterval(poll);
    }
  }, []);

  // Watch for iframe insertion to inject brand styles, and listen for form submission.
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const iframe = frameRef.current?.querySelector("iframe") as HTMLIFrameElement | null;
      if (!iframe) return;
      observer.disconnect();
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
      // Debug: log all HubSpot callbacks so we can verify the email extraction path
      if (e.data?.type === "hsFormCallback") {
        console.log("[HubSpot postMessage]", JSON.stringify(e.data));
      }

      if (
        e.data?.type      === "hsFormCallback" &&
        e.data?.eventName === "onFormSubmitted" &&
        e.data?.id        === "5a2ff39f-bcf8-435a-be40-c6f0afdba087"
      ) {
        submittedEmail.current = e.data?.data?.submissionValues?.email as string | undefined;
        setSubmitted(true);
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
          background:    "#fff",
          borderRadius:  24,
          boxShadow:     "0 32px 96px rgba(0,0,0,0.6)",
          overflow:      "hidden",
          animation:     "hsModalIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) both",
        }}>

          {/* Dark purple header */}
          <div style={{
            background: "linear-gradient(150deg, #1E0035 0%, #2D0050 100%)",
            padding:    "28px 32px 24px",
            position:   "relative",
          }}>
            {/* Close button */}
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                position:       "absolute",
                top:            14,
                right:          14,
                width:          30,
                height:         30,
                borderRadius:   8,
                border:         "1px solid rgba(255,255,255,0.15)",
                background:     "rgba(255,255,255,0.1)",
                color:          "rgba(255,255,255,0.6)",
                cursor:         "pointer",
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                transition:     "background 0.15s, color 0.15s",
                flexShrink:     0,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(253,90,15,0.25)";
                (e.currentTarget as HTMLButtonElement).style.color      = "#FD5A0F";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.1)";
                (e.currentTarget as HTMLButtonElement).style.color      = "rgba(255,255,255,0.6)";
              }}
            >
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>

            <h2 style={{
              fontSize:      22,
              fontWeight:    800,
              color:         "#fff",
              marginBottom:  7,
              letterSpacing: "-0.4px",
              lineHeight:    1.25,
            }}>
              {headline ?? "Get your full AI analysis"}
            </h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.55 }}>
              {subline ?? "An iMocha expert will reach out within 1 business day."}
            </p>
          </div>

          {/* Orange accent stripe */}
          <div style={{ height: 3, background: "linear-gradient(90deg, #FD5A0F 0%, #FF8C42 100%)" }} />

          {/* White form body */}
          <div style={{ padding: "24px 32px 28px" }}>
            {submitted ? (
              <div style={{ textAlign: "center", padding: "20px 0 12px" }}>
                <div style={{
                  width:          52,
                  height:         52,
                  borderRadius:   "50%",
                  background:     "rgba(16,185,129,0.1)",
                  border:         "1px solid rgba(16,185,129,0.3)",
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  margin:         "0 auto 18px",
                }}>
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7" stroke="#34D399" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h3 style={{ fontSize: 19, fontWeight: 800, color: "#1E0035", marginBottom: 8, letterSpacing: "-0.3px" }}>
                  You&apos;re all set! 🎉
                </h3>
                <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6 }}>
                  An iMocha expert will contact you soon.
                </p>
              </div>
            ) : (
              <>
                {/* HubSpot form target — populated by hbspt.forms.create() in useEffect */}
                <div
                  ref={frameRef}
                  id="hs-form-target"
                  className="hs-form-frame"
                  data-region="na1"
                  data-form-id="5a2ff39f-bcf8-435a-be40-c6f0afdba087"
                  data-portal-id="820873"
                />
                <p style={{ fontSize: 11, color: "#9B8AAB", marginTop: 14, textAlign: "center" }}>
                  No spam. Your data is handled per iMocha&apos;s privacy policy.
                </p>
              </>
            )}
          </div>
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
        .hs-form-frame input[type="text"]:focus,
        .hs-form-frame input[type="email"]:focus,
        .hs-form-frame input[type="tel"]:focus {
          border-color: #FD5A0F !important;
          box-shadow: 0 0 0 2px rgba(253,90,15,0.15) !important;
          outline: none !important;
        }
        .hs-form-frame .hs-button,
        .hs-form-frame input[type="submit"] {
          background: #FD5A0F !important;
          color: #fff !important;
          border: none !important;
          border-radius: 8px !important;
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
