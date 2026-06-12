/**
 * One-time rename batch #2. Updates ALL rows whose name matches the old value
 * (duplicates included). URLs (slug/report_token/id) untouched.
 * Run: npx tsx --env-file=.env.local scripts/rename-companies-oneoff-2.ts
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

const RENAMES: Array<[string, string]> = [
  ["Stewart Title of El Paso",                          "Stewart"],
  ["Ryan Larson, Allstate Agency Owner",                "Allstate"],
  ["Penn Mutual Independence Financial Network (IFN)",  "Penn Mutual"],
  ["Tokio Marine HCC-Casualty Group",                   "Tokio Marine HCC"],
  ["Community Association Car Chat",                    "The Baldwin Group"],
  ["Transamerica Agency Network-Greenville NC District","Transamerica"],
  ["Newyorklife",                                       "New York Life"],
  ["Ryan Specialty Underwriting Managers",              "Ryan Speciality"],
  ["Core Specialty Insurance Holdings, Inc.",           "Core Speciality"],
  // Curly apostrophe variant for Optum
  ["Optum Workers’ Comp and Auto No-Fault",        "Optum"],
  ["Optum Workers' Comp and Auto No-Fault",             "Optum"],
  ["RT Environmental & Construction Professional",      "Ryan Turner Speciality"],
  ["National General Lender Services",                  "National General"],
  ["Armando Martinez - COUNTRY Financial Agent",        "Country Financial"],
];

(async () => {
  for (const [oldName, newName] of RENAMES) {
    const matches = await sql`SELECT id, name FROM companies WHERE name = ${oldName}`;
    if (matches.length === 0) {
      const firstWord = oldName.split(/[\s,]/)[0];
      const fuzzy = await sql`SELECT id, name FROM companies WHERE name ILIKE ${"%" + firstWord + "%"} LIMIT 5`;
      console.log(`✗ NOT FOUND: "${oldName}"  (fuzzy "${firstWord}" → ${fuzzy.map((r:{name:string})=>r.name).join(" | ") || "none"})`);
      continue;
    }
    await sql`UPDATE companies SET name = ${newName} WHERE name = ${oldName}`;
    console.log(`✓ "${oldName}"  →  "${newName}"  (${matches.length} row${matches.length>1?"s":""})`);
  }
  console.log("Done.");
})();
