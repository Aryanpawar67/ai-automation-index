/**
 * Agent 8 — Roadmap Builder
 * Model: claude-sonnet-4-6
 * Job: Produce a phased implementation plan that sequences initiatives
 *      based on the actual tools and scores from all prior agents.
 *      Phase 1 items are only things achievable with tools already identified.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import type { ParsedJD, ScoredTask, Opportunity, ROIData, RoadmapPhase } from "./types";
import { lookupTools } from "./utils";

const model = new ChatAnthropic({
  model: "claude-sonnet-4-6",
  temperature: 0,
});

const parser = new JsonOutputParser<{ roadmap: RoadmapPhase[] }>();

const SYSTEM = `You are an AI implementation strategist who designs realistic, phased rollout plans.
Your roadmaps are grounded in what's actually achievable — Phase 1 uses only tools that exist today and require no custom development.
Return ONLY valid JSON.`;

const PROMPT = (
  scoredTasks: ScoredTask[],
  opportunities: Opportunity[],
  toolsMapping: Record<string, string[]>,
  roiData: ROIData,
  parsedJD: ParsedJD
) => `
Build a 3-phase AI implementation roadmap for this role.

Role: ${parsedJD.seniority} ${parsedJD.jobTitle}, ${parsedJD.department}
Target outcome: ${roiData.hoursReclaimed}h/week reclaimed — ${roiData.focusShift}

Available tools (from research):
${scoredTasks
  .filter(t => t.automationScore >= 40)
  .map(t => { const tools = lookupTools(t.name, toolsMapping); return `- ${t.name}: ${(tools.length > 0 ? tools : [t.aiOpportunity]).join(", ")}`; })
  .join("\n")}

Top opportunities to sequence:
${opportunities.map((o, i) => `${i + 1}. [${o.impact} impact, ${o.effort} effort] ${o.title} — ${o.tools.join(", ")}`).join("\n")}

Roadmap rules:
- Phase 1 (0-3 months): Only off-the-shelf tools, no custom dev, no workflow redesign. Quick wins that build confidence.
- Phase 2 (3-9 months): Integration work, process redesign, training. Medium-effort opportunities.
- Phase 3 (9-18 months): Custom AI workflows, advanced integrations, AI agents. High-effort opportunities.
- Every item must name a specific tool and a specific action.
- Phase 1 must deliver measurable hours saved — not just "explore" or "evaluate".

Return:
{
  "roadmap": [
    {
      "phase": "Phase 1: Quick Wins",
      "timeline": "0-3 months",
      "items": ["3-5 specific action items with named tools — each actionable on day 1"]
    },
    {
      "phase": "Phase 2: Core Automation",
      "timeline": "3-9 months",
      "items": ["3-5 specific action items"]
    },
    {
      "phase": "Phase 3: Advanced AI",
      "timeline": "9-18 months",
      "items": ["3-5 specific action items"]
    }
  ]
}`;

export async function runRoadmapAgent(
  scoredTasks: ScoredTask[],
  opportunities: Opportunity[],
  toolsMapping: Record<string, string[]>,
  roiData: ROIData,
  parsedJD: ParsedJD
): Promise<RoadmapPhase[]> {
  const response = await model.invoke([
    new SystemMessage(SYSTEM),
    new HumanMessage(PROMPT(scoredTasks, opportunities, toolsMapping, roiData, parsedJD)),
  ]);

  const raw = typeof response.content === "string"
    ? response.content
    : response.content.map(b => (b.type === "text" ? b.text : "")).join("");

  const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
  const result = await parser.parse(cleaned);
  return result.roadmap;
}
