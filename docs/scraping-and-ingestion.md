# Scraping & Ingestion Pipeline

This document explains how a POC Excel file goes from upload to a fully analysed, shareable report.

---

## Overview

```
Excel Upload
     │
     ▼
┌─────────────────┐
│  Parse & ingest │  xlsx → rows → Postgres (batches, companies, pocs)
└────────┬────────┘
         │ inngest.send("company/scrape") × N companies
         ▼
┌─────────────────┐
│  scrapeCompany  │  Inngest function — runs per company (concurrency 5)
│                 │  Tier 1 → Tier 2 → Tier 3 scraping cascade
└────────┬────────┘
         │ inngest.send("jd/analyze") × N JDs (fan-out)
         ▼
┌─────────────────┐
│   analyzeJD     │  Inngest function — runs per JD (concurrency 3)
│                 │  LangGraph 7-agent pipeline → JSONB result in Postgres
└────────┬────────┘
         │ generates HMAC report token on first completion
         ▼
┌─────────────────┐
│  POC report     │  Token-gated URL → company hub → per-JD dashboard
└─────────────────┘
```

---

## Stage 1 — Excel Upload & Ingestion

**Entry point:** `POST /api/admin/upload`
**Parser:** `src/lib/excel.ts` using the `xlsx` library

### What happens

1. Admin uploads an `.xlsx` / `.xls` file via the drag-and-drop UI.
2. The file is read as a binary buffer and passed to `parseExcel()`.
3. The parser normalises column headers to `snake_case` and validates that the five required columns are present: `first_name`, `last_name`, `email`, `company_name`, `career_page_url`.
4. One **batch** record is created in Postgres (tracks the upload as a whole).
5. For each row:
   - **Company deduplication** — if a company with the same name already exists it is reused; its scrape status is reset to `pending` so it gets re-scraped in the new batch.
   - A **company** record is upserted with the career page URL.
   - A **poc** record is inserted linking the person to the company and batch.
6. One `company/scrape` Inngest event is sent per company — all fired in a single `inngest.send([...])` call.

### Tech
| Concern | Library |
|---|---|
| Excel parsing | `xlsx` (SheetJS) — runs server-side, listed in `serverExternalPackages` |
| Database writes | `drizzle-orm` with `@neondatabase/serverless` (Neon Postgres) |
| Job queue | `inngest` v4 — event sent to local dev server or Inngest cloud |

---

## Stage 2 — Career Page Scraping

**Inngest function:** `scrape-company` (`src/inngest/scrapeCompany.ts`)
**Scraper:** `src/lib/scraper.ts`
**Concurrency:** 5 companies in parallel

### 3-Tier Cascade

The scraper tries each tier in order and stops at the first that returns results.

#### Tier 1 — ATS Public APIs (fastest, most reliable)

Detects the ATS from the URL and calls its public JSON API directly. No HTML parsing required.

| ATS | Detection | API endpoint |
|---|---|---|
| **Greenhouse** | `greenhouse.io` in URL | `boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true` |
| **Lever** | `lever.co` in URL | `api.lever.co/v0/postings/{company}?mode=json&limit=10` |

Returns structured data: title, full job content, source URL, department. Up to 10 JDs per company.

#### Tier 2 — Static HTML Scraping (broad coverage)

Used when the ATS is unknown or Tier 1 returns nothing.

1. Fetches the career page HTML with a `research-bot` User-Agent.
2. Uses **cheerio** (server-side jQuery) to find all `<a>` links whose `href` or text contains job-related keywords (`job`, `career`, `position`, `opening`, `vacancy`, `role`).
3. Fetches each individual job link (up to 10), strips `<script>`, `<style>`, `<nav>`, `<footer>`, `<header>` tags, and extracts the body text as the raw JD content.
4. Skips pages with less than 200 characters (likely not real JDs).

**Timeout:** 10 s for the index page, 8 s per individual JD.

#### Tier 3 — Firecrawl SaaS API (JS-rendered pages)

Used when Tiers 1 & 2 return nothing — typically companies that build their careers pages as React/Vue SPAs which can't be scraped with a plain `fetch`.

- Calls `api.firecrawl.dev/v1/crawl` with path filters (`*job*`, `*career*`, `*position*`, `*opening*`).
- Returns each page as **Markdown** (Firecrawl handles headless rendering server-side).
- Only activates when `FIRECRAWL_API_KEY` is set — degrades gracefully without it.
- Timeout: 30 s (crawl is async on Firecrawl's infrastructure).

### After scraping

- JDs are written to the `job_descriptions` table with status `pending`.
- Company `scrape_status` is updated to `complete` (or `failed` / `blocked`).
- One `jd/analyze` Inngest event is sent **per JD** — fan-out from one company event to N JD events.

### Tech
| Concern | Library |
|---|---|
| HTML parsing | `cheerio` — fast server-side DOM querying |
| JS-rendered pages | `Firecrawl` SaaS API (optional) |
| HTTP | Native `fetch` with `AbortSignal.timeout()` |

---

## Stage 3 — LangGraph Analysis

**Inngest function:** `analyze-jd` (`src/inngest/analyzeJD.ts`)
**Concurrency:** 3 JDs in parallel (rate-limit guard against Anthropic API)
**Retries:** 2 automatic retries on failure

### What happens

1. JD status is set to `analyzing`.
2. `createAnalysisGraph()` is invoked — this is the existing 7-agent LangGraph pipeline:

```
jdAnalyser → taskDecomposer → parallelAnalysis (scoring + tools + skills)
           → roiCalc → synthesize → buildRoadmap → finalise
```

3. The graph streams updates; the `finalise` node's output is captured as `FinalAnalysis`.
4. The result is written to the `analyses` table as a **JSONB blob** alongside the extracted scalar fields `overall_score` and `hours_saved` (used for the report card previews without deserialising the full JSON).
5. JD status → `complete`; batch `processed_jds` counter incremented atomically.
6. **Report token generation** — on the first JD completion for a company, an HMAC-SHA256 token is generated and stored against the company. This token is what appears in the shareable report URL.

### On failure

- JD status → `failed`; error message stored.
- Batch `failed_jds` counter incremented.
- Inngest retries up to 2 times automatically before giving up.

### Tech
| Concern | Library |
|---|---|
| Agent orchestration | `@langchain/langgraph` |
| LLM | Anthropic Claude Sonnet 4.6 via `@langchain/anthropic` |
| Observability | LangSmith (every agent call traced) |

---

## Stage 4 — Daily Cron (catch-up)

**Inngest function:** `daily-batch-cron`
**Schedule:** `0 6 * * *` — 6 AM UTC every day

Handles two failure-recovery scenarios:

1. **Unscraped companies** — picks up to 100 companies still in `pending` scrape status and re-queues `company/scrape` events. This is the primary throttle mechanism for large uploads (e.g. 5,000 POC files process ~100 companies/day).
2. **Stuck JDs** — if no pending companies are found, looks for JDs stuck in `pending` status (missed events) and re-queues `jd/analyze` events for them.

---

## Data Model

```
batches          — one per Excel upload
  └── pocs       — one per row in the Excel (the person)
  └── companies  — one per unique company (deduped across batches)
        └── job_descriptions  — one per scraped JD
              └── analyses    — one per completed LangGraph run (JSONB result)
```

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `INNGEST_EVENT_KEY` | Authenticates `inngest.send()` calls |
| `INNGEST_SIGNING_KEY` | Authenticates Inngest → app function invocations |
| `INNGEST_BASE_URL` | Override to `http://localhost:8288` for local dev |
| `INNGEST_DEV` | Set to `1` in local dev to skip signing verification |
| `HMAC_SECRET` | Signs report tokens (32+ char random string) |
| `FIRECRAWL_API_KEY` | Optional — enables Tier 3 JS-rendered scraping |
| `ANTHROPIC_API_KEY` | Powers the LangGraph analysis agents |

---

## Local Development

You need two processes running alongside `npm run dev`:

```bash
# Terminal 2 — Inngest dev server (handles background jobs locally)
npx inngest-cli@latest dev -u http://localhost:3003/api/inngest

# Terminal 3 — push schema to Neon (one-time / on schema changes)
npx drizzle-kit push
```

The Inngest UI at `http://localhost:8288` shows all function runs, event payloads, and retry history.
