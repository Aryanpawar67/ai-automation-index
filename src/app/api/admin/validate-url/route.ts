import { NextRequest, NextResponse } from "next/server";
import { validateCareerUrl }         from "@/lib/urlValidator";

export async function POST(req: NextRequest) {
  let body: { url: string; atsType?: string | null };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }

  const { url, atsType } = body;
  if (!url || typeof url !== "string")
    return NextResponse.json({ error: "url is required." }, { status: 400 });

  const result = await validateCareerUrl(url.trim(), atsType);
  return NextResponse.json(result);
}
