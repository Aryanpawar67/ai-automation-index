export const dynamic = "force-dynamic";

import { db }                                     from "@/lib/db/client";
import { reportDownloads, reportLeads, companies } from "@/lib/db/schema";
import { desc, eq, sql }                           from "drizzle-orm";
import DeleteDownloadButton                        from "@/components/admin/DeleteDownloadButton";

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day:    "numeric",
    month:  "short",
    year:   "numeric",
    hour:   "2-digit",
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
  // Role-card gated downloads (email submitted before PDF)
  const gatedDownloads = await db
    .select({
      id:          reportLeads.id,
      email:       reportLeads.email,
      companyName: companies.name,
      createdAt:   reportLeads.createdAt,
    })
    .from(reportLeads)
    .leftJoin(companies, eq(reportLeads.companyId, companies.id))
    .where(sql`${reportLeads.source} = 'download'`)
    .orderBy(desc(reportLeads.createdAt));

  // Internal-page PDF downloads (from DashboardView)
  const pageDownloads = await db
    .select()
    .from(reportDownloads)
    .orderBy(desc(reportDownloads.downloadedAt));

  // Hero / CTA leads only
  const ctaLeads = await db
    .select({
      id:          reportLeads.id,
      email:       reportLeads.email,
      companyName: companies.name,
      createdAt:   reportLeads.createdAt,
    })
    .from(reportLeads)
    .leftJoin(companies, eq(reportLeads.companyId, companies.id))
    .where(sql`${reportLeads.source} = 'cta'`)
    .orderBy(desc(reportLeads.createdAt));

  const totalDownloads = gatedDownloads.length + pageDownloads.length;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#220133", margin: "0 0 4px", letterSpacing: "-0.5px" }}>
          Downloads &amp; Leads
        </h1>
        <p style={{ fontSize: 13, color: "#9988AA", margin: 0 }}>
          {totalDownloads} download{totalDownloads !== 1 ? "s" : ""} · {ctaLeads.length} CTA lead{ctaLeads.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* ── SECTION 1: Downloads ───────────────────────────────────── */}
      <Section
        title="Report Downloads"
        icon={
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="#4F46E5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        }
        iconBg="#EEF2FF"
        iconColor="#4F46E5"
        description="Users who entered their email to download a PDF report — from role cards or the report page."
        count={totalDownloads}
        countColor="#4F46E5"
      >
        {totalDownloads === 0 ? (
          <EmptyState label="No PDF downloads yet" />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #EAE4EF", background: "#FAF8FC" }}>
                {["Type", "Email", "Company", "Report", "Referrer", "Date"].map(h => (
                  <Th key={h}>{h}</Th>
                ))}
                <th style={{ padding: "14px 24px", width: 48 }} />
              </tr>
            </thead>
            <tbody>
              {/* Role-card gated downloads */}
              {gatedDownloads.map((row, i) => (
                <tr key={row.id} className="dl-row" style={{ borderBottom: "1px solid #EAE4EF", animation: `fadeInUp 0.3s ease ${i * 0.03}s both` }}>
                  <td style={{ padding: "16px 24px" }}>
                    <Badge bg="#EEF2FF" color="#4F46E5">Card</Badge>
                  </td>
                  <td style={{ padding: "16px 24px" }}>
                    <EmailLink email={row.email} />
                  </td>
                  <td style={{ padding: "16px 24px", fontSize: 14, color: "#220133", fontWeight: 600 }}>
                    {row.companyName ?? "—"}
                  </td>
                  <td style={{ padding: "16px 24px", fontSize: 13, color: "#9988AA" }}>—</td>
                  <td style={{ padding: "16px 24px", fontSize: 13, color: "#9988AA" }}>—</td>
                  <td style={{ padding: "16px 24px", fontSize: 13, color: "#9988AA", whiteSpace: "nowrap" }}>
                    {formatDate(new Date(row.createdAt))}
                  </td>
                  <td style={{ padding: "16px 16px 16px 0" }} />
                </tr>
              ))}
              {/* Internal-page downloads */}
              {pageDownloads.map((row, i) => (
                <tr key={row.id} className="dl-row" style={{ borderBottom: i < pageDownloads.length - 1 ? "1px solid #EAE4EF" : "none", animation: `fadeInUp 0.3s ease ${(gatedDownloads.length + i) * 0.03}s both` }}>
                  <td style={{ padding: "16px 24px" }}>
                    <Badge bg="#F0FDF4" color="#059669">Page</Badge>
                  </td>
                  <td style={{ padding: "16px 24px" }}>
                    <EmailLink email={row.email} />
                  </td>
                  <td style={{ padding: "16px 24px", fontSize: 14, color: "#220133", fontWeight: 600 }}>
                    {row.companyName ?? "—"}
                  </td>
                  <td style={{ padding: "16px 24px", fontSize: 13, color: "#5C4D6E", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                    {row.reportSlug ?? "—"}
                  </td>
                  <td style={{ padding: "16px 24px", fontSize: 13, color: "#9988AA", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.referrer ?? ""}>
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
        )}
      </Section>

      {/* ── SECTION 2: CTA Leads ──────────────────────────────────── */}
      <Section
        title="CTA Leads"
        icon={
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path d="M20 12V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2h6" stroke="#FD5A0F" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M16 19h6m-3-3v6" stroke="#FD5A0F" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        }
        iconBg="#FFF0EA"
        iconColor="#FD5A0F"
        description='Users who submitted their email via the "Reach me out" hero CTA on a report page.'
        count={ctaLeads.length}
        countColor="#FD5A0F"
      >
        {ctaLeads.length === 0 ? (
          <EmptyState label="No CTA leads yet" />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #EAE4EF", background: "#FAF8FC" }}>
                {["Email", "Company", "Date"].map(h => (
                  <Th key={h}>{h}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ctaLeads.map((row, i) => (
                <tr key={row.id} className="dl-row" style={{ borderBottom: i < ctaLeads.length - 1 ? "1px solid #EAE4EF" : "none", animation: `fadeInUp 0.3s ease ${i * 0.03}s both` }}>
                  <td style={{ padding: "16px 24px" }}>
                    <EmailLink email={row.email} />
                  </td>
                  <td style={{ padding: "16px 24px", fontSize: 14, color: "#220133", fontWeight: 600 }}>
                    {row.companyName ?? "—"}
                  </td>
                  <td style={{ padding: "16px 24px", fontSize: 13, color: "#9988AA", whiteSpace: "nowrap" }}>
                    {formatDate(new Date(row.createdAt))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .dl-row:hover { background: #FAF8FC; }
        .dl-email:hover { text-decoration: underline !important; }
      `}</style>
    </div>
  );
}

/* ── Small shared components ─────────────────────────────────────── */

function Section({ title, icon, iconBg, iconColor, description, count, countColor, children }: {
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  description: string;
  count: number;
  countColor: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 32 }}>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {icon}
        </div>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#220133", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            {title}
            <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: iconBg, color: countColor }}>
              {count}
            </span>
          </h2>
          <p style={{ fontSize: 12, color: "#9988AA", margin: 0 }}>{description}</p>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #EAE4EF", borderRadius: 16, boxShadow: "0 2px 12px rgba(34,1,51,0.05)", overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ padding: "12px 24px", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: "#9988AA" }}>
      {children}
    </th>
  );
}

function Badge({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) {
  return (
    <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", background: bg, color }}>
      {children}
    </span>
  );
}

function EmailLink({ email }: { email: string }) {
  return (
    <a href={`mailto:${email}`} className="dl-email" style={{ fontSize: 14, color: "#FD5A0F", fontWeight: 500, textDecoration: "none" }}>
      {email}
    </a>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div style={{ padding: "40px 24px", textAlign: "center", fontSize: 13, color: "#9988AA" }}>
      {label}
    </div>
  );
}
