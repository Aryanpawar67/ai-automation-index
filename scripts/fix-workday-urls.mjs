/**
 * Bulk-updates Workday company career_page_url values to direct job-listing URLs.
 * Run: node scripts/fix-workday-urls.mjs
 */

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => [l.split("=")[0].trim(), l.split("=").slice(1).join("=").trim()])
);

const sql = neon(env.DATABASE_URL);

const CORRECT_URLS = [
  ["Comcast Corporation",    "https://comcast.wd5.myworkdayjobs.com/en-US/Comcast_Careers"],
  ["IQVIA",                  "https://iqvia.wd1.myworkdayjobs.com/IQVIA"],
  ["Valmet",                 "https://valmet.wd103.myworkdayjobs.com/en-US/External"],
  ["BD",                     "https://bdx.wd1.myworkdayjobs.com/EXTERNAL_CAREER_SITE_USA"],
  ["Airbus",                 "https://ag.wd3.myworkdayjobs.com/Airbus"],
  ["RedHat",                 "https://redhat.wd5.myworkdayjobs.com/jobs"],
  ["Thomson Reuters",        "https://thomsonreuters.wd5.myworkdayjobs.com/en-US/External_Career_Site"],
  ["Deloitte",               "https://deloitteie.wd3.myworkdayjobs.com/Experienced_Professionals"],
  ["DXC Technology",         "https://dxctechnology.wd1.myworkdayjobs.com/DXCJobs"],
  ["Guidehouse",             "https://guidehouse.wd1.myworkdayjobs.com/External"],
  ["Pfizer",                 "https://pfizer.wd1.myworkdayjobs.com/PfizerCareers"],
  ["Sun Life Financial Inc", "https://sunlife.wd3.myworkdayjobs.com/Experienced-Jobs"],
  ["Otto International",     "https://ottoint.wd116.myworkdayjobs.com/careers"],
  ["Valeo",                  "https://valeo.wd3.myworkdayjobs.com/en-EN/valeo_jobs"],
  ["TIBA",                   "https://romeu.wd3.myworkdayjobs.com/en-US/Romeu_Jobs"],
];

console.log("Updating Workday company URLs in DB...\n");
let updated = 0, notFound = 0;

for (const [name, url] of CORRECT_URLS) {
  const rows = await sql`
    UPDATE companies
    SET career_page_url = ${url},
        scrape_status   = 'pending',
        scrape_error    = null
    WHERE name = ${name}
    RETURNING id, name
  `;
  if (rows.length > 0) {
    console.log(`✓  ${name.padEnd(28)} → ${url}`);
    updated++;
  } else {
    // Try partial match (name might differ slightly)
    const found = await sql`
      SELECT id, name FROM companies
      WHERE lower(name) LIKE ${"%" + name.toLowerCase().split(" ")[0] + "%"}
        AND ats_type = 'workday'
      LIMIT 3
    `;
    if (found.length > 0) {
      console.log(`?  "${name}" not found — similar: ${found.map(r => r.name).join(", ")}`);
    } else {
      console.log(`✗  NOT IN DB: "${name}"`);
    }
    notFound++;
  }
}

console.log(`\n${updated} updated, ${notFound} not found`);
