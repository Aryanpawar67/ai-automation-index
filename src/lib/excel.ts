import * as XLSX from "xlsx";

export interface DatasetRow {
  rowNumber:     number;
  companyName:   string;
  domain:        string;
  headquarters:  string;
  employeeSize:  string;
  hcmRaw:        string;
  atsType:       string | null;
  careerPageUrl: string;
  jobPreview:    string[];
}

export function parseExcelRaw(buffer: Buffer, sourceFile: string): DatasetRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet    = workbook.Sheets[workbook.SheetNames[0]];
  const rows     = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });

  return rows
    .filter(r => r["Company Name"]?.trim() && r["Career Page URL"]?.trim())
    .map((r, i) => {
      const rawHcm   = (r["HCM / HRIS / ATS"] ?? "").toLowerCase().trim();
      const jobPreview = [1,2,3,4,5,6,7,8,9,10]
        .map(n => (r[`Job ${n}`] ?? "").trim())
        .filter(Boolean);

      let domain = (r["Domain"] ?? "").trim();
      if (!domain) {
        try { domain = new URL(r["Career Page URL"].trim()).hostname; } catch { domain = ""; }
      }

      return {
        rowNumber:     typeof r["#"] === "number" ? (r["#"] as unknown as number) : i + 1,
        companyName:   r["Company Name"].trim(),
        domain,
        headquarters:  (r["Headquarters"] ?? "").trim(),
        employeeSize:  (r["Employee Size"] ?? "").trim(),
        hcmRaw:        (r["HCM / HRIS / ATS"] ?? "").trim(),
        atsType:       HCM_MAP[rawHcm] ?? null,
        careerPageUrl: r["Career Page URL"].trim(),
        jobPreview,
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

const HCM_MAP: Record<string, string> = {
  "workday":               "workday",
  "oracle hcm":            "oracle_hcm",
  "oracle hcm cloud":      "oracle_hcm",
  "oracle taleo":          "oracle_taleo",
  "taleo":                 "oracle_taleo",
  "sap successfactors":    "sap_sf",
  "successfactors":        "sap_sf",
};

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
