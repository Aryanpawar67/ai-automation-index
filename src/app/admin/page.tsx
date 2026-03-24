export const dynamic = "force-dynamic";

import Link         from "next/link";
import ExcelUploader from "@/components/admin/ExcelUploader";
import { db }        from "@/lib/db/client";
import { batches }   from "@/lib/db/schema";
import { desc }      from "drizzle-orm";

const STATUS_BADGE: Record<string, string> = {
  complete:        "badge-low",
  partial_failure: "badge-high",
  scraping:        "badge-medium",
  analyzing:       "badge-medium",
  pending:         "badge-medium",
};

export default async function AdminHome() {
  const recent = await db.select().from(batches).orderBy(desc(batches.createdAt)).limit(5);

  return (
    <div className="max-w-3xl space-y-8">

      {/* Primary CTA — Dataset Manager */}
      <Link href="/admin/dataset"
        className="card card-hover p-6 block mb-6"
        style={{ borderColor: "#FD5A0F22", background: "linear-gradient(135deg, #FFF8F5 0%, #fff 100%)" }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="badge badge-medium">Recommended</span>
            </div>
            <h2 className="text-lg font-bold mb-1" style={{ color: "#220133" }}>Prospect Dataset Manager</h2>
            <p className="text-sm" style={{ color: "#9988AA" }}>
              Upload your Excel, filter by ATS / HQ / size, select companies and create named batches.
            </p>
          </div>
          <span className="text-2xl ml-6" style={{ color: "#FD5A0F" }}>→</span>
        </div>
      </Link>

      {/* Secondary — Quick upload */}
      <details className="mb-8">
        <summary className="text-sm font-medium cursor-pointer select-none" style={{ color: "#9988AA" }}>
          Quick upload (process immediately, no filtering)
        </summary>
        <div className="mt-4">
          <p className="text-xs mb-4" style={{ color: "#9988AA" }}>
            Upload a POC Excel — all companies are queued for scraping immediately.
          </p>
          <ExcelUploader />
        </div>
      </details>

      {recent.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold" style={{ color: "#220133" }}>Recent uploads</h2>
            <Link href="/admin/batches" className="text-xs font-medium hover:underline underline-offset-2"
              style={{ color: "#FD5A0F" }}>
              View all →
            </Link>
          </div>
          <div className="space-y-2">
            {recent.map(b => (
              <Link key={b.id} href={`/admin/batches/${b.id}`}
                className="card card-hover p-4 flex items-center justify-between block">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "#220133" }}>{b.filename}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#9988AA" }}>
                    {new Date(b.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    &nbsp;·&nbsp; {b.totalPocs} POCs
                    {b.processedJds > 0 && <span className="text-emerald-600"> · {b.processedJds} JDs done</span>}
                  </p>
                </div>
                <span className={`badge ml-4 flex-shrink-0 ${STATUS_BADGE[b.status] ?? "badge-medium"}`}>
                  {b.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
