/**
 * Bulk industry sector enrichment script.
 *
 * Uses Claude Haiku's training knowledge directly — no web search needed
 * for well-known companies. Falls back to a single DuckDuckGo search for
 * truly unknown companies.
 *
 * Advantages over the API route:
 *  - No Vercel timeout
 *  - 15× concurrent (vs 5) — processes ~300 companies/minute
 *  - Skips DDG by default → higher hit rate, faster
 *
 * Usage:
 *   node scripts/enrich-industry.mjs              # all missing
 *   node scripts/enrich-industry.mjs --all        # re-run everything
 *   node scripts/enrich-industry.mjs --limit 100  # cap at N rows
 */

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) { console.error("Missing ANTHROPIC_API_KEY"); process.exit(1); }

const CONCURRENCY = 10;
const DELAY_MS    = 200;

const TAXONOMY = [
  "Insurance", "Banking", "Financial Services", "Investment Management",
  "Healthcare", "Pharmaceuticals & Life Sciences", "Medical Devices",
  "Technology", "Software & SaaS", "Telecommunications",
  "Retail", "Consumer Goods", "Food & Beverage", "Manufacturing", "Automotive",
  "Energy & Utilities", "Oil & Gas", "Construction & Real Estate",
  "Logistics & Transportation", "Airlines & Travel", "Hospitality",
  "Media & Entertainment", "Education", "Government & Public Sector",
  "Consulting & Professional Services", "Legal Services", "Non-Profit", "Other",
];

const args   = process.argv.slice(2);
const rerunAll = args.includes("--all");
const limitArg = args.indexOf("--limit");
const maxRows  = limitArg !== -1 ? parseInt(args[limitArg + 1]) : Infinity;

// ── Haiku call ────────────────────────────────────────────────────────────────

async function classifyIndustry(companyName, domain, extraContext = "") {
  const prompt = `You are an industry classification specialist.

Classify the company into exactly one industry sector from the list below based on your training knowledge.

Company: ${companyName}
Domain:  ${domain}
${extraContext ? `Context: ${extraContext}` : ""}

Industry list:
${TAXONOMY.map(i => `- ${i}`).join("\n")}

Rules:
- Return ONLY valid JSON: {"industry": "Insurance", "confidence": 90}
- confidence = 0–100. If < 50, return {"industry": null, "confidence": 0}
- "Technology" is last resort — IT services / consulting → "Consulting & Professional Services"
- Never guess. If genuinely unknown, return null.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:  "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 100,
      messages:   [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? "";
  const json = text.match(/\{[\s\S]*?\}/)?.[0];
  if (!json) return { industry: null, confidence: 0 };

  const parsed = JSON.parse(json);
  const industry = parsed.industry ?? null;
  const confidence = parsed.confidence ?? 0;

  if (industry && !TAXONOMY.includes(industry)) return { industry: null, confidence: 0 };
  return { industry, confidence };
}

// ── DuckDuckGo fallback (for truly unknown companies) ─────────────────────────

async function ddgSearch(query) {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=us-en`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    // Extract snippet text cheaply (no cheerio in script context)
    const snippets = [...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)]
      .slice(0, 3)
      .map(m => m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    return snippets.join(" | ");
  } catch {
    return "";
  }
}

// ── Process one row ───────────────────────────────────────────────────────────

async function processRow(row) {
  try {
    // Pass 1: Claude from training knowledge alone
    const result = await classifyIndustry(row.company_name, row.domain);

    if (result.industry && result.confidence >= 50) {
      return { id: row.id, industry: result.industry, status: "complete" };
    }

    // Pass 2: one DDG search for extra context, then retry
    const snippet = await ddgSearch(`"${row.company_name}" industry sector company profile`);
    if (snippet) {
      const result2 = await classifyIndustry(row.company_name, row.domain, snippet.slice(0, 500));
      if (result2.industry && result2.confidence >= 50) {
        return { id: row.id, industry: result2.industry, status: "complete" };
      }
    }

    return { id: row.id, industry: null, status: "not_found" };
  } catch (e) {
    console.error(`  ✗ ${row.company_name}: ${e.message}`);
    return { id: row.id, industry: null, status: "failed" };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

const rows = rerunAll
  ? await sql`SELECT id, company_name, domain FROM dataset_rows ORDER BY row_number`
  : await sql`SELECT id, company_name, domain FROM dataset_rows WHERE industry_status IS NULL OR industry_status != 'complete' ORDER BY row_number`;

const toProcess = maxRows < Infinity ? rows.slice(0, maxRows) : rows;

if (toProcess.length === 0) {
  console.log("Nothing to process — all companies already have an industry.");
  process.exit(0);
}

console.log(`\nProcessing ${toProcess.length} companies (concurrency: ${CONCURRENCY})\n`);

let done = 0, complete = 0, notFound = 0, failed = 0;
const start = Date.now();

for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
  const chunk = toProcess.slice(i, i + CONCURRENCY);

  const results = await Promise.all(chunk.map(processRow));

  // Write results sequentially — Neon serverless resets on concurrent writes
  for (const r of results) {
    let retries = 3;
    while (retries-- > 0) {
      try {
        await sql`
          UPDATE dataset_rows
          SET industry_status        = ${r.status},
              industry               = ${r.industry},
              industry_discovered_at = NOW()
          WHERE id = ${r.id}
        `;
        break;
      } catch (e) {
        if (retries === 0) throw e;
        await new Promise(res => setTimeout(res, 500));
      }
    }

    done++;
    if (r.status === "complete")    complete++;
    else if (r.status === "failed") failed++;
    else                            notFound++;

    const row = chunk.find(c => c.id === r.id);
    const icon = r.status === "complete" ? "✓" : r.status === "failed" ? "✗" : "–";
    console.log(`  ${icon} [${done}/${toProcess.length}] ${row?.company_name} → ${r.industry ?? r.status}`);
  }

  if (i + CONCURRENCY < toProcess.length) await new Promise(r => setTimeout(r, DELAY_MS));
}

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log(`\n─────────────────────────────────────`);
console.log(`Done in ${elapsed}s`);
console.log(`  ✓ Complete:  ${complete}`);
console.log(`  – Not found: ${notFound}`);
console.log(`  ✗ Failed:    ${failed}`);
console.log(`  Cost: ~$${(complete * 0.001).toFixed(3)} (Haiku)`);
