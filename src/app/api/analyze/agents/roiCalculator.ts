/**
 * Agent 6 — ROI Calculator
 * No LLM — pure deterministic math.
 * Job: Compute all ROI metrics from task scores + time estimates.
 *      Numbers are now provably correct and CFO-verifiable.
 *
 * Formula (per plan):
 *   hoursSavedPerTask = (40h × estimatedTimeShare) × (automationScore / 100) × EFFICIENCY
 *   totalHoursSaved   = min(Σ hoursSavedPerTask, MAX_HOURS)
 *   productivityMultiplier = rounded to nearest 0.5x
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import type { ParsedJD, ScoredTask, ROIData } from "./types";

const WORK_HOURS_PER_WEEK = 40;
const EFFICIENCY_FACTOR   = 0.65; // accounts for AI errors, setup, human review overhead
const MAX_HOURS_SAVED     = 20;   // 50% of 40h week — realistic ceiling for high-automation roles

export function computeROI(scoredTasks: ScoredTask[]): Omit<ROIData, "focusShift"> {
  const taskBreakdown = scoredTasks.map(task => {
    const taskHours    = WORK_HOURS_PER_WEEK * task.estimatedTimeShare;
    const hoursSaved   = taskHours * (task.automationScore / 100) * EFFICIENCY_FACTOR;
    return { name: task.name, taskHours, hoursSaved };
  });

  const rawTotalSaved = taskBreakdown.reduce((s, t) => s + t.hoursSaved, 0);
  const cappedSaved   = Math.min(Math.round(rawTotalSaved), MAX_HOURS_SAVED);

  // Round to nearest 0.5x
  const rawMultiplier = (WORK_HOURS_PER_WEEK + cappedSaved) / WORK_HOURS_PER_WEEK;
  const multiplier    = Math.round(rawMultiplier * 2) / 2;

  const formula = taskBreakdown
    .filter(t => t.hoursSaved > 0.1)
    .map(t => `${t.name}: ${t.taskHours.toFixed(1)}h × ${(scoredTasks.find(s => s.name === t.name)?.automationScore ?? 0)}% automation × 65% efficiency = ${t.hoursSaved.toFixed(1)}h`)
    .join("\n") +
    `\n\nTotal: min(${rawTotalSaved.toFixed(1)}h, ${MAX_HOURS_SAVED}h cap) = ${cappedSaved}h/week reclaimed`;

  return {
    estimatedHoursSavedPerWeek: cappedSaved,
    productivity_multiplier:    `${multiplier}x`,
    formula,
  };
}

/** Agent 6 also generates focusShift via a small LLM call */
let _model: ChatAnthropic | null = null;
const getModel = () => _model ??= new ChatAnthropic({ model: "claude-haiku-4-5-20251001", temperature: 0 });
const parser = new JsonOutputParser<{ focusShift: string }>();

export async function runROIAgent(scoredTasks: ScoredTask[], parsedJD: ParsedJD): Promise<ROIData> {
  const mathResult = computeROI(scoredTasks);

  const highValueTasks = scoredTasks
    .filter(t => t.automationPotential === "high")
    .map(t => t.name)
    .join(", ");

  const response = await getModel().invoke([
    new SystemMessage("Return ONLY valid JSON with one field. No markdown."),
    new HumanMessage(
      `A ${parsedJD.seniority} ${parsedJD.jobTitle} will reclaim ${mathResult.estimatedHoursSavedPerWeek}h/week ` +
      `by automating: ${highValueTasks}. ` +
      `What higher-value work can they focus on instead? ` +
      `Return: { "focusShift": "1-2 sentence answer specific to this role" }`
    ),
  ]);

  const raw = typeof response.content === "string"
    ? response.content
    : response.content.map(b => (b.type === "text" ? b.text : "")).join("");
  const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
  const { focusShift } = await parser.parse(cleaned);

  return { ...mathResult, focusShift };
}
