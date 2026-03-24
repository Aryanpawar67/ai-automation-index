import * as XLSX from "xlsx";

export interface POCRow {
  firstName:     string;
  lastName:      string;
  email:         string;
  country:       string;
  companyName:   string;
  careerPageUrl: string;
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
    .map(r => ({
      firstName:     r.first_name     ?? "",
      lastName:      r.last_name      ?? "",
      email:         r.email,
      country:       r.country        ?? "",
      companyName:   r.company_name,
      careerPageUrl: r.career_page_url,
    }));
}
