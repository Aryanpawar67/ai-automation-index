// Industry sector detection — two layers:
// Layer 1 (free):   2× DuckDuckGo searches (→ Google CSE fallback) for company profile snippets
// Layer 2 (Claude): Haiku classifies snippets into a canonical 28-sector taxonomy
//
// Cost per company: ~$0.001 (Haiku only — web searches are free via DuckDuckGo)
// Batch cap: 50 companies/run (conservative for Google CSE fallback quota)

import { ChatAnthropic } from "@langchain/anthropic";
import { webSearchText } from "@/lib/webSearch";

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

// ── Claude classification ─────────────────────────────────────────────────────

const CLASSIFICATION_PROMPT = `You are an industry classification specialist. Given web search snippets about a company, determine which single industry sector best describes the company's PRIMARY business.

Respond with ONLY a JSON object in this exact shape:
{"industry": "Insurance", "confidence": 85}

Rules:
- You MUST pick exactly one industry from this list:
${INDUSTRY_TAXONOMY.map(i => `  "${i}"`).join(",\n")}
- "confidence" is 0–100. Use 0 if you cannot determine the industry.
- If confidence < 50, return {"industry": null, "confidence": 0}
- Never guess. Use only information present in the snippets provided.
- "Technology" is a last resort — only use it if the company makes software/hardware as its core product. IT services firms → "Consulting & Professional Services".`;

async function claudeClassify(
  companyName: string,
  rawText: string,
): Promise<{ industry: string | null; confidence: number }> {
  try {
    const llm = new ChatAnthropic({ model: "claude-haiku-4-5-20251001", maxTokens: 128 });
    const msg = await llm.invoke([
      { role: "system", content: CLASSIFICATION_PROMPT },
      { role: "user",   content: `Company: ${companyName}\n\n---\n\n${rawText.slice(0, 3000)}` },
    ]);
    const text = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return { industry: null, confidence: 0 };
    const parsed = JSON.parse(json) as { industry?: string | null; confidence?: number };
    const industry  = parsed.industry ?? null;
    const confidence = parsed.confidence ?? 0;
    // Validate the returned label is in the taxonomy
    if (industry && !(INDUSTRY_TAXONOMY as readonly string[]).includes(industry)) {
      return { industry: null, confidence: 0 };
    }
    return { industry, confidence };
  } catch {
    return { industry: null, confidence: 0 };
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function enrichIndustry(
  input: EnrichIndustryInput,
): Promise<EnrichIndustryOutput> {
  const { companyName, domain } = input;

  try {
    const parts: string[] = [];

    const queries = [
      `"${companyName}" industry sector company profile about`,
      `"${domain}" company industry business overview`,
    ];

    for (const q of queries) {
      const text = await webSearchText(q, 5);
      if (text) parts.push(`[Search: ${q}]\n${text}`);
      await new Promise(r => setTimeout(r, 300));
    }

    const rawText = parts.join("\n\n---\n\n");
    if (rawText.length < 100) {
      return { status: "not_found", industry: null, confidence: 0 };
    }

    const { industry, confidence } = await claudeClassify(companyName, rawText);

    if (industry && confidence >= 50) {
      return { status: "complete", industry, confidence };
    }
    return { status: "not_found", industry: null, confidence: 0 };

  } catch {
    return { status: "failed", industry: null, confidence: 0 };
  }
}
