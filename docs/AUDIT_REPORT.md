# Codebase Audit Report
**Date:** 2026-03-17
**Scope:** Full source audit — agents, graph orchestrator, API route, frontend pages, components, types, config
**Build status at audit time:** ✅ Clean (zero TypeScript errors, zero build warnings)

---

## Summary

| # | Severity | Category | File(s) | Status |
|---|----------|----------|---------|--------|
| 1 | **Medium** | Bug | `src/app/page.tsx` | Pending |
| 2 | Low | Bug | `src/app/dashboard/page.tsx` | Pending |
| 3 | Low | Duplication | `agents/toolsResearch.ts`, `agents/skillsAnalysis.ts` | Pending |
| 4 | Low | Dead code | `agents/types.ts` | Pending |
| 5 | Low | Stale types | `agents/types.ts` | Pending |
| 6 | Low | Unused dep | `package.json` | Pending |
| 7 | Low | Redundant logic | `graph.ts`, `agents/toolsResearch.ts` | Pending |

---

## Findings

---

### 1 · Progress state not reset on mid-stream error
**Severity:** Medium
**File:** `src/app/page.tsx` — `handleAnalyze()`, error branches at lines 119-123 and 160-163
**Task:** #1

**Description**
When an SSE `error` event arrives mid-stream, or when the `fetch` itself throws, the handler calls `setIsAnalyzing(false)` but does **not** reset `stepStatuses`, `stepData`, or `completedSteps`. On a retry the progress panel is hidden (correct) but all three state slices carry over stale values from the previous run. When `isAnalyzing` becomes `true` again on the retry they immediately render the old state until individual agents overwrite them.

**Risk**
Users who hit an error and retry immediately will see the previous run's agent statuses flicker in — potentially showing "complete" agents that haven't actually run yet in the new request. This can look like a UI freeze or fake progress.

**Fix**
In both error exit paths, add:
```ts
setStepStatuses({});
setStepData({});
setCompletedSteps(0);
```
alongside `setIsAnalyzing(false)`.

---

### 2 · KPI tooltip `how` field is defined but never rendered
**Severity:** Low
**File:** `src/app/dashboard/page.tsx` — `kpis` array at lines 120-139, tooltip render at line 261
**Task:** #2

**Description**
Each KPI object defines a `how` string explaining the methodology behind the number (e.g. `"Simple average of all 8 task scores (range: 32–85) → 61%"`). The tooltip only renders `k.what`. `k.how` is computed but silently dropped — it's dead data on every render.

**Risk**
Low impact on users, but the calculation context (`how`) was clearly intended to appear. Without it, power users have no way to verify the displayed numbers. If the field stays unused it should be removed to avoid confusion during future development.

**Fix Options**
- **Render it:** Add a dimmed `<p>` under `k.what` in the tooltip: `<p className="text-xs mt-2 font-mono" style={{ color: "#9988AA" }}>{k.how}</p>`
- **Remove it:** Delete the `how` field from all KPI objects if the decision is to keep tooltips brief.

---

### 3 · Duplicate `searchWeb` function
**Severity:** Low
**Files:** `src/app/api/analyze/agents/toolsResearch.ts:22-42`, `src/app/api/analyze/agents/skillsAnalysis.ts:20-40`
**Task:** #3

**Description**
Both agent files contain an identical `searchWeb(query: string): Promise<string>` function — same Tavily API call, same response parsing, same error handling.

**Risk**
If the Tavily API endpoint, authentication method, or response shape changes, both files need updating independently. A developer who patches one may not notice the copy in the other, causing inconsistent behaviour between agents.

**Fix**
Extract to `src/app/api/analyze/agents/utils.ts` and import in both files:
```ts
export async function searchWeb(query: string): Promise<string> { ... }
```

---

### 4 · Unused `AnalysisState` interface
**Severity:** Low
**File:** `src/app/api/analyze/agents/types.ts:69-85`
**Task:** #4

**Description**
`AnalysisState` is defined with fields `completedAgents: string[]` and `errors: string[]` that do not exist in the actual `GraphState` Annotation in `graph.ts`. The interface is never imported or referenced anywhere in the codebase.

**Risk**
Anyone reading the types file may assume `AnalysisState` is the real graph state shape and build code against it. `completedAgents` and `errors` in particular suggest observability features that don't exist — this is a misleading API contract.

**Fix**
Delete the `AnalysisState` interface entirely (lines 68-85 in types.ts). The real state type is exported from graph.ts as `GraphStateType`.

---

### 5 · Stale `AgentName` type and `agent_start` in `SSEEvent`
**Severity:** Low
**File:** `src/app/api/analyze/agents/types.ts:118-136`
**Task:** #5

**Description**
Two issues in the SSE type definitions:

1. `AgentName` union (lines 118-127) lists `"Task Scoring"`, `"AI Tools Research"`, and `"Skills Analysis"` as separate agent names. However `route.ts` `NODE_LABELS` emits a single combined string `"Task Scoring + Tools Research + Skills Analysis"` for the `parallelAnalysis` node. The type does not match what's actually on the wire.

2. `SSEEvent.type` (line 129) includes `"agent_start"` but the route never emits this event type and `page.tsx` has no handler for it. It's a phantom event type.

**Risk**
Any consumer that type-checks against `AgentName` or switches on `SSEEvent.type` will have an inaccurate picture of possible values. This matters most if a second client or a test suite is written against these types.

**Fix**
- Update `AgentName` to match the exact string values in `NODE_LABELS`:
```ts
export type AgentName =
  | "Job Description Analyser"
  | "Task Decomposer"
  | "Task Scoring + Tools Research + Skills Analysis"
  | "ROI Calculator"
  | "Opportunity Synthesizer"
  | "Roadmap Builder"
  | "Finalising Analysis";
```
- Remove `"agent_start"` from `SSEEvent.type`.

---

### 6 · Unused `@anthropic-ai/sdk` production dependency
**Severity:** Low
**File:** `package.json:13`
**Task:** #6

**Description**
`@anthropic-ai/sdk` is listed as a production dependency (`^0.78.0`). No file in `src/` imports from it. All LLM invocations use `@langchain/anthropic` which bundles its own Anthropic SDK internally.

**Risk**
- Adds ~500 KB+ to the production bundle unnecessarily.
- Version drift: if `@langchain/anthropic` upgrades its internal SDK and `@anthropic-ai/sdk` stays pinned, a developer might assume compatibility is covered.
- Slightly increases `npm install` time and attack surface.

**Fix**
```bash
npm uninstall @anthropic-ai/sdk
npm run build  # verify clean
```

---

### 7 · Double-filter on `automationScore >= 40` in tools research
**Severity:** Low
**Files:** `src/app/api/analyze/graph.ts:82`, `src/app/api/analyze/agents/toolsResearch.ts:75`
**Task:** #7

**Description**
`parallelAnalysisNode` in `graph.ts` pre-filters scored tasks before calling the tools research agent:
```ts
const highValueTasks = scoredTasks.filter(t => t.automationScore >= 40);
const toolsMapping = await runToolsResearchAgent(highValueTasks, state.parsedJD!);
```
`runToolsResearchAgent` then immediately re-applies the same filter:
```ts
const automatableTasks = scoredTasks.filter(t => t.automationScore >= 40);
```
This means the agent receives an already-filtered list and filters it again — the second filter is a no-op.

**Risk**
Low runtime impact (the second filter is just iterating an already-small array). The real risk is maintenance confusion: the filtering logic has no single clear owner. If the threshold changes (e.g. to 50), a developer must remember to update both locations.

**Fix**
Choose one owner. Preferred: let the agent own the filtering (it has the business context). Remove the pre-filter in `graph.ts` and pass the full `scoredTasks` array. The agent's internal filter becomes the single source of truth.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigated By |
|------|-----------|--------|--------------|
| Stale progress UI misleads user on retry after error | Medium | Medium | Fix #1 |
| Calculation methodology hidden from users | Low | Low | Fix #2 |
| Tavily API change silently breaks one agent but not the other | Low | Medium | Fix #3 |
| Developer codes against wrong state shape (`AnalysisState`) | Low | Medium | Fix #4 |
| Test suite or second client built on wrong `AgentName` values | Low | Low | Fix #5 |
| Bundle bloat + SDK version drift from unused dependency | Low | Low | Fix #6 |
| Filter threshold updated in one place but not the other | Low | Low | Fix #7 |

---

## Recommended Fix Order

Execute in this sequence to minimise risk of introducing new issues:

1. **#1** — Bug fix only, isolated to `page.tsx` state management. No API or type changes.
2. **#2** — UI-only decision (render or delete). No logic changes.
3. **#6** — Dependency removal. Run build to confirm no breakage.
4. **#4** — Delete dead interface. No runtime impact, purely type-layer.
5. **#5** — Update type definitions. No runtime impact.
6. **#7** — Remove pre-filter in `graph.ts`. Low-risk one-liner.
7. **#3** — Extract shared utility. Requires creating a new file + updating two imports; save for last to keep changes isolated.

---

*Generated by codebase audit on 2026-03-17. Build verified clean before and after audit.*
