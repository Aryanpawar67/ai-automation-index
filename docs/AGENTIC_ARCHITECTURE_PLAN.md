# Agentic Architecture Plan — AI Automation Index

---

## Current Architecture: The Problem

The entire analysis today is a **single API call** — one Claude model simultaneously trying to:

1. Parse and understand the job description
2. Extract 6–10 discrete tasks
3. Score each task on automation potential (0–100)
4. Research AI tools for each task
5. Analyze skills (future-proof / at-risk / AI-augmented)
6. Calculate ROI and hours saved
7. Prioritize 4–6 opportunities by impact/effort
8. Build a 3-phase implementation roadmap

That's 8 distinct cognitive jobs crammed into one 8,192-token call. No task gets the focus it deserves. The model has to context-switch constantly, and a failure anywhere kills everything.

```
User Input → [Single Claude Call] → JSON Blob → Dashboard
```

---

## Proposed Architecture: 8 Specialized Agents

Each agent owns exactly one job. They have the right tools, the right context, and the right amount of focus for that job only.

```
                         ┌─────────────────────────────────┐
                         │        ORCHESTRATOR AGENT        │
                         │  (manages flow, retries, merge)  │
                         └─────────────────┬───────────────┘
                                           │
                                    ┌──────▼──────┐
                                    │  JD PARSER  │
                                    │   AGENT 1   │
                                    └──────┬──────┘
                                           │ structured JD
                                    ┌──────▼──────┐
                                    │    TASK     │
                                    │ DECOMPOSER  │
                                    │   AGENT 2   │
                                    └──────┬──────┘
                                           │ task list
                          ┌────────────────┼────────────────┐
                          │ (parallel)     │                 │
                   ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
                   │   SCORING   │  │  AI TOOLS   │  │   SKILLS    │
                   │  AGENTS 3   │  │  RESEARCH   │  │  ANALYSIS   │
                   │ (1 per task)│  │   AGENT 4   │  │   AGENT 5   │
                   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
                          │                │                 │
                          └────────────────┴────────────────┘
                                           │ all scores + tools + skills
                                    ┌──────▼──────┐
                                    │     ROI     │
                                    │  CALCULATOR │
                                    │   AGENT 6   │
                                    └──────┬──────┘
                                           │
                                    ┌──────▼──────┐
                                    │ OPPORTUNITY │
                                    │ SYNTHESIZER │
                                    │   AGENT 7   │
                                    └──────┬──────┘
                                           │
                                    ┌──────▼──────┐
                                    │   ROADMAP   │
                                    │   BUILDER   │
                                    │   AGENT 8   │
                                    └──────┬──────┘
                                           │
                                    ┌──────▼──────┐
                                    │  Dashboard  │
                                    └─────────────┘
```

---

## Agent Specifications

---

### Agent 1 — JD Parser
**Single responsibility:** Understand and structure the raw job description.

| | |
|--|--|
| **Input** | Raw JD text + company name |
| **Output** | `{ jobTitle, department, seniority, responsibilities[], requiredSkills[], toolsMentioned[], teamContext, industryContext }` |
| **Tools** | None |
| **Model** | `claude-haiku-4-5` (fast, cheap — this is pure extraction) |

**Why separate:** Downstream agents receive clean, structured data instead of raw text. Every agent that currently has to re-parse the JD for its context gets this for free.

---

### Agent 2 — Task Decomposer
**Single responsibility:** Break the role into 6–10 specific, scoreable tasks.

| | |
|--|--|
| **Input** | Structured JD from Agent 1 |
| **Output** | `tasks[{ name, category, description, estimatedTimeShare }]` — with % of weekly time estimated per task |
| **Tools** | `web_search` — *"typical daily tasks for [job title] role"* to validate completeness |
| **Model** | `claude-sonnet-4-6` |

**Why separate:** Task quality is the foundation of everything. A bad task list produces bad scores, bad opportunities, and a bad roadmap. This agent can search the web to cross-check whether it's missed any major responsibility area.

---

### Agent 3 — Task Scoring Agents *(run in parallel, one instance per task)*
**Single responsibility:** Score one task on automation potential, deeply and accurately.

| | |
|--|--|
| **Input** | Single task + role context (seniority, industry, department) |
| **Output** | `{ automationScore, automationPotential, scoringRationale, confidenceLevel }` |
| **Tools** | `web_search` — *"AI automation of [task name] [industry] case studies"* |
| **Model** | `claude-sonnet-4-6` |
| **Instances** | One per task, all run in parallel |

**Why separate:** Today, one model scores all tasks sequentially while also thinking about tools, skills, roadmap, and ROI. An agent dedicated to a single task can research real-world automation evidence, apply the calibration scale properly, and produce a `scoringRationale` (visible to users — "we scored this 72 because..."). Parallel execution means 8 tasks are scored simultaneously, not one-after-another.

---

### Agent 4 — AI Tools Research Agent
**Single responsibility:** Find the best, most current AI tools for each automatable task.

| | |
|--|--|
| **Input** | Task list (tasks with automationScore ≥ 40) |
| **Output** | `taskToolMapping[{ taskName, tools[{ name, url, useCase, pricingModel }] }]` |
| **Tools** | `web_search` — *"best AI tools for [task] 2025-2026 enterprise"* |
| **Model** | `claude-sonnet-4-6` |

**Why separate and critical:** Today's tool recommendations come entirely from Claude's training data (knowledge cutoff August 2025). The AI tool landscape changes monthly — new tools launch, others shut down, pricing changes. This agent searches the live web and returns tools that actually exist *right now*, with links. For a customer-facing demo, recommending a tool that no longer exists or has changed significantly is a credibility killer.

---

### Agent 5 — Skills Analysis Agent
**Single responsibility:** Classify every skill in the JD as future-proof, at-risk, or AI-augmented.

| | |
|--|--|
| **Input** | `requiredSkills[]` from Agent 1 |
| **Output** | `{ futureProof[], atRisk[], aiAugmented[] }` with reasoning per skill |
| **Tools** | `web_search` — *"[skill] automation risk workforce research 2025"* |
| **Model** | `claude-sonnet-4-6` |

**Why separate:** Skills analysis requires different reasoning than task scoring — it needs to think about 3–5 year trends, not just current tool availability. Running it in parallel with the scoring agents costs nothing in time and produces a much more researched output.

---

### Agent 6 — ROI Calculator
**Single responsibility:** Compute all numeric ROI outputs with mathematical consistency.

| | |
|--|--|
| **Input** | Scored tasks (with `estimatedTimeShare` from Agent 2) + tools mapping |
| **Output** | `{ estimatedHoursSavedPerWeek, hoursReclaimed, productivityMultiplier, focusShift, annualValueFormula }` |
| **Tools** | None — this is pure calculation |
| **Model** | `claude-haiku-4-5` (math agent, no creativity needed) |

**Why separate:** A dedicated calculation agent uses the `estimatedTimeShare` percentages from Agent 2 to compute hours saved per task, then sums them. This produces mathematically consistent numbers — `hoursReclaimed` *provably equals* `estimatedHoursSavedPerWeek` because the same agent computes both from the same source. Today, those two values are independently hallucinated and frequently mismatch.

**Formula enforced by this agent:**
```
hoursSavedPerTask = (40h × task.estimatedTimeShare) × (task.automationScore / 100) × 0.65
totalHoursSaved   = min(sum(hoursSavedPerTask), 12)   // 30% of 40h cap
productivityMultiplier = (40 + totalHoursSaved) / 40  // rounded to nearest 0.5x
```

---

### Agent 7 — Opportunity Synthesizer
**Single responsibility:** Identify and prioritize the 4–6 highest-ROI AI opportunities.

| | |
|--|--|
| **Input** | Scored tasks + tools mapping + ROI data |
| **Output** | `opportunities[{ title, description, impact, effort, tools[], estimatedTimeSaving }]` sorted by impact/effort |
| **Tools** | None |
| **Model** | `claude-sonnet-4-6` |

**Why separate:** Opportunity identification requires synthesis across tasks, tools, and ROI data. When it's merged with scoring, the model finds shortcuts — it tends to list the highest-scored tasks as the "opportunities" rather than thinking about which *combinations* of tasks could be bundled into a single automation workflow. A dedicated agent can reason at a higher level.

---

### Agent 8 — Roadmap Builder
**Single responsibility:** Produce a phased, sequenced implementation plan.

| | |
|--|--|
| **Input** | All prior agent outputs |
| **Output** | `implementationRoadmap[{ phase, timeline, items[], dependencies[] }]` |
| **Tools** | None |
| **Model** | `claude-sonnet-4-6` |

**Why separate:** The roadmap requires thinking about *sequencing* — which tools to buy first, which process changes to make before automating, which quick wins build organizational confidence. When this is one of 8 jobs in a single call, the roadmap items end up generic. A dedicated agent that receives full context from all prior agents produces a roadmap where Phase 1 items are genuinely available today and Phase 3 items genuinely require Phase 1 and 2 as prerequisites.

---

### Orchestrator — Pipeline Manager
**Single responsibility:** Sequence agents, handle parallelism, retry failures, merge outputs, run consistency checks.

| | |
|--|--|
| **Runs** | Agents 1 → 2 → [3, 4, 5 in parallel] → 6 → 7 → 8 |
| **Handles** | Agent failures (retry with modified prompt), partial results (surface partial dashboard), timeouts |
| **Also does** | Final consistency pass: verifies `hoursReclaimed === estimatedHoursSavedPerWeek`, verifies `automationPotential` matches `automationScore` thresholds |

---

## Execution Timeline Comparison

### Current (sequential, single call)
```
[────────────── One 8-15 second API call ──────────────]
Total: ~10-15 seconds
```

### Agentic (with parallelism)
```
[Agent 1: Parse]      ~1s
[Agent 2: Tasks]      ~2s
[Agent 3: Score ×8]───────────────┐
[Agent 4: Tools]──────────────────┤ all parallel ~4s
[Agent 5: Skills]─────────────────┘
[Agent 6: ROI]        ~1s
[Agent 7: Opportunities] ~2s
[Agent 8: Roadmap]    ~2s
Total: ~12-14 seconds (similar wall-clock, but results stream in progressively)
```

The key UX difference: with agents, the **dashboard fills in progressively** — scores appear as each scoring agent completes, the tools section populates when Agent 4 finishes, the roadmap appears last. The user sees movement instead of a blank screen for 12 seconds.

---

## Benefits: Agentic vs. Current

| Dimension | Current (Single Call) | Agentic |
|-----------|----------------------|---------|
| **Accuracy per section** | Each area gets ~1/8th of the model's focus | Each agent gives 100% focus to its area |
| **Tool recommendations** | Frozen to training cutoff (Aug 2025) | Agent 4 searches the live web — always current |
| **Score consistency** | Manually enforced via prompt rules, still drifts | Agent 6 computes ROI mathematically from Agent 2's time estimates |
| **Error recovery** | One section fails → entire response fails | One agent fails → retry that agent only, rest of dashboard still shows |
| **Auditability** | Black box — you see a number, not why | Each agent returns `scoringRationale`; users can see *why* a task scored 72 |
| **Parallelism** | Sequential inside single call | Agents 3, 4, 5 run simultaneously |
| **Scalability** | Adding a new output section = rewriting the whole prompt | Add a new agent, wire it into the orchestrator |
| **Model selection** | One model size for everything | Haiku for parsing/math (fast + cheap), Sonnet for reasoning |
| **Progressive UX** | Blank screen → full dashboard (all or nothing) | Dashboard fills section by section as agents complete |
| **Skill trend accuracy** | Static reasoning from training data | Agent 5 searches current workforce research papers |
| **Roadmap quality** | Items generated without knowing what tools are actually available | Roadmap agent receives real, searched tools from Agent 4 |
| **Cost** | ~$0.08–0.12 per analysis (single Sonnet call, 8K tokens) | ~$0.06–0.10 per analysis (mix of Haiku for simple agents, shorter Sonnet calls) |

---

## New Output Fields Unlocked by Agents

The agentic approach enables outputs that are impossible in a single call:

```typescript
// Agent 3 adds this to every task — not possible today
scoringRationale: "Scored 78 because HubSpot's AI features (Breeze) already automate
                   80% of this workflow; human review needed for brand voice alignment."

// Agent 4 adds live-searched tools
tools: [
  { name: "HubSpot Breeze", url: "hubspot.com/breeze", pricing: "included in Pro" },
  { name: "Lavender AI",    url: "lavender.ai",        pricing: "$29/mo" }
]

// Agent 2 adds time distribution — enables accurate ROI math
estimatedTimeShare: 0.18  // this task takes ~18% of a 40h week = ~7.2h/week

// Agent 6 produces a formula the CFO can verify
annualValueFormula: "7.2h/week × 78% automation × 65% efficiency × 52 weeks
                     = 189 hours/year reclaimed per employee"
```

---

## Implementation Approach

The agentic pipeline maps directly to the existing Next.js API route. Replace the single `client.messages.create()` call with an orchestrator function:

```
src/app/api/analyze/
  route.ts              ← becomes the orchestrator entry point
  agents/
    parser.ts           ← Agent 1
    decomposer.ts       ← Agent 2
    scorer.ts           ← Agent 3 (called N times in parallel)
    toolsResearch.ts    ← Agent 4
    skillsAnalysis.ts   ← Agent 5
    roiCalculator.ts    ← Agent 6
    opportunitySynth.ts ← Agent 7
    roadmapBuilder.ts   ← Agent 8
  orchestrator.ts       ← pipeline manager
```

The frontend gets a **streaming response** — the orchestrator pushes partial results as each agent completes using Server-Sent Events (SSE), and the dashboard React components render progressively.

---

## Recommended Rollout

**Phase 1 — Foundation (replace single call with sequential agents)**
Wire Agents 1 → 2 → 6 → 7 → 8 sequentially. No parallelism yet, no web search. Get the pipeline working end-to-end.

**Phase 2 — Parallelism**
Add Agents 3, 4, 5 running in parallel after Agent 2. Add streaming to the frontend so users see the dashboard fill in.

**Phase 3 — Web search**
Enable `web_search` tool for Agents 4 and 5. This is the highest-value change — live tool recommendations and current skills research.

**Phase 4 — Transparency layer**
Surface `scoringRationale` per task, tool URLs, and the `annualValueFormula` in the dashboard. This is the feature that moves the tool from *interesting demo* to *credible enterprise product*.

---

*This document is a planning artifact for the AI Automation Index agentic migration.*
*Prepared: March 2026*
