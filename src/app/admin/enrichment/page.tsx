"use client";

import { useEffect, useState, useCallback } from "react";

interface Stats {
  total:    number;
  hrStack:  { complete: number; notFound: number; failed: number; pending: number };
  linkedin: { eligible: number; complete: number; notFound: number; failed: number; pending: number };
}

function ProgressBar({ value, total, color }: { value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9988AA", marginBottom: 4 }}>
        <span>{value.toLocaleString()} / {total.toLocaleString()}</span>
        <span>{pct}%</span>
      </div>
      <div style={{ height: 8, background: "rgba(22,0,34,0.08)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

function StatCard({
  title, icon, stats, total, color, batchSize, onRunAll, onRunMissing, loading,
}: {
  title:        string;
  icon:         string;
  stats:        { complete: number; notFound: number; failed: number; pending: number };
  total:        number;
  color:        string;
  batchSize:    number;
  onRunAll:     () => void;
  onRunMissing: () => void;
  loading:      boolean;
}) {
  const badges = [
    { label: "Complete",  value: stats.complete,  clr: "#22c55e" },
    { label: "Not found", value: stats.notFound,  clr: "#9988AA" },
    { label: "Failed",    value: stats.failed,    clr: "#ef4444" },
    { label: "Pending",   value: stats.pending,   clr: "#f59e0b" },
  ];

  return (
    <div style={{
      background:   "#fff",
      borderRadius: 16,
      padding:      "24px 28px",
      boxShadow:    "0 2px 12px rgba(22,0,34,0.08)",
      flex:         1,
      minWidth:     280,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#220133" }}>{title}</h2>
      </div>

      <ProgressBar value={stats.complete} total={total} color={color} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 18 }}>
        {badges.map(b => (
          <div key={b.label} style={{ background: "#F4EFF6", borderRadius: 10, padding: "10px 14px" }}>
            <p style={{ margin: 0, fontSize: 11, color: "#9988AA", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{b.label}</p>
            <p style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 800, color: b.clr }}>{b.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button
          disabled={loading}
          onClick={onRunMissing}
          style={{
            flex:         1,
            padding:      "10px 0",
            borderRadius: 10,
            border:       `1.5px solid ${color}`,
            background:   "transparent",
            color,
            fontWeight:   700,
            fontSize:     13,
            cursor:       loading ? "not-allowed" : "pointer",
            opacity:      loading ? 0.5 : 1,
            transition:   "opacity 0.15s",
          }}
        >
          {loading ? "Running…" : "Run missing"}
        </button>
        <button
          disabled={loading}
          onClick={onRunAll}
          style={{
            flex:         1,
            padding:      "10px 0",
            borderRadius: 10,
            border:       "none",
            background:   color,
            color:        "#fff",
            fontWeight:   700,
            fontSize:     13,
            cursor:       loading ? "not-allowed" : "pointer",
            opacity:      loading ? 0.5 : 1,
            transition:   "opacity 0.15s",
          }}
        >
          {loading ? "Running…" : `Run next ${batchSize}`}
        </button>
      </div>
    </div>
  );
}

export default function EnrichmentPage() {
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [hrLoad,  setHrLoad]  = useState(false);
  const [liLoad,  setLiLoad]  = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const loadStats = useCallback(async () => {
    const res = await fetch("/api/admin/enrichment-stats");
    if (res.ok) setStats(await res.json() as Stats);
  }, []);

  useEffect(() => { void loadStats(); }, [loadStats]);

  async function runEnrichment(
    endpoint:    string,
    onlyMissing: boolean,
    setLoad:     (b: boolean) => void,
  ) {
    setLoad(true);
    setMessage(null);
    try {
      const res  = await fetch(endpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ onlyMissing }),
      });
      const data = await res.json() as Record<string, number>;
      setMessage({ text: `Done — ${JSON.stringify(data)}`, ok: res.ok });
      await loadStats();
    } catch (e) {
      setMessage({ text: `Error: ${String(e)}`, ok: false });
    } finally {
      setLoad(false);
    }
  }

  if (!stats) return (
    <div style={{ color: "#9988AA", padding: 40, fontSize: 14 }}>Loading stats…</div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#220133" }}>Enrichment</h1>
        <p style={{ margin: "6px 0 0", color: "#9988AA", fontSize: 14 }}>
          HR tech stack discovery + LinkedIn POC finder &middot; {stats.total.toLocaleString()} total companies
        </p>
      </div>

      {/* Status message */}
      {message && (
        <div style={{
          background:   message.ok ? "#f0fdf4" : "#fef2f2",
          border:       `1px solid ${message.ok ? "#bbf7d0" : "#fecaca"}`,
          borderRadius: 10,
          padding:      "12px 16px",
          marginBottom: 20,
          fontSize:     13,
          color:        message.ok ? "#166534" : "#991b1b",
          fontFamily:   "monospace",
        }}>
          {message.text}
        </div>
      )}

      {/* Free tier quota notice */}
      <div style={{
        background:   "#fffbeb",
        border:       "1px solid #fde68a",
        borderRadius: 10,
        padding:      "12px 16px",
        marginBottom: 24,
        fontSize:     13,
        color:        "#92400e",
        lineHeight:   1.5,
      }}>
        <strong>Free tier limit:</strong> Google Custom Search API allows <strong>100 queries/day</strong>.
        HR stack uses ~3 queries/company (≈33 companies/day safe limit).
        LinkedIn uses ~2 queries/company (≈50 companies/day safe limit).
        &nbsp;Run in small batches or use <strong>onlyMissing</strong> daily to stay within quota.
        <br />
        <span style={{ opacity: 0.7 }}>
          To remove quota: add <code>EXA_API_KEY</code> (Exa.ai) or <code>SERPAPI_KEY</code> (SerpAPI) and
          swap the search function in <code>src/lib/hrStackEnricher.ts</code>.
          For LinkedIn: add <code>APOLLO_API_KEY</code> and swap <code>src/lib/linkedinFinder.ts</code>.
        </span>
      </div>

      {/* Cards */}
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <StatCard
          title="HR Tech Stack"
          icon="🏢"
          stats={stats.hrStack}
          total={stats.total}
          color="#7c3aed"
          batchSize={30}
          loading={hrLoad}
          onRunMissing={() => void runEnrichment("/api/admin/dataset/enrich-hr-stack", true,  setHrLoad)}
          onRunAll     ={() => void runEnrichment("/api/admin/dataset/enrich-hr-stack", false, setHrLoad)}
        />
        <StatCard
          title="LinkedIn Profiles"
          icon="🔗"
          stats={stats.linkedin}
          total={stats.linkedin.eligible}
          color="#0077b5"
          batchSize={50}
          loading={liLoad}
          onRunMissing={() => void runEnrichment("/api/admin/dataset/find-linkedin", true,  setLiLoad)}
          onRunAll     ={() => void runEnrichment("/api/admin/dataset/find-linkedin", false, setLiLoad)}
        />
      </div>
    </div>
  );
}
