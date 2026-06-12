# Auto-Recovery Scraper Agent — Plan

## Context

Today, when the scraping pipeline fails on a company (returns 0 roles, hits "listing noise," or gets blocked), a developer (you) has to manually:

1. Open the company's careers site in a browser.
2. Figure out the right filters / search params / load-more buttons / pagination.
3. Identify the total role count to know when extraction is complete.
4. Either tweak a generic scraper's config (Phenom `refNum`, Workday tenant, etc.) or write a new bespoke scraper module under `src/lib/scrapers/`.
5. Re-trigger the Inngest scrape event.

The goal is to **hand the entire pipeline to a non-technical RevOps manager**. They should be able to:
- Upload a CSV/Excel sheet of companies (name + careers URL), have the system attempt to scrape all of them in batches of 10, and download a results sheet showing what succeeded.
- Click an "Auto-fix" button on any already-in-DB company that failed scraping.

This is the missing piece between the existing scraping pipeline (`src/lib/scraper.ts`, `src/lib/scrapers/*`, `src/inngest/scrapeCompany.ts`) and the existing analysis agents (`docs/AGENTIC_ARCHITECTURE_PLAN.md`). Analysis agents work *after* roles are scraped; this plan covers what happens *when scraping itself fails*.

---

## Decisions (locked in)

| Question | Choice |
|---|---|
| **Trigger (batch)** | RevOps uploads a CSV/Excel via admin UI → system processes in batches of 10 → downloadable result sheet. |
| **Trigger (DB companies)** | Admin clicks **"Auto-fix"** button on failed companies in `CompanyJDSplitView`. |
| Browser tool | **Playwright MCP** (self-hosted) — Claude drives a real browser, clicks filters, reads counts, captures network requests. |
| Persistence | New `scraperConfig jsonb` column on `companies` table. Agent writes; future scrapes read directly. Sheet and DB stay **independent** — sheet is input/output only, not synced to DB. |
| Success signal | **Count match first, LLM quality check as fallback** — agent looks for "Showing X jobs" / "Total roles: X" on the page, then iterates until extracted count matches ±5%. If no count exists, Claude reads sample roles and confirms they look real. |
| Result sheet columns | Status (`pending`/`success`/`failed`), Total roles found, Detected ATS/HCM, Error message. |

---

## Architecture: 4 specialized recovery agents

Mirrors the analysis-agent pattern from `docs/AGENTIC_ARCHITECTURE_PLAN.md`. Orchestrated by a new `scraperRecoveryOrchestrator`.

```
[Failed Company]
      │
      ▼
┌─────────────────────────┐
│ Recovery Orchestrator   │  ── retries, budget cap, status streaming to UI
└──────────┬──────────────┘
           │
   ┌───────▼───────┐
   │ A1: Site Recon │     Playwright MCP: open URL, identify ATS/HCM,
   │                │     find total role count, find filters/load-more.
   └───────┬───────┘
           │ siteProfile
   ┌───────▼───────┐
   │ A2: Structure  │     Playwright MCP: find the API endpoint or DOM
   │     Discovery  │     selector that yields role records. Iterates.
   └───────┬───────┘
           │ candidateConfig
   ┌───────▼───────┐
   │ A3: Validator  │     Runs candidateConfig through a generic
   │                │     executor; compares count + quality vs goal.
   └───────┬───────┘
           │ verifiedConfig (or feedback → A2 again, max N loops)
   ┌───────▼───────┐
   │ A4: Persister  │     Writes scraperConfig to companies row,
   │                │     re-fires `company/scrape` Inngest event.
   └───────────────┘
```

### Agent 1 — Site Recon
- **Input:** `careerPageUrl`, current `atsType`, last `scrapeError`.
- **Tools:** Playwright MCP (`browser_navigate`, `browser_snapshot`, `browser_network_requests`, `browser_evaluate`).
- **Output:** `siteProfile { detectedAts, totalRolesText, totalRolesNumber, filterControls[], paginationStyle, hiddenApiEndpoints[] }`.
- **Model:** `claude-sonnet-4-6`.
- Reads the rendered page, captures network XHRs (to find ATS APIs the way `findWorkdayConfigOnPage` does today, but generalized), looks for "Showing 247 jobs" text patterns.

### Agent 2 — Structure Discovery
- **Input:** `siteProfile` + previous attempt feedback.
- **Tools:** Playwright MCP, `web_search` for ATS docs.
- **Output:** `candidateConfig { strategy: 'api'|'dom'|'firecrawl', endpoint?, body?, selector?, paginationParams?, filters? }`.
- **Model:** `claude-sonnet-4-6`.
- Tries to identify a JSON API first (cheapest, most reliable), falls back to DOM selectors, falls back to Firecrawl-with-actions if interactive.
- Reuses precedent from `src/lib/scrapers/workday.ts` (`findWorkdayConfigOnPage`) — generalize this pattern.

### Agent 3 — Validator
- **Input:** `candidateConfig`, `siteProfile.totalRolesNumber`.
- **Tools:** A new **`runScraperConfig()`** generic executor (see "New code" below).
- **Output:** `{ ok: boolean, extractedCount, sampleRoles[], reason }`.
- **Model:** `claude-haiku-4-5` for the quality check on sampled roles (fast/cheap).
- Pass rules:
  1. If `totalRolesNumber` known: `|extracted - total| / total ≤ 0.05` → pass.
  2. Else: Haiku reviews 5 random sample roles; if ≥4/5 look like real job postings → pass.
  3. Otherwise → feedback string → orchestrator loops to A2 (max 5 iterations, then escalate).

### Agent 4 — Persister
- **Input:** `verifiedConfig`.
- **Tools:** Database (drizzle), Inngest client.
- **Output:** Writes `companies.scraperConfig = verifiedConfig`, `companies.scrapeStatus = 'pending'`, fires `company/scrape` event.
- **Model:** None — deterministic code.

### Orchestrator
- Hard caps: **5 A2↔A3 loop iterations**, **$2 total Anthropic spend**, **8 min wall-clock**.
- Streams progress via SSE to the admin UI so RevOps sees `"Detecting ATS… found Phenom"`, `"Trying API endpoint…"`, `"Validating: 12/247 roles found, retrying…"`, `"Success ✓ 245 roles"`.
- On hard fail: marks `scraperConfig = { failedAttempts: [...] }` and surfaces a Slack/email notification (out of scope for v1 — just write the failure log).

---

## Batch CSV/Excel Intake Workflow

This is the primary RevOps entry point — no DB knowledge required.

### Flow

```
RevOps uploads CSV/Excel
  └── columns: companyName, careersUrl (minimum)
        │
        ▼
  Admin UI parses file, splits into batches of 10
        │
        ▼  (per batch, sequential)
  For each company in batch:
    ├── Try standard scraper tiers (fast path, no agents)
    ├── If 0 roles / noise / error → run 4-agent recovery pipeline
    └── Write result back to row: status, rolesFound, detectedAts, errorMsg
        │
        ▼
  All batches done → "Download Results" button appears
  RevOps downloads enriched CSV with added columns
```

### Input CSV format (minimum columns)
| companyName | careersUrl |
|---|---|
| Progressive Insurance | https://careers.progressive.com |
| Daman Health | https://www.damanhealth.ae/en/careers |

### Output CSV format (appended columns)
| ... | status | rolesFound | detectedAts | errorMessage |
|---|---|---|---|---|
| ... | success | 247 | Workday | |
| ... | failed | 0 | unknown | Blocked by Cloudflare |

### Key implementation details
- **Batch size:** 10 companies processed sequentially within a batch (not parallel — Playwright browser is single-session, and API rate limits apply).
- **No DB writes:** Sheet processing is self-contained. `scraperConfig` is NOT persisted during batch runs — this is a probe/audit tool. If RevOps wants to onboard a company to the main pipeline after a successful batch run, they do that separately via the existing admin UI.
- **File parsing:** Use `xlsx` npm package (already common in Next.js projects) for `.xlsx`; native `fs` + CSV parser for `.csv`.
- **Result download:** Server generates the enriched file in-memory and streams it as a download response — no temp file storage needed.
- **Progress:** SSE stream shows per-company status as batch runs so RevOps isn't staring at a spinner.

### New batch-specific files
```
src/app/api/admin/batch-probe/
  route.ts                 ← POST (upload) + GET (SSE stream) + GET /download
src/components/admin/
  BatchProbeUploader.tsx   ← File drop zone + progress table + download button
src/lib/batchProbe/
  parser.ts                ← CSV/XLSX → CompanyRow[]
  writer.ts                ← CompanyRow[] → enriched Buffer (CSV/XLSX)
  runner.ts                ← orchestrates batches of 10, emits SSE events
```

---

## Files to create / modify

### New code
```
src/lib/scraperConfig/
  types.ts                 ← ScraperConfig type union (api|dom|firecrawl strategies)
  executor.ts              ← runScraperConfig(config, url) — generic runner that
                             reads a config and produces RawJobPosting[]
  countDetector.ts         ← shared util: regex + LLM to extract "Showing X jobs"

src/app/api/admin/company/[companyId]/auto-fix/
  route.ts                 ← POST endpoint, starts SSE stream, runs orchestrator

src/app/api/admin/batch-probe/
  route.ts                 ← upload handler + SSE stream + /download endpoint

src/lib/agents/scraperRecovery/
  orchestrator.ts          ← Pipeline manager (loop budget, SSE emitter)
  siteRecon.ts             ← Agent 1
  structureDiscovery.ts    ← Agent 2
  validator.ts             ← Agent 3
  persister.ts             ← Agent 4 (DB path only, not used in batch-probe)
  prompts/*.md             ← System prompts per agent

src/lib/batchProbe/
  parser.ts                ← CSV/XLSX → CompanyRow[]
  writer.ts                ← CompanyRow[] → enriched Buffer
  runner.ts                ← batch-of-10 orchestration with SSE

src/components/admin/
  BatchProbeUploader.tsx   ← Upload UI, live progress table, download button
```

### Modified code
- **`src/lib/db/schema.ts`** — add `scraperConfig: jsonb('scraper_config')` to `companies` table + drizzle migration.
- **`src/lib/scraper.ts`** — at the top of `scrapeCareerPage()`, if `company.scraperConfig` exists, route to `runScraperConfig()` first; fall through to existing tier logic only if the learned config fails. Preserves backwards compatibility.
- **`src/inngest/scrapeCompany.ts`** — pass `company.scraperConfig` through to `scrapeCareerPage`.
- **`src/components/admin/CompanyJDSplitView.tsx`** — add "Auto-fix" button beside existing `RetryButton` on failed/blocked companies. Opens a panel showing the SSE stream from the orchestrator.
- **`src/app/admin/page.tsx` (or dataset page)** — add entry point to `BatchProbeUploader` panel.

### Reused existing code
- `findWorkdayConfigOnPage` (`src/lib/scrapers/workday.ts`) — pattern for sniffing config from HTML.
- `looksLikeListingNoise` (`src/lib/scraper.ts:37-43`) — failure signal that can trigger Auto-fix suggestion.
- `RetryButton.tsx`, `JDActionButtons.tsx` — UI conventions to match.
- Anthropic client setup from `src/app/api/analyze/agents/` — reuse the same wrapper, model IDs, cost tracking pattern.
- `ATS_OPTIONS` / `HCM_MAP` (`src/lib/ats.ts`) — Agent 1 confirms `detectedAts` against this enum.

---

## Rollout phases

**Phase 1 — Manual recovery foundation (1 week)**
- Add `scraperConfig` column + migration.
- Build `runScraperConfig()` executor supporting `api` strategy only (the most common case — Workday, Oracle, Phenom, Eightfold are all API-based).
- Build orchestrator + Agents 1, 2, 3, 4 with Playwright MCP.
- Wire "Auto-fix" button in admin UI with SSE progress panel.

**Phase 2 — DOM + Firecrawl fallback (3-4 days)**
- Extend executor to handle `dom` strategy (CSS selectors over rendered HTML via Firecrawl).
- Extend executor to handle `firecrawl` strategy (Firecrawl actions: click, scroll, wait).
- Update Agent 2 prompts to consider all three strategies.

**Phase 3 — Self-healing & monitoring (3-4 days)**
- On scheduled re-scrapes, if `runScraperConfig()` extracts <80% of last run's count, auto-fire Auto-fix (sites change).
- Persist attempt history in a `scraper_config_attempts` table for debugging.
- Slack/email notification on hard fail.

---

## Verification

End-to-end test plan:

1. **Pick 3 currently-failing companies** from your `scripts/check-*.ts` files (e.g., `check-azblue.ts`, `check-frp.ts`, `check-daman.ts`).
2. **Reset their state** to `scrapeStatus = 'failed'`, `scraperConfig = null`.
3. **Click Auto-fix** in admin UI for each.
4. **Watch the SSE stream** — confirm Agent 1 detects the correct ATS, Agent 2 produces a working config, Agent 3 validates against the total role count.
5. **Verify** `companies.scraperConfig` is populated and `JDs` rows are created matching the site's stated total ±5%.
6. **Re-run the scrape via standard pipeline** (not Auto-fix) — confirm `scrapeCareerPage` uses the persisted config and completes in <30s without invoking any agents.
7. **Regression**: run an existing working company through the pipeline — confirm it still uses its current scraper path and isn't broken by the new branching in `scrapeCareerPage`.
8. **RevOps walkthrough**: have a non-technical user (you simulating, or real RevOps) trigger Auto-fix on a failed company without any verbal guidance and confirm they understand the progress UI.

Cost target per Auto-fix run: **<$0.50 Anthropic + Playwright compute**. Hard cap at $2 in orchestrator.
