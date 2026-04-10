import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { reportDownloads } from "@/lib/db/schema";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    email?: string;
    reportSlug?: string;
    companyName?: string;
  };

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  await db.insert(reportDownloads).values({
    email,
    reportSlug:  body.reportSlug  ?? null,
    companyName: body.companyName ?? null,
    userAgent:   req.headers.get("user-agent") ?? null,
    referrer:    req.headers.get("referer")    ?? null,
  });

  return NextResponse.json({ ok: true });
}
