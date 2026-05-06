import { NextRequest, NextResponse } from "next/server";
import { db }               from "@/lib/db/client";
import { reportDownloads }  from "@/lib/db/schema";
import { eq, desc }         from "drizzle-orm";

export async function GET() {
  const rows = await db
    .select()
    .from(reportDownloads)
    .orderBy(desc(reportDownloads.downloadedAt));

  return NextResponse.json(
    rows.map(r => ({
      id:           r.id,
      email:        r.email,
      reportSlug:   r.reportSlug,
      companyName:  r.companyName,
      userAgent:    r.userAgent,
      referrer:     r.referrer,
      downloadedAt: r.downloadedAt instanceof Date ? r.downloadedAt.toISOString() : String(r.downloadedAt),
    }))
  );
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json().catch(() => ({})) as { id?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.delete(reportDownloads).where(eq(reportDownloads.id, id));
  return NextResponse.json({ ok: true });
}
