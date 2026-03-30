/**
 * Diagnoses and fixes career page URLs for Oracle HCM, Oracle Taleo, and SAP SuccessFactors companies.
 *
 * Oracle HCM  — attempts to discover the direct {pod}.fa.{region}.oraclecloud.com API URL + siteNumber.
 * Oracle Taleo — attempts to discover the {tenant}.taleo.net URL.
 * SAP SF       — attempts to discover the {tenant}.jobs2web.com URL or company code.
 *
 * Run:  node scripts/fix-oracle-sap-urls.mjs [--dry-run]
 *   --dry-run  Print proposed changes without writing to DB or Excel.
 */

import { neon }    from "@neondatabase/serverless";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const XLSX    = require("xlsx");
import { readFileSync, writeFileSync } from "fs";

const DRY_RUN = process.argv.includes("--dry-run");
const EXCEL   = "/Users/aryan/Desktop/ai-automation-index/imocha_prospects_careers_updated.xlsx";

// ── DB ───────────────────────────────────────────────────────────────────────
const sql = neon(process.env.DATABASE_URL);

// ── Fetch helpers ─────────────────────────────────────────────────────────────
async function fetchHtml(url, timeoutMs = 12_000) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)", "Accept": "text/html,*/*" },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

async function fetchJson(url, timeoutMs = 8_000) {
  try {
    const res = await fetch(url, {
      headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════
// ORACLE HCM
// ═══════════════════════════════════════════════════════

const ORACLE_REGIONS = ["us2", "uk3", "eu5", "ap2", "us6", "ca2", "us1", "eu1", "us3", "eu2"];

function buildOracleListUrl(base, siteNumber) {
  const finder = siteNumber ? `&finder=findReqs;siteNumber=${encodeURIComponent(siteNumber)}` : "";
  return `${base}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&limit=5&expand=requisitionList${finder}`;
}

/** Try the HCM REST API — returns true if it responds with job data. */
async function probeOracleApi(base, siteNumber) {
  const data = await fetchJson(buildOracleListUrl(base, siteNumber), 6_000);
  if (!data) return false;
  const jobs = data?.items?.[0]?.requisitionList;
  return Array.isArray(jobs) && jobs.length > 0;
}

/** Extract Oracle base URL + siteNumber from HTML source. */
function extractOracleFromHtml(html) {
  const domainMatch = html.match(/https?:\/\/([a-z0-9]+)\.fa\.([a-z0-9]+)\.oraclecloud\.com/i);
  if (!domainMatch) return null;
  const base = `https://${domainMatch[1]}.fa.${domainMatch[2]}.oraclecloud.com`;
  const cxMatch   = html.match(/siteNumber[=:]["']?\s*(CX_\d+)/i);
  const nameMatch = html.match(/\/sites\/([A-Za-z0-9_-]+)/i);
  const siteNumber = cxMatch?.[1] ?? nameMatch?.[1] ?? "";
  return { base, siteNumber };
}

/** Extract Oracle context directly from a *.oraclecloud.com URL. */
function extractOracleFromUrl(url) {
  const m = url.match(/https?:\/\/([a-z0-9]+)\.fa\.([a-z0-9]+)\.oraclecloud\.com/i);
  if (!m) return null;
  const base       = `https://${m[1]}.fa.${m[2]}.oraclecloud.com`;
  const siteName   = url.match(/\/sites\/([A-Za-z0-9_-]+)/i)?.[1];
  const siteParam  = (() => { try { return new URL(url).searchParams.get("siteNumber"); } catch { return null; } })();
  const siteNumber = siteParam ?? siteName ?? "";
  return { base, siteNumber };
}

async function resolveOracleHCM(url) {
  // Already a direct Oracle URL
  const direct = extractOracleFromUrl(url);
  if (direct) {
    const works = await probeOracleApi(direct.base, direct.siteNumber);
    if (works) return { ...direct, resolvedUrl: url };
  }

  // Fetch page HTML and scan
  const html = await fetchHtml(url);
  if (html) {
    const fromHtml = extractOracleFromHtml(html);
    if (fromHtml) {
      let works = await probeOracleApi(fromHtml.base, fromHtml.siteNumber);
      if (works) return { ...fromHtml, resolvedUrl: `${fromHtml.base}/hcmUI/CandidateExperience/en/sites/${fromHtml.siteNumber}` };

      // Try probing other regions with the same pod
      const podMatch = fromHtml.base.match(/\/\/([a-z0-9]+)\.fa\./i);
      if (podMatch) {
        for (const region of ORACLE_REGIONS) {
          const altBase = `https://${podMatch[1]}.fa.${region}.oraclecloud.com`;
          works = await probeOracleApi(altBase, fromHtml.siteNumber);
          if (works) return { base: altBase, siteNumber: fromHtml.siteNumber, resolvedUrl: `${altBase}/hcmUI/CandidateExperience/en/sites/${fromHtml.siteNumber}` };
        }
      }
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════
// ORACLE TALEO
// ═══════════════════════════════════════════════════════

async function resolveTaleo(url) {
  // Already a direct taleo.net URL — treat as correct
  if (/[a-z0-9_-]+\.taleo\.net/i.test(url)) return url;


  // Fetch page HTML, scan for taleo.net references
  const html = await fetchHtml(url);
  if (!html) return null;

  const taleoMatch = html.match(/https?:\/\/([a-z0-9_-]+)\.taleo\.net/i);
  if (taleoMatch) {
    const tenant  = taleoMatch[1];
    const testUrl = `https://${tenant}.taleo.net/careersection/rest/jobboard/joblist?lang=en&act=showpage&pg=1`;
    const data    = await fetchJson(testUrl);
    if (data?.requisition?.length > 0 || data?.requisition !== undefined) {
      return `https://${tenant}.taleo.net`;
    }
    // Return the tenant URL even if API returns empty — the tenant is at least valid
    return `https://${tenant}.taleo.net`;
  }

  // Also check for iframe src pointing to taleo
  const iframeMatch = html.match(/src=["'][^"']*([a-z0-9_-]+)\.taleo\.net[^"']*["']/i);
  if (iframeMatch) {
    const tenant = iframeMatch[1];
    return `https://${tenant}.taleo.net`;
  }

  return null;
}

// ═══════════════════════════════════════════════════════
// SAP SUCCESSFACTORS
// ═══════════════════════════════════════════════════════

async function probeJobs2Web(tenant) {
  const data = await fetchJson(
    `https://${tenant}.jobs2web.com/job-invite/list/api?limit=5&offset=0&lang=en&country=all`,
    6_000
  );
  return data?.results?.length > 0 ? `https://${tenant}.jobs2web.com` : null;
}

// SF CDN / infrastructure subdomains that should never be used as career URLs
const SF_CDN_RE = /^rmkcdn\.|^cdn\.|^static\.|^assets\.|^images?\.|rmk-map-/i;
// Static file extensions to reject
const STATIC_EXT_RE = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map)(\?|$)/i;
// A URL looks like an SF career page if it contains job/career path or company param
const SF_CAREER_RE  = /\/career|\/jobs|\/sf\/|[?&]company=/i;

// Session-specific SF query params that expire and should be stripped
const SF_SESSION_PARAMS = ["requestParams", "_s.crb", "loginFlowRequired", "login_ns"];

function cleanSfUrl(raw) {
  const decoded = raw.replace(/&#0*38;/g, "&").replace(/&amp;/g, "&").split(/["'<>\s]/)[0];
  try {
    const u = new URL(decoded);
    SF_SESSION_PARAMS.forEach(p => u.searchParams.delete(p));
    return u.toString();
  } catch { return decoded; }
}

async function resolveSAPSF(url) {
  // Already a direct SF career URL — treat as correct
  if (/career\d+\.(successfactors|sapsf)\.com/i.test(url)) return url;

  // Already a jobs2web URL
  const j2wMatch = url.match(/https?:\/\/([^.]+)\.jobs2web\.com/i);
  if (j2wMatch && !SF_CDN_RE.test(j2wMatch[1])) {
    const found = await probeJobs2Web(j2wMatch[1]);
    if (found) return found;
  }

  // Fetch page HTML
  const html = await fetchHtml(url);
  if (!html) return null;

  // Pattern 1: jobs2web tenant reference in HTML (exclude CDN/mapping tenants)
  const j2wAll = [...html.matchAll(/([a-z0-9_-]+)\.jobs2web\.com/gi)];
  for (const m of j2wAll) {
    if (SF_CDN_RE.test(m[1])) continue;
    const found = await probeJobs2Web(m[1]);
    if (found) return found;
    return `https://${m[1]}.jobs2web.com`;  // tenant found even if probe fails
  }

  // Pattern 2: data-company-code or companyCode JSON
  const codeMatch =
    html.match(/data-company-code=["']([^"']+)["']/i) ??
    html.match(/["']companyCode["']\s*:\s*["']([^"']+)["']/i) ??
    html.match(/company[_-]?code["']?\s*[:=]\s*["']([A-Za-z0-9_-]+)["']/i);
  if (codeMatch) {
    return `https://performancemanager.successfactors.com/sf/careers?company=${codeMatch[1]}`;
  }

  // Pattern 3: successfactors.com URL embedded — only accept actual career/job URLs
  const sfMatches = [...html.matchAll(/https?:\/\/([a-z0-9._-]*)successfactors\.com\/[^\s"'<>]+/gi)];
  for (const m of sfMatches) {
    const subdomain = m[1].replace(/\.$/, "");
    if (SF_CDN_RE.test(subdomain)) continue;
    const clean = cleanSfUrl(m[0]);
    if (STATIC_EXT_RE.test(clean)) continue;
    if (!SF_CAREER_RE.test(clean) && !clean.includes("successfactors.com/career")) continue;
    return clean;
  }

  // Pattern 4: SF Career Site Builder (hcm.sap.com / careers.sap.com)
  const sapMatches = [...html.matchAll(/https?:\/\/[a-z0-9._-]*(?:hcm|careers)\.sap\.com\/[^\s"'<>]+/gi)];
  for (const m of sapMatches) {
    const clean = cleanSfUrl(m[0]);
    if (!STATIC_EXT_RE.test(clean)) return clean;
  }

  return null;
}

// ═══════════════════════════════════════════════════════
// EXCEL UPDATE HELPERS
// ═══════════════════════════════════════════════════════

function loadExcel() {
  const wb = XLSX.readFile(EXCEL);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return { wb, ws, rows: XLSX.utils.sheet_to_json(ws, { defval: "" }) };
}

function saveExcel(wb) {
  XLSX.writeFile(wb, EXCEL);
}

function updateExcelRow(rows, companyName, newUrl) {
  const row = rows.find(r => r["Company Name"]?.trim() === companyName.trim());
  if (row) row["Career Page URL"] = newUrl;
  return !!row;
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════

async function main() {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ATS URL Diagnostic + Fix${DRY_RUN ? " [DRY RUN]" : ""}`);
  console.log(`${"═".repeat(60)}\n`);

  const { wb, ws, rows: excelRows } = loadExcel();

  // ── Fetch companies from DB ──
  const dbCompanies = await sql`SELECT id, name, career_page_url, ats_type FROM companies WHERE ats_type IN ('oracle_hcm','oracle_taleo')`;

  const dbResults   = [];   // { id, name, oldUrl, newUrl, atsType }
  const excelResults = [];  // { name, oldUrl, newUrl, atsType }

  // ── Oracle HCM ──────────────────────────────────────────────
  console.log("── Oracle HCM (" + dbCompanies.filter(c => c.ats_type === "oracle_hcm").length + " companies) ──\n");

  for (const co of dbCompanies.filter(c => c.ats_type === "oracle_hcm")) {
    process.stdout.write(`  ${co.name.padEnd(38)} `);
    const result = await resolveOracleHCM(co.career_page_url);
    if (result?.resolvedUrl && result.resolvedUrl !== co.career_page_url) {
      console.log(`✓  ${result.resolvedUrl}`);
      dbResults.push({ id: co.id, name: co.name, oldUrl: co.career_page_url, newUrl: result.resolvedUrl, atsType: "oracle_hcm" });
    } else if (result?.resolvedUrl) {
      console.log(`=  already correct`);
    } else {
      console.log(`✗  could not resolve`);
    }
  }

  // ── Oracle Taleo ─────────────────────────────────────────────
  console.log("\n── Oracle Taleo (" + dbCompanies.filter(c => c.ats_type === "oracle_taleo").length + " companies) ──\n");

  for (const co of dbCompanies.filter(c => c.ats_type === "oracle_taleo")) {
    process.stdout.write(`  ${co.name.padEnd(38)} `);
    const newUrl = await resolveTaleo(co.career_page_url);
    if (newUrl && newUrl !== co.career_page_url) {
      console.log(`✓  ${newUrl}`);
      dbResults.push({ id: co.id, name: co.name, oldUrl: co.career_page_url, newUrl, atsType: "oracle_taleo" });
    } else if (newUrl) {
      console.log(`=  already correct`);
    } else {
      console.log(`✗  could not resolve`);
    }
  }

  // ── SAP SF (Excel only) ──────────────────────────────────────
  const sapExcelRows = excelRows.filter(r => /sap|successfactor/i.test(r["HCM / HRIS / ATS"] ?? ""));
  console.log(`\n── SAP SuccessFactors (${sapExcelRows.length} companies — Excel only) ──\n`);

  for (const row of sapExcelRows) {
    const name   = row["Company Name"]?.trim();
    const oldUrl = row["Career Page URL"]?.trim();
    process.stdout.write(`  ${name.padEnd(38)} `);
    const newUrl = await resolveSAPSF(oldUrl);
    if (newUrl && newUrl !== oldUrl) {
      console.log(`✓  ${newUrl}`);
      excelResults.push({ name, oldUrl, newUrl, atsType: "sap_sf" });
    } else if (newUrl) {
      console.log(`=  already correct`);
    } else {
      console.log(`✗  could not resolve`);
    }
  }

  // ── Summary ──────────────────────────────────────────────────
  const totalFixed = dbResults.length + excelResults.length;
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  Fixed: ${totalFixed}  |  DB updates: ${dbResults.length}  |  Excel-only: ${excelResults.length}`);
  console.log(`${"─".repeat(60)}\n`);

  if (DRY_RUN) {
    console.log("DRY RUN — no changes written.\n");
    return;
  }

  if (dbResults.length === 0 && excelResults.length === 0) {
    console.log("Nothing to update.\n");
    return;
  }

  // ── Apply DB updates ──
  for (const r of dbResults) {
    await sql`UPDATE companies SET career_page_url = ${r.newUrl} WHERE id = ${r.id}`;
    console.log(`  DB updated: ${r.name}`);
  }

  // ── Apply Excel updates (DB-changed companies + SAP-only companies) ──
  const allExcelUpdates = [
    ...dbResults.map(r => ({ name: r.name, newUrl: r.newUrl })),
    ...excelResults.map(r => ({ name: r.name, newUrl: r.newUrl })),
  ];

  let excelChanged = 0;
  for (const { name, newUrl } of allExcelUpdates) {
    if (updateExcelRow(excelRows, name, newUrl)) excelChanged++;
  }

  if (excelChanged > 0) {
    // Rebuild worksheet from updated rows and save
    const newWs = XLSX.utils.json_to_sheet(excelRows);
    wb.Sheets[wb.SheetNames[0]] = newWs;
    saveExcel(wb);
    console.log(`  Excel updated: ${excelChanged} rows → ${EXCEL}`);
  }

  console.log("\nDone.\n");
}

main().catch(err => { console.error(err); process.exit(1); });
