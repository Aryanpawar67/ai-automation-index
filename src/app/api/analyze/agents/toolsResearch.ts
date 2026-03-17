/**
 * Agent 4 — AI Tools Research
 * Model: claude-sonnet-4-6 + optional Tavily web search
 * Job: Find specific, current AI tools for automatable tasks.
 *      If TAVILY_API_KEY is set, searches the live web for up-to-date tools.
 *      If not, uses Claude's training knowledge as fallback.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import type { ParsedJD, ScoredTask } from "./types";
import { searchWeb } from "./utils";

const model = new ChatAnthropic({
  model: "claude-sonnet-4-6",
  temperature: 0,
});

const parser = new JsonOutputParser<{ toolsMapping: Record<string, string[]> }>();

const SYSTEM = `You are an AI tools expert with deep knowledge of the 2025-2026 enterprise AI landscape.
Your job is to recommend specific, named, production-ready AI tools for workplace tasks.
Return ONLY valid JSON. Only name tools that actually exist.`;

const PROMPT = (tasks: ScoredTask[], context: ParsedJD, searchContext: string) => `
Recommend the best current AI tools for each of these automatable tasks.

Role: ${context.seniority} ${context.jobTitle}, ${context.department} department
${searchContext ? `\nRecent web research on available tools:\n${searchContext}\n` : ""}

Tasks to research (automation score ≥ 40):
${tasks.map(t => `- ${t.name} (score: ${t.automationScore}, category: ${t.category})`).join("\n")}

For each task, list 2-4 specific AI tools available today (real product names only).
Prefer tools that are:
1. Production-ready with enterprise support
2. Specifically designed for or commonly used for this task type
3. Available as of 2025-2026

Return:
{
  "toolsMapping": {
    "exact task name": ["Tool 1", "Tool 2", "Tool 3"],
    ...
  }
}`;

export async function runToolsResearchAgent(
  scoredTasks: ScoredTask[],
  context: ParsedJD
): Promise<Record<string, string[]>> {
  const automatableTasks = scoredTasks.filter(t => t.automationScore >= 40);

  // Search web for each task category if Tavily key available
  let searchContext = "";
  if (process.env.TAVILY_API_KEY && automatableTasks.length > 0) {
    const categories = [...new Set(automatableTasks.map(t => t.category))];
    const searches = await Promise.allSettled(
      categories.map(cat =>
        searchWeb(`best AI automation tools for ${cat} tasks ${context.department} 2025 2026`)
      )
    );
    searchContext = searches
      .filter(r => r.status === "fulfilled")
      .map(r => (r as PromiseFulfilledResult<string>).value)
      .filter(Boolean)
      .join("\n\n---\n\n")
      .slice(0, 3000); // cap context size
  }

  const response = await model.invoke([
    new SystemMessage(SYSTEM),
    new HumanMessage(PROMPT(automatableTasks, context, searchContext)),
  ]);

  const raw = typeof response.content === "string"
    ? response.content
    : response.content.map(b => (b.type === "text" ? b.text : "")).join("");

  const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
  const result = await parser.parse(cleaned);
  return result.toolsMapping;
}
