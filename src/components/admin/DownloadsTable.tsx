"use client";

import { useState } from "react";
import DeleteDownloadButton from "@/components/admin/DeleteDownloadButton";

export type DownloadRow = {
  id:          string;
  type:        "page" | "cta";
  email:       string;
  companyName: string | null;
  reportSlug:  string | null;
  referrer:    string | null;
  date:        string;
  deletableId: string | null; // non-null only for "page" rows (reportDownloads)
};

type Filter = "all" | "page" | "cta";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all",  label: "All"      },
  { value: "page", label: "Page"     },
  { value: "cta",  label: "CTA Lead" },
];

const TYPE_META: Record<"page" | "cta", { label: string; bg: string; color: string }> = {
  page: { label: "Page",     bg: "#F0FDF4", color: "#059669" },
  cta:  { label: "CTA Lead", bg: "#FFF0EA", color: "#FD5A0F" },
};

function shortReferrer(ref: string | null): string {
  if (!ref) return "—";
  try {
    const u = new URL(ref);
    return u.hostname + (u.pathname !== "/" ? u.pathname : "");
  } catch {
    return ref.length > 40 ? ref.slice(0, 40) + "…" : ref;
  }
}

export default function DownloadsTable({ rows }: { rows: DownloadRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const countOf = (f: Filter) =>
    f === "all" ? rows.length : rows.filter(r => r.type === f).length;

  const visible = filter === "all" ? rows : rows.filter(r => r.type === filter);

  return (
    <div>
      {/* Toggle */}
      <div style={{ display: "flex", background: "#F4EFF6", borderRadius: 10, padding: 3, gap: 2, width: "fit-content", marginBottom: 20 }}>
        {FILTERS.map(f => {
          const active = filter === f.value;
          const count  = countOf(f.value);
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              style={{
                fontSize:    12,
                fontWeight:  700,
                padding:     "5px 14px",
                borderRadius: 7,
                border:      "none",
                cursor:      "pointer",
                background:  active ? "#fff" : "transparent",
                color:       active ? "#220133" : "#9988AA",
                boxShadow:   active ? "0 1px 4px rgba(34,1,51,0.10)" : "none",
                transition:  "background 0.12s, color 0.12s",
                display:     "flex",
                alignItems:  "center",
                gap:         5,
              }}
            >
              <span>{f.label}</span>
              <span style={{
                fontSize:    10,
                fontWeight:  700,
                padding:     "1px 5px",
                borderRadius: 10,
                background:  active ? "#EAE4EF" : "transparent",
                color:       active ? "#553366" : "#C4B5D0",
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #EAE4EF", borderRadius: 16, padding: "40px 24px", textAlign: "center", fontSize: 13, color: "#9988AA" }}>
          No entries for this filter.
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #EAE4EF", borderRadius: 16, boxShadow: "0 2px 12px rgba(34,1,51,0.05)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #EAE4EF", background: "#FAF8FC" }}>
                {["Type", "Email", "Company", "Report", "Referrer", "Date"].map(h => (
                  <th key={h} style={{ padding: "12px 24px", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#9988AA" }}>
                    {h}
                  </th>
                ))}
                <th style={{ width: 48 }} />
              </tr>
            </thead>
            <tbody>
              {visible.map((row, i) => {
                const meta = TYPE_META[row.type];
                return (
                  <tr key={row.id} className="dl-row" style={{ borderBottom: i < visible.length - 1 ? "1px solid #EAE4EF" : "none" }}>
                    <td style={{ padding: "15px 24px" }}>
                      <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: meta.bg, color: meta.color }}>
                        {meta.label}
                      </span>
                    </td>
                    <td style={{ padding: "15px 24px" }}>
                      <a href={`mailto:${row.email}`} className="dl-email" style={{ fontSize: 14, color: "#FD5A0F", fontWeight: 500, textDecoration: "none" }}>
                        {row.email}
                      </a>
                    </td>
                    <td style={{ padding: "15px 24px", fontSize: 14, color: "#220133", fontWeight: 600 }}>
                      {row.companyName ?? "—"}
                    </td>
                    <td style={{ padding: "15px 24px", fontSize: 13, color: "#5C4D6E", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                      {row.reportSlug ?? "—"}
                    </td>
                    <td style={{ padding: "15px 24px", fontSize: 13, color: "#9988AA", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.referrer ?? ""}>
                      {shortReferrer(row.referrer)}
                    </td>
                    <td style={{ padding: "15px 24px", fontSize: 13, color: "#9988AA", whiteSpace: "nowrap" }}>
                      {row.date}
                    </td>
                    <td style={{ padding: "15px 16px 15px 0" }}>
                      {row.deletableId && <DeleteDownloadButton id={row.deletableId} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        .dl-row:hover  { background: #FAF8FC; }
        .dl-email:hover { text-decoration: underline !important; }
      `}</style>
    </div>
  );
}
