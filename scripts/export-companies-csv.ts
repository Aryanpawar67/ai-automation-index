import { readFileSync, writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const env = readFileSync(".env.local", "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
}

const sql = neon(process.env.DATABASE_URL!);

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  const rows = await sql`
    SELECT
      c.id                                                     AS id,
      c.name                                                   AS organization_name,
      COALESCE(SUM(CASE WHEN jd.status = 'complete' THEN 1 ELSE 0 END), 0)::int AS processed_jds,
      COALESCE(SUM(CASE WHEN jd.status = 'failed'   THEN 1 ELSE 0 END), 0)::int AS failed_jds,
      c.career_page_url                                        AS subdomain_url,
      (c.scrape_status = 'complete')                           AS report_available,
      ''                                                       AS logo,
      c.slug                                                   AS slug,
      c.report_token                                           AS report_token,
      c.total_jobs_available                                   AS total_roles,
      ROUND(AVG(a.overall_score)::numeric, 1)                  AS avg_automation_score,
      c.created_at                                             AS created_at
    FROM companies c
    LEFT JOIN job_descriptions jd ON jd.company_id = c.id
    LEFT JOIN analyses a ON a.company_id = c.id
    GROUP BY c.id
    ORDER BY c.name ASC, c.created_at ASC
  `;

  // ── Detect duplicates / redundancies ───────────────────────────────────────
  // Group by normalized (name, url) and by name alone to flag near-duplicates.
  const byName = new Map<string, any[]>();
  const byNameUrl = new Map<string, any[]>();
  const norm = (s: string) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
  for (const r of rows as any[]) {
    const n = norm(r.organization_name);
    const u = (r.subdomain_url || "").trim().toLowerCase();
    if (!byName.has(n)) byName.set(n, []);
    byName.get(n)!.push(r);
    const key = `${n}|${u}`;
    if (!byNameUrl.has(key)) byNameUrl.set(key, []);
    byNameUrl.get(key)!.push(r);
  }

  function statusFor(r: any): string {
    const slug: string = r.slug || "";
    const name = norm(r.organization_name);
    const url = (r.subdomain_url || "").trim().toLowerCase();
    const nameDupes = byName.get(name) || [];
    const sameUrlDupes = byNameUrl.get(`${name}|${url}`) || [];
    if (nameDupes.length <= 1) return "primary";

    // Manual override: for Daman Health, the rescrape is canonical
    if (name === "daman health") {
      return slug === "daman-health-may-2026" ? "primary" : "duplicate";
    }

    // Pick "primary" within a name group = highest processed JDs, then earliest created
    const sorted = [...nameDupes].sort((a, b) => {
      if (b.processed_jds !== a.processed_jds) return b.processed_jds - a.processed_jds;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    const primary = sorted[0];
    if (primary.id === r.id) return "primary";

    // Explicit rescrape marker in slug
    if (/-(may|jun|jul|aug|sep|oct|nov|dec|jan|feb|mar|apr)-?\d{4}$/i.test(slug) || /rescrape/i.test(slug)) {
      return "rescrape";
    }
    // Numeric suffix (-2, -3) and 0 JDs ⇒ failed retry
    if (/-\d+$/.test(slug) && r.processed_jds === 0 && r.failed_jds === 0) {
      return "retry-empty";
    }
    // Same name + same URL ⇒ exact duplicate
    if (sameUrlDupes.length > 1) return "duplicate";
    // Same name but different URL ⇒ alternate-source duplicate
    return "duplicate-alt-url";
  }

  const BASE_URL = "https://ai-automation-index.up.railway.app";

  const mainHeader = [
    "Organization Name",
    "Processed JDs",
    "Failed JDs",
    "Report Link",
    "Report Available",
    "Total Roles",
    "Avg Automation Score",
    "Logo",
    "Slug",
  ];
  const archiveHeader = [...mainHeader, "Status"];
  const mainLines = [mainHeader.join(",")];
  const archiveLines = [archiveHeader.join(",")];

  for (const r of rows as any[]) {
    const status = statusFor(r);
    const reportLink = r.report_token
      ? `${BASE_URL}/report/${r.slug}?token=${r.report_token}`
      : "";
    const base = [
      csvEscape(r.organization_name),
      csvEscape(r.processed_jds),
      csvEscape(r.failed_jds),
      csvEscape(reportLink),
      csvEscape(r.report_available ? "TRUE" : "FALSE"),
      csvEscape(r.total_roles ?? ""),
      csvEscape(r.avg_automation_score != null ? `${r.avg_automation_score}%` : ""),
      csvEscape(r.logo),
      csvEscape(r.slug),
    ];
    if (status === "primary") {
      mainLines.push(base.join(","));
    } else {
      archiveLines.push([...base, csvEscape(status)].join(","));
    }
  }

  writeFileSync("companies-export.csv", mainLines.join("\n") + "\n");
  writeFileSync("companies-archive.csv", archiveLines.join("\n") + "\n");
  console.log(`Wrote ${mainLines.length - 1} primary rows to companies-export.csv`);
  console.log(`Wrote ${archiveLines.length - 1} archived rows to companies-archive.csv`);
}

main().catch((e) => { console.error(e); process.exit(1); });
