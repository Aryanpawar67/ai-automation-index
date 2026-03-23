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

      <div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: "#220133" }}>Upload POC Excel</h1>
        <p className="text-sm mb-6" style={{ color: "#9988AA" }}>
          Upload your weekly POC file. Companies are queued for scraping immediately —
          the daily cron processes up to 100 per day at 6 AM UTC.
        </p>
        <ExcelUploader />
      </div>

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
