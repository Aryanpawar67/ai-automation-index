import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain");
  if (!domain) {
    return new NextResponse("Missing domain", { status: 400 });
  }

  const apiKey = process.env.CLEARBIT_API_KEY;
  const headers: HeadersInit = apiKey
    ? { Authorization: `Bearer ${apiKey}` }
    : {};

  try {
    const res = await fetch(`https://logo.clearbit.com/${encodeURIComponent(domain)}`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return new NextResponse(null, { status: 404 });
    }

    const contentType = res.headers.get("content-type") ?? "image/png";
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400", // cache logos for 24h
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
