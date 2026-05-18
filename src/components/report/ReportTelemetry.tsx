"use client";

import { useEffect, useRef } from "react";
import posthog from "posthog-js";
import { track } from "@/lib/reportTrack";

const CAMPAIGN = "100-leads-90-days";

interface Props {
  token:        string;
  companySlug:  string;
  companyName:  string;
  reportType:   "hub" | "analysis";
  jobTitle?:    string;
}

export default function ReportTelemetry({ token, companySlug, companyName, reportType, jobTitle }: Props) {
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    if (!token || typeof window === "undefined") return;

    startedAtRef.current = Date.now();
    const ctx = { token, companySlug, reportType, jobTitle };

    // PostHog identity (own DB doesn't need this — it stores token directly).
    try {
      posthog.identify(token, { company: companySlug, company_name: companyName, campaign: CAMPAIGN });
      posthog.group("company", companySlug, { name: companyName });
    } catch { /* ignore */ }

    track("report_opened", ctx, { company_name: companyName });

    const onVis = () => {
      track(document.hidden ? "report_tab_hidden" : "report_tab_visible", ctx);
    };
    document.addEventListener("visibilitychange", onVis);

    const onEnd = () => {
      const time_spent_seconds = Math.round((Date.now() - startedAtRef.current) / 1000);
      track("report_session_end", ctx, { time_spent_seconds });
    };
    window.addEventListener("pagehide", onEnd);
    window.addEventListener("beforeunload", onEnd);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onEnd);
      window.removeEventListener("beforeunload", onEnd);
    };
  }, [token, companySlug, companyName, reportType, jobTitle]);

  return null;
}
