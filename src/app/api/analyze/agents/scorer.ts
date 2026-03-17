/**
 * Agent 3 — Task Scorer
 * Model: claude-sonnet-4-6
 * Job: Score ONE task's automation potential with full focus and a visible rationale.
 *      Called in parallel (one instance per task) — each task gets 100% attention.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import type { ParsedJD, RawTask, ScoredTask } from "./types";

const model = new ChatAnthropic({
  model: "claude-sonnet-4-6",
  temperature: 0,
});

const parser = new JsonOutputParser<Pick<ScoredTask, "automationScore" | "automationPotential" | "scoringRationale" | "aiOpportunity">>();

const SYSTEM = `You are a specialist in AI automation assessment with deep knowledge of the 2025-2026 AI tool landscape.
You score tasks using a precise calibration scale. Return ONLY valid JSON.

AUTOMATION SCORE CALIBRATION:
85-100 → Fully automatable: structured, repetitive, rule-based with no judgment required
        (e.g. data entry, scheduling, template report generation, copy-paste workflows)
65-84  → Mostly automatable: AI handles 70%+ with light human review
        (e.g. routine email drafting, document summarization, basic research compilation)
45-64  → Significantly augmented: AI does 50-60%, human provides brand voice / judgment
        (e.g. content drafting, data analysis with interpretation, vendor research)
25-44  → AI-assisted but human-led: AI accelerates, human drives decisions
        (e.g. strategic planning, presentations, complex negotiations)
0-24   → Primarily human: nuanced judgment, relationships, novel thinking required
        (e.g. C-suite decisions, team leadership, crisis management)`;

const PROMPT = (task: RawTask, context: ParsedJD) => `Score the automation potential of this specific task.

TASK: "${task.name}"
Description: ${task.description}
Category: ${task.category}

Role context:
- Role: ${context.seniority} ${context.jobTitle} in ${context.department}
- Industry: ${context.industryContext}
- Tools used in this role: ${context.toolsMentioned.join(", ")}

Score this task using the calibration scale in your instructions.
Consider: does AI exist TODAY for this specific task in this context? What human judgment is still required?

Return:
{
  "automationScore": <integer 0-100 per calibration scale>,
  "automationPotential": <"high" if score>=70, "medium" if 40-69, "low" if <40>,
  "scoringRationale": "2-3 sentences explaining why this score. Reference specific AI tools if they exist. Mention what aspect still requires human involvement.",
  "aiOpportunity": "one sentence: name a specific production-ready AI tool and describe exactly how it automates this task (e.g. 'Use ChatGPT to draft email responses from bullet points, cutting composition time by 70%')"
}`;

export async function runScorerAgent(task: RawTask, context: ParsedJD): Promise<ScoredTask> {
  const response = await model.invoke([
    new SystemMessage(SYSTEM),
    new HumanMessage(PROMPT(task, context)),
  ]);

  const raw = typeof response.content === "string"
    ? response.content
    : response.content.map(b => (b.type === "text" ? b.text : "")).join("");

  const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
  const scored = await parser.parse(cleaned);

  // Enforce threshold consistency
  const potential =
    scored.automationScore >= 70 ? "high" :
    scored.automationScore >= 40 ? "medium" : "low";

  return {
    ...task,
    automationScore: scored.automationScore,
    automationPotential: potential,
    scoringRationale: scored.scoringRationale,
    aiOpportunity: scored.aiOpportunity,
  };
}

/** Run all task scorers in parallel — each task gets its own dedicated call. */
export async function runAllScorerAgents(tasks: RawTask[], context: ParsedJD): Promise<ScoredTask[]> {
  const results = await Promise.allSettled(tasks.map(t => runScorerAgent(t, context)));

  return results.map((result, i) => {
    if (result.status === "fulfilled") return result.value;
    // Fallback for failed scorer: return task with mid-range defaults
    console.error(`Scorer failed for task "${tasks[i].name}":`, result.reason);
    return {
      ...tasks[i],
      automationScore: 50,
      automationPotential: "medium" as const,
      scoringRationale: "Score unavailable due to an error.",
      aiOpportunity: "See general AI automation tools.",
    };
  });
}
