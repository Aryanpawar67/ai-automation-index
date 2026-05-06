export const dynamic = "force-dynamic";

import { db }                 from "@/lib/db/client";
import { reportDownloads }    from "@/lib/db/schema";
import { desc }               from "drizzle-orm";
import DeleteDownloadButton   from "@/components/admin/DeleteDownloadButton";

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day:   "numeric",
    month: "short",
    year:  "numeric",
    hour:  "2-digit",
    minute: "2-digit",
  });
}

function shortReferrer(ref: string | null): string {
  if (!ref) return "—";
  try {
    const u = new URL(ref);
    return u.hostname + (u.pathname !== "/" ? u.pathname : "");
  } catch {
    return ref.length > 40 ? ref.slice(0, 40) + "…" : ref;
  }
}

export default async function DownloadsPage() {
  const rows = await db
    .select()
    .from(reportDownloads)
    .orderBy(desc(reportDownloads.downloadedAt));

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#220133", margin: "0 0 4px", letterSpacing: "-0.5px" }}>
            Downloads
          </h1>
          <p style={{ fontSize: 13, color: "#9988AA", margin: 0 }}>
            {rows.length} PDF download{rows.length !== 1 ? "s" : ""} tracked from report pages
          </p>
        </div>
      </div>

      {/* Use-case context card */}
      <div style={{
        background:   "linear-gradient(135deg, #FFF7F2, #FFFAF6)",
        border:       "1px solid #FFE0CC",
        borderRadius: 14,
        padding:      "14px 18px",
        marginBottom: 24,
        display:      "flex",
        gap:          12,
        alignItems:   "flex-start",
      }}>
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" style={{ marginTop: 2, flexShrink: 0 }}>
          <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="#FD5A0F" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div style={{ fontSize: 13, color: "#5C4D6E", lineHeight: 1.55 }}>
          <strong style={{ color: "#220133" }}>What this tracks: </strong>
          A user clicked the <em>Download report</em> button on a public report and exported it to PDF.
          These are <strong>engaged, mid-funnel signals</strong> — the user already saw the report and chose to take it offline.
          Each row records the email used, the report slug viewed, the originating page (referrer), and the device (user agent).
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{
          background:   "#fff",
          border:       "1px solid #EAE4EF",
          borderRadius: 20,
          padding:      "64px 32px",
          textAlign:    "center",
          boxShadow:    "0 2px 12px rgba(34,1,51,0.06)",
        }}>
          <div style={{ marginBottom: 20 }}>
            <svg width="56" height="56" fill="none" viewBox="0 0 24 24" style={{ opacity: 0.25, display: "inline-block" }}>
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="#FD5A0F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#220133", marginBottom: 8 }}>No downloads yet</h2>
          <p style={{ fontSize: 14, color: "#9988AA" }}>
            PDF exports from report pages will appear here.
          </p>
        </div>
      ) : (
        <div style={{
          background:   "#fff",
          border:       "1px solid #EAE4EF",
          borderRadius: 20,
          boxShadow:    "0 2px 12px rgba(34,1,51,0.06)",
          overflow:     "hidden",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #EAE4EF", background: "#FAF8FC" }}>
                {["Email", "Company", "Report Slug", "Referrer", "Downloaded At"].map(h => (
                  <th key={h} style={{
                    padding: "14px 24px", textAlign: "left",
                    fontSize: 11, fontWeight: 700, letterSpacing: "0.07em",
                    textTransform: "uppercase", color: "#9988AA",
                  }}>
                    {h}
                  </th>
                ))}
                <th style={{ padding: "14px 24px", width: 48 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.id}
                  className="dl-row"
                  style={{
                    borderBottom: i < rows.length - 1 ? "1px solid #EAE4EF" : "none",
                    animation:    `fadeInUp 0.35s ease ${i * 0.04}s both`,
                  }}
                >
                  <td style={{ padding: "16px 24px" }}>
                    <a
                      href={`mailto:${row.email}`}
                      title={row.userAgent ?? ""}
                      style={{
                        fontSize:       14,
                        color:          "#FD5A0F",
                        fontWeight:     500,
                        textDecoration: "none",
                      }}
                      className="dl-email"
                    >
                      {row.email}
                    </a>
                  </td>
                  <td style={{ padding: "16px 24px", fontSize: 14, color: "#220133", fontWeight: 600 }}>
                    {row.companyName ?? "—"}
                  </td>
                  <td style={{ padding: "16px 24px", fontSize: 13, color: "#5C4D6E", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                    {row.reportSlug ?? "—"}
                  </td>
                  <td style={{ padding: "16px 24px", fontSize: 13, color: "#9988AA", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.referrer ?? ""}>
                    {shortReferrer(row.referrer)}
                  </td>
                  <td style={{ padding: "16px 24px", fontSize: 13, color: "#9988AA", whiteSpace: "nowrap" }}>
                    {formatDate(new Date(row.downloadedAt))}
                  </td>
                  <td style={{ padding: "16px 16px 16px 0" }}>
                    <DeleteDownloadButton id={row.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .dl-row:hover { background: #FAF8FC; }
        .dl-email:hover { text-decoration: underline !important; }
      `}</style>
    </div>
  );
}
