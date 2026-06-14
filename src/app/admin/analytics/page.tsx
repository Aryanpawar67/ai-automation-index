export const dynamic = "force-dynamic";

import { db }            from "@/lib/db/client";
import { sql, and, eq, gte, desc } from "drizzle-orm";
import { reportEvents, companies } from "@/lib/db/schema";
import AnalyticsCompanyTable, { type AnalyticsRow } from "@/components/admin/AnalyticsCompanyTable";
import DownloadEventsTable,  { type DownloadEvent  } from "@/components/admin/DownloadEventsTable";
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

  // SQL date filter — applied to the LEFT JOIN's events, not to companies rows
  const dateFilter = days
    ? sql`AND e.created_at >= NOW() - (${days} || ' days')::interval`
    : sql``;

  // Per-company aggregation
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

  // Individual download events — use query builder (avoids empty sql-fragment issues)
  const dlWhereConditions = days
    ? and(
        eq(reportEvents.event, "report_downloaded"),
        gte(reportEvents.createdAt, new Date(Date.now() - days * 24 * 60 * 60 * 1000))
      )
    : eq(reportEvents.event, "report_downloaded");

  const dlRows = await db
    .select({
      id:        reportEvents.id,
      company:   companies.name,
      jobTitle:  reportEvents.jobTitle,
      props:     reportEvents.props,
      createdAt: reportEvents.createdAt,
    })
    .from(reportEvents)
    .innerJoin(companies, eq(companies.id, reportEvents.companyId))
    .where(dlWhereConditions)
    .orderBy(desc(reportEvents.createdAt))
    .limit(200);

  const downloadEvents: DownloadEvent[] = dlRows.map(r => {
    const p = (r.props ?? {}) as Record<string, string | null>;
    return {
      id:        r.id,
      company:   r.company,
      jobTitle:  r.jobTitle ?? null,
      source:    (p.source ?? null) as "role_card" | "report_page" | null,
      email:     p.email ?? null,
      createdAt: new Date(r.createdAt).toLocaleString("en-GB", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
        timeZone: "Asia/Kolkata",
      }),
    };
  });

  const totalSessions  = rows.reduce((sum, r) => sum + r.sessions,  0);
  const totalDownloads = rows.reduce((sum, r) => sum + r.downloads, 0);
  const engaged        = rows.filter(r => r.sessions > 0).length;
  const forwarded      = rows.filter(r => r.devices > 1).length;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#220133", margin: "0 0 4px", letterSpacing: "-0.5px" }}>
          Report Analytics
        </h1>
        <p style={{ fontSize: 13, color: "#9988AA", margin: 0 }}>
          Self-hosted mirror of PostHog report events — opens, sessions, and downloads per company. Scroll depth and section views only appear for legacy analysis (DashboardView) sessions, not wizard.
        </p>
      </div>

      {/* Topline */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Companies engaged", value: `${engaged} / ${rows.length}`, sub: "distinct sessions > 0 out of all token-enabled companies" },
          { label: "Forwarded",         value: forwarded, hint: forwarded > 0 ? "multi-device" : undefined, sub: "link accessed from 2+ distinct device/network signatures" },
          { label: "Total sessions",    value: totalSessions, sub: "distinct sessionIds · new session per tab/page-mount" },
          { label: "Total downloads",   value: totalDownloads, sub: "report_downloaded events · 0 for wizard-only companies" },
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
            {s.sub && (
              <p style={{ fontSize: 10, color: "#9988AA", margin: "2px 0 0" }}>
                {s.sub}
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

      {/* Download Events with All / Card / Page toggle */}
      <p style={{ fontSize: 12, color: "#9988AA", margin: "0 0 8px" }}>
        Download events (report_downloaded) are only fired from DashboardView PDF downloads — not the wizard report. This table will be empty for wizard-only companies.
      </p>
      <DownloadEventsTable events={downloadEvents} />
    </div>
  );
}
