import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db/client";
import { companies, pocs }           from "@/lib/db/schema";
import { inngest }                   from "@/inngest/client";
import { eq }                        from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  const { batchId } = body as { batchId?: string };

  if (!batchId)
    return NextResponse.json({ error: "Missing batchId." }, { status: 400 });

  const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
  if (!company)
    return NextResponse.json({ error: "Company not found." }, { status: 404 });

  // Verify company belongs to this batch
  const [poc] = await db.select().from(pocs)
    .where(eq(pocs.companyId, companyId));
  if (!poc)
    return NextResponse.json({ error: "Company not in any batch." }, { status: 404 });

  // Reset scrape state
  await db.update(companies)
    .set({ scrapeStatus: "pending", scrapeError: null })
    .where(eq(companies.id, companyId));

  await inngest.send({
    name: "company/scrape",
    data: { companyId, batchId },
  });

  return NextResponse.json({ queued: true });
}
