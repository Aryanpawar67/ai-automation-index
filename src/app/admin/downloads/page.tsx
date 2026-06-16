export const dynamic = "force-dynamic";

import { db }                                      from "@/lib/db/client";
import { reportDownloads, reportLeads, companies } from "@/lib/db/schema";
import { desc, eq, sql }                           from "drizzle-orm";
import DownloadsTable, { type DownloadRow }        from "@/components/admin/DownloadsTable";

function fmt(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default async function DownloadsPage() {
  const [pageRows, ctaRows] = await Promise.all([
    // Internal-page PDF downloads
    db.select().from(reportDownloads).orderBy(desc(reportDownloads.downloadedAt)),

    // Wizard CTA leads
    db.select({ id: reportLeads.id, email: reportLeads.email, companyName: companies.name, createdAt: reportLeads.createdAt })
      .from(reportLeads)
      .leftJoin(companies, eq(reportLeads.companyId, companies.id))
      .where(sql`${reportLeads.source} = 'cta'`)
      .orderBy(desc(reportLeads.createdAt)),
  ]);

  // Merge into a single array, sort by raw timestamp, then format dates for display
  const merged = [
    ...pageRows.map(r => ({ id: r.id, type: "page" as const, email: r.email, companyName: r.companyName ?? null, reportSlug: r.reportSlug ?? null, referrer: r.referrer ?? null, deletableId: r.id,           ts: new Date(r.downloadedAt).getTime() })),
    ...ctaRows.map(r => ({  id: r.id, type: "cta"  as const, email: r.email, companyName: r.companyName ?? null, reportSlug: null as string | null, referrer: null as string | null, deletableId: null as string | null, ts: new Date(r.createdAt).getTime() })),
  ].sort((a, b) => b.ts - a.ts);

  const rows: DownloadRow[] = merged.map(({ ts: _ts, ...r }) => ({ ...r, date: fmt(new Date(_ts)) }));

  const total = rows.length;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#220133", margin: "0 0 4px", letterSpacing: "-0.5px" }}>
          Downloads &amp; Leads
        </h1>
        <p style={{ fontSize: 13, color: "#9988AA", margin: 0 }}>
          {pageRows.length} PDF download{pageRows.length !== 1 ? "s" : ""} · {ctaRows.length} CTA lead{ctaRows.length !== 1 ? "s" : ""} · {total} total
        </p>
        <p style={{ fontSize: 11, color: "#9988AA", margin: "2px 0 0" }}>
          Page = in-report PDF download (report_downloads · has referrer + delete) · CTA Lead = &apos;Get your full analysis&apos; wizard form (report_leads · source:cta). Referrer only on Page rows.
        </p>
      </div>

      <DownloadsTable rows={rows} />
    </div>
  );
}
