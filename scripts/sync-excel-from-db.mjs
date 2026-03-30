import { neon } from "@neondatabase/serverless";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
import { readFileSync } from "fs";

const DRY_RUN = process.argv.includes("--dry-run");
const EXCEL = "./imocha_prospects_careers_updated.xlsx";
const sql = neon(process.env.DATABASE_URL);

// Get all unique companies from DB with their current URLs (latest per name)
const dbRows = await sql`
  SELECT DISTINCT ON (name) name, career_page_url, ats_type
  FROM companies
  WHERE career_page_url IS NOT NULL
  ORDER BY name, created_at DESC NULLS LAST
`;
console.log(`DB companies: ${dbRows.length}`);

// Load Excel
const wb = XLSX.readFile(EXCEL);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

// Build lookup: normalized name -> excel row
const normalize = n => n?.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
const excelMap = new Map();
for (const row of rows) {
  const key = normalize(row["Company Name"]);
  if (key) excelMap.set(key, row);
}

let updated = 0;
for (const db of dbRows) {
  const key = normalize(db.name);
  const excelRow = excelMap.get(key);
  if (!excelRow) continue;

  const oldUrl = excelRow["Career Page URL"]?.trim();
  const newUrl = db.career_page_url?.trim();
  if (oldUrl === newUrl || !newUrl) continue;

  console.log(`  UPDATE: ${db.name}`);
  console.log(`    OLD: ${oldUrl}`);
  console.log(`    NEW: ${newUrl}`);
  if (!DRY_RUN) excelRow["Career Page URL"] = newUrl;
  updated++;
}

console.log(`\nTotal updates: ${updated}`);
if (!DRY_RUN && updated > 0) {
  const newWs = XLSX.utils.json_to_sheet(rows);
  wb.Sheets[wb.SheetNames[0]] = newWs;
  XLSX.writeFile(wb, EXCEL);
  console.log(`Saved → ${EXCEL}`);
}
if (DRY_RUN) console.log("DRY RUN — no changes written.");
