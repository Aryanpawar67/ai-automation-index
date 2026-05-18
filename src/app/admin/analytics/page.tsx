export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db/client";
import { sql } from "drizzle-orm";

interface Row {
  companyId:   string;
  name:        string;
  slug:        string | null;
  opens:       number;
  sessions:    number;
  downloads:   number;
  lastSeenAt:  Date | null;
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function AnalyticsIndexPage() {
  const result = await db.execute(sql`
    SELECT
      c.id                                                AS "companyId",
      c.name                                              AS "name",
      c.slug                                              AS "slug",
      COUNT(*) FILTER (WHERE e.event = 'report_opened')   AS "opens",
      COUNT(DISTINCT e.session_id)                        AS "sessions",
      COUNT(*) FILTER (WHERE e.event = 'report_downloaded') AS "downloads",
      MAX(e.created_at)                                   AS "lastSeenAt"
    FROM companies c
    LEFT JOIN report_events e ON e.company_id = c.id
    WHERE c.report_token IS NOT NULL
    GROUP BY c.id, c.name, c.slug
    ORDER BY MAX(e.created_at) DESC NULLS LAST, c.name ASC
  `);

  const rows = (result.rows as unknown as Array<Record<string, unknown>>).map(r => ({
    companyId:  r.companyId  as string,
    name:       r.name       as string,
    slug:       (r.slug as string | null) ?? null,
    opens:      Number(r.opens ?? 0),
    sessions:   Number(r.sessions ?? 0),
    downloads:  Number(r.downloads ?? 0),
    lastSeenAt: r.lastSeenAt ? new Date(r.lastSeenAt as string) : null,
  })) as Row[];

  const totalSessions = rows.reduce((sum, r) => sum + r.sessions, 0);
  const totalDownloads = rows.reduce((sum, r) => sum + r.downloads, 0);
  const engaged = rows.filter(r => r.sessions > 0).length;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#220133", margin: "0 0 4px", letterSpacing: "-0.5px" }}>
          Report Analytics
        </h1>
        <p style={{ fontSize: 13, color: "#9988AA", margin: 0 }}>
          Engagement on personalised report links sent in outbound campaigns
        </p>
      </div>

      {/* Topline */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Companies engaged", value: `${engaged} / ${rows.length}` },
          { label: "Total sessions",    value: totalSessions },
          { label: "Total downloads",   value: totalDownloads },
        ].map(s => (
          <div key={s.label} style={{
            background: "#fff", border: "1px solid #EAE4EF", borderRadius: 16,
            padding: "18px 20px", boxShadow: "0 2px 12px rgba(34,1,51,0.06)",
          }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9988AA", margin: "0 0 8px" }}>
              {s.label}
            </p>
            <p style={{ fontSize: 28, fontWeight: 800, color: "#220133", margin: 0, letterSpacing: "-0.5px" }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div style={{
          background: "#fff", border: "1px solid #EAE4EF", borderRadius: 20,
          padding: "64px 32px", textAlign: "center", boxShadow: "0 2px 12px rgba(34,1,51,0.06)",
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#220133", marginBottom: 8 }}>No companies with report tokens yet</h2>
          <p style={{ fontSize: 14, color: "#9988AA" }}>Generate a report token on a company first.</p>
        </div>
      ) : (
        <div style={{
          background: "#fff", border: "1px solid #EAE4EF", borderRadius: 20,
          boxShadow: "0 2px 12px rgba(34,1,51,0.06)", overflow: "hidden",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #EAE4EF", background: "#FAF8FC" }}>
                {["Company", "Opens", "Sessions", "Downloads", "Last activity"].map(h => (
                  <th key={h} style={{
                    padding: "14px 24px", textAlign: "left",
                    fontSize: 11, fontWeight: 700, letterSpacing: "0.07em",
                    textTransform: "uppercase", color: "#9988AA",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const identifier = row.slug ?? row.companyId;
                return (
                  <tr key={row.companyId} className="an-row" style={{
                    borderBottom: i < rows.length - 1 ? "1px solid #EAE4EF" : "none",
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
    </div>
  );
}
