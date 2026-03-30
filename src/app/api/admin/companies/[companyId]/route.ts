import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db/client";
import { companies }                 from "@/lib/db/schema";
import { eq }                        from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  let body: { careerPageUrl?: string; atsType?: string | null };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }

  // Fetch current company to check scrape state
  const [existing] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId));

  if (!existing)
    return NextResponse.json({ error: "Company not found." }, { status: 404 });

  const update: Partial<{
    careerPageUrl: string;
    atsType:       string | null;
    scrapeStatus:  string;
    scrapeError:   string | null;
    scrapedAt:     Date | null;
  }> = {};

  if (body.careerPageUrl !== undefined) {
    const trimmed = body.careerPageUrl.trim();
    if (!trimmed)
      return NextResponse.json({ error: "careerPageUrl cannot be empty." }, { status: 400 });
    update.careerPageUrl = trimmed;
  }

  if ("atsType" in body) {
    update.atsType = body.atsType ?? null;
  }

  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  // If URL changed, flag whether a re-scrape is needed (company was previously complete)
  const urlChanged      = body.careerPageUrl !== undefined && body.careerPageUrl.trim() !== existing.careerPageUrl;
  const requiresRescrape = urlChanged && existing.scrapeStatus === "complete";

  if (urlChanged) {
    // Reset scrape state so the new URL gets picked up on next batch
    update.scrapeStatus = "pending";
    update.scrapeError  = null;
    update.scrapedAt    = null;
  }

  const [updated] = await db
    .update(companies)
    .set(update)
    .where(eq(companies.id, companyId))
    .returning();

  return NextResponse.json({ ...updated, requiresRescrape });
}
