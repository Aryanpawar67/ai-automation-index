export const dynamic = "force-dynamic";

import { db } from "@/lib/db/client";
import { sql } from "drizzle-orm";
import AnalyticsCompanyTable, { type AnalyticsRow } from "@/components/admin/AnalyticsCompanyTable";
import { formatLocation } from "@/lib/formatLocation";

type Range = "7d" | "30d" | "90d" | "all";
const RANGE_DAYS: Record<Range, number | null> = {
  "7d":  7,
  "30d": 30,
  "90d": 90,
  "all": null,
};

function parseRange(raw: string | undefined): Range {
  return raw && raw in RANGE_DAYS ? (raw as Range) : "all";
}

export default async function AnalyticsIndexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const { range: rangeParam } = await searchParams;
  const range = parseRange(rangeParam);
  const days  = RANGE_DAYS[range];

  // SQL date filter. Applied to the LEFT JOIN's events but NOT to the
  // companies row itself — companies with no events in the range still
  // appear (with zero counts) so users can see who hasn't engaged.
  const dateFilter = days
    ? sql`AND e.created_at >= NOW() - (${days} || ' days')::interval`
    : sql``;

  // Per-company aggregation. The top_location subquery picks the city+country
  // pair with the most events for that company (NULL when no geo data exists).
  // Individual download events with email — shown in the Download Events section.
  // email lives in props->>'email' for both role_card (after our change) and report_page.
  const dlDateFilter = days
    ? sql`AND e.created_at >= NOW() - (${days} || ' days')::interval`
    : sql``;

  const dlEvents = await db.execute(sql`
    SELECT
      e.id                        AS "id",
      c.name                      AS "company",
      e.job_title                 AS "jobTitle",
      e.props->>'source'          AS "source",
      e.props->>'email'           AS "email",
      e.created_at                AS "createdAt"
    FROM report_events e
    JOIN companies c ON c.id = e.company_id
    WHERE e.event = 'report_downloaded'
      ${dlDateFilter}
    ORDER BY e.created_at DESC
    LIMIT 200
  `);

  type DlEvent = { id: string; company: string; jobTitle: string | null; source: string | null; email: string | null; createdAt: string };
  const downloadEvents = dlEvents.rows as unknown as DlEvent[];

  const fmtDlDate = (iso: string): string =>
    new Date(iso).toLocaleString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
      timeZone: "Asia/Kolkata",
    });

  const result = await db.execute(sql`
    SELECT
      c.id                                                  AS "companyId",
      c.name                                                AS "name",
      c.slug                                                AS "slug",
      COUNT(*) FILTER (WHERE e.event = 'report_opened')     AS "opens",
      COUNT(DISTINCT e.session_id)                          AS "sessions",
      COUNT(*) FILTER (WHERE e.event = 'report_downloaded' AND e.props->>'source' = 'role_card') AS "downloadCard",
      COUNT(*) FILTER (WHERE e.event = 'report_downloaded' AND (e.props->>'source' IS NULL OR e.props->>'source' != 'role_card')) AS "downloadPage",
      COUNT(DISTINCT (
        COALESCE(e.ip_hash, '') || '|' || COALESCE(e.user_agent, '')
      )) FILTER (WHERE e.ip_hash IS NOT NULL OR e.user_agent IS NOT NULL)
                                                            AS "devices",
      MAX(e.created_at)                                     AS "lastSeenAt",
      (
        SELECT json_build_object(
          'city',        city,
          'region',      region,
          'country',     country,
          'accuracy_km', MIN(accuracy_km)
        )
        FROM report_events
        WHERE company_id = c.id
          AND country IS NOT NULL
          ${days ? sql`AND created_at >= NOW() - (${days} || ' days')::interval` : sql``}
        GROUP BY city, region, country
        ORDER BY COUNT(*) DESC
        LIMIT 1
      )                                                     AS "topGeo"
    FROM companies c
    LEFT JOIN report_events e
      ON e.company_id = c.id
      ${dateFilter}
    WHERE c.report_token IS NOT NULL
    GROUP BY c.id, c.name, c.slug
    ORDER BY MAX(e.created_at) DESC NULLS LAST, c.name ASC
  `);

  // Format the timestamp on the server with an explicit timezone so the SSR
  // output is identical to what the client would render — otherwise React
  // throws hydration error #418 when the server is UTC and the browser is IST.
  const fmtLastSeen = (iso: string | null): string => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
      timeZone: "Asia/Kolkata",
    });
  };

  const rows: AnalyticsRow[] = (result.rows as unknown as Array<Record<string, unknown>>).map(r => {
    const g = (r.topGeo as { city?: string | null; region?: string | null; country?: string | null; accuracy_km?: number | null } | null) ?? null;
    return {
      companyId:   r.companyId  as string,
      name:        r.name       as string,
      slug:        (r.slug as string | null) ?? null,
      opens:       Number(r.opens ?? 0),
      sessions:    Number(r.sessions ?? 0),
      downloads:    Number(r.downloadCard ?? 0) + Number(r.downloadPage ?? 0),
      downloadCard: Number(r.downloadCard ?? 0),
      downloadPage: Number(r.downloadPage ?? 0),
      devices:     Number(r.devices ?? 0),
      topLocation: g ? formatLocation(g.city ?? null, g.region ?? null, g.country ?? null, g.accuracy_km ?? null) : null,
      lastSeen:    fmtLastSeen(r.lastSeenAt ? (r.lastSeenAt as string) : null),
    };
  });

  const totalSessions   = rows.reduce((sum, r) => sum + r.sessions,  0);
  const totalDownloads  = rows.reduce((sum, r) => sum + r.downloads, 0);
  const engaged         = rows.filter(r => r.sessions > 0).length;
  const forwarded       = rows.filter(r => r.devices > 1).length;

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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Companies engaged", value: `${engaged} / ${rows.length}` },
          { label: "Forwarded",         value: forwarded, hint: forwarded > 0 ? "multi-device" : undefined },
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
            {s.hint && (
              <p style={{ fontSize: 10, color: "#FD5A0F", margin: "2px 0 0", fontWeight: 600 }}>
                {s.hint}
              </p>
            )}
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
        <AnalyticsCompanyTable rows={rows} range={range} />
      )}

      {/* ── Download Events ──────────────────────────────────────── */}
      <div style={{ marginTop: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#220133", margin: 0 }}>
            Download Events
          </h2>
          <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: "#EEF2FF", color: "#4F46E5" }}>
            {downloadEvents.length}
          </span>
          <span style={{ fontSize: 12, color: "#9988AA", marginLeft: 4 }}>
            — every PDF download with the email that unlocked it
          </span>
        </div>

        {downloadEvents.length === 0 ? (
          <div style={{ background: "#fff", border: "1px solid #EAE4EF", borderRadius: 16, padding: "32px 24px", textAlign: "center", fontSize: 13, color: "#9988AA" }}>
            No download events yet in this range.
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
                {downloadEvents.map((ev, i) => (
                  <tr key={ev.id} style={{ borderBottom: i < downloadEvents.length - 1 ? "1px solid #EAE4EF" : "none" }} className="dl-ev-row">
                    <td style={{ padding: "14px 24px" }}>
                      {ev.source === "role_card" ? (
                        <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: "#EEF2FF", color: "#4F46E5" }}>Card</span>
                      ) : (
                        <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: "#F0FDF4", color: "#059669" }}>Page</span>
                      )}
                    </td>
                    <td style={{ padding: "14px 24px" }}>
                      {ev.email ? (
                        <a href={`mailto:${ev.email}`} style={{ fontSize: 14, color: "#FD5A0F", fontWeight: 500, textDecoration: "none" }} className="dl-ev-email">
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
                      {fmtDlDate(ev.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        .dl-ev-row:hover { background: #FAF8FC; }
        .dl-ev-email:hover { text-decoration: underline !important; }
      `}</style>
    </div>
  );
}
