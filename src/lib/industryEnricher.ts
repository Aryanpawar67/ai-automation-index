// Industry sector detection — Haiku-first, DDG fallback only for unknowns.
//
// Pass 1: Claude Haiku from training knowledge (no web search).
//         Covers ~83% of companies instantly.
// Pass 2: One DuckDuckGo search for truly obscure companies, then retry Haiku.
//
// Cost per company: ~$0.001 (Haiku) — web searches are free via DDG.

import { ChatAnthropic } from "@langchain/anthropic";

// ── Taxonomy ───────────────────────────────────────────────────────────────────

export const INDUSTRY_TAXONOMY = [
  "Insurance",
  "Banking",
  "Financial Services",
  "Investment Management",
  "Healthcare",
  "Pharmaceuticals & Life Sciences",
  "Medical Devices",
  "Technology",
  "Software & SaaS",
  "Telecommunications",
  "Retail",
  "Consumer Goods",
  "Food & Beverage",
  "Manufacturing",
  "Automotive",
  "Energy & Utilities",
  "Oil & Gas",
  "Construction & Real Estate",
  "Logistics & Transportation",
  "Airlines & Travel",
  "Hospitality",
  "Media & Entertainment",
  "Education",
  "Government & Public Sector",
  "Consulting & Professional Services",
  "Legal Services",
  "Non-Profit",
  "Other",
] as const;

export type Industry = typeof INDUSTRY_TAXONOMY[number];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EnrichIndustryInput {
  companyName:   string;
  domain:        string;
  careerPageUrl: string;
}

export interface EnrichIndustryOutput {
  status:     "complete" | "not_found" | "failed";
  industry:   string | null;
  confidence: number;
}

// ── Haiku classification ──────────────────────────────────────────────────────

let llm: ChatAnthropic | null = null;
function getLlm() {
  if (!llm) llm = new ChatAnthropic({ model: "claude-haiku-4-5-20251001", maxTokens: 100 });
  return llm;
}

async function claudeClassify(
  companyName: string,
  domain: string,
  extraContext = "",
): Promise<{ industry: string | null; confidence: number }> {
  try {
    const prompt = `You are an industry classification specialist.

Classify the company into exactly one industry sector from the list below based on your training knowledge.

Company: ${companyName}
Domain:  ${domain}
${extraContext ? `Context: ${extraContext}` : ""}

Industry list:
${INDUSTRY_TAXONOMY.map(i => `- ${i}`).join("\n")}

Rules:
- Return ONLY valid JSON: {"industry": "Insurance", "confidence": 90}
- confidence = 0–100. If < 50, return {"industry": null, "confidence": 0}
- "Technology" is last resort — IT services / consulting → "Consulting & Professional Services"
- Never guess. If genuinely unknown, return null.`;

    const msg  = await getLlm().invoke([{ role: "user", content: prompt }]);
    const text = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    const json = text.match(/\{[\s\S]*?\}/)?.[0];
    if (!json) return { industry: null, confidence: 0 };

    const parsed = JSON.parse(json) as { industry?: string | null; confidence?: number };
    const industry   = parsed.industry ?? null;
    const confidence = parsed.confidence ?? 0;

    if (industry && !(INDUSTRY_TAXONOMY as readonly string[]).includes(industry)) {
      return { industry: null, confidence: 0 };
    }
    return { industry, confidence };
  } catch {
    return { industry: null, confidence: 0 };
  }
}

// ── DuckDuckGo fallback ───────────────────────────────────────────────────────

async function ddgSnippet(companyName: string): Promise<string> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`"${companyName}" industry sector company profile`)}&kl=us-en`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    const snippets = [...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)]
      .slice(0, 3)
      .map(m => m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    return snippets.join(" | ");
  } catch {
    return "";
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function enrichIndustry(
  input: EnrichIndustryInput,
): Promise<EnrichIndustryOutput> {
  const { companyName, domain } = input;

  try {
    // Pass 1: Haiku from training knowledge alone — fast, no web calls
    const result = await claudeClassify(companyName, domain);
    if (result.industry && result.confidence >= 50) {
      return { status: "complete", industry: result.industry, confidence: result.confidence };
    }

    // Pass 2: one DDG search for extra context, then retry
    const snippet = await ddgSnippet(companyName);
    if (snippet) {
      const result2 = await claudeClassify(companyName, domain, snippet.slice(0, 500));
      if (result2.industry && result2.confidence >= 50) {
        return { status: "complete", industry: result2.industry, confidence: result2.confidence };
      }
    }

    return { status: "not_found", industry: null, confidence: 0 };
  } catch {
    return { status: "failed", industry: null, confidence: 0 };
  }
}
