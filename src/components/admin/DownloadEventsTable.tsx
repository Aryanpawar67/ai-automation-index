"use client";

import { useState } from "react";

export type DownloadEvent = {
  id:        string;
  company:   string;
  jobTitle:  string | null;
  source:    "role_card" | "report_page" | null;
  email:     string | null;
  createdAt: string;
};

type Filter = "all" | "card" | "page";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all",  label: "All" },
  { value: "card", label: "Card" },
  { value: "page", label: "Page" },
];

export default function DownloadEventsTable({ events }: { events: DownloadEvent[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const visible = events.filter(ev => {
    if (filter === "card") return ev.source === "role_card";
    if (filter === "page") return ev.source !== "role_card";
    return true;
  });

  return (
    <div style={{ marginTop: 40 }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#220133", margin: 0 }}>
          Download Events
        </h2>

        {/* Toggle */}
        <div style={{ display: "flex", background: "#F4EFF6", borderRadius: 10, padding: 3, gap: 2 }}>
          {FILTERS.map(f => {
            const active = filter === f.value;
            const count  = f.value === "all"
              ? events.length
              : f.value === "card"
                ? events.filter(e => e.source === "role_card").length
                : events.filter(e => e.source !== "role_card").length;
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
                {f.label}
                <span style={{
                  fontSize:   10,
                  fontWeight: 700,
                  padding:    "1px 5px",
                  borderRadius: 10,
                  background: active
                    ? (f.value === "card" ? "#EEF2FF" : f.value === "page" ? "#F0FDF4" : "#FFF0EA")
                    : "transparent",
                  color: active
                    ? (f.value === "card" ? "#4F46E5" : f.value === "page" ? "#059669" : "#FD5A0F")
                    : "#C4B5D0",
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <span style={{ fontSize: 12, color: "#9988AA" }}>
          — every PDF download with the email that unlocked it
        </span>
      </div>

      {visible.length === 0 ? (
        <div style={{
          background: "#fff", border: "1px solid #EAE4EF", borderRadius: 16,
          padding: "32px 24px", textAlign: "center", fontSize: 13, color: "#9988AA",
        }}>
          No download events yet.
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #EAE4EF", borderRadius: 16, boxShadow: "0 2px 12px rgba(34,1,51,0.05)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #EAE4EF", background: "#FAF8FC" }}>
                {["Type", "Email", "Company", "Role / Report", "Date"].map(h => (
                  <th key={h} style={{ padding: "12px 24px", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#9988AA" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((ev, i) => (
                <tr
                  key={ev.id}
                  style={{ borderBottom: i < visible.length - 1 ? "1px solid #EAE4EF" : "none" }}
                  className="dl-ev-row"
                >
                  <td style={{ padding: "14px 24px" }}>
                    {ev.source === "role_card" ? (
                      <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: "#EEF2FF", color: "#4F46E5" }}>Card</span>
                    ) : (
                      <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: "#F0FDF4", color: "#059669" }}>Page</span>
                    )}
                  </td>
                  <td style={{ padding: "14px 24px" }}>
                    {ev.email ? (
                      <a href={`mailto:${ev.email}`} className="dl-ev-email" style={{ fontSize: 14, color: "#FD5A0F", fontWeight: 500, textDecoration: "none" }}>
                        {ev.email}
                      </a>
                    ) : (
                      <span style={{ fontSize: 13, color: "#C4B5D0" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "14px 24px", fontSize: 14, color: "#220133", fontWeight: 600 }}>
                    {ev.company}
                  </td>
                  <td style={{ padding: "14px 24px", fontSize: 13, color: "#5C4D6E" }}>
                    {ev.jobTitle ?? "—"}
                  </td>
                  <td style={{ padding: "14px 24px", fontSize: 13, color: "#9988AA", whiteSpace: "nowrap" }}>
                    {ev.createdAt}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        .dl-ev-row:hover  { background: #FAF8FC; }
        .dl-ev-email:hover { text-decoration: underline !important; }
      `}</style>
    </div>
  );
}
