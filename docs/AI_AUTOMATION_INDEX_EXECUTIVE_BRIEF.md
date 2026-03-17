# iMocha AI Automation Index
## Executive Brief — Architecture, Methodology & Calculations

**Audience:** C-Suite & Senior Leadership

---

## What This Tool Does

The iMocha AI Automation Index analyzes any job description and delivers a structured, quantitative assessment of AI automation potential — in under 60 seconds.

**Input:** A job description (paste from any source, any role, any industry)
**Output:** A scored, prioritized action plan covering automation potential per task, specific AI tool recommendations, skills impact analysis, mathematically derived ROI estimates, and a phased implementation roadmap

The system is built on a pipeline of **eight specialized AI agents** — each an expert in one specific aspect of the analysis, running in sequence and in parallel to produce a complete picture of AI opportunity for any role.

---

## How the Pipeline Works

```
Job Description Input
        │
   ┌────▼────────────────────────┐
   │  AGENT 1: JD Parser         │
   └────┬────────────────────────┘
        │
   ┌────▼────────────────────────┐
   │  AGENT 2: Task Decomposer   │
   └────┬────────────────────────┘
        │
        ├──────────────────┬──────────────────┐
        │                  │                  │  ← Parallel execution
   ┌────▼────┐        ┌────▼────┐        ┌────▼────┐
   │AGENT 3  │        │AGENT 4  │        │AGENT 5  │
   │Task     │        │AI Tools │        │Skills   │
   │Scoring  │        │Research │        │Analysis │
   └────┬────┘        └────┬────┘        └────┬────┘
        └──────────────────┴──────────────────┘
        │
   ┌────▼────────────────────────┐
   │  AGENT 6: ROI Calculator    │
   └────┬────────────────────────┘
        │
   ┌────▼────────────────────────┐
   │  AGENT 7: Opportunity       │
   │           Synthesizer       │
   └────┬────────────────────────┘
        │
   ┌────▼────────────────────────┐
   │  AGENT 8: Roadmap Builder   │
   └────┬────────────────────────┘
        │
   Dashboard & Report
```

Agents 3, 4, and 5 run simultaneously — each focused on a separate dimension of the analysis. The total wall-clock time is approximately 30–60 seconds regardless of job description length.

---

## The Eight Agents

---

### Agent 1 — JD Parser

**Responsibility:** Extract clean, structured data from the raw job description before any analysis begins.

Reads the job description and identifies every distinct element: job title, department, seniority level, full list of responsibilities, named skills, software tools mentioned, team context, and industry context. All downstream agents receive this structured data as their input — ensuring a single, consistent interpretation of the role across the entire pipeline.

**Produces:**
- Job title, department, and seniority classification
- Complete responsibilities list
- All named skills and technologies
- Industry and team context

---

### Agent 2 — Task Decomposer

**Responsibility:** Break the role into 6–10 specific, discrete tasks and estimate the time spent on each.

Identifies the distinct tasks that make up the role from the structured JD. Critically, it assigns an `estimatedTimeShare` to each task — the fraction of a standard 40-hour work week that task represents. This time distribution is the data that powers the ROI calculation in Agent 6.

**Produces:**
- 6–10 specific tasks grounded in the job description
- Time distribution across tasks (summing to 100% of a 40h week)
- Task category per task: Data Processing, Communication, Research, Reporting, Creative, Strategic, Administrative, or Technical

---

### Agent 3 — Task Scoring *(runs in parallel)*

**Responsibility:** Score every task on automation potential, with a visible written rationale for each score.

One scoring instance runs per task, all in parallel. Each instance scores a single task on the 0–100 automation scale using the calibrated framework below. Every score is accompanied by a `scoringRationale` — a written explanation of why this score was given, which AI tools apply to this specific task, and where human judgment remains necessary.

**Automation scoring scale:**

| Score | Label | What It Means |
|-------|-------|---------------|
| 85–100 | Fully Automatable | Structured, repetitive, rule-based — no judgment required (e.g. data entry, scheduling, template report generation) |
| 65–84 | Mostly Automatable | AI handles 70%+ with light human review (e.g. routine email drafting, document summarization, research compilation) |
| 45–64 | Significantly Augmented | AI does 50–60%; human provides brand voice or contextual judgment (e.g. content drafting, data analysis with interpretation) |
| 25–44 | AI-Assisted | AI accelerates but human leads all decisions (e.g. strategic planning, stakeholder presentations, negotiations) |
| 0–24 | Primarily Human | Requires nuanced judgment, relationships, or novel thinking (e.g. executive decisions, team leadership, crisis management) |

**Classification thresholds** (enforced mechanically — not left to model interpretation):
- Score ≥ 70 → **High** automation potential
- Score 40–69 → **Medium** automation potential
- Score < 40 → **Low** automation potential

**Produces:**
- Automation score (0–100) per task
- High / Medium / Low classification per task
- Written rationale per score
- Specific AI tool recommendation per task

---

### Agent 4 — AI Tools Research *(runs in parallel)*

**Responsibility:** Identify the most current, production-ready AI tools for every automatable task.

Takes the list of tasks with automation scores ≥ 40 and researches specific AI tools for each. When connected to live web search (via Tavily), this agent queries current sources to ensure tool recommendations reflect what is available today. It returns named, production-ready tools with specific use cases — not generic categories.

**Produces:**
- 2–4 specific, named AI tools per automatable task
- Tools sourced from live web research when available
- Only production-ready tools included

---

### Agent 5 — Skills Analysis *(runs in parallel)*

**Responsibility:** Classify every skill in the job description by its AI vulnerability over the next 3–5 years.

Takes the skills list from Agent 1 and categorizes each into three groups. Where web search is available, it draws on current workforce research to inform its classifications.

| Category | Definition |
|----------|-----------|
| **Future-Proof** | Skills requiring human judgment, creativity, or relationship management that AI cannot replicate — these become *more* valuable as AI handles routine work |
| **At Risk** | Skills likely to be substantially automated within 3–5 years — routine, rule-based, or pattern-matching tasks |
| **AI-Augmented** | Skills that remain important but become dramatically more powerful when combined with AI tools — the human + AI pairing creates outsized output |

**Produces:**
- 3–5 future-proof skills with reasoning
- 3–5 at-risk skills
- 3–5 AI-augmented skills

---

### Agent 6 — ROI Calculator

**Responsibility:** Compute all financial estimates using deterministic mathematics.

This agent does not use a language model for its core calculation. It applies a fixed formula to the task scores (Agent 3) and time estimates (Agent 2) to produce ROI figures that are mathematically verifiable. The full formula is surfaced in the dashboard so any analyst can audit the working.

**The ROI Formula:**

```
For each task:
  Task Hours/Week  = 40h × estimatedTimeShare
  Hours Saved      = Task Hours × (automationScore ÷ 100) × 0.65*

Across all tasks:
  Total Hours Saved = min(Σ Hours Saved, 12h)**

Productivity Multiplier:
  Raw              = (40 + Total Hours Saved) ÷ 40
  Final            = rounded to nearest 0.5x
```

*\* 0.65 efficiency factor accounts for AI error correction, human review overhead, and partial first-year adoption*
*\*\* 12h/week cap reflects a conservative 30% of a 40h week — a realistic first-year estimate*

**Worked example — Senior Marketing Manager:**

```
Email Campaign Management:   40h × 22% × 72% automation × 65% = 2.1h saved
Performance Reporting:       40h × 18% × 88% automation × 65% = 4.1h saved
Market Research Compilation: 40h × 15% × 61% automation × 65% = 2.4h saved
Content Calendar Planning:   40h × 12% × 55% automation × 65% = 1.7h saved
─────────────────────────────────────────────────────────────────────────────
Total: min(10.3h, 12h cap) = 10h/week reclaimed
Productivity Multiplier: (40 + 10) ÷ 40 = 1.25x → displayed as 1.5x
```

**Produces:**
- Hours saved per week (calculated, not estimated)
- Productivity multiplier in "Nx" format
- Full formula breakdown (CFO-verifiable)
- Focus shift — the higher-value work the employee redirects time toward

---

### Agent 7 — Opportunity Synthesizer

**Responsibility:** Identify the 4–6 highest-ROI AI opportunities by reasoning across all prior agent outputs.

Receives the complete output of every prior agent — task scores, tool research, skills analysis, ROI data — and identifies which combinations of tasks and tools create the most business value. It looks for automation clusters: multiple tasks that can be handled by a single tool or workflow, delivering more combined value than each task addressed in isolation.

**Prioritization framework:**

```
Priority 1: High Impact + Low Effort    → Implement immediately
Priority 2: High Impact + High Effort   → Plan and invest
Priority 3: Low Impact + Low Effort     → Quick wins
Priority 4: Low Impact + High Effort    → Deprioritize
```

**Produces:**
- 4–6 prioritized opportunities with specific tool recommendations
- Impact and effort classification per opportunity
- Estimated time saving per opportunity

---

### Agent 8 — Roadmap Builder

**Responsibility:** Produce a phased, sequenced implementation plan grounded in what Agent 4 confirmed is available today.

Takes the full output of all prior agents and sequences implementation across three phases. Phase 1 is constrained to tools that Agent 4 confirmed are available today, require no custom development, and can be adopted without process redesign — ensuring the first phase delivers measurable results within weeks, not months.

| Phase | Timeline | Scope |
|-------|----------|-------|
| Phase 1: Quick Wins | 0–3 months | Off-the-shelf tools only, no custom development, immediate time savings |
| Phase 2: Core Automation | 3–9 months | Integrations, workflow redesign, team training |
| Phase 3: Advanced AI | 9–18 months | Custom AI workflows, advanced integrations, AI agents |

**Produces:**
- 3–5 specific, named action items per phase
- Each item references a specific tool and a specific action

---

## Key Scores — Definitions & Computation

| Score | What It Measures | How It's Computed |
|-------|-----------------|-------------------|
| **Automation Score** | How much of this role's work can AI perform today | Weighted average of all task automation scores (Agent 3) |
| **AI Readiness Score** | How ready this role is to adopt AI tools right now | Average score of automatable tasks × 0.85 readiness factor |
| **Hours Saved / Week** | Weekly hours reclaimed through AI automation | Mathematical formula (Agent 6) — not an estimate |
| **Productivity Multiplier** | How much more output the role can generate | (40 + hours saved) ÷ 40, rounded to nearest 0.5x |
| **Task Potential Label** | High / Medium / Low classification per task | Threshold-enforced: ≥70 High, 40–69 Medium, <40 Low |

---

## Observability

Every agent call is traced to **LangSmith**, providing full operational visibility into every analysis run.

| What Is Recorded | Business Value |
|-----------------|----------------|
| Input and output per agent | Complete audit trail — every score and recommendation is traceable to its source |
| Latency per agent | Performance monitoring at the agent level |
| Token usage per agent | Cost breakdown at the agent level |
| Full execution graph | Visual map of the pipeline for every run |
| Error logs with full context | Root cause analysis if any agent encounters an issue |

Traces are accessible at **smith.langchain.com** under the `ai-automation-index` project.

---

## Applying Results

**Workforce planning:** Roles with Automation Scores above 60% are candidates for redesign — restructuring toward higher-value, human-only responsibilities rather than elimination.

**Technology investment:** AI Readiness Score identifies where AI tooling delivers the fastest returns. High-readiness roles see ROI in weeks; low-readiness roles require data and process groundwork first.

**Change management:** The Skills Analysis drives proactive retraining decisions — building AI-augmented capability before at-risk skills become obsolete.

**Business case (for the CFO):**
```
Annual Value = Hours Saved/Week × 52 weeks × Fully Loaded Hourly Cost × Headcount in Role

Example: 10h/week × 52 × $75/h × 20 employees = $780,000 annual value at stake
```

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Agent orchestration | LangGraph (StateGraph with parallel node execution) |
| AI models | Claude Sonnet 4.6 (reasoning) · Claude Haiku 4.5 (extraction & math) |
| Observability | LangSmith |
| Live web search | Tavily |
| Application | Next.js · Vercel |

---

*iMocha AI Automation Index*
*Powered by Claude Sonnet 4.6 · Orchestrated with LangGraph · Traced with LangSmith*
*March 2026*
