"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LOCATION_TOOLTIP } from "@/lib/formatLocation";

export interface AnalyticsRow {
  companyId:    string;
  name:         string;
  slug:         string | null;
  opens:        number;
  sessions:     number;
  downloads:    number;
  topLocation:  string | null;
  lastSeenAt:   string | null;   // ISO string — serialised by parent
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AnalyticsCompanyTable({ rows }: { rows: AnalyticsRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      r.name.toLowerCase().includes(q) ||
      (r.slug ?? "").toLowerCase().includes(q),
    );
  }, [rows, query]);

  return (
    <>
      {/* Search */}
      <div style={{ marginBottom: 14, position: "relative", maxWidth: 360 }}>
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24"
          style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9988AA" }}>
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8"/>
          <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search company name or slug…"
          style={{
            width: "100%", height: 38, padding: "0 36px 0 36px",
            borderRadius: 10, fontSize: 13,
            background: "#fff", color: "#220133",
            border: "1px solid #EAE4EF", outline: "none",
            boxShadow: "0 2px 8px rgba(34,1,51,0.04)",
          }}
          onFocus={e => (e.currentTarget.style.borderColor = "#FD5A0F")}
          onBlur={e  => (e.currentTarget.style.borderColor = "#EAE4EF")}
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="Clear search"
            style={{
              position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
              width: 22, height: 22, border: "none", background: "transparent",
              color: "#9988AA", fontSize: 16, cursor: "pointer", lineHeight: 1,
            }}
          >×</button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div style={{
          background: "#fff", border: "1px solid #EAE4EF", borderRadius: 20,
          padding: "48px 32px", textAlign: "center", boxShadow: "0 2px 12px rgba(34,1,51,0.06)",
          fontSize: 14, color: "#9988AA",
        }}>
          No companies match &ldquo;{query}&rdquo;.
        </div>
      ) : (
        <div style={{
          background: "#fff", border: "1px solid #EAE4EF", borderRadius: 20,
          boxShadow: "0 2px 12px rgba(34,1,51,0.06)", overflow: "hidden",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #EAE4EF", background: "#FAF8FC" }}>
                {[
                  { label: "Company" },
                  { label: "Top location", hint: LOCATION_TOOLTIP },
                  { label: "Opens" },
                  { label: "Sessions" },
                  { label: "Downloads" },
                  { label: "Last activity" },
                ].map(h => (
                  <th key={h.label} title={h.hint} style={{
                    padding: "14px 24px", textAlign: "left",
                    fontSize: 11, fontWeight: 700, letterSpacing: "0.07em",
                    textTransform: "uppercase", color: "#9988AA",
                    cursor: h.hint ? "help" : "default",
                  }}>
                    {h.label}
                    {h.hint && (
                      <span style={{ marginLeft: 4, fontSize: 10, color: "#C4B5D0" }}>ⓘ</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const identifier = row.slug ?? row.companyId;
                return (
                  <tr key={row.companyId} className="an-row" style={{
                    borderBottom: i < filtered.length - 1 ? "1px solid #EAE4EF" : "none",
                  }}>
                    <td style={{ padding: "16px 24px" }}>
                      <Link href={`/admin/analytics/${identifier}`} style={{
                        fontSize: 14, color: "#220133", fontWeight: 600, textDecoration: "none",
                      }}>
                        {row.name}
                      </Link>
                      {row.slug && (
                        <span style={{ marginLeft: 8, fontSize: 12, color: "#9988AA", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                          {row.slug}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "16px 24px", fontSize: 13, color: row.topLocation ? "#553366" : "#C4B5D0", whiteSpace: "nowrap" }}>
                      {row.topLocation ?? "—"}
                    </td>
                    <td style={{ padding: "16px 24px", fontSize: 14, color: "#220133", fontWeight: 600 }}>
                      {row.opens}
                    </td>
                    <td style={{ padding: "16px 24px", fontSize: 14, color: "#220133", fontWeight: 600 }}>
                      {row.sessions}
                    </td>
                    <td style={{ padding: "16px 24px", fontSize: 14, color: row.downloads > 0 ? "#059669" : "#9988AA", fontWeight: 700 }}>
                      {row.downloads}
                    </td>
                    <td style={{ padding: "16px 24px", fontSize: 13, color: "#9988AA", whiteSpace: "nowrap" }}>
                      {formatDate(row.lastSeenAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        .an-row:hover { background: #FAF8FC; cursor: pointer; }
      `}</style>
    </>
  );
}
