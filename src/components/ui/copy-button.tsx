"use client";

import { useState } from "react";

interface CopyButtonProps {
  content:  string;
  onCopy?:  () => void;
}

export function CopyButton({ content, onCopy }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for non-secure contexts
      const el = document.createElement("textarea");
      el.value = content;
      el.style.position = "fixed";
      el.style.opacity  = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      aria-label={copied ? "Copied" : "Copy to clipboard"}
      title={copied ? "Copied!" : "Copy link"}
      style={{
        display:        "inline-flex",
        alignItems:     "center",
        justifyContent: "center",
        width:          32,
        height:         32,
        borderRadius:   6,
        border:         "1px solid #e2e8f0",
        background:     copied ? "#f0fdf4" : "#fff",
        color:          copied ? "#16a34a" : "#64748b",
        cursor:         "pointer",
        transition:     "background 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s",
        flexShrink:     0,
        outline:        "none",
      }}
      onMouseEnter={e => {
        if (!copied) {
          (e.currentTarget as HTMLButtonElement).style.background   = "#f8fafc";
          (e.currentTarget as HTMLButtonElement).style.borderColor  = "#cbd5e1";
          (e.currentTarget as HTMLButtonElement).style.color        = "#0f172a";
          (e.currentTarget as HTMLButtonElement).style.boxShadow    = "0 1px 3px rgba(0,0,0,0.08)";
        }
      }}
      onMouseLeave={e => {
        if (!copied) {
          (e.currentTarget as HTMLButtonElement).style.background   = "#fff";
          (e.currentTarget as HTMLButtonElement).style.borderColor  = "#e2e8f0";
          (e.currentTarget as HTMLButtonElement).style.color        = "#64748b";
          (e.currentTarget as HTMLButtonElement).style.boxShadow    = "none";
        }
      }}
    >
      {copied ? (
        /* Check icon */
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14" height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        /* Clipboard icon */
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14" height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        </svg>
      )}
    </button>
  );
}
