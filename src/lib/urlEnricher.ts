/**
 * AI enrichment layer for ambiguous career URL validation results.
 *
 * Only called when rule-based validation is inconclusive:
 *   - URL is unreachable (404 / timeout / network error) and suggestedUrl is still null
 *   - URL is reachable but no ATS detected and isCareerPage is null/false
 *   - confidence is "blocked" (bot-detection likely)
 *
 * Uses claude-haiku-4-5 for cost efficiency — one focused call per ambiguous URL.
 */

import { ChatAnthropic }                from "@langchain/anthropic";
import { HumanMessage, SystemMessage }  from "@langchain/core/messages";
import { JsonOutputParser }             from "@langchain/core/output_parsers";
import type { UrlValidationResult }     from "./urlValidator";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AiEnrichmentResult {
  isCareerPage:     boolean | null;
  hasLiveJobs:      boolean | null;
  detectedAts:      string | null;   // ATS name if AI inferred it
  suggestedUrl:     string | null;   // AI-suggested correction URL
  actionableReason: string;          // human-readable next step
  confidence:       "high" | "medium" | "low";
}

// ── Model (lazy-initialised so the API key is read at call-time, not import) ──

let _model:  ChatAnthropic | null = null;
const parser = new JsonOutputParser<AiEnrichmentResult>();

function getModel(): ChatAnthropic {
  if (!_model) {
    _model = new ChatAnthropic({
      model:       "claude-haiku-4-5-20251001",
      temperature: 0,
      maxTokens:   300,
      apiKey:      process.env.ANTHROPIC_API_KEY,
    });
  }
  return _model;
}

// ── Prompts ────────────────────────────────────────────────────────────────────

const SYSTEM = `You are a career page and ATS (Applicant Tracking System) expert.
Given a URL and optional HTML snippet, determine:
1. Is this a legitimate careers/jobs page?
2. Does it show live job openings?
3. Which ATS platform is being used (if detectable)?
4. If the URL seems wrong or broken, what is the most likely correct careers URL?
5. What should the user do next?

Known ATS platforms: workday, greenhouse, lever, oracle_taleo, oracle_hcm, sap_sf, bamboohr, icims, smartrecruiters, ashby, jobvite, workable, personio, rippling, breezyhr, jazzhr, cornerstone, adp, pinpoint.

Respond ONLY with valid JSON matching this exact shape:
{
  "isCareerPage":     boolean | null,
  "hasLiveJobs":      boolean | null,
  "detectedAts":      string | null,
  "suggestedUrl":     string | null,
  "actionableReason": string,
  "confidence":       "high" | "medium" | "low"
}`;

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Enrich a validation result with AI analysis.
 *
 * @param url          - The original URL that was validated
 * @param result       - The rule-based validation result
 * @param company      - Optional company name for better URL suggestions
 * @param htmlSnippet  - Optional first ~2000 chars of the page HTML
 */
export async function enrichWithAI(
  url:          string,
  result:       UrlValidationResult,
  company?:     string | null,
  htmlSnippet?: string | null,
): Promise<AiEnrichmentResult> {
  const prompt = buildPrompt(url, result, company, htmlSnippet);

  try {
    const response = await getModel().invoke([
      new SystemMessage(SYSTEM),
      new HumanMessage(prompt),
    ]);

    const parsed = await parser.invoke(response);
    return parsed;
  } catch (err) {
    // Graceful degradation — never crash the caller
    return {
      isCareerPage:     null,
      hasLiveJobs:      null,
      detectedAts:      null,
      suggestedUrl:     null,
      actionableReason: `AI enrichment failed: ${err instanceof Error ? err.message : String(err)}`,
      confidence:       "low",
    };
  }
}

/**
 * Decide whether AI enrichment is worth calling for this result.
 * Keeps token usage low by skipping clear-cut cases.
 */
export function shouldEnrich(result: UrlValidationResult): boolean {
  // Already high confidence and career page confirmed — nothing to add
  if (result.confidence === "high" && result.isCareerPage === true) return false;
  // Reachable, has ATS, no suggestion needed
  if (result.reachable && result.detectedAts && result.suggestedUrl === null && result.confidence === "high") return false;
  // Everything is clearly broken with no recovery possible (private IP, bad protocol)
  if (result.reason.includes("Private/internal") || result.reason.includes("Disallowed protocol")) return false;

  return true; // ambiguous — enrich
}

/**
 * One-shot helper: validate + enrich in a single call.
 * Import this instead of validateCareerUrl when AI enrichment is desired.
 */
export async function validateAndEnrich(
  url:      string,
  company?: string | null,
  options?: { declaredAtsType?: string | null; timeoutMs?: number },
): Promise<UrlValidationResult & { aiEnrichment: AiEnrichmentResult | null }> {
  const { validateCareerUrl } = await import("./urlValidator");

  const result = await validateCareerUrl(
    url,
    options?.declaredAtsType,
    options?.timeoutMs,
  );

  if (!shouldEnrich(result)) {
    return { ...result, aiEnrichment: null };
  }

  // Pass a trimmed HTML snippet to save tokens
  const snippet = result.isCareerPage !== null
    ? null
    : (result.finalUrl ?? url);   // we don't re-fetch here; pass what we know

  const aiEnrichment = await enrichWithAI(url, result, company, snippet as string | null);

  // Merge AI suggestions back into the result (AI fills gaps, doesn't override rule-based facts)
  return {
    ...result,
    detectedAts:  result.detectedAts  ?? aiEnrichment.detectedAts,
    suggestedUrl: result.suggestedUrl ?? aiEnrichment.suggestedUrl,
    isCareerPage: result.isCareerPage ?? aiEnrichment.isCareerPage,
    // Upgrade confidence if AI is confident
    confidence:   (result.confidence === "low" || result.confidence === "blocked") && aiEnrichment.confidence === "high"
      ? "medium"   // AI alone can't override to "high" — treat as medium
      : result.confidence,
    aiEnrichment,
  };
}

// ── Prompt builder ─────────────────────────────────────────────────────────────

function buildPrompt(
  url:          string,
  result:       UrlValidationResult,
  company?:     string | null,
  htmlSnippet?: string | null,
): string {
  const parts: string[] = [];

  parts.push(`URL: ${url}`);
  if (company)               parts.push(`Company: ${company}`);
  parts.push(`Reachable: ${result.reachable}`);
  parts.push(`HTTP status: ${result.httpStatus ?? "unknown"}`);
  parts.push(`Rule-based reason: ${result.reason}`);
  if (result.detectedAts)    parts.push(`ATS detected by rules: ${result.detectedAts}`);
  if (result.finalUrl)       parts.push(`Redirected to: ${result.finalUrl}`);
  if (result.confidence)     parts.push(`Current confidence: ${result.confidence}`);

  if (htmlSnippet) {
    // Trim to ~1500 chars to stay token-efficient
    const trimmed = htmlSnippet.slice(0, 1500).replace(/\s+/g, " ");
    parts.push(`\nHTML snippet (first 1500 chars):\n${trimmed}`);
  }

  return parts.join("\n");
}
