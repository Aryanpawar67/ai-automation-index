export const dynamic = "force-dynamic";

import Link              from "next/link";
import { db }            from "@/lib/db/client";
import { batches, jobDescriptions, pocs, companies } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { datasetRows } from "@/lib/db/schema";
import BatchListView, { BatchItem } from "@/components/admin/BatchListView";

export default async function BatchesPage() {
  // Live JD counts from jobDescriptions
  const rows = await db
    .select({
      id:          batches.id,
      filename:    batches.filename,
      name:        batches.name,
      status:      batches.status,
      totalPocs:   batches.totalPocs,
      createdAt:   batches.createdAt,
      completedAt: batches.completedAt,
      totalJds:     sql<number>`COUNT(CASE WHEN ${jobDescriptions.status} NOT IN ('invalid','cancelled') THEN 1 END)`.mapWith(Number),
      processedJds: sql<number>`COUNT(CASE WHEN ${jobDescriptions.status} = 'complete' THEN 1 END)`.mapWith(Number),
      failedJds:    sql<number>`COUNT(CASE WHEN ${jobDescriptions.status} = 'failed' THEN 1 END)`.mapWith(Number),
    })
    .from(batches)
    .leftJoin(jobDescriptions, eq(jobDescriptions.batchId, batches.id))
    .groupBy(batches.id)
    .orderBy(desc(batches.createdAt));

  // ATS types + total available jobs per batch (via pocs → companies)
  const atsMeta = await db
    .select({
      batchId:        pocs.batchId,
      atsTypes:       sql<string[]>`array_agg(DISTINCT ${companies.atsType}) FILTER (WHERE ${companies.atsType} IS NOT NULL)`,
      totalAvailable: sql<number>`COALESCE(SUM(${companies.totalJobsAvailable}), 0)`.mapWith(Number),
    })
    .from(pocs)
    .leftJoin(companies, eq(companies.id, pocs.companyId))
    .groupBy(pocs.batchId);

  // Industries per batch (via pocs → companies ← dataset_rows on career_page_url)
  const industryMeta = await db
    .select({
      batchId:    pocs.batchId,
      industries: sql<string[]>`array_agg(DISTINCT ${datasetRows.industry}) FILTER (WHERE ${datasetRows.industry} IS NOT NULL)`,
    })
    .from(pocs)
    .leftJoin(companies, eq(companies.id, pocs.companyId))
    .leftJoin(datasetRows, eq(datasetRows.careerPageUrl, companies.careerPageUrl))
    .groupBy(pocs.batchId);

  // Report token + company name + POC per batch — first company alphabetically with a token
  const reportMeta = await db
    .select({
      batchId:      pocs.batchId,
      slug:         companies.slug,
      companyId:    companies.id,
      companyName:  companies.name,
      reportToken:  companies.reportToken,
      pocFirstName: pocs.firstName,
      pocLastName:  pocs.lastName,
    })
    .from(pocs)
    .innerJoin(companies, eq(companies.id, pocs.companyId))
    .orderBy(companies.name);

  // One entry per batch: first company with a token
  const reportMetaMap = new Map<string, {
    link:         string;
    companyName:  string;
    pocFirstName: string;
    pocLastName:  string;
  }>();
  for (const r of reportMeta) {
    if (!reportMetaMap.has(r.batchId) && r.reportToken) {
      const identifier = r.slug ?? r.companyId;
      reportMetaMap.set(r.batchId, {
        link:         `/report/${identifier}?token=${r.reportToken}`,
        companyName:  r.companyName,
        pocFirstName: r.pocFirstName,
        pocLastName:  r.pocLastName,
      });
    }
  }

  const industryMetaMap = new Map(industryMeta.map(r => [r.batchId, r.industries ?? []]));
  const atsMetaMap = new Map(atsMeta.map(r => [r.batchId, r]));

  // Derive effective status and merge ATS metadata
  const withEffectiveStatus: BatchItem[] = rows.map(r => {
    let effectiveStatus = r.status;
    if (r.totalJds > 0 && r.processedJds + r.failedJds >= r.totalJds) {
      effectiveStatus = r.failedJds > 0 ? "partial_failure" : "complete";
    }
    const meta = atsMetaMap.get(r.id);
    return {
      ...r,
      createdAt:    r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      completedAt:  r.completedAt instanceof Date ? r.completedAt.toISOString() : r.completedAt ? String(r.completedAt) : null,
      effectiveStatus,
      atsTypes:       meta?.atsTypes  ?? [],
      totalAvailable: meta?.totalAvailable ?? 0,
      industries:       industryMetaMap.get(r.id) ?? [],
      reportLink:       reportMetaMap.get(r.id)?.link         ?? null,
      emailCompanyName: reportMetaMap.get(r.id)?.companyName  ?? null,
      pocFirstName:     reportMetaMap.get(r.id)?.pocFirstName ?? null,
      pocLastName:      reportMetaMap.get(r.id)?.pocLastName  ?? null,
    };
  });

  const completeCount = withEffectiveStatus.filter(r => r.effectiveStatus === "complete").length;
  const activeCount   = withEffectiveStatus.filter(r => ["scraping", "analyzing", "pending"].includes(r.effectiveStatus)).length;
  const failedCount   = withEffectiveStatus.filter(r => ["stopped", "partial_failure"].includes(r.effectiveStatus)).length;

  return (
    <div>
      {/* ── Page header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#220133", margin: "0 0 4px", letterSpacing: "-0.5px" }}>
            All Batches
          </h1>
          <p style={{ fontSize: 13, color: "#9988AA", margin: 0 }}>{rows.length} total upload{rows.length !== 1 ? "s" : ""}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a
            href="/api/admin/dataset/export"
            download
            className="export-xlsx-btn"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 18px", borderRadius: 12, textDecoration: "none",
              fontSize: 13, fontWeight: 700, whiteSpace: "nowrap",
              background: "#EAF7ED", color: "#24A148",
              border: "1.5px solid #24A14830",
              transition: "background 0.15s, color 0.15s",
            }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Export XLSX
          </a>
          <Link href="/admin" className="new-batch-btn" style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "10px 22px", borderRadius: 12,
            background: "linear-gradient(135deg, #220133, #FD5A0F)",
            color: "#fff", fontWeight: 700, fontSize: 13,
            textDecoration: "none", boxShadow: "0 4px 16px rgba(253,90,15,0.35)",
            transition: "transform 0.15s, box-shadow 0.15s",
          }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
            New Batch
          </Link>
        </div>
      </div>

      {/* ── Empty state ── */}
      {rows.length === 0 ? (
        <div style={{
          background: "#fff", border: "1px solid #EAE4EF", borderRadius: 20,
          padding: "64px 32px", textAlign: "center",
          boxShadow: "0 2px 12px rgba(34,1,51,0.06)",
        }}>
          <div style={{ marginBottom: 20 }}>
            <svg width="56" height="56" fill="none" viewBox="0 0 24 24" style={{ opacity: 0.25, display: "inline-block" }}>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="#FD5A0F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M17 8l-5-5-5 5M12 3v12" stroke="#FD5A0F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#220133", marginBottom: 8 }}>No batches yet</h2>
          <p style={{ fontSize: 14, color: "#9988AA", marginBottom: 24 }}>Upload an Excel file to kick off your first analysis batch.</p>
          <Link href="/admin" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "12px 28px", borderRadius: 12,
            background: "linear-gradient(135deg, #220133, #FD5A0F)",
            color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none",
            boxShadow: "0 4px 16px rgba(253,90,15,0.35)",
          }}>
            Upload first batch →
          </Link>
        </div>
      ) : (
        <BatchListView
          batches={withEffectiveStatus}
          completeCount={completeCount}
          activeCount={activeCount}
          failedCount={failedCount}
        />
      )}

      <style>{`
        .new-batch-btn:hover { transform: scale(1.03); box-shadow: 0 6px 24px rgba(253,90,15,0.5) !important; }
        .export-xlsx-btn:hover { background: #24A148 !important; color: #fff !important; }
      `}</style>
    </div>
  );
}
