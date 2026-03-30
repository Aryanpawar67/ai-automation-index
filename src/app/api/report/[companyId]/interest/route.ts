import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db/client";
import { reportLeads, companies }    from "@/lib/db/schema";
import { verifyReportToken }         from "@/lib/token";
import { eq }                        from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;
  const token         = req.nextUrl.searchParams.get("token") ?? "";

  if (!verifyReportToken(companyId, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as { email?: string };
  const email = (body.email ?? "").trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required." }, { status: 400 });
  }

  const [company] = await db.select({ id: companies.id })
    .from(companies)
    .where(eq(companies.id, companyId));

  if (!company) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await db.insert(reportLeads).values({ companyId, email });

  return NextResponse.json({ ok: true });
}
