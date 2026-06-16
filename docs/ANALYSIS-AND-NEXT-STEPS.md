# Techwolf-Style Report Redesign — Complete Analysis & Implementation Plan

**Reference output:** `reference/report-flow-v2.html` is the definitive target for all UI, data, and behavior decisions.
**Scope:** ~130 companies from user-provided XLSX
**Goal:** Replace the per-company report hub at `/report/[companyId]` with the 4-step wizard from `report-flow-v2.html`, keeping all existing backend services, PostHog, and Clarity tracking untouched.

---

> ## ⚠️ FEATURE BRANCH
>
> All implementation work happens in **`~/Desktop/ai-automation-index`** on branch **`feat/wizard-v2-migration`** (already created and checked out).
>
> ```bash
> cd ~/Desktop/ai-automation-index
> git checkout feat/wizard-v2-migration   # already on this branch
> ```
>
> Do not commit directly to `main`. The branch was cut from `main` clean — use it for all wizard changes.

---

> ## ⚠️ WORKING DIRECTORY RULE
>
> **ALL code changes happen exclusively in `~/Desktop/techwolf-judwa/`.**
>
> `~/Desktop/ai-automation-index/` is the **original repo — do NOT touch it for any codebase changes.**
> It may only be referenced for reading context (e.g. checking how something works).
> Every file edit, new file, script run, migration, and `npm install` happens inside `techwolf-judwa/` only.

---

## Inngest & Backend — Swap Is Seamless

**All four Inngest files are byte-for-byte identical between the legacy and new app:**

| File | Legacy (`ai-automation-index`) | New (`techwolf-judwa`) | Match? |
|------|-------------------------------|------------------------|--------|
| `src/inngest/client.ts` | `id: "ai-automation-index"` | `id: "ai-automation-index"` | ✅ Identical |
| `src/inngest/analyzeJD.ts` | Full pipeline + batch completion | Same | ✅ Identical |
| `src/inngest/scrapeCompany.ts` | Scraper + status transitions | Same | ✅ Identical |
| `src/inngest/dailyCron.ts` | Daily background cron | Same | ✅ Identical |
| `src/app/api/inngest/route.ts` | Serves all 3 functions | Same | ✅ Identical |

**All DB tables and columns are identical** except the new app already has `wizard_data jsonb` on `companies` (added to schema + the `CompanyWizardData` interface).

**The admin panel is identical.** `BatchProgressTable.tsx` in both apps generates the report link and copy button using the exact same code:

```
View ↗  →  /report/{slug ?? companyId}?token={reportToken}
Copy    →  {origin}/report/{slug ?? companyId}?token={reportToken}
```

This means:
- The link structure does **not change at all**
- The Copy chip and View Report button in admin keep working without any modification
- The `slug`, `reportToken`, and `companyId` columns are identical in both apps
- When the new app is deployed, those links simply route to the new wizard instead of the old role list — auto-behavior, zero admin changes

**The only backend change is a single additive hook in `analyzeJD.ts`:** call `computeWizardData()` after the batch-completion state transition. This is a pure append — it doesn't touch any existing logic, doesn't change any state machine transitions, and doesn't affect the Copy/View links.

---

## Quick Answers to the Open Questions

### Q1: Do we keep the current backend?
**Yes, completely unchanged.** The DB schema stays as-is except for ONE new column (already added). All existing API routes, Inngest jobs, scraping logic, and the per-role `DashboardView` (`/report/[companyId]/[analysisId]`) stay exactly as they are. Only the hub page changes.

### Q2: Do we need to aggregate 100+ roles in real-time?
**No.** Pre-compute once, cache on the `companies` table. The hub page does a single fast `companies.wizard_data` query — no expensive JSONB aggregation at request time.

### Q3: Do we need the scraping scripts again?
**No.** All companies already have their JDs analyzed and stored. Do NOT re-scrape.

### Q4: Where does `computeWizardData()` get called automatically?
**`src/inngest/analyzeJD.ts`, inside the batch-completion check (~line 130)** — after `db.update(batches).set({ status: "complete" ... })`. This fires once per batch when all JDs finish. The call recomputes `wizardData` for the company and writes it to `companies.wizard_data`. The batch state machine, status transitions, and all existing counters remain completely unchanged.

### Q5: What color theme?
**Use `reference/report-flow-v2.html` exactly.** Near-black `#0e0e10` background, `#4ade80` green accent, `#FD5A0F` orange for CTAs. The modal header keeps `linear-gradient(135deg,#1a0030,#2d0050)` per the v2 reference.

### Q6: What triggers the HubSpot modal?
**Two entry points:**
1. **"Get your custom analysis"** — top navbar button (visible on all 4 steps)
2. **"Get your Full Analysis"** — the orange Continue button that appears on Step 4 (replaces "Continue →" on the last step)

`HubSpotModal.tsx` already exists. It needs to be rendered inside `ReportWizard.tsx` with an `isOpen` state toggled by both buttons.

### Q7: PostHog and Clarity?
**Keep 100% as-is from the legacy application.** `ReportTelemetry.tsx` stays unchanged. Do not add, remove, or modify any PostHog or Clarity events, keys, or initialization code.

---

## What the v2 Reference Shows (Definitive)

`reference/report-flow-v2.html` is the single source of truth. Key structure:

### Layout Shell (all 4 steps share this)
- Dark near-black background `#0e0e10`
- Top navbar: Back arrow (hidden on Step 1) | iMocha logo | "Vision" · "How it works" nav links | orange "Get your custom analysis" CTA button
- **Fixed-height viewport (no scrolling)** — except Step 4 which is `overflow-y: auto`
- Bottom bar: `← Back` (left, invisible on Step 1) | 4 dot-indicators (active dot is wider green pill) | `Continue →` (right, becomes orange "Get your Full Analysis" CTA on last step)

### Step 1 — "Hi {Company}, here's your AI assessment at a glance"
Sub-line: "These estimated insights are based on analysis of X publicly available job postings..."

- 3 stat cards in a 3-column grid:
  - "AI Implementation Opportunity" → `aiImplementationOpportunity`%  → "of workforce can use AI to boost productivity"
  - "Task Automation Potential" → `taskAutomationPotential`% → "of tasks could be enhanced with AI"
  - "Workforce Upskilling Needs" → `workforceUpskillingNeeds`% → "of workforce skills might need up- or reskilling"
- **Hours banner below the grid** (new v2 element):
  - Large green number: `totalHoursSavedPerWeek`h
  - Text: "estimated hours reclaimed per week across all analyzed roles — time redirected to higher-value, uniquely human work"

### Step 2 — "How {Company}'s workforce can benefit from AI"
- 2 ring cards side by side:
  - Left: "Human AI Partnership Opportunity" → `humanAiPartnership`% → blue ring (`#6094FF`)
  - Right: "Transformation Opportunity" → `transformationOpportunity`% → green ring (`#4ade80`)
  - Both animate via `stroke-dashoffset` on mount

### Step 3 — "How {Company} compares to peers"
- Split layout: left 360px text column, right flexible radar canvas
- Left: heading + 2 description paragraphs + legend (orange dot = company, green dimmed dot = Industry avg) + italicized note
- Right: Chart.js radar canvas (NOT Recharts) with `departmentRadar` (orange) vs `peerBaseline` (green, 0.7 opacity)
- Note: "Industry average is illustrative." must appear in the legend/note

### Step 4 — "AI opportunities for specific roles at {Company}"
- Step 4 is **scrollable** (overflow-y: auto); all other steps are fixed-height
- 3 mini stat cards:
  - "AI Implementation Opportunity" → `aiImplementationOpportunity`%
  - "Task Automation Potential" → `taskAutomationPotential`%
  - **"Hours Reclaimed / Week"** → `totalHoursSavedPerWeek`h (green, NOT "Workforce Upskilling Needs")
- Snapshot table: role rows showing name, dept badge, hours saved chip, score bar + label, chevron
- Clicking a role → inline role detail sub-view (no page navigation):
  - Back to roles button
  - Role title + dept badge + AI Readiness score
  - **KPI chips row**: hours saved per week (green), high-automation-task count (red), skills at risk count (amber)
  - **Executive Summary box** ("AI Impact Summary") — blue-tinted card with `executiveSummary` text
  - Skills Snapshot card — 3 columns: Future-Proof (green) / AI-Augmented (amber) / At Risk (red)
  - **Automation by Category** bar chart — horizontal bars with category name + score bar + score label
  - Task Automation Potential: stacked bar + legend (Low green / Medium amber / High red) + Sort by Score/Level
  - 2-column task card grid — each card: score, potential badge, task name, category, aiOpportunity excerpt, **scoringRationale** (italic, bottom)
  - **AI Implementation Opportunities section** — 2-column opp-card grid: title, impact badge, effort badge, time saving, description, tool pills

---

## Data Model

### `Analysis` Type (source: `src/components/DashboardView.tsx`)

```typescript
interface Task {
  name: string;
  automationScore: number;          // 0–100
  automationPotential: "high" | "medium" | "low";
  category: string;
  aiOpportunity: string;
  scoringRationale?: string;        // shown in v2 task cards
}

interface Opportunity {
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  effort: "high" | "medium" | "low";
  tools: string[];
  estimatedTimeSaving: string;      // e.g. "6h/week"
}

interface Analysis {
  jobTitle: string;
  department: string;
  executiveSummary: string;         // shown in v2 role detail
  overallAutomationScore: number;   // 0–100
  aiReadinessScore: number;         // 0–100
  estimatedHoursSavedPerWeek: number;
  tasks: Task[];
  skillsAnalysis: {
    futureProof: string[];
    atRisk: string[];
    aiAugmented: string[];
  };
  automationByCategory: { category: string; score: number }[];  // shown in v2
  implementationRoadmap: { phase: string; timeline: string; items: string[] }[];
  roiHighlights: { focusShift: string; productivity_multiplier: string };
  aiOpportunities: Opportunity[];   // shown in v2 role detail
}
```

### `CompanyWizardData` — Full Shape (stored in `companies.wizard_data`)

```typescript
interface WizardRole {
  analysisId:             string;
  jobTitle:               string;
  department:             string;
  overallAutomationScore: number;
  aiReadinessScore:       number;
  estimatedHoursSavedPerWeek: number;
  executiveSummary:       string;
  skillsAnalysis: {
    futureProof:  string[];
    atRisk:       string[];
    aiAugmented:  string[];
  };
  automationByCategory: { category: string; score: number }[];
  tasks: {
    name:               string;
    automationScore:    number;
    automationPotential: "high" | "medium" | "low";
    category:           string;
    aiOpportunity:      string;
    scoringRationale?:  string;
  }[];
  aiOpportunities: {
    title:               string;
    description:         string;
    impact:              "high" | "medium" | "low";
    effort:              "high" | "medium" | "low";
    tools:               string[];
    estimatedTimeSaving: string;
  }[];
}

interface CompanyWizardData {
  totalRolesAnalyzed:          number;
  // Step 1 + Step 4 stats
  aiImplementationOpportunity: number;    // avg aiReadinessScore across all roles (0–100)
  taskAutomationPotential:     number;    // % tasks with high/medium automationPotential
  workforceUpskillingNeeds:    number;    // % skills that are atRisk or aiAugmented
  totalHoursSavedPerWeek:      number;    // sum of estimatedHoursSavedPerWeek across all roles
  // Step 2
  transformationOpportunity:   number;    // % roles with overallAutomationScore >= 50
  humanAiPartnership:          number;    // 100 - transformationOpportunity
  // Step 3
  departmentRadar: { department: string; score: number }[];  // top 6 depts, real data
  peerBaseline:    { department: string; score: number }[];  // synthetic illustrative baseline
  // Step 4
  roles:           WizardRole[];          // full per-role data, sorted by overallAutomationScore desc
}
```

---

## Aggregation Formulas (for `computeWizardData()`)

```
aiImplementationOpportunity = round( avg(analysis.aiReadinessScore) across all roles )

taskAutomationPotential = round(
  count(tasks where automationPotential in ["high","medium"]) /
  count(all tasks) * 100
)

workforceUpskillingNeeds = round(
  (sum(atRisk.length) + sum(aiAugmented.length)) /
  (sum(futureProof.length) + sum(atRisk.length) + sum(aiAugmented.length)) * 100
)

totalHoursSavedPerWeek = sum(analysis.estimatedHoursSavedPerWeek) across all roles
  (round to nearest integer)

transformationOpportunity = round(
  count(roles where overallAutomationScore >= 50) / totalRoles * 100
)

humanAiPartnership = 100 - transformationOpportunity

departmentRadar:
  Group roles by jd.department
  For each dept: deptScore = round( avg(overallAutomationScore) of roles in dept )
  Only include depts with >= 2 roles
  Cap at top 6 departments by role count
  Sort by role count desc

peerBaseline:
  For each dept in departmentRadar:
    peerScore = clamp(deptScore + random_seeded_offset_between(-15, +15), 20, 80)
    Use company slug as seed so values are stable across recomputes
  Label clearly as "Industry avg (illustrative)" in the legend

roles[]:
  For each analysis in the company:
    Collect: analysisId, jobTitle, department, overallAutomationScore, aiReadinessScore,
             estimatedHoursSavedPerWeek, executiveSummary, skillsAnalysis, automationByCategory,
             tasks (with scoringRationale), aiOpportunities
  Sort by overallAutomationScore descending
  No role limit — include all valid analyses
```

---

## What Needs to Be Built / Changed

### New files to create

| # | File | Purpose |
|---|------|---------|
| 1 | `drizzle/XXXX_add_wizard_data.sql` | `ALTER TABLE companies ADD COLUMN IF NOT EXISTS wizard_data jsonb;` |
| 2 | `src/lib/report/aggregate.ts` | `computeWizardData()` — pure aggregation functions applying the formulas above |
| 3 | `scripts/compute-wizard-data.ts` | One-time backfill script: reads all analyses per company, writes `wizardData` |
| 4 | `src/components/report/wizard/Step4Roles.tsx` | Role list table + inline role detail sub-view (full Step 4 from v2 reference) |
| 5 | `src/components/report/wizard/WizardNav.tsx` | Top navbar: back arrow, iMocha logo, nav links, "Get your custom analysis" CTA |
| 6 | `src/components/report/wizard/WizardBottomBar.tsx` | Back/Continue buttons + 4 dot-indicators |

### Files to modify

| File | What changes |
|------|-------------|
| `src/lib/db/schema.ts` | Add `wizardData: jsonb("wizard_data").$type<CompanyWizardData>()` to companies table |
| `src/inngest/analyzeJD.ts` | After batch-completion check (line ~130), call `computeWizardData()` for the company and `UPDATE companies SET wizard_data = ...` |
| `src/components/report/wizard/ReportWizard.tsx` | Add `WizardNav`, `WizardBottomBar`, 4-step state, `HubSpotModal` wired to CTA buttons, remove fallback branch |
| `src/components/report/wizard/Step1Glance.tsx` | Add hours banner below stat grid; use v2 colors; add count-up animation |
| `src/components/report/wizard/Step2Benefit.tsx` | Animated SVG `stroke-dashoffset` rings; blue (`#6094FF`) for partnership, green (`#4ade80`) for transformation |
| `src/components/report/wizard/Step3Peers.tsx` | Split layout (left text+legend, right Chart.js canvas); orange company line, dimmed green peer line |
| `src/components/CategoryRadar.tsx` | Step 3 now uses Chart.js canvas (per v2 reference), not Recharts. Replace or add a `peerData` prop variant using Chart.js |
| `src/app/report/[companyId]/page.tsx` | Remove `?view` param logic, remove CompanyReportList fallback, always render `ReportWizard`. Add `wizardData` to company query. |
| `src/components/report/HubSpotModal.tsx` | Verify modal matches v2 reference HTML design (form fields: first name, last name, work email, company, job title) |

### Files to delete (post-migration)

| File | Reason |
|------|--------|
| `src/components/report/CompanyReportList.tsx` | Replaced by Step 4 inline role list |
| `src/components/report/FullAnalysisHeroStrip.tsx` | No equivalent in v2 |
| `src/components/report/CompleteCoverageHeroStrip.tsx` | No equivalent in v2 |
| `src/app/report/daman-health/page.tsx` | Hardcoded example page |
| `src/app/preview/report/page.tsx` | Preview mode, retire |

### Files that stay 100% unchanged

- All API routes under `src/app/api/` — untouched
- All Inngest jobs (`src/inngest/`) — untouched **except** the `computeWizardData()` trigger addition in `analyzeJD.ts`
- All scrapers (`src/lib/scrapers/`) — untouched
- Per-role dashboard (`src/app/report/[companyId]/[analysisId]/page.tsx` + `DashboardView.tsx`) — untouched
- `ScoreRing.tsx`, `TasksChart.tsx` — untouched (not used in wizard)
- `ReportTelemetry.tsx` — untouched (PostHog + Clarity stay exactly as in legacy)
- All database tables except `companies.wizard_data` column addition

---

## Inngest Trigger — Exact Location

**File:** `src/inngest/analyzeJD.ts`

**Where:** Inside the success-path batch completion block (around line 130), after the `db.update(batches).set({ status: "complete" ... })` call:

```typescript
// After this existing block:
if (counts.total > 0 && counts.processed + counts.failed >= counts.total) {
  await db.update(batches)
    .set({
      status:      counts.failed > 0 ? "partial_failure" : "complete",
      completedAt: new Date(),
    })
    .where(eq(batches.id, batchId));

  // ← ADD THIS: recompute and persist wizard data when batch completes
  if (counts.failed === 0 || counts.processed > 0) {
    const allAnalyses = await db
      .select({ result: analyses.result, id: analyses.id, department: jobDescriptions.department })
      .from(analyses)
      .innerJoin(jobDescriptions, eq(analyses.jobDescriptionId, jobDescriptions.id))
      .where(eq(analyses.companyId, jd.companyId));

    const wizardData = computeWizardData(
      allAnalyses.map(a => ({ analysisId: a.id, result: a.result as Analysis, department: a.department }))
    );

    await db.update(companies)
      .set({ wizardData })
      .where(eq(companies.id, jd.companyId));
  }
}
```

This ensures: every time a batch finishes (even partial), wizard data is recomputed from all completed analyses for that company.

---

## HubSpot Modal Wiring

The modal in `HubSpotModal.tsx` must be triggered from two places inside `ReportWizard.tsx`:

1. `WizardNav` — "Get your custom analysis" button (top-right, visible on all steps)
2. Step 4 role detail — "Get your Full Analysis" button (the orange CTA that replaces "Continue" on the last step's bottom bar, and/or inside Step 4)

**Modal fields** (per v2 reference HTML):
- First name (required)
- Last name (required)
- Work email (required)
- Company (required)
- Job title (optional)

**Success state**: "You're all set! An iMocha expert will contact you soon with your full analysis."

The modal backdrop has `onclick="maybeClose"` behavior (click outside to close). The close ✕ button in the top-right corner of the modal header also dismisses it.

---

## Color Palette (v2 Reference — Final)

| Token | Hex | Used for |
|---|---|---|
| Page background | `#0e0e10` | Entire wizard shell background |
| Card background | `rgba(255,255,255,0.05)` | All cards (stat, ring, role, task, opp) |
| Card border | `rgba(255,255,255,0.1)` | All card borders |
| Green accent | `#4ade80` | Active dot, company radar line, Step 1 numbers, hours number, ring (transformation), low-automation |
| Green dim | `rgba(74,222,128,0.12)` | Low-potential badge background |
| Amber | `#fbbf24` | Medium-automation tasks, AI-Augmented skills |
| Red | `#f87171` | High-automation tasks, At Risk skills |
| Orange CTA | `#FD5A0F` | "Get your custom analysis" button, company radar line in Step 3, high-impact opp badges |
| Blue accent | `#6094FF` | Partnership ring, executive summary card border/tint, AI opp cards |
| Muted text | `rgba(255,255,255,0.5)` | Sub-lines, captions |
| Subtle | `rgba(255,255,255,0.25)` | Inactive dots |
| Modal header | `linear-gradient(135deg,#1a0030,#2d0050)` | HubSpot modal header only |
| Form background | `#faf8fc` | Modal form inputs |
| Form border | `#e4dced` | Modal form input borders |

---

## v2 HTML → React: Exact Implementation Mapping

This section maps every piece of static logic in `reference/report-flow-v2.html` to its React equivalent. Use this as the line-by-line implementation guide.

---

### Current State of Each Component (Gaps)

| File | Exists? | Key gaps vs v2 |
|------|---------|---------------|
| `ReportWizard.tsx` | ✅ | `TOTAL_STEPS=3` (needs 4), wrong background (`#0a1628` teal gradient → must be `#0e0e10`), nav CTA links to `?view=roles` (must open modal), no `HubSpotModal`, no Step 4, Continue invisible on step 3 (must become orange CTA) |
| `Step1Glance.tsx` | ✅ | Missing hours banner, no count-up animation, wrong green (`#6ee7b7` → `#4ade80`) |
| `Step2Benefit.tsx` | ✅ | Animation logic correct ✅, minor color tweak (`#6ee7b7` → `#4ade80` for green ring) |
| `Step3Peers.tsx` | ✅ | Uses Recharts `CategoryRadar` — needs raw Canvas 2D draw (per v2 reference). Build `WizardRadarChart.tsx` instead |
| `Step4Roles.tsx` | ❌ | Does not exist. Full build required |
| `src/lib/report/aggregate.ts` | ❌ | Does not exist. Full build required |
| `schema.ts` `CompanyWizardData` | ⚠️ | Missing `totalHoursSavedPerWeek` and `roles[]` |

---

### Data Flow: Static → Dynamic

| v2 HTML (`report-flow-v2.html`) | React / DB equivalent |
|---------------------------------|-----------------------|
| `const CURRENT_COMPANY = { name, domain }` | `company` prop passed from `page.tsx` via `companies.name` |
| `const DATA = { s1: [52,68,74], totalHours: 342, partnership: 45, transform: 55, radar: {...} }` | `wizardData` prop — fields map 1:1: `[aiImplementationOpportunity, taskAutomationPotential, workforceUpskillingNeeds]`, `totalHoursSavedPerWeek`, `humanAiPartnership`, `transformationOpportunity`, `{ labels: departmentRadar.map(d=>d.department), company: departmentRadar.map(d=>d.score), peers: peerBaseline.map(d=>d.score) }` |
| `const ROLES = [{ jobTitle, department, scores, tasks, ... }]` | `wizardData.roles[]` — computed by `computeWizardData()`, stored in `companies.wizard_data` |
| `document.getElementById('s1-company-name').textContent = name` | `{company}` JSX interpolation in Step1Glance heading |

---

### Navigation Logic

| v2 HTML | React equivalent |
|---------|-----------------|
| `let current = 1` | `const step = parseInt(searchParams.get("step") ?? "1")` — URL-driven, no local state needed |
| `goTo(n)` | `router.push(`?step=${n}&token=${token}`)` |
| `nextStep()` — if `current < TOTAL` goTo else `openModal()` | Bottom bar Continue `onClick`: `step < 4 ? goTo(step+1) : setModalOpen(true)` |
| `prevStep()` — if step4 + role open, hideRoleDetail; else goTo-1 | Bottom bar Back `onClick`: step 4 + `activeRole` → `setActiveRole(null)`; else `goTo(step-1)` |
| `handleNavBack()` → `prevStep()` | Navbar back arrow — same logic as prevStep |
| `updateUI()` — hides back on step 1, switches Continue to orange CTA on last step | Pure computed JSX: `step === 1 → back invisible`, `step === 4 → Continue becomes orange "Get your full analysis →"` |
| `buildDots()` — creates 4 dot buttons | `Array.from({length:4}).map((_, i) => <DotButton active={i+1===step} onClick={()=>goTo(i+1)} />)` |

---

### ReportWizard.tsx — Required Changes

```
1. TOTAL_STEPS = 3  →  TOTAL_STEPS = 4
2. background: "linear-gradient(#0a1628...)"  →  background: "#0e0e10"
3. Remove radial-gradient starfield div
4. Navbar CTA: href="/report/..."  →  onClick={() => setModalOpen(true)}  (opens HubSpotModal)
5. Import + render <HubSpotModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
6. Add useState<boolean>(false) for modalOpen
7. Step content: add  {step === 4 && <Step4Roles company={company} data={wizardData} onRequestAnalysis={() => setModalOpen(true)} />}
8. Continue button on step 4: text="Get your full analysis →", background="#FD5A0F", color="#fff", onClick → setModalOpen(true) instead of goTo
9. Continue button opacity: step < TOTAL_STEPS ? 1 : 1  (always visible, CTA on last step)
10. Back button: step === 1 → visibility: hidden  (invisible, still takes space — matches v2 .invisible class)
11. Navbar back arrow: step === 1 AND no active role → opacity 0 / pointer-events none
```

---

### Step1Glance.tsx — Required Changes

**Add count-up animation** (v2's `animateNumber()`):
```typescript
// useEffect on mount — animates 0 → target over 1200ms using ease-out cubic
function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      setValue(Math.round((1 - Math.pow(1 - t, 3)) * target));
      if (t < 1) requestAnimationFrame(tick);
    }
    const id = setTimeout(() => requestAnimationFrame(tick), 300);
    return () => clearTimeout(id);
  }, [target, duration]);
  return value;
}
```

**Add hours banner** below the 3-card grid:
```tsx
<div style={{ display:"flex", alignItems:"center", gap:14, marginTop:22,
  background:"rgba(74,222,128,0.07)", border:"1px solid rgba(74,222,128,0.2)",
  borderRadius:12, padding:"14px 28px", maxWidth:900 }}>
  <span style={{ fontSize:28, fontWeight:900, color:"#4ade80", letterSpacing:-1 }}>
    {hoursAnimated}h
  </span>
  <span style={{ fontSize:13, color:"rgba(255,255,255,0.65)", lineHeight:1.55 }}>
    <strong style={{color:"#fff",fontWeight:600}}>estimated hours reclaimed per week</strong>
    {" "}across all analyzed roles — time redirected to higher-value, uniquely human work
  </span>
</div>
```

**Color fix**: all `#6ee7b7` → `#4ade80`

---

### Step2Benefit.tsx — Required Changes

- Green ring color: `#6ee7b7` → `#4ade80`
- All other logic (animated SVG stroke-dashoffset via `useEffect → setTimeout → setAnimated(value)`) is correct and matches v2 ✅

---

### Step3Peers.tsx — Required Changes

**Replace Recharts `CategoryRadar` with a Canvas 2D draw** matching v2's `drawRadar()`:

Build `src/components/report/wizard/WizardRadarChart.tsx`:
```typescript
// Props: labels: string[], company: number[], peers: number[]
// useRef<HTMLCanvasElement>
// useEffect — runs drawRadar() on mount and when data changes
// Draw order (matches v2 exactly):
//   1. Grid rings at [20,40,60,80,100] — rgba(255,255,255,0.08), lineWidth 1
//   2. Spoke lines from center to each label — same stroke
//   3. Peers polygon — fill rgba(74,222,128,0.1), stroke rgba(74,222,128,0.5) dashed [5,4], lineWidth 1.5
//   4. Company polygon — fill rgba(253,90,15,0.18), stroke #FD5A0F solid, lineWidth 2
//   5. Company dots at each vertex — radius 4, fill #FD5A0F
//   6. Labels at radius 118% — font "600 12px", fill rgba(255,255,255,0.65), textAlign center
// Canvas size: width=420, height=380, cx=210, cy=200, R=min(420,380)*0.36
```

In `Step3Peers.tsx`, replace `<CategoryRadar ...>` with:
```tsx
<WizardRadarChart
  labels={data.departmentRadar.map(d => d.department)}
  company={data.departmentRadar.map(d => d.score)}
  peers={data.peerBaseline.map(d => d.score)}
/>
```

---

### Step4Roles.tsx — Full Spec (NEW file)

**File:** `src/components/report/wizard/Step4Roles.tsx`

**Props:**
```typescript
interface Props {
  company: string;
  data: CompanyWizardData;  // uses data.roles[], data.aiImplementationOpportunity, data.taskAutomationPotential, data.totalHoursSavedPerWeek
  onRequestAnalysis: () => void;  // opens HubSpotModal from within Step 4
}
```

**State:**
```typescript
const [activeRole, setActiveRole] = useState<WizardRole | null>(null);
const [sort, setSort] = useState<'score' | 'level'>('score');
const detailRef = useRef<HTMLDivElement>(null);
```

**scoreColor helper** (direct port from v2):
```typescript
function scoreColor(s: number) {
  return s >= 66 ? '#f87171' : s >= 33 ? '#fbbf24' : '#4ade80';
}
```

**Outer container:** `overflow-y: auto`, `padding: "28px 40px 0"`, `width: 100%`, `max-width: 880px`, `margin: "0 auto"`

**List view** (shown when `activeRole === null`):
```
Heading: "AI opportunities for specific roles at {company}"
Sub: "Based on iMocha's AI analysis of publicly available job postings · Click any role to see tasks, skills and AI tools"

3 mini stat cards (grid 3-col):
  - "AI Implementation Opportunity" → data.aiImplementationOpportunity%
  - "Task Automation Potential" → data.taskAutomationPotential%
  - "Hours Reclaimed / Week" → data.totalHoursSavedPerWeek + "h"  ← green color, NOT %

Snapshot table:
  header: "Snapshot of roles and their AI automation scores"
  rows: data.roles.map(role => (
    role-row with:
      role.jobTitle (truncated)
      dept badge
      role.estimatedHoursSavedPerWeek + "h/wk"  (green)
      role.overallAutomationScore  (colored via scoreColor)
      bar: width=overallAutomationScore%, background=scoreColor(score)
      chevron ›
    onClick → setActiveRole(role), detailRef.current?.scrollTo(0,0)
  ))
```

**Role detail view** (shown when `activeRole !== null`):

```
Back button: onClick → setActiveRole(null)

Header row:
  role.jobTitle (h2)
  dept badge
  "AI Readiness {role.aiReadinessScore}%" (right-aligned)

KPI chips row (3 chips):
  Chip 1: value="{role.estimatedHoursSavedPerWeek}h" color=#4ade80, label="estimated hours / saved per week"
  Chip 2: value="{highTaskCount}/{total}" color=#f87171, label="high-automation / tasks"
           where highTaskCount = role.tasks.filter(t=>t.automationPotential==='high').length
  Chip 3: value="{role.aiReadinessScore}%" color=#6094FF, label="AI readiness / score"

Executive Summary box (show only if role.executiveSummary is non-empty):
  blue-tinted: background rgba(96,148,255,0.06), border rgba(96,148,255,0.2)
  label: "AI IMPACT SUMMARY" (small caps, blue)
  text: role.executiveSummary

Skills Snapshot card:
  3 columns: Future-Proof (green) / AI-Augmented (amber) / At Risk (red)
  skills as pill spans per column
  empty column → show "—"

Automation by Category (show only if role.automationByCategory.length > 0):
  rows: category name (160px) | bar (flex 1) | score (30px)
  bar fill color = scoreColor(score)

Task Automation section:
  stacked bar: lowPct (green) | medPct (amber) | highPct (red)
  where:
    lowPct  = tasks.filter(t=>t.automationPotential==='low').length / total * 100
    medPct  = tasks.filter(t=>t.automationPotential==='medium').length / total * 100
    highPct = 100 - lowPct - medPct
  legend: "X% Low" (green) | "X% Medium" (amber) | "X% High" (red) | Sort by: [Score] [Level]

Task grid (2-col):
  sorted: sort==='score' → by automationScore desc
          sort==='level' → by LEVEL_ORDER {high:0, medium:1, low:2}
  each card:
    border-top: 3px solid [red/amber/green based on potential]
    top row: potential badge (HIGH/MEDIUM/LOW) | score number (colored)
    task name
    category (small caps, muted)
    aiOpportunity text (3-line clamp)
    scoringRationale (if present, italic, very muted, border-top separator)

AI Implementation Opportunities (show only if role.aiOpportunities.length > 0):
  2-col grid of opp-cards:
    header row: impact badge | effort badge | timeSaving (green, right)
    title
    description (3-line clamp)
    tool pills (blue tint)
  EFFORT_LABEL = { high:'High Effort', medium:'Med Effort', low:'Low Effort' }
```

---

### HubSpotModal.tsx — Wiring

The component already exists. Changes needed in `ReportWizard.tsx`:

```typescript
// 1. Add state
const [modalOpen, setModalOpen] = useState(false);

// 2. Import
import HubSpotModal from "@/components/report/HubSpotModal";

// 3. Render inside WizardInner (not inside a step — at root level of the shell div)
<HubSpotModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />

// 4. Wire navbar CTA
<button onClick={() => setModalOpen(true)}>Get your custom analysis</button>

// 5. Wire Continue on step 4
onClick={step < 4 ? () => goTo(step + 1) : () => setModalOpen(true)}

// 6. Wire Step4Roles "Get your Full Analysis" button (via prop)
<Step4Roles ... onRequestAnalysis={() => setModalOpen(true)} />
```

Verify `HubSpotModal` accepts `isOpen: boolean` and `onClose: () => void` props — if the current interface differs, update accordingly.

---

### schema.ts — Required Update

The `CompanyWizardData` interface in `schema.ts` is outdated. It must be replaced with the full shape defined in the "Data Model" section above (`WizardRole[]` + `totalHoursSavedPerWeek`). The `wizardData` column definition stays the same — only the TypeScript interface changes. The migration SQL does not need to change since it's a JSONB column.

---

## Implementation Order

### Phase 1 — Data layer (~1 day)

1. Update `CompanyWizardData` interface in `schema.ts` — add `totalHoursSavedPerWeek` and `roles: WizardRole[]`
2. Write `src/lib/report/aggregate.ts` — `computeWizardData()` with all formulas
3. Wire `computeWizardData()` into `src/inngest/analyzeJD.ts` batch completion handler
4. Write `scripts/compute-wizard-data.ts` — backfill for all existing companies
5. Run backfill; spot-check 3–4 companies in DB

### Phase 2 — UI components (~2–3 days)

6. Rewrite `ReportWizard.tsx` — apply all 11 changes listed above (TOTAL_STEPS=4, bg, modal, Step4, CTA)
7. Rewrite `Step1Glance.tsx` — add `useCountUp` hook, hours banner, color fix
8. Fix `Step2Benefit.tsx` — color tweak only
9. Build `WizardRadarChart.tsx` — Canvas 2D matching v2 `drawRadar()` exactly
10. Rewrite `Step3Peers.tsx` — swap Recharts for `WizardRadarChart`
11. Build `Step4Roles.tsx` — full spec above

### Phase 3 — Hub page & cleanup (~half day)

12. Rework `src/app/report/[companyId]/page.tsx` — remove `?view=roles` branch, always render wizard
13. Verify `ReportTelemetry` still mounted unchanged
14. Delete `CompanyReportList.tsx`, `FullAnalysisHeroStrip.tsx`, `CompleteCoverageHeroStrip.tsx`

### Phase 4 — Test (~half day)

15. Step through all 4 steps on 3–4 real companies
16. Confirm numbers match raw DB values
17. Back/Continue navigation, dot indicators, step 4 scroll
18. Role detail opens/closes inline (no page navigation)
19. HubSpot modal opens from navbar CTA and step 4 last-step button
20. Per-role reports at `/report/[companyId]/[analysisId]` still work unchanged

---

## File-by-File Change Summary

### `src/lib/db/schema.ts`
```typescript
// Add to companies table:
wizardData: jsonb("wizard_data").$type<CompanyWizardData>(),
```

### `src/lib/report/aggregate.ts` (NEW)
```typescript
import type { Analysis } from "@/components/DashboardView";

export interface WizardRole { /* full shape per data model above */ }
export interface CompanyWizardData { /* full shape per data model above */ }

export function computeWizardData(
  roles: { analysisId: string; result: Analysis; department: string | null }[]
): CompanyWizardData {
  // Apply all formulas from the "Aggregation Formulas" section
}
```

### `scripts/compute-wizard-data.ts` (NEW)
```bash
# Run once for all companies:
npx tsx scripts/compute-wizard-data.ts

# Run for a single company (testing):
npx tsx scripts/compute-wizard-data.ts --slug=aig

# Run against target XLSX:
npx tsx scripts/compute-wizard-data.ts --input=./target-companies.xlsx
```

Reads analyses + jd.department per company, calls `computeWizardData()`, writes to `companies.wizard_data`. Logs any company slugs with zero analyses so they can be investigated.

### `src/app/report/[companyId]/page.tsx`
- Remove `?view=roles` conditional branch
- Remove CompanyReportList import
- Add `wizardData: companies.wizardData` to the SELECT
- Always render `<ReportWizard wizardData={…} company={…} token={…} identifier={…} />`
- Keep `<ReportTelemetry />` mounted unchanged

---

## Radar Chart: Chart.js vs Recharts

The v2 reference HTML uses a **Chart.js canvas** (`<canvas id="radarCanvas">`) for the Step 3 radar. The existing `CategoryRadar.tsx` uses Recharts.

Decision: **Replace Step 3's radar with a Chart.js implementation**. Do NOT try to shoehorn a dual-series peerBaseline prop into the Recharts `CategoryRadar` component. Build a dedicated `WizardRadarChart.tsx` using Chart.js that accepts `{ labels, company, peers }` exactly matching the `DATA.radar` shape in the v2 reference. `CategoryRadar.tsx` stays unchanged for any other usage.

If `chart.js` and `react-chartjs-2` are not already in `package.json`, install them:
```bash
npm install chart.js react-chartjs-2
```

---

## How to Run / Verify

```bash
# First-time setup
cd ~/Desktop/techwolf-judwa
npm install

# Run backfill script
npx tsx scripts/compute-wizard-data.ts

# Verify wizard data in DB
# SELECT slug, (wizard_data->>'totalRolesAnalyzed')::int as roles,
#        (wizard_data->>'aiImplementationOpportunity')::int as ai_opp,
#        (wizard_data->>'totalHoursSavedPerWeek')::int as hours
# FROM companies WHERE wizard_data IS NOT NULL ORDER BY name LIMIT 20;

# Start dev server
npm run dev
```

Test URLs (swap slug + token):
```
http://localhost:3000/report/aig?token=<token>
```

Expected on load:
- Step 1: dark `#0e0e10` background, 3 green stat numbers, hours banner below grid
- Step 2: 2 animated rings (blue left, green right)
- Step 3: split layout, dual-line radar (orange = company, green dim = peers)
- Step 4: scrollable, role list, click a role → inline detail with all sections
- "Get your custom analysis" → opens HubSpot modal
- `← Back` / `Continue →` update step, dots reflect active step
- `/report/aig/<analysisId>` still opens DashboardView unchanged
```

---

## Risk Areas

| Risk | Severity | Mitigation |
|------|----------|-----------|
| `wizardData` never written for existing companies | **Critical** | Run `scripts/compute-wizard-data.ts` as first action before any UI work |
| Inngest trigger addition breaks existing batch flow | **High** | Add the recompute block after the existing update — non-destructive append only |
| Chart.js not installed | **Medium** | Check `package.json` before building Step 3; install if missing |
| `roles[]` payload size for large companies (500+ roles) | **Medium** | Cap roles array at top 50 by overallAutomationScore; Step 4 only shows a snapshot table anyway |
| HubSpot env vars missing in new deployment | **Medium** | Confirm `HUBSPOT_PORTAL_ID` and form ID env vars are set |
| peerBaseline randomness causing different values each recompute | **Low** | Seed the random offset with the company slug so values are stable |
