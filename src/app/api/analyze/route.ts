/**
 * POST /api/analyze
 *
 * Runs the 8-agent LangGraph pipeline and streams SSE events back to the client.
 * Each node completion sends an event so the frontend can update the progress UI.
 *
 * LangSmith tracing: set LANGCHAIN_TRACING_V2=true + LANGCHAIN_API_KEY in .env.local
 * Every agent call is automatically traced to LangSmith when these vars are set.
 */

import { NextRequest } from "next/server";
import { createAnalysisGraph } from "./graph";

// Node name → display label for the progress UI
const NODE_LABELS: Record<string, string> = {
  parser:           "Job Description Analyser",
  decomposer:       "Task Decomposer",
  parallelAnalysis: "Task Scoring + Tools Research + Skills Analysis",
  roiCalc:          "ROI Calculator",
  synthesize:       "Opportunity Synthesizer",
  buildRoadmap:     "Roadmap Builder",
  finalise:         "Finalising Analysis",
};

const TOTAL_STEPS = Object.keys(NODE_LABELS).length;

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        const { jobDescription, company } = await req.json();

        if (!jobDescription || jobDescription.trim().length < 50) {
          send({ type: "error", message: "Job description is too short." });
          controller.close();
          return;
        }

        if (!process.env.ANTHROPIC_API_KEY) {
          send({ type: "error", message: "ANTHROPIC_API_KEY not configured." });
          controller.close();
          return;
        }

        const graph = createAnalysisGraph();
        let step = 0;

        // Stream graph updates — each completed node triggers an event
        const graphStream = await graph.stream(
          { jobDescription, company: company ?? "" },
          { streamMode: "updates" }
        );

        for await (const update of graphStream) {
          const nodeUpdate = update as Record<string, Record<string, unknown>>;
          const nodeName = Object.keys(nodeUpdate)[0];
          if (!nodeName || nodeName === "__end__") continue;

          step += 1;
          const label = NODE_LABELS[nodeName] ?? nodeName;
          const nodeOutput = nodeUpdate[nodeName] ?? {};

          if (nodeName === "finalise" && nodeOutput.result) {
            // Final node — send the complete result
            send({
              type: "complete",
              agent: label,
              step,
              totalSteps: TOTAL_STEPS,
              result: nodeOutput.result,
            });
          } else {
            // Intermediate node — send progress event with partial data
            send({
              type: "agent_complete",
              agent: label,
              step,
              totalSteps: TOTAL_STEPS,
              data: buildPartialData(nodeName, nodeOutput),
            });
          }
        }
      } catch (err: unknown) {
        console.error("Analysis pipeline error:", err);
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Analysis failed. Please try again.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection":    "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

/** Extract preview-friendly partial data per node for the progress UI */
function buildPartialData(nodeName: string, nodeOutput: Record<string, unknown>): Record<string, unknown> {
  switch (nodeName) {
    case "parser":
      return {
        jobTitle:   (nodeOutput.parsedJD as { jobTitle?: string })?.jobTitle,
        department: (nodeOutput.parsedJD as { department?: string })?.department,
      };
    case "decomposer":
      return {
        taskCount: (nodeOutput.rawTasks as unknown[])?.length,
        taskNames: (nodeOutput.rawTasks as Array<{ name: string }>)?.map(t => t.name),
      };
    case "parallelAnalysis":
      return {
        scoredTaskCount: (nodeOutput.scoredTasks as unknown[])?.length,
        topTask: (nodeOutput.scoredTasks as Array<{ name: string; automationScore: number }>)
          ?.sort((a, b) => b.automationScore - a.automationScore)[0]?.name,
      };
    case "roiCalc":
      return {
        hoursReclaimed:         (nodeOutput.roiData as { hoursReclaimed?: number })?.hoursReclaimed,
        productivity_multiplier: (nodeOutput.roiData as { productivity_multiplier?: string })?.productivity_multiplier,
      };
    case "synthesize":
      return {
        opportunityCount: (nodeOutput.opportunities as unknown[])?.length,
        topOpportunity:   (nodeOutput.opportunities as Array<{ title: string }>)?.[0]?.title,
      };
    case "buildRoadmap":
      return {
        phaseCount: (nodeOutput.roadmap as unknown[])?.length,
      };
    default:
      return {};
  }
}
