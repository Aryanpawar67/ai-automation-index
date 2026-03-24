export const dynamic = "force-dynamic";

import Link       from "next/link";
import { db }     from "@/lib/db/client";
import { batches } from "@/lib/db/schema";
import { desc }   from "drizzle-orm";

const STATUS_BADGE: Record<string, string> = {
  complete:        "badge-low",
  partial_failure: "badge-high",
  scraping:        "badge-medium",
  analyzing:       "badge-medium",
  pending:         "badge-medium",
};

export default async function BatchesPage() {
  const rows = await db.select().from(batches).orderBy(desc(batches.createdAt));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#220133" }}>All Batches</h1>
          <p className="text-sm mt-0.5" style={{ color: "#9988AA" }}>{rows.length} total uploads</p>
        </div>
        <Link href="/admin"
          className="text-xs px-4 py-2 rounded-xl font-semibold gradient-btn">
          + New Upload
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-sm" style={{ color: "#9988AA" }}>No batches yet. Upload an Excel file to get started.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead style={{ background: "#FAFAFA", borderBottom: "1px solid #EAE4EF" }}>
              <tr>
                {["File", "Uploaded", "POCs", "JDs done", "Failed", "Status"].map(h => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-widest"
                    style={{ color: "#9988AA" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((b, i) => (
                <tr key={b.id}
                  className="transition-colors hover:bg-[#FAFAFA]"
                  style={{ borderBottom: i < rows.length - 1 ? "1px solid #F4EFF6" : "none" }}>
                  <td className="px-5 py-3.5">
                    <Link href={`/admin/batches/${b.id}`}
                      className="font-medium hover:underline underline-offset-2 truncate max-w-[200px] block"
                      style={{ color: "#FD5A0F" }}>
                      {b.filename}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-xs whitespace-nowrap" style={{ color: "#9988AA" }}>
                    {new Date(b.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-5 py-3.5" style={{ color: "#553366" }}>{b.totalPocs}</td>
                  <td className="px-5 py-3.5 font-medium text-emerald-600">{b.processedJds}</td>
                  <td className="px-5 py-3.5 font-medium text-red-400">{b.failedJds || "—"}</td>
                  <td className="px-5 py-3.5">
                    <span className={`badge ${STATUS_BADGE[b.status] ?? "badge-medium"}`}>{b.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
