import { NextRequest, NextResponse } from "next/server";
import { promises as dns } from "dns";

async function hasMxRecord(domain: string): Promise<boolean> {
  try {
    const records = await dns.resolveMx(domain);
    return records.length > 0;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { email?: string };
  const email = (body.email ?? "").trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required." }, { status: 400 });
  }

  const domain = email.split("@")[1];
  const mxOk = await hasMxRecord(domain);
  if (!mxOk) {
    return NextResponse.json(
      { error: "Email domain not valid. Please use a real work email." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
