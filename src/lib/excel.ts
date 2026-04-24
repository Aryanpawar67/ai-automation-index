import * as XLSX from "xlsx";
import { HCM_MAP } from "@/lib/ats";

export interface DatasetRow {
  rowNumber:     number;
  companyName:   string;
  domain:        string;
  headquarters:  string;
  employeeSize:  string;
  hcmRaw:        string;
  atsType:       string | null;
  careerPageUrl: string;
  // POC contact fields — present only when the Excel sheet contains them
  pocFirstName:  string | null;
  pocLastName:   string | null;
  pocEmail:      string | null;
}

// Normalise a header string: lowercase, collapse whitespace → underscore
function norm(s: string) { return s.toLowerCase().trim().replace(/[\s/]+/g, "_"); }

// Find the first key in a normalised row whose normalised key contains all of the given substrings
function findCol(normRow: Record<string, string>, ...parts: string[]): string {
  const key = Object.keys(normRow).find(k => parts.every(p => k.includes(p)));
  return key ? normRow[key] : "";
}

export function parseExcelRaw(buffer: Buffer, sourceFile: string): DatasetRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet    = workbook.Sheets[workbook.SheetNames[0]];
  const raw      = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });

  // Build a parallel array of normalised-key rows for flexible header matching
  const normRows = raw.map(r =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [norm(k), String(v).trim()]))
  );

  return raw
    .filter(r => r["Company Name"]?.trim() && r["Career Page URL"]?.trim())
    .map((r, i) => {
      const nr     = normRows[i];
      const rawHcm = (r["HCM / HRIS / ATS"] ?? "").toLowerCase().trim();

      let domain = (r["Domain"] ?? "").trim();
      if (!domain) {
        try { domain = new URL(r["Career Page URL"].trim()).hostname; } catch { domain = ""; }
      }

      // Flexible POC column matching — handles "First Name", "first_name", "POC First Name", etc.
      const firstName = findCol(nr, "first") || findCol(nr, "firstname") || "";
      const lastName  = findCol(nr, "last")  || findCol(nr, "lastname")  || "";
      const email     = findCol(nr, "email") || "";

      return {
        rowNumber:     typeof r["#"] === "number" ? (r["#"] as unknown as number) : i + 1,
        companyName:   r["Company Name"].trim(),
        domain,
        headquarters:  (r["Headquarters"] ?? "").trim(),
        employeeSize:  (r["Employee Size"] ?? "").trim(),
        hcmRaw:        (r["HCM / HRIS / ATS"] ?? "").trim(),
        atsType:       HCM_MAP[rawHcm] ?? null,
        careerPageUrl: r["Career Page URL"].trim(),
        pocFirstName:  firstName || null,
        pocLastName:   lastName  || null,
        pocEmail:      email     || null,
      };
    });
}

export interface POCRow {
  firstName:     string;
  lastName:      string;
  email:         string;
  country:       string;
  companyName:   string;
  careerPageUrl: string;
  atsType:       string | null;
}

const REQUIRED = ["first_name", "last_name", "email", "company_name", "career_page_url"];

export function parseExcel(buffer: Buffer): POCRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet    = workbook.Sheets[workbook.SheetNames[0]];
  const rows     = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });

  if (rows.length === 0) throw new Error("Excel file is empty.");

  // Normalise column headers: lowercase, spaces → underscores
  const normalised = rows.map(row =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [
        k.toLowerCase().trim().replace(/\s+/g, "_"),
        String(v).trim(),
      ])
    )
  );

  const first = normalised[0];
  for (const col of REQUIRED) {
    if (!(col in first)) throw new Error(`Missing required column: "${col}"`);
  }

  return normalised
    .filter(r => r.email && r.company_name && r.career_page_url)
    .map(r => {
      const rawHcm = (r["hcm_/_hris_/_ats"] ?? r["hcm/hris/ats"] ?? r["ats"] ?? "").toLowerCase().trim();
      return {
        firstName:     r.first_name     ?? "",
        lastName:      r.last_name      ?? "",
        email:         r.email,
        country:       r.country        ?? "",
        companyName:   r.company_name,
        careerPageUrl: r.career_page_url,
        atsType:       HCM_MAP[rawHcm] ?? null,
      };
    });
}
