/**
 * Agent 7 — Opportunity Synthesizer
 * Model: claude-sonnet-4-6
 * Job: Identify the 4-6 highest-ROI AI opportunities by reasoning across
 *      ALL prior agent outputs — not just listing highest-scored tasks.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import type { ParsedJD, ScoredTask, ROIData, Opportunity } from "./types";

const model = new ChatAnthropic({
  model: "claude-sonnet-4-6",
  temperature: 0,
});

const parser = new JsonOutputParser<{ opportunities: Opportunity[] }>();

const SYSTEM = `You are a strategic AI transformation advisor who identifies where AI creates the most business value.
You look for opportunities that bundle multiple tasks, leverage existing tools, and create compounding ROI.
Return ONLY valid JSON.`;

const PROMPT = (
  scoredTasks: ScoredTask[],
  toolsMapping: Record<string, string[]>,
  roiData: ROIData,
  parsedJD: ParsedJD
) => `
Identify the 4-6 highest-value AI opportunities for this role. Think beyond individual tasks — look for workflow automation clusters.

Role: ${parsedJD.seniority} ${parsedJD.jobTitle}, ${parsedJD.department}
Hours reclaimed target: ${roiData.hoursReclaimed}h/week

Scored tasks (with available tools):
${scoredTasks.map(t => {
  const tools = toolsMapping[t.name] ?? [];
  return `- ${t.name} | Score: ${t.automationScore} | ${t.automationPotential} potential | Tools: ${tools.join(", ") || t.aiOpportunity}`;
}).join("\n")}

Instructions:
- Prioritise: high impact + low effort first (biggest ROI for least friction)
- Consider bundles: can multiple tasks be automated by one tool/workflow?
- Be specific about which tools to use (use the tool names from above)
- estimatedTimeSaving should be additive across bundled tasks

Return:
{
  "opportunities": [
    {
      "title": "concise title (5-8 words)",
      "description": "2 sentences: first sentence describes exactly what AI automates and which tool handles it; second sentence states the measurable business impact (time saved, quality improvement, or risk reduction)",
      "impact": "high" | "medium" | "low",
      "effort": "high" | "medium" | "low",
      "tools": ["specific AI tool names"],
      "estimatedTimeSaving": "X-Y hours/week"
    }
  ]
}`;

export async function runOpportunitySynthAgent(
  scoredTasks: ScoredTask[],
  toolsMapping: Record<string, string[]>,
  roiData: ROIData,
  parsedJD: ParsedJD
): Promise<Opportunity[]> {
  const response = await model.invoke([
    new SystemMessage(SYSTEM),
    new HumanMessage(PROMPT(scoredTasks, toolsMapping, roiData, parsedJD)),
  ]);

  const raw = typeof response.content === "string"
    ? response.content
    : response.content.map(b => (b.type === "text" ? b.text : "")).join("");

  const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
  const result = await parser.parse(cleaned);
  return result.opportunities;
}
