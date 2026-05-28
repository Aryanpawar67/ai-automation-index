"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LOCATION_TOOLTIP } from "@/lib/formatLocation";

export interface AnalyticsRow {
  companyId:    string;
  name:         string;
  slug:         string | null;
  opens:        number;
  sessions:     number;
  downloads:    number;
  downloadCard: number;
  downloadPage: number;
  devices:      number;
  topLocation:  string | null;
  lastSeen:     string;           // already formatted on the server; passing
                                  // ISO + formatting client-side would cause
                                  // SSR/CSR timezone hydration mismatches.
}

const RANGE_OPTIONS = [
  { value: "7d",  label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
] as const;

type EngagementFilter = "all" | "engaged" | "downloaded" | "forwarded";

const FILTER_PILLS: Array<{ value: EngagementFilter; label: string }> = [
  { value: "all",        label: "All" },
  { value: "engaged",    label: "Engaged" },
  { value: "downloaded", label: "Downloaded" },
  { value: "forwarded",  label: "Forwarded" },
];

export default function AnalyticsCompanyTable({
  rows,
  range,
}: {
  rows: AnalyticsRow[];
  range: string;
}) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState("");
  const [pill,  setPill]  = useState<EngagementFilter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r => {
      if (q && !r.name.toLowerCase().includes(q) && !(r.slug ?? "").toLowerCase().includes(q)) return false;
      if (pill === "engaged"    && r.sessions  === 0) return false;
      if (pill === "downloaded" && r.downloads === 0) return false;
      if (pill === "forwarded"  && r.devices   <= 1)  return false;
      return true;
    });
  }, [rows, query, pill]);

  function setRange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") params.delete("range");
    else                params.set("range", next);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <>
      {/* Filter row */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 16 }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 360 }}>
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

        {/* Engagement pills */}
        <div style={{ display: "flex", gap: 4, background: "#fff", padding: 4, borderRadius: 10, border: "1px solid #EAE4EF" }}>
          {FILTER_PILLS.map(p => {
            const active = pill === p.value;
            return (
              <button
                key={p.value}
                onClick={() => setPill(p.value)}
                style={{
                  fontSize: 12, fontWeight: 600,
                  padding: "6px 12px", borderRadius: 7,
                  background: active ? "#FD5A0F" : "transparent",
                  color:      active ? "#fff"    : "#553366",
                  border: "none", cursor: "pointer",
                  transition: "background 0.12s, color 0.12s",
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Date range select — server-driven (page re-renders with new SQL) */}
        <select
          value={range}
          onChange={e => setRange(e.target.value)}
          style={{
            height: 38, padding: "0 12px",
            borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: "#fff", color: "#220133",
            border: "1px solid #EAE4EF", outline: "none",
            cursor: "pointer",
          }}
        >
          {RANGE_OPTIONS.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>

        {/* Active filter readout */}
        {(query || pill !== "all" || range !== "all") && (
          <div style={{ fontSize: 12, color: "#9988AA" }}>
            Showing {filtered.length} of {rows.length}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div style={{
          background: "#fff", border: "1px solid #EAE4EF", borderRadius: 20,
          padding: "48px 32px", textAlign: "center", boxShadow: "0 2px 12px rgba(34,1,51,0.06)",
          fontSize: 14, color: "#9988AA",
        }}>
          No companies match the current filters.
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
                  { label: "Devices", hint: "Distinct device/network signatures (ip_hash + user_agent). >1 = link was likely forwarded to another person or accessed from multiple devices." },
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
                const isForwarded = row.devices > 1;
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
                    <td style={{ padding: "16px 24px", fontSize: 14, color: isForwarded ? "#FD5A0F" : "#220133", fontWeight: isForwarded ? 700 : 600, whiteSpace: "nowrap" }}>
                      {row.devices}
                      {isForwarded && (
                        <span style={{
                          marginLeft: 6, fontSize: 9, fontWeight: 700, letterSpacing: "0.05em",
                          padding: "2px 6px", borderRadius: 10,
                          background: "#FFF0EA", color: "#FD5A0F", border: "1px solid #FDBB96",
                        }}>
                          FWD
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "16px 24px", fontSize: 14, color: row.downloads > 0 ? "#059669" : "#9988AA", fontWeight: 700, whiteSpace: "nowrap" }}>
                      {row.downloads === 0
                        ? "0"
                        : (row.downloadCard > 0 && row.downloadPage > 0)
                          ? <>{row.downloads} <span style={{ fontSize: 11, fontWeight: 500, color: "#9988AA" }}>({row.downloadCard} card + {row.downloadPage} page)</span></>
                          : row.downloads
                      }
                    </td>
                    <td style={{ padding: "16px 24px", fontSize: 13, color: "#9988AA", whiteSpace: "nowrap" }}>
                      {row.lastSeen}
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
