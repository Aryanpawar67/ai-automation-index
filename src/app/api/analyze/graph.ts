/**
 * LangGraph Orchestrator
 *
 * Defines the StateGraph that coordinates all 8 agents.
 * LangSmith automatically traces every node and LLM call when
 * LANGCHAIN_TRACING_V2=true and LANGCHAIN_API_KEY are set.
 *
 * Execution flow:
 *   parser → decomposer → parallelAnalysis (scorer + toolsResearch + skillsAnalysis)
 *          → roi → opportunities → roadmap → finalise
 */

import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { JsonOutputParser } from "@langchain/core/output_parsers";

import { runParserAgent }           from "./agents/parser";
import { runDecomposerAgent }        from "./agents/decomposer";
import { runAllScorerAgents }        from "./agents/scorer";
import { runToolsResearchAgent }     from "./agents/toolsResearch";
import { runSkillsAnalysisAgent }    from "./agents/skillsAnalysis";
import { runROIAgent }               from "./agents/roiCalculator";
import { runOpportunitySynthAgent }  from "./agents/opportunitySynth";
import { runRoadmapAgent }           from "./agents/roadmapBuilder";

import type {
  ParsedJD, RawTask, ScoredTask, SkillsAnalysis,
  ROIData, Opportunity, RoadmapPhase, FinalAnalysis,
} from "./agents/types";

// ─── State Definition ─────────────────────────────────────────────────────────

// "last write wins" reducer — each node overwrites the field
const overwrite = <T>(x: T, y: T): T => y ?? x;

const GraphState = Annotation.Root({
  // inputs
  jobDescription:  Annotation<string>(),
  company:         Annotation<string>(),
  // agent outputs
  parsedJD:        Annotation<ParsedJD | undefined>({ value: overwrite, default: () => undefined }),
  rawTasks:        Annotation<RawTask[]>({ value: overwrite, default: () => [] }),
  scoredTasks:     Annotation<ScoredTask[]>({ value: overwrite, default: () => [] }),
  toolsMapping:    Annotation<Record<string, string[]>>({ value: overwrite, default: () => ({}) }),
  skillsAnalysis:  Annotation<SkillsAnalysis | undefined>({ value: overwrite, default: () => undefined }),
  roiData:         Annotation<ROIData | undefined>({ value: overwrite, default: () => undefined }),
  opportunities:   Annotation<Opportunity[]>({ value: overwrite, default: () => [] }),
  roadmap:         Annotation<RoadmapPhase[]>({ value: overwrite, default: () => [] }),
  // final assembled result
  result:          Annotation<FinalAnalysis | undefined>({ value: overwrite, default: () => undefined }),
});

type State = typeof GraphState.State;

// ─── Node: Agent 1 — JD Parser ───────────────────────────────────────────────

async function parserNode(state: State): Promise<Partial<State>> {
  const parsedJD = await runParserAgent(state.jobDescription, state.company);
  return { parsedJD };
}

// ─── Node: Agent 2 — Task Decomposer ─────────────────────────────────────────

async function decomposerNode(state: State): Promise<Partial<State>> {
  const rawTasks = await runDecomposerAgent(state.parsedJD!);
  return { rawTasks };
}

// ─── Node: Agents 3 + 4 + 5 in parallel ─────────────────────────────────────

async function parallelAnalysisNode(state: State): Promise<Partial<State>> {
  // Agent 3 (task scoring) and Agent 5 (skills analysis) run in parallel —
  // neither depends on the other.
  const [scoredTasks, skillsAnalysis] = await Promise.all([
    runAllScorerAgents(state.rawTasks, state.parsedJD!),
    runSkillsAnalysisAgent(state.parsedJD!),
  ]);

  // Agent 4 (tools research) runs after scoring — it owns its own ≥40 filter internally.
  const toolsMapping = await runToolsResearchAgent(scoredTasks, state.parsedJD!);

  return { scoredTasks, toolsMapping, skillsAnalysis };
}

// ─── Node: Agent 6 — ROI Calculator ──────────────────────────────────────────

async function roiNode(state: State): Promise<Partial<State>> {
  const roiData = await runROIAgent(state.scoredTasks, state.parsedJD!);
  return { roiData };
}

// ─── Node: Agent 7 — Opportunity Synthesizer ─────────────────────────────────

async function opportunitiesNode(state: State): Promise<Partial<State>> {
  const opportunities = await runOpportunitySynthAgent(
    state.scoredTasks,
    state.toolsMapping,
    state.roiData!,
    state.parsedJD!
  );
  return { opportunities };
}

// ─── Node: Agent 8 — Roadmap Builder ─────────────────────────────────────────

async function roadmapNode(state: State): Promise<Partial<State>> {
  const roadmap = await runRoadmapAgent(
    state.scoredTasks,
    state.opportunities,
    state.toolsMapping,
    state.roiData!,
    state.parsedJD!
  );
  return { roadmap };
}

// ─── Node: Finalise — assemble dashboard-compatible FinalAnalysis ─────────────

async function finaliseNode(state: State): Promise<Partial<State>> {
  const { parsedJD, scoredTasks, skillsAnalysis, roiData, opportunities, roadmap } = state;

  // Compute overallAutomationScore as timeShare-WEIGHTED average.
  // timeShares are normalised to sum to 1.0 in the decomposer, so no division needed.
  // A task that occupies 30% of the week should count 6× more than one at 5%.
  const overallAutomationScore = Math.round(
    scoredTasks.reduce((s, t) => s + t.automationScore * t.estimatedTimeShare, 0)
  );

  // Compute aiReadinessScore: timeShare-weighted average of automatable tasks × 0.85 readiness factor
  const readyTasks = scoredTasks.filter(t => t.automationScore >= 40);
  const readyShareTotal = readyTasks.reduce((s, t) => s + t.estimatedTimeShare, 0);
  const aiReadinessScore = readyTasks.length > 0 && readyShareTotal > 0
    ? Math.round(
        readyTasks.reduce((s, t) => s + t.automationScore * t.estimatedTimeShare, 0)
        / readyShareTotal * 0.85
      )
    : 40;

  // automationByCategory: timeShare-weighted average per category
  const categoryMap: Record<string, { weightedSum: number; totalShare: number }> = {};
  scoredTasks.forEach(t => {
    if (!categoryMap[t.category]) categoryMap[t.category] = { weightedSum: 0, totalShare: 0 };
    categoryMap[t.category].weightedSum += t.automationScore * t.estimatedTimeShare;
    categoryMap[t.category].totalShare  += t.estimatedTimeShare;
  });
  const automationByCategory = Object.entries(categoryMap).map(([category, data]) => ({
    category,
    score: Math.round(data.weightedSum / data.totalShare),
  }));

  // Generate executive summary via Haiku — wrapped in try/catch so a JSON parse
  // failure here never crashes the entire pipeline.
  let executiveSummary =
    `This ${parsedJD!.seniority} ${parsedJD!.jobTitle} role scores ${overallAutomationScore}% for automation potential, ` +
    `with ${roiData!.hoursReclaimed}h/week reclaimed. ` +
    `Top opportunity: ${opportunities[0]?.title ?? "workflow automation"}.`;
  try {
    const summaryModel = new ChatAnthropic({ model: "claude-haiku-4-5-20251001", temperature: 0 });
    const summaryParser = new JsonOutputParser<{ executiveSummary: string }>();
    const summaryRes = await summaryModel.invoke([
      new SystemMessage("Return ONLY valid JSON with one field. No markdown fences."),
      new HumanMessage(
        `Write a 2-3 sentence executive summary for a ${parsedJD!.seniority} ${parsedJD!.jobTitle} role in ${parsedJD!.department}. ` +
        `Key metrics: automation score ${overallAutomationScore}/100, ${roiData!.hoursReclaimed}h/week reclaimed, productivity multiplier ${roiData!.productivity_multiplier}. ` +
        `Top AI opportunity: ${opportunities[0]?.title ?? "workflow automation"}. ` +
        `Focus shift: ${roiData!.focusShift}. ` +
        `The summary should be specific to this role, business-ready, and highlight the most impactful transformation potential. Avoid generic statements. ` +
        `Return: { "executiveSummary": "..." }`
      ),
    ]);
    const summaryRaw = typeof summaryRes.content === "string" ? summaryRes.content
      : summaryRes.content.map(b => (b.type === "text" ? b.text : "")).join("");
    const parsed = await summaryParser.parse(
      summaryRaw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim()
    );
    if (parsed.executiveSummary) executiveSummary = parsed.executiveSummary;
  } catch (err) {
    console.warn("Executive summary generation failed, using fallback:", err);
  }

  const result: FinalAnalysis = {
    jobTitle:                  parsedJD!.jobTitle,
    department:                parsedJD!.department,
    executiveSummary,
    overallAutomationScore,
    aiReadinessScore,
    estimatedHoursSavedPerWeek: roiData!.estimatedHoursSavedPerWeek,
    tasks: scoredTasks.map(t => ({
      name:               t.name,
      automationScore:    t.automationScore,
      automationPotential: t.automationPotential,
      category:           t.category,
      aiOpportunity:      (state.toolsMapping[t.name]?.[0]) ?? t.aiOpportunity,
      scoringRationale:   t.scoringRationale,
    })),
    aiOpportunities:      opportunities,
    skillsAnalysis:       skillsAnalysis!,
    automationByCategory,
    implementationRoadmap: roadmap,
    roiHighlights: {
      hoursReclaimed:         roiData!.hoursReclaimed,
      focusShift:             roiData!.focusShift,
      productivity_multiplier: roiData!.productivity_multiplier,
      formula:                roiData!.formula,
    },
  };

  return { result };
}

// ─── Build and Export the Graph ───────────────────────────────────────────────

export function createAnalysisGraph() {
  return new StateGraph(GraphState)
    .addNode("parser",           parserNode)
    .addNode("decomposer",       decomposerNode)
    .addNode("parallelAnalysis", parallelAnalysisNode)
    .addNode("roiCalc",          roiNode)
    .addNode("synthesize",       opportunitiesNode)
    .addNode("buildRoadmap",     roadmapNode)
    .addNode("finalise",         finaliseNode)
    .addEdge(START,              "parser")
    .addEdge("parser",           "decomposer")
    .addEdge("decomposer",       "parallelAnalysis")
    .addEdge("parallelAnalysis", "roiCalc")
    .addEdge("roiCalc",          "synthesize")
    .addEdge("synthesize",       "buildRoadmap")
    .addEdge("buildRoadmap",     "finalise")
    .addEdge("finalise",         END)
    .compile();
}

export type { State as GraphStateType };
