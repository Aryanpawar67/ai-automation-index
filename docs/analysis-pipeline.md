# AI Automation Potential Report — Full Pipeline Documentation

> Every agent, every input, every output, every prompt. Start-to-finish.

---

## Table of Contents

1. [What Starts the Engine](#what-starts-the-engine)
2. [Execution Graph](#execution-graph)
3. [Agent 1 — JD Parser](#agent-1--jd-parser)
4. [Agent 2 — Task Decomposer](#agent-2--task-decomposer)
5. [Agent 3 — Task Scorer](#agent-3--task-scorer)
6. [Agent 4 — AI Tools Research](#agent-4--ai-tools-research)
7. [Agent 5 — Skills Analysis](#agent-5--skills-analysis)
8. [Agent 6 — ROI Calculator](#agent-6--roi-calculator)
9. [Agent 7 — Opportunity Synthesizer](#agent-7--opportunity-synthesizer)
10. [Agent 8 — Roadmap Builder](#agent-8--roadmap-builder)
11. [Finalise Node — Assembly](#finalise-node--assembly)
12. [API Route — SSE Streaming](#api-route--sse-streaming)
13. [Batch Mode — Inngest](#batch-mode--inngest)
14. [Supporting Enrichers](#supporting-enrichers)
15. [Scoring Formulas](#scoring-formulas)

---

## What Starts the Engine

### User-Facing Input (Two Fields)

```typescript
{
  jobDescription: string;  // raw JD text, minimum 50 characters
  company?: string;        // optional — used as context in prompts
}
```

This is sent as a `POST /api/analyze` request. The API immediately opens a Server-Sent Events (SSE) stream and the pipeline begins.

### Frontend Call Site
**File:** `src/app/page.tsx`

```typescript
const res = await fetch("/api/analyze", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ jobDescription, company }),
});
```

The frontend reads the SSE stream in real time, updating a progress UI as each agent completes, then on `type: "complete"` stores the result in `sessionStorage` and navigates to `/dashboard`.

### Batch Mode Input (Inngest)
**Event:** `"jd/analyze"`

```typescript
{
  jobDescriptionId: string;  // FK to job_descriptions table
  batchId: string;           // FK to batches table
}
```

The Inngest function reads the raw JD text and company name from the database, then runs the same graph. Output is written back to the `analyses` table.

---

## Execution Graph

**File:** `src/app/api/analyze/graph.ts`

```
                    ┌─────────────────────────────────────────────┐
  jobDescription ──▶│ Agent 1: Parser                             │
  company            └────────────────┬────────────────────────────┘
                                      │ parsedJD
                                      ▼
                    ┌─────────────────────────────────────────────┐
                    │ Agent 2: Decomposer                          │
                    └────────────────┬────────────────────────────┘
                                     │ rawTasks
                          ┌──────────┼──────────┐
                          ▼          ▼           ▼
                    ┌──────────┐ ┌──────────┐ ┌──────────────┐
                    │Agent 3:  │ │Agent 4:  │ │Agent 5:      │
                    │Scorer    │ │Tools     │ │Skills        │
                    │(parallel)│ │Research  │ │Analysis      │
                    └────┬─────┘ └────┬─────┘ └──────┬───────┘
                         │            │               │
                         └────────────┴───────────────┘
                                      │ scoredTasks, toolsMapping, skillsAnalysis
                                      ▼
                    ┌─────────────────────────────────────────────┐
                    │ Agent 6: ROI Calculator                      │
                    └────────────────┬────────────────────────────┘
                                     │ roiData
                                     ▼
                    ┌─────────────────────────────────────────────┐
                    │ Agent 7: Opportunity Synthesizer             │
                    └────────────────┬────────────────────────────┘
                                     │ opportunities
                                     ▼
                    ┌─────────────────────────────────────────────┐
                    │ Agent 8: Roadmap Builder                     │
                    └────────────────┬────────────────────────────┘
                                     │ roadmap
                                     ▼
                    ┌─────────────────────────────────────────────┐
                    │ Finalise Node (assembly, no LLM except Haiku │
                    │ for executiveSummary)                         │
                    └────────────────┬────────────────────────────┘
                                     │ FinalAnalysis
                                     ▼
                              SSE "complete" event
                              (or DB insert in batch mode)
```

**Graph state object** accumulates every agent's output and passes the full state to downstream agents:

```typescript
interface GraphState {
  jobDescription: string;
  company: string;
  parsedJD: ParsedJD;
  rawTasks: RawTask[];
  scoredTasks: ScoredTask[];
  toolsMapping: Record<string, string[]>;
  skillsAnalysis: SkillsAnalysis;
  roiData: ROIData;
  opportunities: Opportunity[];
  roadmap: RoadmapPhase[];
  result: FinalAnalysis;
}
```

---

## Agent 1 — JD Parser

**File:** `src/app/api/analyze/agents/parser.ts`  
**Model:** `claude-sonnet-4-6` (temperature 0)  
**Node label:** "Job Description Analyser"

### Inputs

| Field | Source | Type |
|-------|--------|------|
| `jobDescription` | User input | `string` |
| `company` | User input | `string` (optional) |

### System Prompt

```
You are a precise information extractor. Extract structured data from job descriptions.
Return ONLY valid JSON, no markdown, no explanation.
```

### User Prompt

```
Extract the following from this job description${company ? ` at ${company}` : ""}.

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
}
```

### Output Type — `ParsedJD`

```typescript
{
  jobTitle: string;
  department:
    | "Marketing" | "Engineering" | "Sales" | "HR" | "Finance"
    | "Operations" | "Legal" | "Product" | "Customer Success" | "Data"
    | "Design" | "Security" | "Infrastructure" | "Business Development"
    | "Partnerships" | "Strategy" | "Research" | "Analytics" | "Revenue"
    | "Growth" | "Recruiting" | "Procurement";
  seniority: "junior" | "mid" | "senior" | "lead" | "executive";
  responsibilities: string[];
  requiredSkills: string[];
  toolsMentioned: string[];
  industryContext: string;
  teamContext: string;
}
```

---

## Agent 2 — Task Decomposer

**File:** `src/app/api/analyze/agents/decomposer.ts`  
**Model:** `claude-sonnet-4-6` (temperature 0)  
**Node label:** "Task Decomposer"

### Inputs

| Field | Source | Type |
|-------|--------|------|
| `parsedJD` | Agent 1 output | `ParsedJD` |

Fields used from `parsedJD`: `seniority`, `jobTitle`, `department`, `industryContext`, `responsibilities`, `toolsMentioned`

### System Prompt

```
You are an expert job analyst who breaks roles into discrete, measurable tasks.
Each task must be specific enough to evaluate for AI automation independently.
Return ONLY valid JSON, no markdown, no explanation.
```

### User Prompt

```
Analyze this ${parsedJD.seniority} ${parsedJD.jobTitle} role and decompose it into 6-10 specific, day-to-day executable tasks.

Role context:
- Department: ${parsedJD.department}
- Industry: ${parsedJD.industryContext}
- Responsibilities: ${parsedJD.responsibilities.join("; ")}
- Tools used: ${parsedJD.toolsMentioned.join(", ")}

Rules for task decomposition:
1. Focus on WHAT THE PERSON ACTUALLY DOES DAILY — the concrete, repeatable execution tasks, not high-level accountabilities
2. For technical roles (engineers, developers, analysts): include tasks like writing code, writing tests, writing documentation, code reviews, debugging, writing reports/specs — these are where AI tools provide the most leverage
3. Do NOT create vague strategic tasks like "lead technical direction" or "manage team" unless they represent >20% of actual weekly time
4. Tasks must be specific enough to assess which AI tools could assist (e.g. "Write unit tests for new features" not "ensure code quality")
5. estimatedTimeShare values must sum to exactly 1.0 across all tasks
6. Use your knowledge of this specific role type and seniority to estimate realistic time distributions

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
}
```

### Post-Processing

After LLM response, time shares are renormalized so they sum to exactly 1.0:

```typescript
const totalShare = tasks.reduce((sum, t) => sum + t.estimatedTimeShare, 0);
return tasks.map(t => ({ ...t, estimatedTimeShare: t.estimatedTimeShare / totalShare }));
```

### Output Type — `RawTask[]`

```typescript
{
  name: string;                    // 3–6 words, imperative form
  description: string;             // 1 sentence
  category:
    | "Data Processing" | "Communication" | "Research" | "Reporting"
    | "Creative" | "Strategic" | "Administrative" | "Technical";
  estimatedTimeShare: number;      // 0.0–1.0, sum = 1.0
}[]
```

---

## Agent 3 — Task Scorer

**File:** `src/app/api/analyze/agents/scorer.ts`  
**Model:** `claude-sonnet-4-6` (temperature 0)  
**Node label:** "Task Scoring + Tools Research + Skills Analysis" (runs in parallel with Agents 4 & 5)

### Inputs

| Field | Source | Type |
|-------|--------|------|
| `task` | Agent 2 output (one at a time) | `RawTask` |
| `context` | Agent 1 output | `ParsedJD` |

Each task is scored in a **separate LLM call**. All calls run in parallel via `Promise.allSettled()` so each task gets full model attention.

### System Prompt

```
You are a specialist in AI augmentation assessment with deep knowledge of the 2025-2026 AI tool landscape.
You score tasks using a HITL (Human-In-The-Loop) augmentation scale — not "can AI replace the human" but
"what % of task execution time can AI tools handle, even with human review and approval of outputs."
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
         real-time incident command, board-level strategic decisions)
```

### User Prompt

```
Score the AI augmentation potential of this specific task under a HITL model.

TASK: "${task.name}"
Description: ${task.description}
Category: ${task.category}

Role context:
- Role: ${context.seniority} ${context.jobTitle} in ${context.department}
- Industry: ${context.industryContext}
- Tools used in this role: ${context.toolsMentioned.join(", ")}

IMPORTANT FRAMING: Score how much of this task's EXECUTION TIME can be handled by AI tools with a human
reviewing/approving the output. A senior engineer reviewing AI-generated code, tests, or docs still scores
high because AI does the heavy lifting. Do NOT penalise a task just because it requires expert human
judgment — the question is whether AI tools can draft/execute the bulk of the work.

Ask yourself: "If this person used the best available AI tools for this task today, what % of their
execution time would be saved even if they still approve every output?"

Return:
{
  "automationScore": <integer 0-100 per calibration scale>,
  "automationPotential": <"high" if score>=65, "medium" if 40-64, "low" if <40>,
  "scoringRationale": "2-3 sentences explaining why this score. Reference specific AI tools if they
    exist. Be explicit about what AI handles vs. what the human still reviews/decides.",
  "aiOpportunity": "one sentence: name a specific production-ready AI tool and describe exactly how
    it augments this task (e.g. 'GitHub Copilot generates unit tests and boilerplate, cutting
    implementation time by 60-70% while the engineer reviews for correctness')"
}
```

### Fallback on Error

If an individual task scorer call fails, the task gets mid-range defaults:

```typescript
{
  automationScore: 45,
  automationPotential: "medium",
  scoringRationale: "Score estimated due to processing error.",
  aiOpportunity: "AI tools can assist with this task.",
}
```

### Output Type — `ScoredTask[]`

```typescript
extends RawTask {
  automationScore: number;                        // 0–100
  automationPotential: "high" | "medium" | "low"; // ≥65 = high, 40–64 = medium, <40 = low
  scoringRationale: string;
  aiOpportunity: string;
}
```

---

## Agent 4 — AI Tools Research

**File:** `src/app/api/analyze/agents/toolsResearch.ts`  
**Model:** `claude-sonnet-4-6` (temperature 0)  
**Runs in parallel with Agents 3 & 5**

### Inputs

| Field | Source | Type |
|-------|--------|------|
| `scoredTasks` | Agent 3 output | `ScoredTask[]` |
| `context` | Agent 1 output | `ParsedJD` |

Only tasks with `automationScore >= 40` are sent to the LLM.

### Optional Web Search

If `TAVILY_API_KEY` is set, a web search is run first:

```
Query: "best AI tools for ${context.department} ${context.seniority} 2025 2026"
Results: Appended as searchContext to user prompt (capped at 3000 chars)
```

### System Prompt

```
You are an AI tools expert with deep knowledge of the 2025-2026 enterprise AI landscape.
Your job is to recommend specific, named, production-ready AI tools for workplace tasks.
Return ONLY valid JSON. Only name tools that actually exist.
```

### User Prompt

```
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
}
```

### Tool Lookup Utility

`lookupTools(taskName, toolsMapping)` in `agents/utils.ts` does fuzzy matching at lookup time:
1. Exact string match
2. Normalized match (lowercase, strip punctuation, collapse spaces)
3. Partial substring match

### Output Type

```typescript
Record<string, string[]>
// e.g. { "Write unit tests": ["GitHub Copilot", "CodiumAI", "Tabnine"] }
```

---

## Agent 5 — Skills Analysis

**File:** `src/app/api/analyze/agents/skillsAnalysis.ts`  
**Model:** `claude-sonnet-4-6` (temperature 0)  
**Runs in parallel with Agents 3 & 4**

### Inputs

| Field | Source | Type |
|-------|--------|------|
| `parsedJD` | Agent 1 output | `ParsedJD` |

Fields used: `seniority`, `jobTitle`, `department`, `requiredSkills`, `toolsMentioned`

### Optional Web Search

If `TAVILY_API_KEY` is set:

```
Query: "AI impact on ${context.department} skills jobs 2025 2026"
Results: Appended as searchContext (capped at 3000 chars)
```

### System Prompt

```
You are a workforce transformation expert who advises organizations on how AI will reshape skill requirements.
Your analysis is grounded in current research and the 2025-2026 AI capability landscape.
Return ONLY valid JSON.
```

### User Prompt

```
Classify every skill in this job description into three categories based on AI's impact over the next 3-5 years.

Role: ${parsedJD.seniority} ${parsedJD.jobTitle} in ${parsedJD.department}
Skills to classify: ${parsedJD.requiredSkills.join(", ")}
Tools mentioned: ${parsedJD.toolsMentioned.join(", ")}
${searchContext ? `\nCurrent research on AI impact on these skills:\n${searchContext}\n` : ""}

Classification rules:
- futureProof: Skills that require human judgment, creativity, relationships, or strategic thinking
  that AI cannot replicate. These become MORE valuable as AI handles routine work.
- atRisk: Skills likely to be substantially automated by AI within 3-5 years — routine, rule-based,
  or pattern-matching tasks.
- aiAugmented: Skills that remain important but become dramatically more powerful when paired with
  AI tools. The human + AI combination creates outsized value.

Return skill NAMES ONLY — short labels, no explanations or descriptions appended.
Each entry must be a concise skill name (1-4 words), not a sentence.

{
  "futureProof": ["Skill Name", "Skill Name", ...],
  "atRisk":      ["Skill Name", "Skill Name", ...],
  "aiAugmented": ["Skill Name", "Skill Name", ...]
}
```

### Output Type — `SkillsAnalysis`

```typescript
{
  futureProof: string[];   // skills that become MORE valuable with AI
  atRisk: string[];        // skills likely automated in 3–5 years
  aiAugmented: string[];   // skills more powerful with AI pairing
}
```

---

## Agent 6 — ROI Calculator

**File:** `src/app/api/analyze/agents/roiCalculator.ts`  
**Model:** `claude-haiku-4-5-20251001` (temperature 0) — for focus shift only  
**Node label:** "ROI Calculator"

### Inputs

| Field | Source | Type |
|-------|--------|------|
| `scoredTasks` | Agent 3 output | `ScoredTask[]` |
| `parsedJD` | Agent 1 output | `ParsedJD` |

### Step 1 — Deterministic Math (no LLM)

```typescript
const WORK_HOURS_PER_WEEK = 40;
const EFFICIENCY_FACTOR = 0.65;   // accounts for setup, errors, review overhead
const MAX_HOURS_SAVED = 20;       // realistic ceiling (50% of week)

hoursSavedPerTask = (40 × estimatedTimeShare) × (automationScore / 100) × 0.65

totalHoursSaved = min(Σ hoursSavedPerTask, 20)

multiplier = round((40 + totalHoursSaved) / 40 to nearest 0.5x)

formula = `${totalHoursSaved}h saved / week × 48 weeks = ${annual}h/year ≈ ${fte} FTE`
```

### Step 2 — Focus Shift (LLM)

**System Prompt:**

```
Return ONLY valid JSON with one field. No markdown.
```

**User Prompt:**

```
A ${parsedJD.seniority} ${parsedJD.jobTitle} will reclaim ${mathResult.estimatedHoursSavedPerWeek}h/week
by automating: ${highValueTasks}. What higher-value work can they focus on instead?
Return: { "focusShift": "1-2 sentence answer specific to this role" }
```

Where `highValueTasks` = names of all tasks with `automationScore >= 65`, joined by ", "

### Output Type — `ROIData`

```typescript
{
  estimatedHoursSavedPerWeek: number;   // deterministic math
  productivity_multiplier: string;       // e.g. "1.5x"
  focusShift: string;                    // LLM-generated, 1–2 sentences
  formula: string;                       // human-readable CFO calculation
}
```

---

## Agent 7 — Opportunity Synthesizer

**File:** `src/app/api/analyze/agents/opportunitySynth.ts`  
**Model:** `claude-sonnet-4-6` (temperature 0)  
**Node label:** "Opportunity Synthesizer"

### Inputs

| Field | Source | Type |
|-------|--------|------|
| `scoredTasks` | Agent 3 output | `ScoredTask[]` |
| `toolsMapping` | Agent 4 output | `Record<string, string[]>` |
| `roiData` | Agent 6 output | `ROIData` |
| `parsedJD` | Agent 1 output | `ParsedJD` |

### System Prompt

```
You are a strategic AI transformation advisor who identifies where AI creates the most business value.
You look for opportunities that bundle multiple tasks, leverage existing tools, and create compounding ROI.
Return ONLY valid JSON.
```

### User Prompt

```
Identify the 4-6 highest-value AI opportunities for this role. Think beyond individual tasks —
look for workflow automation clusters.

Role: ${parsedJD.seniority} ${parsedJD.jobTitle}, ${parsedJD.department}
Hours reclaimed target: ${roiData.estimatedHoursSavedPerWeek}h/week

Scored tasks (with available tools):
${scoredTasks.map(t => {
  const tools = lookupTools(t.name, toolsMapping);
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
      "description": "2 sentences: first sentence describes exactly what AI automates and which tool
        handles it; second sentence states the measurable business impact (time saved, quality
        improvement, or risk reduction)",
      "impact": "high" | "medium" | "low",
      "effort": "high" | "medium" | "low",
      "tools": ["specific AI tool names"],
      "estimatedTimeSaving": "X-Y hours/week"
    }
  ]
}
```

### Output Type — `Opportunity[]`

```typescript
{
  title: string;                        // 5–8 words
  description: string;                  // 2 sentences: what AI does + business impact
  impact: "high" | "medium" | "low";
  effort: "high" | "medium" | "low";
  tools: string[];                      // specific named tools
  estimatedTimeSaving: string;          // "X-Y hours/week"
}[]
```

---

## Agent 8 — Roadmap Builder

**File:** `src/app/api/analyze/agents/roadmapBuilder.ts`  
**Model:** `claude-sonnet-4-6` (temperature 0)  
**Node label:** "Roadmap Builder"

### Inputs

| Field | Source | Type |
|-------|--------|------|
| `scoredTasks` | Agent 3 output | `ScoredTask[]` |
| `opportunities` | Agent 7 output | `Opportunity[]` |
| `toolsMapping` | Agent 4 output | `Record<string, string[]>` |
| `roiData` | Agent 6 output | `ROIData` |
| `parsedJD` | Agent 1 output | `ParsedJD` |

### System Prompt

```
You are an AI implementation strategist who designs realistic, phased rollout plans.
Your roadmaps are grounded in what's actually achievable — Phase 1 uses only tools that exist today
and require no custom development.
Return ONLY valid JSON.
```

### User Prompt

```
Build a 3-phase AI implementation roadmap for this role.

Role: ${parsedJD.seniority} ${parsedJD.jobTitle}, ${parsedJD.department}
Target outcome: ${roiData.estimatedHoursSavedPerWeek}h/week reclaimed — ${roiData.focusShift}

Available tools (from research):
${scoredTasks
  .filter(t => t.automationScore >= 40)
  .map(t => {
    const tools = lookupTools(t.name, toolsMapping);
    return `- ${t.name}: ${(tools.length > 0 ? tools : [t.aiOpportunity]).join(", ")}`;
  })
  .join("\n")}

Top opportunities to sequence:
${opportunities.map((o, i) =>
  `${i + 1}. [${o.impact} impact, ${o.effort} effort] ${o.title} — ${o.tools.join(", ")}`
).join("\n")}

Roadmap rules:
- Phase 1 (0-3 months): Only off-the-shelf tools, no custom dev, no workflow redesign.
  Quick wins that build confidence.
- Phase 2 (3-9 months): Integration work, process redesign, training. Medium-effort opportunities.
- Phase 3 (9-18 months): Custom AI workflows, advanced integrations, AI agents.
  High-effort opportunities.
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
}
```

### Output Type — `RoadmapPhase[]`

```typescript
{
  phase: string;     // "Phase 1: Quick Wins" | "Phase 2: Core Automation" | "Phase 3: Advanced AI"
  timeline: string;  // "0-3 months" | "3-9 months" | "9-18 months"
  items: string[];   // 3–5 specific action items, each naming a tool
}[]
```

---

## Finalise Node — Assembly

**File:** `src/app/api/analyze/graph.ts`  
**Model:** `claude-haiku-4-5-20251001` (temperature 0) — executive summary only  
**Node label:** "Finalising Analysis"

This node assembles the `FinalAnalysis` object. No agents are called except one optional Haiku call for the executive summary.

### Inputs (all from prior agents)

All fields from `GraphState` — every agent's output is available.

### Scoring Calculations

```typescript
// Time-weighted average automation score across all tasks
overallAutomationScore = Σ(task.automationScore × task.estimatedTimeShare)

// Weighted score for tasks with score ≥ 40, scaled by 0.85
readyTasks = tasks.filter(t => t.automationScore >= 40)
readyShareTotal = Σ(readyTask.estimatedTimeShare)
aiReadinessScore = (Σ(readyTask.automationScore × readyTask.estimatedTimeShare) / readyShareTotal) × 0.85

// Per-category time-weighted average
automationByCategory = groupBy(tasks, 'category')
  .map(group => ({
    category: group.category,
    score: Σ(task.automationScore × task.estimatedTimeShare) / Σ(task.estimatedTimeShare)
  }))
```

### Executive Summary Prompt

**System:**
```
You write concise, data-driven executive summaries for AI automation assessments.
Return ONLY valid JSON with one key.
```

**User:**
```
Write a 2-3 sentence executive summary for this AI automation assessment.

Role: ${parsedJD.seniority} ${parsedJD.jobTitle}, ${parsedJD.department}
Overall automation score: ${overallAutomationScore}/100
Hours that can be reclaimed: ${roiData.estimatedHoursSavedPerWeek}h/week
Top opportunity: ${opportunities[0]?.title}
Key tools: ${topTools.join(", ")}

Return: { "executiveSummary": "..." }
```

### Final Output Type — `FinalAnalysis`

```typescript
{
  jobTitle: string;
  department: string;
  executiveSummary: string;
  overallAutomationScore: number;       // time-weighted across all tasks
  aiReadinessScore: number;             // weighted for tasks ≥40, × 0.85
  estimatedHoursSavedPerWeek: number;
  tasks: {
    name: string;
    automationScore: number;
    automationPotential: "high" | "medium" | "low";
    category: string;
    aiOpportunity: string;             // first tool from mapping, or scoringRationale fallback
    scoringRationale: string;
  }[];
  aiOpportunities: Opportunity[];
  skillsAnalysis: SkillsAnalysis;
  automationByCategory: { category: string; score: number }[];
  implementationRoadmap: RoadmapPhase[];
  roiHighlights: {
    focusShift: string;
    productivity_multiplier: string;
    formula: string;
  };
}
```

---

## API Route — SSE Streaming

**File:** `src/app/api/analyze/route.ts`  
**Endpoint:** `POST /api/analyze`

### Request

```typescript
{
  jobDescription: string;   // validated: minimum 50 characters
  company?: string;
}
```

### SSE Event Shape

Each event is emitted as:

```
data: <JSON string>\n\n
```

**Progress event** (emitted after each node completes):

```typescript
{
  type: "agent_complete";
  agent: string;            // display label
  step: number;             // 1-indexed
  totalSteps: number;       // always 7
  data: {
    // partial preview fields, depends on which node just finished:
    jobTitle?: string;
    department?: string;
    taskCount?: number;
    taskNames?: string[];
    scoredTaskCount?: number;
    topTask?: string;
    estimatedHoursSavedPerWeek?: number;
    productivity_multiplier?: string;
    opportunityCount?: number;
    topOpportunity?: string;
    phaseCount?: number;
  };
}
```

**Completion event:**

```typescript
{
  type: "complete";
  agent: "Analysis Complete";
  step: 7;
  totalSteps: 7;
  result: FinalAnalysis;    // full result object
}
```

**Error event:**

```typescript
{
  type: "error";
  message: string;
}
```

### Node → Step Mapping

| Step | Node | Label |
|------|------|-------|
| 1 | parser | "Job Description Analyser" |
| 2 | decomposer | "Task Decomposer" |
| 3 | parallelAnalysis | "Task Scoring + Tools Research + Skills Analysis" |
| 4 | roiCalc | "ROI Calculator" |
| 5 | synthesize | "Opportunity Synthesizer" |
| 6 | buildRoadmap | "Roadmap Builder" |
| 7 | finalise | "Finalising Analysis" |

---

## Batch Mode — Inngest

**File:** `src/inngest/analyzeJD.ts`  
**Event:** `"jd/analyze"`  
**Concurrency:** 3 jobs max  
**Retries:** 2

### Input

```typescript
{
  jobDescriptionId: string;   // reads rawText + companyId from DB
  batchId: string;
}
```

### What it does differently from the API route

- Reads `jobDescription` and `company` from the database instead of request body
- Runs the same `createAnalysisGraph()` in stream mode
- Extracts `FinalAnalysis` from the `finalise` node update
- Inserts to `analyses` table:

```typescript
await db.insert(analyses).values({
  jobDescriptionId,
  companyId: jd.companyId,
  result: finalResult,                           // full FinalAnalysis JSON
  overallScore: finalResult.overallAutomationScore,
  hoursSaved: String(finalResult.estimatedHoursSavedPerWeek),
});
```

- Updates `job_descriptions` row status to `"analysed"`
- Updates `batches` row progress counters

---

## Supporting Enrichers

These run outside the main report pipeline — they enrich company/URL metadata, not the JD analysis.

### URL Enricher

**File:** `src/lib/urlEnricher.ts`  
**Model:** `claude-haiku-4-5-20251001`  
**Purpose:** Validates career page URLs and detects ATS platform

**System Prompt:**

```
You are a career page and ATS (Applicant Tracking System) expert.
Given a URL and optional HTML snippet, determine:
1. Is this a legitimate careers/jobs page?
2. Does it show live job openings?
3. Which ATS platform is being used (if detectable)?
4. If the URL seems wrong or broken, what is the most likely correct careers URL?
5. What should the user do next?

Known ATS platforms: workday, greenhouse, lever, oracle_taleo, oracle_hcm, sap_sf, bamboohr,
icims, smartrecruiters, ashby, jobvite, workable, personio, rippling, breezyhr, jazzhr,
cornerstone, adp, pinpoint.

Respond ONLY with valid JSON:
{
  "isCareerPage":     boolean | null,
  "hasLiveJobs":      boolean | null,
  "detectedAts":      string | null,
  "suggestedUrl":     string | null,
  "actionableReason": string,
  "confidence":       "high" | "medium" | "low"
}
```

**User Prompt (dynamic):**

```
URL: ${url}
[Company: ${company}]
Reachable: ${result.reachable}
HTTP status: ${result.httpStatus ?? "unknown"}
Rule-based reason: ${result.reason}
[ATS detected by rules: ${result.detectedAts}]
[Redirected to: ${result.finalUrl}]
[HTML snippet (first 1500 chars): ${trimmed}]
```

---

### Industry Enricher

**File:** `src/lib/industryEnricher.ts`  
**Model:** `claude-haiku-4-5-20251001`  
**Purpose:** Classifies company into an industry sector

**User Prompt:**

```
You are an industry classification specialist.

Classify the company into exactly one industry sector from the list below based on your training knowledge.

Company: ${companyName}
Domain:  ${domain}
${extraContext ? `Context: ${extraContext}` : ""}

Industry list:
${INDUSTRY_TAXONOMY.map(i => `- ${i}`).join("\n")}

Rules:
- Return ONLY valid JSON: {"industry": "Insurance", "confidence": 90}
- confidence = 0–100. If < 50, return {"industry": null, "confidence": 0}
- "Technology" is last resort — IT services / consulting → "Consulting & Professional Services"
- Never guess. If genuinely unknown, return null.
```

---

### HR Stack Enricher

**File:** `src/lib/hrStackEnricher.ts`  
**Model:** `claude-haiku-4-5-20251001`  
**Purpose:** Detects company's ATS, HCM, LXP, HRIS tools from web content

**System Prompt:**

```
You are an HR technology analyst. Given web search results and/or page content below, extract the
HR technology stack for this company.

Return ONLY valid JSON (omit a key entirely if not found, do not guess):
{"ats":{"vendor":"Greenhouse","confidence":90,"source":"career page URL pattern"},"hcm":null,"lxp":null,"hris":null}

Confidence rules:
- 90–100: Explicitly named in a direct quote, URL, or page content for this company
- 70–89:  Mentioned in a review, case study, or press release alongside the company
- 50–69:  Mentioned near the company in context but not directly attributed
- Below 50: Omit the key entirely

Only include vendors you are confident about. Never guess. Never hallucinate vendor names.
Categories:
- ats:  Applicant Tracking System (Greenhouse, Lever, Workday Recruiting, iCIMS, SmartRecruiters, Ashby, Jobvite, BambooHR, Taleo, etc.)
- hcm:  Human Capital Management (Workday HCM, SAP SuccessFactors, Oracle HCM, ADP Workforce Now, etc.)
- lxp:  Learning Experience Platform (Degreed, Cornerstone, LinkedIn Learning, 360Learning, Docebo, etc.)
- hris: HR Information System (BambooHR, Rippling, Gusto, HiBob, Personio, etc.)
```

**User Prompt:**

```
Company: ${companyName}

---

${rawText.slice(0, 8000)}
```

---

## Scoring Formulas

### Task Automation Score (per task, 0–100)

Set by Agent 3 using the HITL calibration scale. Score is the % of task execution time AI can handle even with a human reviewing every output.

### Overall Automation Score (report-level)

```
overallAutomationScore = Σ (task.automationScore × task.estimatedTimeShare)
```

Time-weighted — a task taking 30% of the week counts 3× more than a task taking 10%.

### AI Readiness Score (report-level)

```
readyTasks     = tasks where automationScore ≥ 40
readyShareSum  = Σ readyTask.estimatedTimeShare
aiReadiness    = (Σ(readyTask.automationScore × readyTask.estimatedTimeShare) / readyShareSum) × 0.85
```

The 0.85 factor = conservative discount for real-world friction (change management, adoption).

### Hours Saved Per Week (deterministic)

```
hoursSaved(task) = (40 × estimatedTimeShare) × (automationScore / 100) × 0.65
totalHoursSaved  = min(Σ hoursSaved(task), 20)
```

- `0.65` = efficiency factor (setup, errors, review overhead)
- `20h` = hard ceiling (50% of a 40h week)

### Productivity Multiplier

```
multiplier = round((40 + totalHoursSaved) / 40, to nearest 0.5)
```

Example: 12h saved → (40+12)/40 = 1.3 → rounds to 1.5x
