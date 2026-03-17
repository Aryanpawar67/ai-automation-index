# AI Automation Index — Methodology & Scoring Guide

**Audience:** C-Suite & Senior Leadership
**Purpose:** Understanding how the tool works, what it measures, and how to interpret results

---

## What This Tool Does

The AI Automation Index analyzes any job description and produces a structured, quantitative assessment of how much of that role can be augmented or automated by AI — and what the organization should do about it.

Input a job description. Get back a scored, prioritized action plan in under 30 seconds.

---

## How It Works

```
Job Description  →  Claude AI Analysis  →  Scored Dashboard
(your input)         (structured reasoning)   (scores, charts, roadmap)
```

The tool is powered by Claude Sonnet 4.6 (Anthropic's enterprise AI model). The analysis is **deterministic** — the same job description will always produce the same output, ensuring consistency across teams and evaluation cycles.

---

## The Scoring System

There are two primary scores per role: **Automation Score** and **AI Readiness Score**.

---

### 1. Automation Score

> *"How much of this role's work can AI perform today?"*

Scored 0–100 per task, then averaged across all tasks in the role.

| Score Range | Label | What It Means | Example Tasks |
|-------------|-------|---------------|---------------|
| 85 – 100 | Fully Automatable | AI can perform with no meaningful human involvement | Data entry, calendar scheduling, standard report generation |
| 65 – 84 | Mostly Automatable | AI handles 70%+ of the work; human does light review | Drafting routine emails, document summarization, web research |
| 45 – 64 | Significantly Augmented | AI does 50–60%; human provides judgment and context | Content drafting, data analysis with interpretation, vendor research |
| 25 – 44 | AI-Assisted | AI accelerates, but human leads | Strategic planning, stakeholder presentations, complex negotiations |
| 0 – 24 | Primarily Human | Requires nuanced judgment, relationships, or novel thinking | Executive decisions, team leadership, client relationship management |

**Formula:**

```
Overall Automation Score = Average of all task Automation Scores

Example:
  Task 1 (Data Reporting)      → Score: 88
  Task 2 (Email Campaigns)     → Score: 72
  Task 3 (Market Research)     → Score: 61
  Task 4 (Vendor Management)   → Score: 35
  Task 5 (Strategy Presentations) → Score: 22
  ──────────────────────────────────────────
  Overall Score = (88 + 72 + 61 + 35 + 22) / 5 = 56
```

Each task is also labeled **High / Medium / Low** based on strict thresholds:

| Label | Threshold |
|-------|-----------|
| High | Score ≥ 70 |
| Medium | Score 40 – 69 |
| Low | Score < 40 |

---

### 2. AI Readiness Score

> *"How ready is this role — practically — to adopt AI tools right now?"*

Scored 0–100 based on four equally weighted factors:

| Factor | What It Measures |
|--------|-----------------|
| **Tool Maturity** | Are enterprise-grade, production-ready AI tools available for this task today? |
| **Data Structure** | Is the task's input and output structured enough for AI to process reliably? |
| **Output Verifiability** | Can a human easily review and validate what the AI produces? |
| **Process Standardization** | Is the task well-defined enough that AI can follow a consistent, repeatable process? |

```
AI Readiness Score = Average of four factor scores (each 0–100)
```

A high Automation Score with a low Readiness Score means the opportunity is significant but requires groundwork (data cleanup, process documentation, tool procurement) before implementation.

---

### 3. Hours Saved Per Week

> *"How many hours per week would AI realistically save in this role?"*

This is a **conservative, first-year estimate**. The model accounts for:
- Setup and configuration time
- AI error correction and review overhead
- Partial adoption (not all tasks automated simultaneously)

**Constraints applied:**

```
Maximum hours saved = 30% of a 40-hour work week = 12 hours/week cap

Realistic savings = Automation Score of high-potential tasks
                    × Time currently spent on those tasks
                    × 0.70 efficiency factor (accounts for overhead)
```

This is intentionally conservative. Overstating savings is the fastest way to lose organizational trust in an AI initiative.

---

## Key Outputs Explained

### Task Breakdown
Every task extracted from the job description is scored individually. This allows managers to understand *which* parts of a role to automate first, rather than treating the role as a monolith.

### AI Opportunities
The 4–6 highest-impact opportunities are ranked by the following matrix:

```
Priority 1: High Impact + Low Effort   (do first)
Priority 2: High Impact + High Effort  (plan and invest)
Priority 3: Low Impact + Low Effort    (quick wins)
Priority 4: Low Impact + High Effort   (deprioritize)
```

Each opportunity includes specific, real AI tools available today — not hypothetical future technology.

### Skills Analysis
Tasks are classified into three categories:

| Category | Definition |
|----------|-----------|
| **Future-Proof** | Skills AI cannot replace; remain differentiating |
| **At Risk** | Skills likely automated within 3–5 years |
| **AI-Augmented** | Skills that become significantly more powerful when combined with AI |

### Implementation Roadmap
A three-phase plan grounded in time-to-value:

| Phase | Timeline | Focus |
|-------|----------|-------|
| Phase 1: Quick Wins | 0–3 months | High-automation, low-effort tasks with available tools |
| Phase 2: Core Automation | 3–9 months | Process redesign and tool integration for mid-complexity tasks |
| Phase 3: Advanced AI | 9–18 months | Agentic workflows, custom models, and cross-functional automation |

### ROI Highlights
Three summary metrics for executive review:

- **Hours Reclaimed** — Weekly hours saved per employee in this role
- **Productivity Multiplier** — How much more output the role can generate on its highest-value work (e.g. "2x on strategic analysis")
- **Focus Shift** — The higher-value work the employee can redirect their time toward

---

## What Makes This Analysis Reliable

| Design Choice | Why It Matters |
|---------------|----------------|
| **Deterministic model** (`temperature: 0`) | Same job description → same scores every time. Comparable across roles and departments. |
| **Calibrated scoring scale** | Scores are anchored to real-world examples, not arbitrary numbers. |
| **Internal consistency enforcement** | The overall score is mathematically derived from task scores. Hours saved in the summary equals hours saved in the detail view. Labels always match scores. |
| **Conservative hours estimate** | Capped at 12h/week to prevent overpromising and ensure credibility with frontline teams. |
| **Real tools only** | Every recommendation references a named, available product — not vague "AI solutions." |

---

## How to Use Results in Decision-Making

**For workforce planning:** Use the Automation Score to identify roles with >60% automation potential as candidates for redesign or reallocation — not elimination, but restructuring toward higher-value work.

**For technology investment:** Use the AI Readiness Score to sequence tool investments. High-readiness, high-automation roles deliver the fastest ROI and the lowest implementation risk.

**For change management:** Use the Skills Analysis to proactively retrain employees in AI-augmented skills before the at-risk skills become obsolete.

**For the CFO:** `Hours Saved × Fully Loaded Hourly Cost × Number of Employees in Role = Annual Value at Stake`

---

*AI Automation Index — Powered by Claude Sonnet 4.6 (Anthropic)*
*Analysis reflects the current AI tool landscape as of 2025–2026*
