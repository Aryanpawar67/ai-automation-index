import { Pool } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationSql = readFileSync(join(__dirname, "../drizzle/0007_report_events_geo_accuracy.sql"), "utf8");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

const statements = migrationSql
  .split(";")
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith("--"));

for (const stmt of statements) {
  try {
    await client.query(stmt);
    console.log("OK:", stmt.slice(0, 80));
  } catch (e) {
    console.error("ERR:", e.message.slice(0, 120), "\n  ->", stmt.slice(0, 60));
  }
}

await client.release();
await pool.end();
console.log("\nMigration complete.");
