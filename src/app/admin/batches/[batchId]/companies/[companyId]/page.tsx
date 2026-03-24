export const dynamic = "force-dynamic";

import Link        from "next/link";
import { db }      from "@/lib/db/client";
import { companies, jobDescriptions, batches } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";

const STATUS_BADGE: Record<string, string> = {
  complete: "badge-low",
  pending:  "badge-medium",
  analyzing:"badge-medium",
  failed:   "badge-high",
  invalid:  "badge-high",
};

const STATUS_LABEL: Record<string, string> = {
  complete:  "analysed",
  pending:   "queued",
  analyzing: "analysing",
  failed:    "failed",
  invalid:   "invalid — skipped",
};

export default async function CompanyJDsPage({
  params,
}: {
  params: Promise<{ batchId: string; companyId: string }>;
}) {
  const { batchId, companyId } = await params;

  const [[batch], [company], jds] = await Promise.all([
    db.select().from(batches).where(eq(batches.id, batchId)),
    db.select().from(companies).where(eq(companies.id, companyId)),
    db.select().from(jobDescriptions).where(
      and(
        eq(jobDescriptions.batchId, batchId),
        eq(jobDescriptions.companyId, companyId),
      )
    ).orderBy(jobDescriptions.createdAt),
  ]);

  if (!batch || !company) notFound();

  const validCount   = jds.filter(j => j.status !== "invalid").length;
  const invalidCount = jds.filter(j => j.status === "invalid").length;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-1 text-xs" style={{ color: "#9988AA" }}>
        <Link href="/admin/batches" className="hover:underline underline-offset-2">Batches</Link>
        <span>›</span>
        <Link href={`/admin/batches/${batchId}`} className="hover:underline underline-offset-2 truncate max-w-[160px]">
          {batch.filename}
        </Link>
        <span>›</span>
        <span className="truncate max-w-[160px]">{company.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#220133" }}>{company.name}</h1>
          <a
            href={company.careerPageUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs hover:underline underline-offset-2 mt-0.5 inline-block"
            style={{ color: "#9988AA" }}
          >
            {company.careerPageUrl} ↗
          </a>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-semibold" style={{ color: "#220133" }}>
            {jds.length} collected
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#9988AA" }}>
            {validCount} valid · {invalidCount} invalid
          </p>
        </div>
      </div>

      {/* JD list */}
      {jds.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm" style={{ color: "#9988AA" }}>No job descriptions were collected for this company.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {jds.map(jd => (
            <div
              key={jd.id}
              className="card p-5"
              style={{
                borderLeft: `3px solid ${jd.status === "invalid" ? "#f87171" : jd.status === "complete" ? "#10b981" : "#a78bfa"}`,
              }}
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate" style={{ color: "#220133" }}>
                    {jd.title}
                  </p>
                  {jd.department && (
                    <p className="text-xs mt-0.5" style={{ color: "#9988AA" }}>{jd.department}</p>
                  )}
                </div>
                <span className={`badge flex-shrink-0 ${STATUS_BADGE[jd.status] ?? "badge-medium"}`}>
                  {STATUS_LABEL[jd.status] ?? jd.status}
                </span>
              </div>

              {jd.sourceUrl && (
                <a
                  href={jd.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs hover:underline underline-offset-2 block mb-2 truncate"
                  style={{ color: "#9988AA" }}
                >
                  {jd.sourceUrl} ↗
                </a>
              )}

              {/* Raw text preview */}
              <p className="text-xs leading-relaxed rounded p-3 whitespace-pre-wrap line-clamp-5"
                style={{ background: "#F4EFF6", color: "#553366" }}>
                {jd.rawText.slice(0, 500)}{jd.rawText.length > 500 ? "…" : ""}
              </p>

              {jd.status === "invalid" && (
                <p className="text-xs mt-2 font-medium" style={{ color: "#f87171" }}>
                  Skipped — did not pass job description validation (missing required keywords or marketing title)
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
