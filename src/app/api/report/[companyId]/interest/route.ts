import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db/client";
import { reportLeads, companies }    from "@/lib/db/schema";
import { eq }                        from "drizzle-orm";
import { promises as dns }           from "dns";

async function hasMxRecord(domain: string): Promise<boolean> {
  try {
    const records = await dns.resolveMx(domain);
    return records.length > 0;
  } catch {
    return false;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;
  const token         = req.nextUrl.searchParams.get("token") ?? "";

  const [company] = await db.select({ id: companies.id, reportToken: companies.reportToken })
    .from(companies)
    .where(eq(companies.id, companyId));

  if (!company || !company.reportToken || token !== company.reportToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as { email?: string };
  const email = (body.email ?? "").trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required." }, { status: 400 });
  }

  const domain = email.split("@")[1];
  const mxOk   = await hasMxRecord(domain);
  if (!mxOk) {
    return NextResponse.json({ error: "Email domain does not appear to be valid. Please use a real work email." }, { status: 400 });
  }

  await db.insert(reportLeads).values({ companyId, email });

  return NextResponse.json({ ok: true });
}
