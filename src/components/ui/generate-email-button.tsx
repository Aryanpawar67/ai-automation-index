"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal }                from "react-dom";
import { CopyButton }                  from "./copy-button";

interface GenerateEmailButtonProps {
  companyName:  string;
  reportLink:   string;
  pocFirstName: string | null;
  pocLastName:  string | null;
}

function buildBody(
  companyName:  string,
  reportLink:   string,
  pocFirstName: string | null,
): string {
  const greeting = pocFirstName ? `Hi ${pocFirstName},` : "Hi there,";
  return `${greeting}

I hope this message finds you well.

We recently conducted an AI Automation Readiness analysis for ${companyName} and we'd love to share the insights with you.

Your personalized report is ready here:
${reportLink}

The report breaks down ${companyName}'s open roles by automation readiness, highlights where AI-powered skill assessments could reduce time-to-hire, and identifies high-impact positions for immediate ROI.

We'd love to walk you through the findings and explore how iMocha can support ${companyName}'s hiring goals. Would you be open to a 20-minute call this week?

Looking forward to connecting.

Warm regards,
The iMocha Team
imocha.io | AI-Powered Skill Intelligence`;
}

function EmailModal({
  companyName, reportLink, pocFirstName, pocLastName, onClose,
}: GenerateEmailButtonProps & { onClose: () => void }) {
  const defaultSubject = `Your AI Automation Readiness Report — ${companyName}`;
  const defaultBody    = buildBody(companyName, reportLink, pocFirstName);

  const [subject, setSubject] = useState(defaultSubject);
  const [body,    setBody]    = useState(defaultBody);

  const fullEmail = `Subject: ${subject}\n\n${body}`;

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position:       "fixed",
        inset:          0,
        zIndex:         9999,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        background:     "rgba(15,0,25,0.55)",
        backdropFilter: "blur(6px)",
        padding:        "24px 16px",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background:    "#fff",
          borderRadius:  20,
          width:         "100%",
          maxWidth:      580,
          maxHeight:     "calc(100vh - 48px)",
          display:       "flex",
          flexDirection: "column",
          boxShadow:     "0 32px 80px rgba(15,0,25,0.28), 0 4px 20px rgba(15,0,25,0.12)",
          border:        "1px solid #EAE4EF",
          overflow:      "hidden",
        }}
      >
        {/* ── Header ── */}
        <div style={{
          padding:        "16px 20px 14px",
          borderBottom:   "1px solid #F4EFF6",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          flexShrink:     0,
          background:     "#FDFBFE",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: "linear-gradient(135deg, #220133, #FD5A0F)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#220133", lineHeight: 1.2 }}>Outreach Email</p>
              <p style={{ margin: 0, fontSize: 11, color: "#9988AA", lineHeight: 1.2 }}>{companyName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 6,
              border: "1px solid #EAE4EF", background: "#F4EFF6",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#9988AA", flexShrink: 0, outline: "none",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#EAE4EF"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#F4EFF6"; }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>

          {/* To */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "9px 13px", borderRadius: 9,
            background: "#F9F7FC", border: "1px solid #EAE4EF",
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#9988AA", width: 52, flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>To</span>
            <span style={{ fontSize: 13, color: "#553366", fontWeight: 500 }}>
              {pocFirstName || pocLastName
                ? `${pocFirstName ?? ""} ${pocLastName ?? ""}`.trim()
                : <em style={{ color: "#C4B5D0", fontStyle: "italic", fontWeight: 400 }}>add recipient email</em>
              }
            </span>
          </div>

          {/* Subject — editable */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "2px 13px 2px 13px", borderRadius: 9,
            background: "#F9F7FC", border: "1px solid #EAE4EF",
            transition: "border-color 0.15s",
          }}
            onFocusCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#C4B5D0"; }}
            onBlurCapture={e  => { (e.currentTarget as HTMLDivElement).style.borderColor = "#EAE4EF"; }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: "#9988AA", width: 52, flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>Subject</span>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              style={{
                flex: 1, border: "none", background: "transparent",
                fontSize: 13, fontWeight: 600, color: "#220133",
                outline: "none", padding: "8px 0",
              }}
            />
          </div>

          {/* Body — editable textarea */}
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={14}
            style={{
              width:        "100%",
              border:       "1px solid #EAE4EF",
              borderRadius: 10,
              padding:      "14px 16px",
              fontSize:     13,
              lineHeight:   1.7,
              color:        "#220133",
              fontFamily:   "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              resize:       "vertical",
              outline:      "none",
              background:   "#FDFBFE",
              boxSizing:    "border-box",
              transition:   "border-color 0.15s",
            }}
            onFocus={e  => { e.currentTarget.style.borderColor = "#C4B5D0"; }}
            onBlur={e   => { e.currentTarget.style.borderColor = "#EAE4EF"; }}
          />
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding:        "12px 20px",
          borderTop:      "1px solid #F4EFF6",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          flexShrink:     0,
          background:     "#FDFBFE",
        }}>
          <p style={{ margin: 0, fontSize: 11, color: "#C4B5D0" }}>
            Subject & body are editable before copying
          </p>
          <CopyButton content={fullEmail} />
        </div>
      </div>
    </div>
  );
}

export function GenerateEmailButton({
  companyName, reportLink, pocFirstName, pocLastName,
}: GenerateEmailButtonProps) {
  const [open,    setOpen]    = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Generate outreach email"
        title="Generate outreach email"
        style={{
          display:        "inline-flex",
          alignItems:     "center",
          justifyContent: "center",
          width:          32,
          height:         32,
          borderRadius:   6,
          border:         "1px solid #e2e8f0",
          background:     "#fff",
          color:          "#64748b",
          cursor:         "pointer",
          transition:     "background 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s",
          flexShrink:     0,
          outline:        "none",
        }}
        onMouseEnter={e => {
          const btn = e.currentTarget as HTMLButtonElement;
          btn.style.background  = "#f0f9ff";
          btn.style.borderColor = "#7dd3fc";
          btn.style.color       = "#0284c7";
          btn.style.boxShadow   = "0 1px 3px rgba(0,0,0,0.08)";
        }}
        onMouseLeave={e => {
          const btn = e.currentTarget as HTMLButtonElement;
          btn.style.background  = "#fff";
          btn.style.borderColor = "#e2e8f0";
          btn.style.color       = "#64748b";
          btn.style.boxShadow   = "none";
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="16" x="2" y="4" rx="2"/>
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
        </svg>
      </button>

      {mounted && open && createPortal(
        <EmailModal
          companyName={companyName}
          reportLink={reportLink}
          pocFirstName={pocFirstName}
          pocLastName={pocLastName}
          onClose={() => setOpen(false)}
        />,
        document.body,
      )}
    </>
  );
}
