// HR Stack discovery — three layers:
// Layer 1 (free, instant):   ATS already in urlDetectedAts — no network call needed
// Layer 2 (free, 100/day):   Google Custom Search API for HCM/LXP/HRIS signals
// Layer 3 (Firecrawl credits): Career page + About page deep crawl if Layer 2 is thin
// Layer 4 (Claude):          Structured extraction from aggregated raw text
//
// Paid upgrade path:
//   Layer 2 → replace googleCseSearch() with Exa.ai (npm install exa-js, EXA_API_KEY env)
//   Layer 2 → replace googleCseSearch() with SerpAPI (SERPAPI_KEY env, no npm needed)

import { ChatAnthropic }  from "@langchain/anthropic";
import FirecrawlApp        from "@mendable/firecrawl-js";
import { webSearchText }   from "@/lib/webSearch";
import { HrStackResult, HrStackVendor } from "@/lib/db/schema";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EnrichHrStackInput {
  companyName:    string;
  domain:         string;
  careerPageUrl:  string;
  urlDetectedAts: string | null;  // already discovered by URL validation — Layer 1 is instant
}

export interface EnrichHrStackOutput {
  status:  "complete" | "not_found" | "failed";
  result:  HrStackResult;
}

// ── Layer 2: Web search (DuckDuckGo primary → Google CSE fallback) ───────────
// Uses webSearch.ts — no API keys needed, no daily limits.
// Google CSE (100/day) is the automatic fallback inside webSearchText().

// ── Layer 3: Firecrawl page crawl ─────────────────────────────────────────────

async function firecrawlPage(url: string): Promise<string> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return "";
  try {
    const app    = new FirecrawlApp({ apiKey: key });
    const result = await app.scrape(url, { formats: ["markdown"] });
    return ((result as unknown as { markdown?: string }).markdown ?? "").slice(0, 6000);
  } catch {
    return "";
  }
}

// ── Layer 4: Claude structured extraction ─────────────────────────────────────

const EXTRACTION_PROMPT = `You are an HR technology analyst. Given web search results and/or page content below, extract the HR technology stack for this company.

Return ONLY valid JSON in this exact shape (omit a key entirely if not found, do not guess):
{"ats":{"vendor":"Greenhouse","confidence":90,"source":"career page URL pattern"},"hcm":null,"lxp":null,"hris":null}

Confidence rules:
- 90–100: Explicitly named in a direct quote, URL, or page content for this company
- 70–89:  Mentioned in a review, case study, or press release alongside the company
- 50–69:  Mentioned near the company in context but not directly attributed
- Below 50: Omit the key entirely

Only include vendors you are confident about. Never guess. Never hallucinate vendor names.
Categories:
- ats:  Applicant Tracking System (Greenhouse, Lever, Workday Recruiting, iCIMS, SmartRecruiters, Ashby, Jobvite, BambooHR, Taleo, etc.)
- hcm:  Human Capital Management (Workday HCM, SAP SuccessFactors, Oracle HCM, ADP Workforce Now, etc.)
- lxp:  Learning Experience Platform (Degreed, Cornerstone, LinkedIn Learning, 360Learning, Docebo, etc.)
- hris: HR Information System (BambooHR, Rippling, Gusto, HiBob, Personio, etc.)`;

async function claudeExtract(companyName: string, rawText: string): Promise<HrStackResult> {
  if (!rawText.trim()) return {};
  try {
    const llm = new ChatAnthropic({ model: "claude-haiku-4-5-20251001", maxTokens: 512 });
    const msg = await llm.invoke([
      { role: "system", content: EXTRACTION_PROMPT },
      { role: "user",   content: `Company: ${companyName}\n\n---\n\n${rawText.slice(0, 8000)}` },
    ]);
    const text = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return {};
    return JSON.parse(json) as HrStackResult;
  } catch {
    return {};
  }
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function enrichHrStack(input: EnrichHrStackInput): Promise<EnrichHrStackOutput> {
  const { companyName, domain, careerPageUrl, urlDetectedAts } = input;

  try {
    const parts: string[] = [];

    // Layer 1: ATS already known from URL validation (instant, free)
    let knownAts: HrStackVendor | null = null;
    if (urlDetectedAts) {
      knownAts = {
        vendor:     urlDetectedAts,
        confidence: 95,
        source:     "career page URL/HTML pattern (URL validation)",
      };
    }

    // Layer 2: Web search (DuckDuckGo → Google CSE fallback)
    // Only search for ATS if not already known from URL validation (avoid redundant queries)
    const queries: string[] = [];

    if (!urlDetectedAts) {
      queries.push(`"${companyName}" "applicant tracking" OR "ATS" OR "Greenhouse" OR "Lever" OR "iCIMS" OR "SmartRecruiters" OR "Ashby" OR "Jobvite" OR "Workday Recruiting"`);
    }
    // Always search for HCM / HRIS / LXP — these are never auto-detected from URL patterns
    queries.push(`"${companyName}" "Workday" OR "SAP SuccessFactors" OR "Oracle HCM" OR "ADP" OR "Rippling" OR "BambooHR" OR "HiBob" OR "Personio" HRIS OR HCM`);
    queries.push(`"${companyName}" "learning platform" OR "LXP" OR "Degreed" OR "Cornerstone" OR "Docebo" OR "360Learning" OR "LinkedIn Learning" OR "Udemy Business"`);
    queries.push(`"${companyName}" HR technology stack site:linkedin.com OR site:g2.com OR site:glassdoor.com`);

    for (const q of queries) {
      const text = await webSearchText(q, 5);
      if (text) parts.push(`[Search: ${q}]\n${text}`);
      await new Promise(r => setTimeout(r, 300));
    }

    // Layer 3: Firecrawl — only if CSE returned almost nothing
    if (parts.join("").length < 400) {
      const [careerText, aboutText] = await Promise.all([
        firecrawlPage(careerPageUrl),
        firecrawlPage(`https://${domain}/about`),
      ]);
      if (careerText) parts.push(`[Career page: ${careerPageUrl}]\n${careerText}`);
      if (aboutText)  parts.push(`[About page: https://${domain}/about]\n${aboutText}`);
    }

    const rawText = parts.join("\n\n---\n\n");

    // Layer 4: Claude extraction
    const extracted = await claudeExtract(companyName, rawText);

    // Merge: Layer 1 ATS wins if higher confidence
    const result: HrStackResult = { ...extracted };
    if (knownAts && (!result.ats || (result.ats?.confidence ?? 0) < knownAts.confidence)) {
      result.ats = knownAts;
    }

    const hasAny = Object.values(result).some(v => v != null);
    return { status: hasAny ? "complete" : "not_found", result };

  } catch {
    return { status: "failed", result: {} };
  }
}
