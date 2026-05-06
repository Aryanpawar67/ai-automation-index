export const dynamic = "force-dynamic";

import { db }                     from "@/lib/db/client";
import { reportLeads, companies }  from "@/lib/db/schema";
import { eq, desc }                from "drizzle-orm";
import DeleteLeadButton            from "@/components/admin/DeleteLeadButton";

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day:   "numeric",
    month: "short",
    year:  "numeric",
    hour:  "2-digit",
    minute: "2-digit",
  });
}

export default async function LeadsPage() {
  const rows = await db
    .select({
      id:          reportLeads.id,
      email:       reportLeads.email,
      companyId:   reportLeads.companyId,
      companyName: companies.name,
      createdAt:   reportLeads.createdAt,
    })
    .from(reportLeads)
    .innerJoin(companies, eq(reportLeads.companyId, companies.id))
    .orderBy(desc(reportLeads.createdAt));

  return (
    <div>
      {/* ── Page header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#220133", margin: "0 0 4px", letterSpacing: "-0.5px" }}>
            Leads
          </h1>
          <p style={{ fontSize: 13, color: "#9988AA", margin: 0 }}>
            {rows.length} lead{rows.length !== 1 ? "s" : ""} captured from report pages
          </p>
        </div>
      </div>

      {/* ── Use-case context ── */}
      <div style={{
        background:   "linear-gradient(135deg, #F4EFF6, #FAF6FC)",
        border:       "1px solid #E6DAEE",
        borderRadius: 14,
        padding:      "14px 18px",
        marginBottom: 24,
        display:      "flex",
        gap:          12,
        alignItems:   "flex-start",
      }}>
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" style={{ marginTop: 2, flexShrink: 0 }}>
          <rect x="2" y="4" width="20" height="16" rx="2" stroke="#220133" strokeWidth="1.6"/>
          <path d="M2 8l10 7 10-7" stroke="#220133" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div style={{ fontSize: 13, color: "#5C4D6E", lineHeight: 1.55 }}>
          <strong style={{ color: "#220133" }}>What this tracks: </strong>
          A visitor entered their email on a report page to <em>unlock the report</em> or express interest in iMocha.
          These are <strong>top-of-funnel signals</strong> — the user has identified themselves but may not have engaged deeply yet.
          See <a href="/admin/downloads" style={{ color: "#FD5A0F", fontWeight: 600 }}>Downloads</a> for users who exported the PDF after viewing.
        </div>
      </div>

      {/* ── Empty state ── */}
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
              <path d="M4 4h16v16H4z" stroke="#FD5A0F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 4l8 9 8-9" stroke="#FD5A0F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#220133", marginBottom: 8 }}>No leads yet</h2>
          <p style={{ fontSize: 14, color: "#9988AA" }}>
            Email captures from report pages will appear here.
          </p>
        </div>
      ) : (
        /* ── Table card ── */
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
                <th style={{
                  padding: "14px 24px", textAlign: "left",
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.07em",
                  textTransform: "uppercase", color: "#9988AA",
                }}>
                  Company
                </th>
                <th style={{
                  padding: "14px 24px", textAlign: "left",
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.07em",
                  textTransform: "uppercase", color: "#9988AA",
                }}>
                  Email
                </th>
                <th style={{
                  padding: "14px 24px", textAlign: "left",
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.07em",
                  textTransform: "uppercase", color: "#9988AA",
                }}>
                  Date Submitted
                </th>
                <th style={{ padding: "14px 24px", width: 48 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.id}
                  className="lead-row"
                  style={{
                    borderBottom: i < rows.length - 1 ? "1px solid #EAE4EF" : "none",
                    animation:    `fadeInUp 0.35s ease ${i * 0.04}s both`,
                  }}
                >
                  {/* Company */}
                  <td style={{ padding: "16px 24px" }}>
                    <div style={{
                      display:    "inline-flex",
                      alignItems: "center",
                      gap:        8,
                    }}>
                      <div style={{
                        width:        32,
                        height:       32,
                        borderRadius: 8,
                        background:   "linear-gradient(135deg, #F4EFF6, #EAE4EF)",
                        border:       "1px solid #EAE4EF",
                        display:      "flex",
                        alignItems:   "center",
                        justifyContent: "center",
                        flexShrink:   0,
                      }}>
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                          <path d="M3 21h18M3 7l9-4 9 4M4 21V7M20 21V7M9 21V14h6v7" stroke="#9988AA" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#220133" }}>
                        {row.companyName}
                      </span>
                    </div>
                  </td>

                  {/* Email */}
                  <td style={{ padding: "16px 24px" }}>
                    <a
                      href={`mailto:${row.email}`}
                      style={{
                        fontSize:       14,
                        color:          "#FD5A0F",
                        fontWeight:     500,
                        textDecoration: "none",
                      }}
                      className="lead-email"
                    >
                      {row.email}
                    </a>
                  </td>

                  {/* Date */}
                  <td style={{ padding: "16px 24px" }}>
                    <span style={{ fontSize: 13, color: "#9988AA" }}>
                      {formatDate(new Date(row.createdAt))}
                    </span>
                  </td>
                  {/* Delete */}
                  <td style={{ padding: "16px 16px 16px 0" }}>
                    <DeleteLeadButton id={row.id} />
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
        .lead-row:hover { background: #FAF8FC; }
        .lead-email:hover { text-decoration: underline !important; }
      `}</style>
    </div>
  );
}
