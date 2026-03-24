"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardView, { type Analysis } from "@/components/DashboardView";

export default function Dashboard() {
  const router   = useRouter();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [company,  setCompany]  = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem("analysisResult");
    const co  = sessionStorage.getItem("company");
    if (!raw) { router.push("/"); return; }
    try {
      setAnalysis(JSON.parse(raw));
      setCompany(co || "");
    } catch {
      router.push("/");
    }
  }, [router]);

  if (!analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F9F7FB" }}>
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin w-7 h-7" style={{ color: "#FD5A0F" }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <p className="text-sm" style={{ color: "#9988AA" }}>Loading analysis…</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardView
      analysis={analysis}
      company={company}
      backHref="/"
      showNewAnalysis
    />
  );
}
