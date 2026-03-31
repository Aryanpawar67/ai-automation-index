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

const SYSTEM = `You are a specialist in AI augmentation assessment with deep knowledge of the 2025-2026 AI tool landscape.
You score tasks using a HITL (Human-In-The-Loop) augmentation scale — not "can AI replace the human" but "what % of task execution time can AI tools handle, even with human review and approval of outputs."
Return ONLY valid JSON.

AUGMENTATION SCORE CALIBRATION (HITL model — human always in the loop):
85-100 → AI executes fully, human reviews output in <5 min
        (e.g. data entry, scheduling, template reports, unit test generation, code documentation,
         PR description writing, meeting notes, regex/boilerplate code, SQL query generation)
65-84  → AI drafts/executes 70%+ of the task, human refines and approves
        (e.g. code review with GitHub Copilot/CodeRabbit, test suite generation, email drafting,
         document summarization, bug triage, API documentation, data pipeline scripts)
45-64  → AI handles 50-60% of execution, human provides domain judgment on outputs
        (e.g. architecture recommendations, complex debugging assistance, content drafting,
         data analysis with interpretation, security audit support, vendor evaluation)
25-44  → AI accelerates research/prep, human makes all key decisions
        (e.g. system design, cross-team technical leadership, complex stakeholder negotiations,
         novel algorithm design, regulatory compliance decisions)
0-24   → Minimal AI leverage: requires live human relationships, physical presence, or real-time crisis judgment
        (e.g. executive people management, client relationship building, on-site hardware debugging,
         real-time incident command, board-level strategic decisions)`;

const PROMPT = (task: RawTask, context: ParsedJD) => `Score the AI augmentation potential of this specific task under a HITL model.

TASK: "${task.name}"
Description: ${task.description}
Category: ${task.category}

Role context:
- Role: ${context.seniority} ${context.jobTitle} in ${context.department}
- Industry: ${context.industryContext}
- Tools used in this role: ${context.toolsMentioned.join(", ")}

IMPORTANT FRAMING: Score how much of this task's EXECUTION TIME can be handled by AI tools with a human reviewing/approving the output. A senior engineer reviewing AI-generated code, tests, or docs still scores high because AI does the heavy lifting. Do NOT penalise a task just because it requires expert human judgment — the question is whether AI tools can draft/execute the bulk of the work.

Ask yourself: "If this person used the best available AI tools for this task today, what % of their execution time would be saved even if they still approve every output?"

Return:
{
  "automationScore": <integer 0-100 per calibration scale>,
  "automationPotential": <"high" if score>=65, "medium" if 40-64, "low" if <40>,
  "scoringRationale": "2-3 sentences explaining why this score. Reference specific AI tools if they exist. Be explicit about what AI handles vs. what the human still reviews/decides.",
  "aiOpportunity": "one sentence: name a specific production-ready AI tool and describe exactly how it augments this task (e.g. 'GitHub Copilot generates unit tests and boilerplate, cutting implementation time by 60-70% while the engineer reviews for correctness')"
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
    scored.automationScore >= 65 ? "high" :
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
