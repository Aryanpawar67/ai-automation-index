/**
 * Agent 1 — JD Parser
 * Model: claude-haiku-4-5 (fast, cheap — pure extraction)
 * Job: Convert raw JD text into clean structured data for all downstream agents.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import type { ParsedJD } from "./types";

let _model: ChatAnthropic | null = null;
const getModel = () => _model ??= new ChatAnthropic({ model: "claude-sonnet-4-6", temperature: 0 });

const parser = new JsonOutputParser<ParsedJD>();

const SYSTEM = `You are a precise information extractor. Extract structured data from job descriptions.
Return ONLY valid JSON, no markdown, no explanation.`;

const PROMPT = (jd: string, company: string) => `Extract the following from this job description${company ? ` at ${company}` : ""}.

<job_description>
${jd}
</job_description>

Return this exact JSON structure:
{
  "jobTitle": "exact title from JD or best inference",
  "department": "one of: Marketing, Engineering, Sales, HR, Finance, Operations, Legal, Product, Customer Success, Data, Design, Security, Infrastructure, Business Development, Partnerships, Strategy, Research, Analytics, Revenue, Growth, Recruiting, Procurement",
  "seniority": "one of: junior, mid, senior, lead, executive",
  "responsibilities": ["list every distinct responsibility as a short phrase"],
  "requiredSkills": ["every named skill, tool, or technology explicitly mentioned"],
  "toolsMentioned": ["every software tool, platform, or technology mentioned by name"],
  "industryContext": "2-sentence description of the industry/business context inferred from the JD",
  "teamContext": "1-sentence description of team size and structure if mentioned, else 'Not specified'"
}`;

export async function runParserAgent(jobDescription: string, company: string): Promise<ParsedJD> {
  const response = await getModel().invoke([
    new SystemMessage(SYSTEM),
    new HumanMessage(PROMPT(jobDescription, company)),
  ]);

  const raw = typeof response.content === "string"
    ? response.content
    : response.content.map(b => (b.type === "text" ? b.text : "")).join("");

  const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
  return parser.parse(cleaned);
}
