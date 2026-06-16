export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import { companies, reportEvents } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { formatLocation, LOCATION_TOOLTIP } from "@/lib/formatLocation";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatTime(d: Date): string {
  return d.toLocaleString("en-GB", {
    day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function fmtSecs(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0s";
  if (n < 60) return `${Math.round(n)}s`;
  const m = Math.floor(n / 60);
  const s = Math.round(n % 60);
  return `${m}m ${s}s`;
}

function shortUA(ua: string | null): string {
  if (!ua) return "—";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Mac OS X/i.test(ua)) return /Chrome/i.test(ua) ? "Mac · Chrome" : /Firefox/i.test(ua) ? "Mac · Firefox" : "Mac · Safari";
  if (/Windows/i.test(ua)) return /Chrome/i.test(ua) ? "Win · Chrome" : /Edge/i.test(ua) ? "Win · Edge" : "Windows";
  return ua.slice(0, 40);
}

export default async function CompanyAnalyticsPage({ params }: { params: Promise<{ identifier: string }> }) {
  const { identifier } = await params;

  const [company] = await db
    .select({ id: companies.id, name: companies.name, slug: companies.slug, reportToken: companies.reportToken })
    .from(companies)
    .where(UUID_RE.test(identifier) ? eq(companies.id, identifier) : eq(companies.slug, identifier));
  if (!company) return notFound();

  // Pull all events for the company. At ~20 events/visit x small lead lists,
  // even an enterprise prospect generates only hundreds of rows — fine to read in one go.
  const events = await db
    .select()
    .from(reportEvents)
    .where(eq(reportEvents.companyId, company.id))
    .orderBy(desc(reportEvents.createdAt));

  // Per-session rollup
  type SessionRow = {
    sessionId:   string;
    startedAt:   Date;
    endedAt:     Date;
    durationSec: number;
    userAgent:   string | null;
    ipHash:      string | null;
    jobTitle:    string | null;
    reportType:  string;
    location:    string | null;
  };
  const sessionMap = new Map<string, SessionRow>();
  for (const e of events) {
    const locStr = formatLocation(e.city, e.region, e.country, e.accuracyKm);
    const loc = locStr === "—" ? null : locStr;
    const s = sessionMap.get(e.sessionId) ?? {
      sessionId:   e.sessionId,
      startedAt:   e.createdAt,
      endedAt:     e.createdAt,
      durationSec: 0,
      userAgent:   e.userAgent,
      ipHash:      e.ipHash,
      jobTitle:    e.jobTitle,
      reportType:  e.reportType,
      location:    loc,
    };
    if (!s.location && loc) s.location = loc;
    if (e.createdAt < s.startedAt) s.startedAt = e.createdAt;
    if (e.createdAt > s.endedAt)   s.endedAt   = e.createdAt;
    if (e.event === "report_session_end") {
      const t = Number((e.props as Record<string, unknown>)?.time_spent_seconds);
      if (Number.isFinite(t)) s.durationSec = Math.max(s.durationSec, t);
    }
    sessionMap.set(e.sessionId, s);
  }
  const sessions = Array.from(sessionMap.values())
    .map(s => ({ ...s, durationSec: s.durationSec || Math.round((+s.endedAt - +s.startedAt) / 1000) }))
    .sort((a, b) => +b.startedAt - +a.startedAt);

  // Topline
  const opens = events.filter(e => e.event === "report_opened").length;
  const uniqueDevices = new Set(sessions.map(s => `${s.ipHash ?? ""}|${s.userAgent ?? ""}`).filter(k => k !== "|")).size;
  const avgTime = sessions.length > 0 ? sessions.reduce((a, b) => a + b.durationSec, 0) / sessions.length : 0;

  // Wizard step funnel — count distinct sessions that reached each step.
  // Uses the furthest `wizard_step_viewed` step seen per session.
  const STEP_LABELS = ["At a glance", "Benefit", "Peers", "Roles"];
  const maxStepBySession = new Map<string, number>();
  for (const e of events) {
    if (e.event !== "wizard_step_viewed") continue;
    const st = Number((e.props as Record<string, unknown>)?.step);
    if (!Number.isFinite(st)) continue;
    maxStepBySession.set(e.sessionId, Math.max(maxStepBySession.get(e.sessionId) ?? 0, st));
  }
  const stepReached = [0, 0, 0, 0];
  for (const max of maxStepBySession.values()) {
    for (let st = 1; st <= 4; st++) if (max >= st) stepReached[st - 1]++;
  }
  const maxStepCount = Math.max(1, ...stepReached);
  const hasStepData  = stepReached.some(n => n > 0);

  // Role interest — wizard_role_viewed counts by role title
  const roleAgg = new Map<string, number>();
  for (const e of events) {
    if (e.event !== "wizard_role_viewed") continue;
    const r = String((e.props as Record<string, unknown>)?.role ?? "").trim();
    if (!r) continue;
    roleAgg.set(r, (roleAgg.get(r) ?? 0) + 1);
  }
  const roleRows = Array.from(roleAgg.entries())
    .map(([role, n]) => ({ role, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 12);
  const maxRole = Math.max(1, ...roleRows.map(r => r.n));

  // CTA funnel — clicked → submitted, plus dismissed
  const ctaClicked   = events.filter(e => e.event === "wizard_cta_clicked").length;
  const ctaSubmitted = events.filter(e => e.event === "wizard_cta_submitted").length;
  const ctaDismissed = events.filter(e => e.event === "wizard_cta_dismissed").length;
  const ctaConvPct   = ctaClicked > 0 ? Math.round((ctaSubmitted / ctaClicked) * 100) : 0;

  // Region breakdown — group by raw (city, region, country) but render with
  // accuracy-aware labels. We collapse the result by display label afterwards
  // so e.g. low-confidence "Bengaluru" and high-confidence "Bengaluru" rows
  // that both render as "Bengaluru, India" don't appear twice.
  const geoAgg = await db.execute(sql`
    SELECT
      city,
      region,
      country,
      MIN(accuracy_km)            AS "accuracyKm",
      COUNT(DISTINCT session_id)  AS n
    FROM report_events
    WHERE company_id = ${company.id} AND country IS NOT NULL
    GROUP BY city, region, country
    ORDER BY n DESC
    LIMIT 24
  `);
  const rawGeo = (geoAgg.rows as unknown as Array<{ city: string | null; region: string | null; country: string | null; accuracyKm: number | null; n: number }>);
  const geoByLabel = new Map<string, number>();
  for (const r of rawGeo) {
    const label = formatLocation(r.city, r.region, r.country, r.accuracyKm);
    if (label === "—") continue;
    geoByLabel.set(label, (geoByLabel.get(label) ?? 0) + Number(r.n));
  }
  const geoRows = Array.from(geoByLabel.entries())
    .map(([label, n]) => ({ label, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 8);
  const maxGeo = Math.max(1, ...geoRows.map(g => g.n));

  const TOKEN_PREVIEW = company.reportToken ? `${company.reportToken.slice(0, 10)}…` : "—";
  const forwardedFlag = uniqueDevices > 1;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link href="/admin/analytics" style={{ fontSize: 12, color: "#9988AA", textDecoration: "none" }}>
          ← All companies
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#220133", margin: 0, letterSpacing: "-0.5px" }}>
            {company.name}
          </h1>
          {company.slug && (
            <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, background: "#F4EFF6", color: "#553366", border: "1px solid #EAE4EF", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
              {company.slug}
            </span>
          )}
          {forwardedFlag && (
            <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "#FFF0EA", color: "#FD5A0F", border: "1px solid #FDBB96", fontWeight: 700 }}>
              FORWARDED
            </span>
          )}
        </div>
        <p style={{ fontSize: 12, color: "#9988AA", margin: "6px 0 0", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
          token: {TOKEN_PREVIEW}
        </p>
      </div>

      {/* Topline cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Opens",          value: opens,           sub: "report_opened events · one per page-mount" },
          { label: "Sessions",       value: sessions.length, sub: "distinct sessionIds · new session per browser tab" },
          { label: "Unique devices", value: uniqueDevices,   hint: forwardedFlag ? "forwarded" : undefined, sub: "distinct ip_hash + user_agent combos · >1 = likely forwarded" },
          { label: "Avg time/visit", value: fmtSecs(avgTime), small: true, sub: "from report_session_end · 0s if tab closed without sending" },
        ].map((c) => (
          <div key={c.label} style={{
            background: "#fff", border: "1px solid #EAE4EF", borderRadius: 14,
            padding: "16px 18px", boxShadow: "0 2px 12px rgba(34,1,51,0.06)",
          }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9988AA", margin: "0 0 6px" }}>
              {c.label}
            </p>
            <p style={{ fontSize: c.small ? 20 : 24, fontWeight: 800, color: "#220133", margin: 0, letterSpacing: "-0.4px" }}>
              {c.value}
            </p>
            {c.hint && (
              <p style={{ fontSize: 10, color: "#FD5A0F", margin: "2px 0 0", fontWeight: 600 }}>
                {c.hint}
              </p>
            )}
            {c.sub && (
              <p style={{ fontSize: 10, color: "#9988AA", margin: "2px 0 0" }}>
                {c.sub}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Wizard step funnel + CTA funnel */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12, marginBottom: 24 }}>
        {/* Step funnel */}
        <div style={{ background: "#fff", border: "1px solid #EAE4EF", borderRadius: 16, padding: "20px 22px", boxShadow: "0 2px 12px rgba(34,1,51,0.06)" }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#220133", margin: "0 0 4px" }}>Wizard step funnel</h3>
          <p style={{ fontSize: 11, color: "#9988AA", margin: "0 0 16px" }}>Distinct sessions that reached each step — wizard_step_viewed. Replaces the legacy scroll-depth funnel for hub (wizard) sessions.</p>
          {!hasStepData ? (
            <p style={{ fontSize: 12, color: "#9988AA", margin: 0 }}>No wizard step events yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {stepReached.map((n, i) => (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: "#553366", fontWeight: 600 }}>Step {i + 1} · {STEP_LABELS[i]}</span>
                    <span style={{ color: "#9988AA" }}>{n}</span>
                  </div>
                  <div style={{ height: 6, background: "#F4EFF6", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(n / maxStepCount) * 100}%`, background: "linear-gradient(90deg, #220133, #553366)" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CTA funnel */}
        <div style={{ background: "#fff", border: "1px solid #EAE4EF", borderRadius: 16, padding: "20px 22px", boxShadow: "0 2px 12px rgba(34,1,51,0.06)" }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#220133", margin: "0 0 4px" }}>CTA funnel</h3>
          <p style={{ fontSize: 11, color: "#9988AA", margin: "0 0 16px" }}>&apos;Get your full analysis&apos; modal — clicked → submitted. Dismissed = closed without submitting.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "Clicked",   value: ctaClicked,   note: "wizard_cta_clicked" },
              { label: "Submitted", value: ctaSubmitted, note: `${ctaConvPct}% of clicks · also a CTA lead`, accent: true },
              { label: "Dismissed", value: ctaDismissed, note: "wizard_cta_dismissed" },
            ].map(c => (
              <div key={c.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: c.accent ? "#059669" : "#553366" }}>{c.label}</span>
                  <span style={{ fontSize: 10, color: "#9988AA", marginLeft: 8 }}>{c.note}</span>
                </div>
                <span style={{ fontSize: 20, fontWeight: 800, color: c.accent ? "#059669" : "#220133" }}>{c.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Role interest */}
      <div style={{ background: "#fff", border: "1px solid #EAE4EF", borderRadius: 16, padding: "20px 22px", boxShadow: "0 2px 12px rgba(34,1,51,0.06)", marginBottom: 24 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "#220133", margin: "0 0 4px" }}>Role interest</h3>
        <p style={{ fontSize: 11, color: "#9988AA", margin: "0 0 16px" }}>Step-4 role cards opened — wizard_role_viewed. Which roles prospects drill into. Replaces the legacy &apos;sections viewed&apos; chart.</p>
        {roleRows.length === 0 ? (
          <p style={{ fontSize: 12, color: "#9988AA", margin: 0 }}>No role cards opened yet.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
            {roleRows.map((r, i) => (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "#553366", fontWeight: 600 }}>{r.role}</span>
                  <span style={{ color: "#9988AA" }}>{r.n}</span>
                </div>
                <div style={{ height: 6, background: "#F4EFF6", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(r.n / maxRole) * 100}%`, background: "linear-gradient(90deg, #FD5A0F, #FDBB96)" }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Regions */}
      <div style={{ background: "#fff", border: "1px solid #EAE4EF", borderRadius: 16, padding: "20px 22px", boxShadow: "0 2px 12px rgba(34,1,51,0.06)", marginBottom: 24 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "#220133", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 6 }}>
          Top regions
          <span title={LOCATION_TOOLTIP} style={{ fontSize: 11, color: "#C4B5D0", cursor: "help" }}>ⓘ</span>
        </h3>
        <p style={{ fontSize: 11, color: "#9988AA", margin: "0 0 16px" }}>Distinct sessions by geolocation. City shown only when MaxMind reports &lt;50km accuracy; otherwise we fall back to region or country.</p>
        {geoRows.length === 0 ? (
          <p style={{ fontSize: 12, color: "#9988AA", margin: 0 }}>No geolocated sessions yet. Drop the GeoLite2-City.mmdb file into <code style={{ background: "#F4EFF6", padding: "1px 5px", borderRadius: 4 }}>data/</code> to enable geo enrichment.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
            {geoRows.map((g, i) => {
              return (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: "#553366", fontWeight: 600 }}>{g.label}</span>
                    <span style={{ color: "#9988AA" }}>{g.n}</span>
                  </div>
                  <div style={{ height: 6, background: "#F4EFF6", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${(g.n / maxGeo) * 100}%`,
                      background: "linear-gradient(90deg, #220133, #553366)",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sessions */}
      <div style={{ background: "#fff", border: "1px solid #EAE4EF", borderRadius: 16, boxShadow: "0 2px 12px rgba(34,1,51,0.06)", overflow: "hidden", marginBottom: 24 }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid #EAE4EF" }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#220133", margin: 0 }}>Sessions</h3>
          <p style={{ fontSize: 11, color: "#9988AA", margin: "2px 0 0" }}>hub = wizard v2 · analysis = legacy DashboardView · multiple devices = link was forwarded</p>
        </div>
        {sessions.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9988AA", fontSize: 13 }}>No sessions yet.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#FAF8FC" }}>
                {[
                  { label: "Started" },
                  { label: "Type" },
                  { label: "Role" },
                  { label: "Location", hint: LOCATION_TOOLTIP },
                  { label: "Device" },
                  { label: "Duration" },
                ].map(h => (
                  <th key={h.label} title={h.hint} style={{
                    padding: "12px 18px", textAlign: "left", fontSize: 10, fontWeight: 700,
                    letterSpacing: "0.07em", textTransform: "uppercase", color: "#9988AA",
                    cursor: h.hint ? "help" : "default",
                  }}>
                    {h.label}
                    {h.hint && <span style={{ marginLeft: 3, fontSize: 9, color: "#C4B5D0" }}>ⓘ</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, i) => (
                <tr key={s.sessionId} style={{ borderTop: i === 0 ? "none" : "1px solid #EAE4EF" }}>
                  <td style={{ padding: "12px 18px", fontSize: 12, color: "#220133", whiteSpace: "nowrap" }}>
                    {formatTime(s.startedAt)}
                  </td>
                  <td style={{ padding: "12px 18px", fontSize: 11 }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 12,
                      background: s.reportType === "hub" ? "#F4EFF6" : "#FFF0EA",
                      color:      s.reportType === "hub" ? "#553366" : "#FD5A0F",
                      border:     `1px solid ${s.reportType === "hub" ? "#EAE4EF" : "#FDBB96"}`,
                      fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 9,
                    }}>
                      {s.reportType}
                    </span>
                  </td>
                  <td style={{ padding: "12px 18px", fontSize: 12, color: "#553366" }}>
                    {s.jobTitle ?? "—"}
                  </td>
                  <td style={{ padding: "12px 18px", fontSize: 12, color: "#553366", whiteSpace: "nowrap" }}>
                    {s.location ?? "—"}
                  </td>
                  <td style={{ padding: "12px 18px", fontSize: 12, color: "#9988AA" }} title={s.userAgent ?? ""}>
                    {shortUA(s.userAgent)}
                  </td>
                  <td style={{ padding: "12px 18px", fontSize: 12, color: "#220133", fontWeight: 600 }}>
                    {fmtSecs(s.durationSec)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Event timeline (recent 200) */}
      <div style={{ background: "#fff", border: "1px solid #EAE4EF", borderRadius: 16, boxShadow: "0 2px 12px rgba(34,1,51,0.06)", overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid #EAE4EF" }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#220133", margin: 0 }}>Event timeline</h3>
          <p style={{ fontSize: 11, color: "#9988AA", margin: "2px 0 0" }}>Latest 200 events, most recent first — report_opened · report_tab_hidden/visible · report_session_end · wizard_step_viewed · wizard_role_viewed · wizard_info_viewed · wizard_cta_clicked · wizard_cta_submitted · wizard_cta_dismissed</p>
        </div>
        {events.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9988AA", fontSize: 13 }}>No events yet.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {events.slice(0, 200).map((e, i) => {
                const props = (e.props ?? {}) as Record<string, unknown>;
                let detail = "";
                if (e.event === "report_session_end")      detail = `${props.time_spent_seconds ?? "?"}s`;
                else if (e.event === "wizard_step_viewed") detail = `step ${props.step ?? "?"}`;
                else if (e.event === "wizard_cta_clicked") detail = String(props.source ?? "");
                else if (e.event === "wizard_cta_submitted") detail = String(props.email ?? "");
                else if (e.event === "wizard_role_viewed") detail = String(props.role ?? "");
                else if (e.event === "wizard_info_viewed") detail = String(props.page ?? "");
                return (
                  <tr key={e.id} style={{ borderTop: i === 0 ? "none" : "1px solid #F4EFF6" }}>
                    <td style={{ padding: "8px 22px", fontSize: 11, color: "#9988AA", whiteSpace: "nowrap", width: 140 }}>
                      {formatTime(e.createdAt)}
                    </td>
                    <td style={{ padding: "8px 16px", fontSize: 12, color: "#220133", fontWeight: 600, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                      {e.event}
                    </td>
                    <td style={{ padding: "8px 16px", fontSize: 12, color: "#553366" }}>
                      {detail}
                    </td>
                    <td style={{ padding: "8px 22px 8px 16px", fontSize: 11, color: "#9988AA", textAlign: "right" }}>
                      {e.jobTitle ?? e.reportType}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
