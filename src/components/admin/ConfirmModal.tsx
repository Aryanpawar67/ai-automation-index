"use client";

import { useEffect, useState } from "react";
import { createPortal }        from "react-dom";

interface Props {
  title:     string;
  message:   string;
  onConfirm: () => void;
  onCancel:  () => void;
  danger?:   boolean;
  loading?:  boolean;
}

export default function ConfirmModal({ title, message, onConfirm, onCancel, danger = true, loading = false }: Props) {
  // Wait for client mount before rendering portal (avoids SSR mismatch)
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  // Render directly into document.body to escape any parent stacking context
  // caused by CSS transforms (animation: fadeInUp uses transform: translateY)
  return createPortal(
    <div
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)",
      }}
    >
      <div style={{
        background: "#fff", borderRadius: 20, padding: "28px 28px 24px",
        maxWidth: 400, width: "calc(100% - 32px)",
        boxShadow: "0 20px 60px rgba(34,1,51,0.22)",
        border: "1px solid #EAE4EF",
        animation: "confirmModalIn 0.2s ease",
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: "#220133", margin: "0 0 8px" }}>{title}</h3>
        <p style={{ fontSize: 13, color: "#553366", margin: "0 0 22px", lineHeight: 1.55 }}>{message}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              fontSize: 13, padding: "8px 18px", borderRadius: 10,
              fontWeight: 600, color: "#553366", background: "#fff",
              border: "1px solid #EAE4EF", cursor: "pointer",
              opacity: loading ? 0.5 : 1, transition: "background 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "#F4EFF6")}
            onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              fontSize: 13, padding: "8px 18px", borderRadius: 10,
              fontWeight: 700, color: "#fff", border: "none", cursor: "pointer",
              background: danger ? "#ef4444" : "#FD5A0F",
              opacity: loading ? 0.6 : 1, transition: "opacity 0.15s, filter 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.filter = "brightness(1.1)")}
            onMouseLeave={e => (e.currentTarget.style.filter = "")}
          >
            {loading ? "Working…" : "Confirm"}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes confirmModalIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  );
}
