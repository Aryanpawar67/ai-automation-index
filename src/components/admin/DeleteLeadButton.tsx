"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteLeadButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    setLoading(true);
    await fetch("/api/admin/leads", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      style={{
        background:   "transparent",
        border:       "1px solid #EAE4EF",
        borderRadius: 8,
        padding:      "5px 8px",
        cursor:       loading ? "not-allowed" : "pointer",
        color:        "#cc3333",
        opacity:      loading ? 0.5 : 1,
        display:      "flex",
        alignItems:   "center",
        transition:   "background 0.15s, border-color 0.15s",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.background = "#fef2f2";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "#fecaca";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "#EAE4EF";
      }}
      title="Delete lead"
    >
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}
