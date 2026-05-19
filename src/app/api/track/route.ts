import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db/client";
import { companies, reportEvents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { lookupGeo } from "@/lib/geoip";

export const runtime = "nodejs";

const NO_CONTENT = new NextResponse(null, { status: 204 });

// One event row per client capture. Silently 204s on any invalid input so we
// don't leak token validity or schema details to public callers.
export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return NO_CONTENT; }
  if (!body || typeof body !== "object") return NO_CONTENT;

  const { token, sessionId, event, props } = body as Record<string, unknown>;
  if (typeof token !== "string" || typeof sessionId !== "string" || typeof event !== "string") {
    return NO_CONTENT;
  }
  if (token.length > 256 || sessionId.length > 64 || event.length > 64) return NO_CONTENT;

  const [company] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.reportToken, token));
  if (!company) return NO_CONTENT;

  const p = (props && typeof props === "object" ? props : {}) as Record<string, unknown>;
  const reportType = p.report_type === "hub" || p.report_type === "analysis" ? p.report_type : "analysis";
  const jobTitle   = typeof p.job_title === "string" ? p.job_title : null;

  const userAgent = req.headers.get("user-agent")?.slice(0, 512) ?? null;
  const referrer  = req.headers.get("referer")?.slice(0, 512) ?? null;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
          ?? req.headers.get("x-real-ip")
          ?? "";
  const salt = process.env.REPORT_EVENTS_IP_SALT ?? "";
  const ipHash = ip ? createHash("sha256").update(ip + salt).digest("hex") : null;
  const geo = ip ? lookupGeo(ip) : { country: null, region: null, city: null, accuracyKm: null };

  try {
    await db.insert(reportEvents).values({
      companyId: company.id,
      token,
      sessionId,
      event,
      reportType,
      jobTitle,
      props: p,
      userAgent,
      ipHash,
      referrer,
      country:    geo.country,
      region:     geo.region,
      city:       geo.city,
      accuracyKm: geo.accuracyKm,
    });
  } catch {
    // swallow — analytics must never break the report
  }

  return NO_CONTENT;
}
