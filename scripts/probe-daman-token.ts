import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
const env = readFileSync(".env.local", "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
}
const sql = neon(process.env.DATABASE_URL!);
async function main() {
  const rows = await sql`SELECT slug, report_token IS NOT NULL AS has_token, token_expires_at FROM companies WHERE slug ILIKE 'daman%'`;
  console.log(rows);
}
main();
