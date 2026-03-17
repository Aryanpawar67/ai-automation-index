/**
 * Agent 2 — Task Decomposer
 * Model: claude-sonnet-4-6
 * Job: Break the role into 6-10 specific, scoreable tasks.
 *      Critically adds estimatedTimeShare per task — this powers accurate ROI math.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import type { ParsedJD, RawTask } from "./types";

const model = new ChatAnthropic({
  model: "claude-sonnet-4-6",
  temperature: 0,
});

const parser = new JsonOutputParser<{ tasks: RawTask[] }>();

const SYSTEM = `You are an expert job analyst who breaks roles into discrete, measurable tasks.
Each task must be specific enough to evaluate for AI automation independently.
Return ONLY valid JSON, no markdown, no explanation.`;

const PROMPT = (parsedJD: ParsedJD) => `Analyze this ${parsedJD.seniority} ${parsedJD.jobTitle} role and decompose it into 6-10 specific tasks.

Role context:
- Department: ${parsedJD.department}
- Industry: ${parsedJD.industryContext}
- Responsibilities: ${parsedJD.responsibilities.join("; ")}
- Tools used: ${parsedJD.toolsMentioned.join(", ")}

Rules for task decomposition:
1. Each task must come directly from the responsibilities listed above
2. Tasks must be specific enough to score for AI automation (not vague like "manage projects")
3. estimatedTimeShare values must sum to exactly 1.0 across all tasks
4. Use your knowledge of this role type to estimate realistic time distributions

Return:
{
  "tasks": [
    {
      "name": "task name (3-6 words, imperative form)",
      "description": "1-sentence description of what this task involves day-to-day",
      "category": "one of exactly: Data Processing, Communication, Research, Reporting, Creative, Strategic, Administrative, Technical",
      "estimatedTimeShare": <decimal 0.0–1.0, fraction of a 40h work week>
    }
  ]
}`;

export async function runDecomposerAgent(parsedJD: ParsedJD): Promise<RawTask[]> {
  const response = await model.invoke([
    new SystemMessage(SYSTEM),
    new HumanMessage(PROMPT(parsedJD)),
  ]);

  const raw = typeof response.content === "string"
    ? response.content
    : response.content.map(b => (b.type === "text" ? b.text : "")).join("");

  const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
  const parsed = await parser.parse(cleaned);

  // Normalise timeShares to sum to 1.0 in case of drift
  const total = parsed.tasks.reduce((s, t) => s + t.estimatedTimeShare, 0);
  return parsed.tasks.map(t => ({
    ...t,
    estimatedTimeShare: parseFloat((t.estimatedTimeShare / total).toFixed(3)),
  }));
}
