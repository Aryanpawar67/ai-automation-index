/**
 * Agent 5 — Skills Analysis
 * Model: claude-sonnet-4-6 + optional Tavily web search
 * Job: Classify every skill in the JD as future-proof, at-risk, or AI-augmented.
 *      Runs in parallel with Agents 3 and 4 — zero wall-clock cost.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import type { ParsedJD, SkillsAnalysis } from "./types";
import { searchWeb } from "./utils";

let _model: ChatAnthropic | null = null;
const getModel = () => _model ??= new ChatAnthropic({ model: "claude-sonnet-4-6", temperature: 0 });

const parser = new JsonOutputParser<SkillsAnalysis>();

const SYSTEM = `You are a workforce transformation expert who advises organizations on how AI will reshape skill requirements.
Your analysis is grounded in current research and the 2025-2026 AI capability landscape.
Return ONLY valid JSON.`;

const PROMPT = (parsedJD: ParsedJD, searchContext: string) => `
Classify every skill in this job description into three categories based on AI's impact over the next 3-5 years.

Role: ${parsedJD.seniority} ${parsedJD.jobTitle} in ${parsedJD.department}
Skills to classify: ${parsedJD.requiredSkills.join(", ")}
Tools mentioned: ${parsedJD.toolsMentioned.join(", ")}
${searchContext ? `\nCurrent research on AI impact on these skills:\n${searchContext}\n` : ""}

Classification rules:
- futureProof: Skills that require human judgment, creativity, relationships, or strategic thinking that AI cannot replicate. These become MORE valuable as AI handles routine work.
- atRisk: Skills likely to be substantially automated by AI within 3-5 years — routine, rule-based, or pattern-matching tasks.
- aiAugmented: Skills that remain important but become dramatically more powerful when paired with AI tools. The human + AI combination creates outsized value.

Return skill NAMES ONLY — short labels, no explanations or descriptions appended.
Each entry must be a concise skill name (1-4 words), not a sentence.

{
  "futureProof": ["Skill Name", "Skill Name", ...],
  "atRisk":      ["Skill Name", "Skill Name", ...],
  "aiAugmented": ["Skill Name", "Skill Name", ...]
}`;

export async function runSkillsAnalysisAgent(parsedJD: ParsedJD): Promise<SkillsAnalysis> {
  if (parsedJD.requiredSkills.length === 0 && parsedJD.toolsMentioned.length === 0) {
    return { futureProof: [], atRisk: [], aiAugmented: [] };
  }

  let searchContext = "";
  if (process.env.TAVILY_API_KEY) {
    const result = await searchWeb(
      `AI automation impact on ${parsedJD.department} skills workforce research 2025 2026`
    );
    searchContext = result.slice(0, 2000);
  }

  const response = await getModel().invoke([
    new SystemMessage(SYSTEM),
    new HumanMessage(PROMPT(parsedJD, searchContext)),
  ]);

  const raw = typeof response.content === "string"
    ? response.content
    : response.content.map(b => (b.type === "text" ? b.text : "")).join("");

  const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
  return parser.parse(cleaned);
}
