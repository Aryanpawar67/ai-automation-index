# LangGraph Agent Pipeline — Quality Audit

> **Status:** Updated — additional findings incorporated from prospect data review (2026-03-24)
> **Last updated:** 2026-03-24
> **Audited by:** Code + prompt inspection across all 8 agents + prospect Excel analysis

---

## Overview

The pipeline processes one job description through 8 sequential/parallel agents.
Agent 1 (Parser) is the **single source of truth** for all downstream agents — every structural break there cascades through the entire analysis.

```
rawText ──► Agent 1 (Parser/Haiku)
               │ ParsedJD
               ▼
           Agent 2 (Decomposer/Sonnet)
               │ RawTask[]
               ▼
    ┌──────────┼──────────┐
    ▼          ▼          ▼
Agent 3    Agent 4    Agent 5
(Scorer)  (Tools)  (Skills)
    └──────────┼──────────┘
               ▼
           Agent 6 (ROI — pure math)
               ▼
           Agent 7 (Opportunities/Sonnet)
               ▼
           Agent 8 (Roadmap/Sonnet)
               ▼
           finalise (math + Haiku summary)
```

---

## Severity Levels

| Level | Meaning |
|---|---|
| 🔴 Critical | Pipeline produces wrong/fabricated output — affects every analysis |
| 🟠 High | Significant quality degradation for a large subset of JDs |
| 🟡 Medium | Inconsistency or edge-case failure with measurable impact |
| 🟢 Low | Polish / minor improvement |

---

## Agent 1 — Parser (`agents/parser.ts`)

**Model:** `claude-haiku-4-5-20251001`
**Input:** `rawText` (up to 8,000 chars) + `company` string
**Output:** `ParsedJD` — foundation for all downstream agents

### 🔴 Break 1: Greenhouse API content is raw HTML

**Location:** `scrapeGreenhouse()` in `scraper.ts`, then `analyzeJD.ts` → `graph.stream`

Greenhouse API returns `job.content` as full HTML (`<p>`, `<ul>`, `<li>`, `<strong>`, `<br/>` tags). This is stored directly as `rawText` with no sanitisation. Agent 1 then extracts responsibilities and skills from HTML-polluted text.

**Consequence:** Responsibilities array contains raw HTML fragments instead of clean phrases. Every downstream agent (Decomposer, Scorer, Skills) receives corrupted structured data.

**Example (actual Greenhouse response):**
```html
<p>You will:</p><ul><li>Acquire and grow new business</li><li>Own the full sales cycle</li></ul>
```
**What Agent 1 extracts:** `["<li>Acquire and grow new business</li>", "<li>Own the full sales cycle</li>"]`

**Fix needed:** Strip HTML to plain text before storing `rawText` (in `scrapeGreenhouse`) or before passing to the pipeline.

---

### 🔴 Break 2: Company name hardcoded as empty string

**Location:** `analyzeJD.ts` line ~31

```ts
const graphStream = await graph.stream(
  { jobDescription: jd.rawText, company: "" },  // ← always blank
```

The `company` field in the state is never populated despite being available in the DB (`jd.companyId` → `companies.name`). Agent 1's prompt uses it:
```
"Extract from this job description at ${company}"
```
With company always blank, agents lose brand/industry context that would meaningfully sharpen department inference, seniority calibration, and tool recommendations.

**Fix needed:** Query company name and pass it: `{ jobDescription: jd.rawText, company: company.name }`.

---

### 🔴 Break 3: Haiku used for most critical extraction step

Agent 1 is the single point of failure for the entire 8-agent pipeline. Its output — `responsibilities[]`, `requiredSkills[]`, `toolsMentioned[]` — is used by every subsequent agent. Yet it uses the smallest, fastest model (`claude-haiku-4-5`) optimised for speed and cost, not extraction accuracy.

For dense JDs (8,000 chars, multi-section format with requirements vs. responsibilities vs. nice-to-haves), Haiku misses nuanced responsibilities, conflates required vs. preferred skills, and produces shallow tool lists. All 7 downstream agents then work from degraded input.

**Fix needed:** Upgrade Agent 1 to `claude-sonnet-4-6`. Parser runs once per JD — the cost difference is negligible versus the quality gain for all 7 downstream agents.

---

### 🟠 Break 4: Department list missing ~8 real-world categories

**Location:** `parser.ts` prompt

```
"one of: Marketing, Engineering, Sales, HR, Finance, Operations, Legal, Product, Customer Success, Data, Design"
```

**Missing categories:** `Security`, `Infrastructure`, `Business Development`, `Partnerships`, `Strategy`, `Research`, `Analytics`, `Revenue`, `Growth`, `Recruiting`, `Procurement`.

When a JD doesn't fit the list, Haiku picks the nearest wrong bucket. `department` is used in:
- Decomposer prompt (role context)
- Scorer prompt (industry calibration)
- Skills analysis prompt (workforce framing)
- Executive summary (Haiku)

One wrong department label corrupts the context for 5+ agents.

**Fix needed:** Expand the allowed list to include the missing categories.

---

### 🟡 Break 5: No separation of required vs. preferred skills

The parser extracts a flat `requiredSkills[]` list with no distinction between:
- Hard requirements ("5+ years Salesforce experience")
- Preferred qualifications ("Nice to have: Tableau")
- Implicit expectations ("strong communication skills")

All three end up in the same array. Agent 5 (Skills Analysis) then classifies "nice to have" skills with the same weight as hard requirements — the `atRisk` and `futureProof` lists are diluted.

**Fix needed:** Add `preferredSkills[]` to `ParsedJD` type and extract separately.

---

## Agent 2 — Decomposer (`agents/decomposer.ts`)

**Model:** `claude-sonnet-4-6`
**Input:** `ParsedJD`
**Output:** `RawTask[]` with `estimatedTimeShare` per task

### 🟠 Break 1: Empty responsibilities array → hallucinated tasks

If Agent 1 failed to extract responsibilities (HTML noise, sparse JD, or extraction error), the decomposer receives:

```
Responsibilities:
Tools used:
```

With no grounding data, Sonnet produces plausible-sounding but entirely fabricated generic tasks for the job title — "Manage stakeholder communications", "Prepare reports", "Coordinate with cross-functional teams". These get scored and produce realistic-looking but meaningless automation analysis.

**Fix needed:** Guard in decomposer — if `parsedJD.responsibilities.length === 0`, throw an error rather than hallucinating tasks.

---

### 🟡 Break 2: Uniform `estimatedTimeShare` values normalised to appear valid

The normalization step masks when the LLM returns identical or near-identical shares:

```ts
// If LLM returns [0.1, 0.1, 0.1, 0.1, 0.1, 0.1] for 6 tasks:
// After normalization: [0.167, 0.167, 0.167, 0.167, 0.167, 0.167]
// Looks mathematically correct — but all weights are invented equally
```

The ROI calculator multiplies time shares by automation scores. Uniform shares produce artificially compressed ROI numbers — all tasks contribute equally, which is never true for real roles.

**Fix needed:** Add variance validation — if all shares are within ±0.02 of each other, flag or reject the decomposition.

---

## Agent 3 — Scorer (`agents/scorer.ts`)

**Model:** `claude-sonnet-4-6` (one call per task, parallel)
**Input:** One `RawTask` + `ParsedJD` context
**Output:** `automationScore`, `automationPotential`, `scoringRationale`, `aiOpportunity`

### 🟡 Break 1: Threshold inconsistency between system prompt and code

System prompt defines `"high"` as score ≥65:
```
65-84  → Mostly automatable: AI handles 70%+ with light human review
```

But enforcement code uses ≥70:
```ts
const potential =
  scored.automationScore >= 70 ? "high" :
  scored.automationScore >= 40 ? "medium" : "low";
```

Scores 65–69 will have a model rationale saying "high automation potential" but display as `medium` on the dashboard. Creates a visible contradiction between the score, badge, and written rationale.

**Fix needed:** Align the code threshold to match the calibration scale (change `>= 70` to `>= 65`), or update the system prompt to say 70.

---

### 🟡 Break 2: Failed scorer silently injects `50/medium` into overall score

```ts
// Fallback for failed API call:
return {
  automationScore: 50,
  automationPotential: "medium",
  scoringRationale: "Score unavailable due to an error.",
  aiOpportunity: "See general AI automation tools.",
};
```

50 is mid-range and affects the weighted `overallAutomationScore` materially. If 2-3 tasks fail (timeout, rate limit, parse error), the final score and hours-saved calculation are silently wrong with no visible signal to the user.

**Fix needed:** Surface failures visibly rather than injecting a default. Either throw (causing the whole JD to retry) or mark the task clearly as `error` so the dashboard can exclude it from the overall score.

---

## Agent 4 — Tools Research (`agents/toolsResearch.ts`)

**Model:** `claude-sonnet-4-6` + optional Tavily
**Input:** `ScoredTask[]` (score ≥40) + `ParsedJD`
**Output:** `toolsMapping: Record<string, string[]>` — task name → tool names

### 🟡 Break 1: Exact-string task name lookup fails consistently

`toolsMapping` keys are generated by Agent 4's LLM. Task names are generated by Agent 2's LLM. They rarely match exactly:

- Agent 2 produces: `"Manage Pipeline Updates"`
- Agent 4 keys as: `"Pipeline Management"`
- Lookup: `toolsMapping["Manage Pipeline Updates"]` → `undefined`

This fallback chain in Agents 7 and 8:
```ts
const tools = toolsMapping[t.name] ?? [];
// → empty array → falls back to t.aiOpportunity (single sentence, not tool names)
```

Agents 7 (Opportunities) and 8 (Roadmap) then list no specific tools for those tasks — producing generic recommendations instead of named tool integrations.

**Fix needed:** Fuzzy/normalised key matching, or pass task names explicitly to Agent 4 and require exact key echo-back.

---

## Agent 5 — Skills Analysis (`agents/skillsAnalysis.ts`)

**Model:** `claude-sonnet-4-6` + optional Tavily
**Input:** `ParsedJD.requiredSkills[]`, `ParsedJD.toolsMentioned[]`
**Output:** `{ futureProof[], atRisk[], aiAugmented[] }`

### 🟠 Break 1: Runs on empty skill list — produces fabricated classifications

If Agent 1 extracted zero skills (common with HTML-polluted Greenhouse content):
```
Skills to classify:
Tools mentioned:
```

The model classifies generic skills for the role archetype (inferred from job title alone) rather than skills actually listed in this specific JD. The dashboard shows a credible-looking skills breakdown that is entirely fabricated.

**No guard exists** — no check for `requiredSkills.length === 0` before running.

**Fix needed:** Guard + early return with empty classification if both `requiredSkills` and `toolsMentioned` are empty.

---

## Agent 6 — ROI Calculator (`agents/roiCalculator.ts`)

**Model:** Pure math + one Haiku call for `focusShift`
**Input:** `ScoredTask[]` + `ParsedJD`
**Output:** `ROIData`

### 🟡 Break 1: Flat cap and efficiency factor applied uniformly across all role types

```ts
const EFFICIENCY_FACTOR = 0.65;  // same for every role
const MAX_HOURS_SAVED   = 12;    // hard cap for every role
```

A junior data processing analyst doing bulk CSV work has fundamentally different automation ceiling than a senior enterprise account executive. The flat 12h/week cap and 65% efficiency factor produce compressed, homogeneous numbers across entirely different role types — every analysis "saves 5-12 hours/week" regardless of actual role composition.

**Fix needed:** Introduce seniority-based and category-based modifiers. Example: `junior` + high `Data Processing` task mix → higher efficiency ceiling; `executive` + high `Strategic` task mix → lower ceiling.

---

## Agents 7 & 8 — Opportunities + Roadmap

These agents are structurally sound but inherit all of the above issues. Their output quality is directly correlated to the quality of `ParsedJD`, `scoredTasks`, and `toolsMapping` fed to them.

### 🟢 Minor: `estimatedTimeSaving` has no normalised format

Agent 7 returns this as a freeform string — sometimes `"2-3 hours/week"`, sometimes `"~2h"`, sometimes `"3 hours per week"`. No parsing issues, but the dashboard should normalise display.

---

## Consolidated Findings

| # | Agent | Severity | Issue | Impact |
|---|---|---|---|---|
| 1 | Parser (A1) | 🔴 Critical | Greenhouse HTML in `rawText` — tags in extracted responsibilities | All downstream agents receive corrupted structured data |
| 2 | Parser (A1) | 🔴 Critical | `company: ""` hardcoded — no brand/industry context | Loses context that sharpens 5+ agents |
| 3 | Parser (A1) | 🔴 Critical | Haiku on most critical extraction step | Misses nuanced responsibilities, shallow tool lists |
| 4 | Parser (A1) | 🟠 High | Department list missing ~8 real-world categories | Wrong department corrupts context for 5+ agents |
| 5 | Parser (A1) | 🟡 Medium | No separation of required vs. preferred skills | `atRisk`/`futureProof` classification diluted |
| 6 | Decomposer (A2) | 🟠 High | Empty `responsibilities[]` → hallucinated tasks | Entire analysis fabricated from job title alone |
| 7 | Decomposer (A2) | 🟡 Medium | Uniform `estimatedTimeShare` normalised silently | ROI math produces compressed uniform numbers |
| 8 | Scorer (A3) | 🟡 Medium | 65 vs 70 threshold — rationale contradicts badge | Visible contradiction on dashboard |
| 9 | Scorer (A3) | 🟡 Medium | Silent `50/medium` fallback on API failure | Overall score silently wrong |
| 10 | Tools (A4) | 🟡 Medium | Exact-string task name lookup fails often | Agents 7 & 8 lack tool names for many tasks |
| 11 | Skills (A5) | 🟠 High | No guard for empty skill list — fabricated output | Skills dashboard shows invented classifications |
| 12 | ROI (A6) | 🟡 Medium | Flat 12h cap + 0.65 efficiency for all roles | Homogeneous ROI numbers across very different roles |
| 13 | Opps/Roadmap (A7/A8) | 🟢 Low | `estimatedTimeSaving` freeform string | Dashboard display inconsistency |

---

## Additional Findings — Prospect Data Review (2026-03-24)

Sourced from `imocha_prospects_careers_updated.xlsx` (2,460 companies, Q4 2025–Q1 2026).

### Finding A: Scraper input quality is worse than originally estimated for enterprise HCM

The Excel file's `Job 1–10` columns contain what the existing scraper collected from each career page. For all Workday, Oracle HCM, and SAP SuccessFactors companies in the prospect list, the scraped content is **entirely non-JD data**:

| Company | Platform | What was scraped |
|---|---|---|
| Comcast | Workday | `"AnalyticsSee all 9 open rolesof Analytics Jobs9"` |
| Valmet | Workday | `"中文 - Chinese"`, `"Deutsch - German"` (language selector) |
| BD | Workday | `"Don't Miss Out"`, `"First Name"`, `"Email Address"` (newsletter form) |
| MiQ Digital | Workday | `"OPENROLES"`, `"Atlanta"`, `"Bengaluru"` (location filters) |
| JPMorgan | Oracle HCM | `"Work with us"`, `"Grow with us"`, `"How we hire"` (nav links) |
| Humber College | Oracle Taleo | `"all available jobs"`, `"Academic Administration"` (category filters) |

This confirms that **Tier 2 (static HTML) is completely ineffective for all three enterprise platforms** — they are all JS-rendered SPAs. The LangGraph pipeline has been receiving navigation labels, form fields, and location filters as "job descriptions", explaining the garbage analysis outputs observed.

This elevates the Workday/Oracle/SAP scraping plan from a new feature to a **prerequisite for any real data quality** from the prospect list.

### Finding B: 90.6% of companies have no ATS detected

Only 230 of 2,460 companies have a value in the `HCM / HRIS / ATS` column. The other 2,230 are either: (a) using an unknown or undetected ATS, (b) using a fully custom career page, or (c) have no career page at all.

**Impact on audit:** Agent 1 Break 3 (Haiku on critical extraction) is more urgent than previously assessed. For the ~2,000 companies without known ATS, the pipeline relies entirely on Tier 2 static scraping followed by Agent 1 parsing arbitrary HTML-stripped body text. The extraction quality from unstructured pages is even lower than from structured ATS content — upgrading Agent 1 to Sonnet directly improves quality for this majority case.

### Finding C: HTML in rawText is confirmed for all Tier 1 sources

Greenhouse (already confirmed), and the SAP SuccessFactors API (confirmed from API documentation), both return job descriptions as rich HTML in the `description`/`content` field. Workday individual job pages are SSR HTML pages. Oracle HCM REST API returns HTML in the `JobPostingDescription` field.

**Impact on audit:** 🔴 Break 1 (HTML in rawText) is not limited to Greenhouse — it applies to **all four Tier 1 scrapers** (Greenhouse, Lever content fields, and all three new enterprise platforms). A shared `stripHtml()` utility applied at the scraper level before storage fixes this globally.

### Finding D: `company` field context is available but never passed

The prospect data confirms company names, headquarters, industry verticals, and employee sizes are available in the Excel. The `company: ""` bug (Break 2) means Agent 1 lacks this context even though it's stored in the `companies` table. Passing the company name (and optionally employee size / HQ location) would meaningfully ground Agent 1's department inference and industry context extraction for all companies in the prospect list.

### Updated Priority Order (incorporating new findings)

| Priority | Fix | Why |
|---|---|---|
| **1** | `stripHtml()` utility applied before storing `rawText` | Fixes Break 1 for ALL Tier 1 sources — Greenhouse, Lever, Workday, Oracle, SAP SF |
| **2** | Workday/Oracle/SAP Tier 1 scrapers | Prerequisite for any quality analysis on the 85 prospect companies using these platforms |
| **3** | Pass `company.name` to `graph.stream()` | One-line fix, improves all 2,460 companies |
| **4** | Upgrade Agent 1 to Sonnet | Most critical for the 2,000+ companies with no known ATS (unstructured input) |
| **5** | Expand department list | Affects all companies |
| **6** | Guard empty `responsibilities[]` in Agent 2 | Prevents hallucination when Break 1 or Break 4 causes empty extraction |
| **7** | Guard empty `requiredSkills[]` in Agent 5 | Same trigger as above |
| **8** | Fix scorer threshold (65 vs 70) | Dashboard consistency |
| **9** | Fix tool name exact-match lookup | Agents 7 & 8 tool attribution |
| **10** | Role-type modifiers in ROI calculator | Accuracy for senior/executive roles |

---

## Proposed Fix Priority Order

1. Strip HTML from `rawText` before storing (fixes Break 1 at source)
2. Pass `company.name` into `graph.stream()` (one-line fix, high leverage)
3. Upgrade Agent 1 to Sonnet (one-line fix, highest quality ROI)
4. Expand department list in parser prompt
5. Add empty-array guards in Agent 2 and Agent 5
6. Fix scorer threshold alignment (65 vs 70)
7. Fix tool name lookup (normalise keys or echo exact names)
8. Introduce role-type modifiers in ROI calculator
