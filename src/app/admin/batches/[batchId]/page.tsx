import Link               from "next/link";
import BatchProgressTable from "@/components/admin/BatchProgressTable";
import { db }             from "@/lib/db/client";
import { batches }        from "@/lib/db/schema";
import { eq }             from "drizzle-orm";
import { notFound }       from "next/navigation";

const STATUS_BADGE: Record<string, string> = {
  complete:        "badge-low",
  partial_failure: "badge-high",
  scraping:        "badge-medium",
  analyzing:       "badge-medium",
  pending:         "badge-medium",
};

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const [batch]     = await db.select().from(batches).where(eq(batches.id, batchId));
  if (!batch) notFound();

  return (
    <div>
      <div className="flex items-center gap-2 mb-1 text-xs" style={{ color: "#9988AA" }}>
        <Link href="/admin/batches" className="hover:underline underline-offset-2">Batches</Link>
        <span>›</span>
        <span className="truncate max-w-[200px]">{batch.filename}</span>
      </div>

      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#220133" }}>{batch.filename}</h1>
          <p className="text-sm mt-0.5" style={{ color: "#9988AA" }}>
            Uploaded {new Date(batch.createdAt).toLocaleString("en-GB", {
              day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
            })}
            &nbsp;·&nbsp; {batch.totalPocs} POCs
          </p>
        </div>
        <span className={`badge flex-shrink-0 ${STATUS_BADGE[batch.status] ?? "badge-medium"}`}>
          {batch.status}
        </span>
      </div>

      <div className="card p-6">
        <p className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: "#9988AA" }}>
          Live Progress
        </p>
        <BatchProgressTable batchId={batchId} />
      </div>
    </div>
  );
}
