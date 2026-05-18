"use client";

import posthog from "posthog-js";

// Single sessionId per tab/page-mount, shared across all telemetry callers in
// the same browsing context so events can be bucketed into "visits".
let sessionId: string | null = null;

export function getSessionId(): string {
  if (typeof window === "undefined") return "00000000-0000-0000-0000-000000000000";
  if (!sessionId) sessionId = crypto.randomUUID();
  return sessionId;
}

export interface TrackContext {
  token?:       string;
  companySlug?: string;
  reportType:   "hub" | "analysis";
  jobTitle?:    string;
}

const CAMPAIGN = "100-leads-90-days";

// Dual-write helper: send to PostHog and to our own /api/track in one call.
// No-ops if token/companySlug are missing (e.g. internal /dashboard preview).
export function track(
  event: string,
  ctx: TrackContext,
  extra: Record<string, unknown> = {},
) {
  if (typeof window === "undefined") return;
  const { token, companySlug, reportType, jobTitle } = ctx;
  if (!token || !companySlug) return;

  const props: Record<string, unknown> = {
    company:     companySlug,
    token,
    campaign:    CAMPAIGN,
    report_url:  window.location.href,
    report_type: reportType,
    ...(jobTitle ? { job_title: jobTitle } : {}),
    ...extra,
  };

  try { posthog.capture(event, props); } catch { /* ignore */ }

  const sid = getSessionId();
  const body = JSON.stringify({ token, sessionId: sid, event, props });

  // sendBeacon is the only transport that reliably fires during page unload.
  if (event === "report_session_end" && typeof navigator !== "undefined" && navigator.sendBeacon) {
    try { navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" })); } catch { /* ignore */ }
    return;
  }
  fetch("/api/track", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => { /* ignore */ });
}
