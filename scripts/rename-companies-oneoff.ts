/**
 * One-time rename of company display names. URLs (slug/report_token/id) untouched.
 * Run: npx tsx --env-file=.env.local scripts/rename-companies-oneoff.ts
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

const RENAMES: Array<[string, string]> = [
  ["Reinsurance Group of America, Incorporated",   "Reinsurance Group of America"],
  ["QBE North America",                            "QBE Insurance"],
  ["PacificSource Health Plans",                   "Pacific Source"],
  ["Berkshire Hathaway GUARD Insurance Companies", "Berkshire Hathway Group"],
  ["Aviva USA",                                    "Athene"],
  ["CBIZ Network Solutions",                       "Cigna"],
  ["Guidewire Software (formerly ISCS)",           "Guidewire"],
  ["FNF Family of Companies - Agency Division",    "Fidelity National Financial"],
  ["AIG Life & Retirement",                        "Corebridge Financial"],
  ["Legacy page for Rogers Insurance",             "Acrisure"],
  ["Crum & Forster | Surety and Trade Credit",     "Crum & Forster"],
];

(async () => {
  for (const [oldName, newName] of RENAMES) {
    const matches = await sql`SELECT id, name FROM companies WHERE name = ${oldName}`;
    if (matches.length === 0) {
      const fuzzy = await sql`SELECT id, name FROM companies WHERE name ILIKE ${"%" + oldName.split(" ")[0] + "%"} LIMIT 5`;
      console.log(`✗ NOT FOUND: "${oldName}"  (fuzzy by first word → ${fuzzy.length} candidates: ${fuzzy.map((r:{name:string})=>r.name).join(" | ")})`);
      continue;
    }
    if (matches.length > 1) {
      console.log(`! AMBIGUOUS: "${oldName}" matched ${matches.length} rows — skipping`);
      continue;
    }
    await sql`UPDATE companies SET name = ${newName} WHERE id = ${matches[0].id}`;
    console.log(`✓ "${oldName}"  →  "${newName}"`);
  }
  console.log("Done.");
})();
