# Plan: PostHog Analytics Migration → Admin Pages + DB Verification

## Background

The report was rebuilt around **wizard v2** (`ReportWizard`). During that overhaul:
- The old hero strips (`CompleteCoverageHeroStrip`, `FullAnalysisHeroStrip`) that wrote `report_leads` were **deleted**.
- The wizard's "Get your full analysis" buttons now open `HubSpotModal`, which captures email **only into HubSpot — never into `report_leads`**.
- Result: `/admin/downloads` CTA Leads is blind to every wizard conversion.

PostHog is **legacy-frozen** per `docs/ANALYSIS-AND-NEXT-STEPS.md` — nothing is removed. The goal is to make the two admin dashboards a readable, self-contained mirror of what PostHog previously showed, and close the wizard→DB lead gap.

### What the wizard does and does NOT track (important context)

The wizard (`reportType = "hub"`) fires these events via `ReportTelemetry.tsx`:
- ✅ `report_opened` — on mount
- ✅ `report_tab_hidden` / `report_tab_visible` — on visibility change
- ✅ `report_session_end` — on pagehide/beforeunload with `time_spent_seconds`

The wizard does **NOT** fire:
- ❌ `report_scrolled_depth` — wired in `DashboardView.tsx:262` only (horizontal swipe in wizard, no vertical scroll depth concept)
- ❌ `report_section_viewed` — wired in `DashboardView.tsx:283` only
- ❌ `report_downloaded` — wired in `DashboardView.tsx:306` and `DownloadRolePdfButton.tsx:62`, both orphaned from the wizard

**Consequence:** For wizard-only traffic, the scroll depth funnel, sections viewed chart, and Download Events table on `/admin/analytics` will always show empty/zero. These charts only populate from `analysis` (DashboardView) sessions. This is not a bug — the wizard deliberately replaced that flow — but must be documented clearly so admins don't misread the zeros.

---

## STEP 1 — Fix the wizard → `report_leads` gap
**Files:** `src/app/report/[companyId]/page.tsx`, `src/components/report/wizard/ReportWizard.tsx`

**Why first:** Every other change is cosmetic; this is a live functional gap. Until fixed, `/admin/downloads` CTA Leads shows zero wizard conversions.

### 1a. Pass `companyId` down to `ReportWizard`
In `src/app/report/[companyId]/page.tsx` at lines 57–62:

```tsx
// BEFORE
<ReportWizard
  company={company.name}
  wizardData={company.wizardData}
  token={token}
/>

// AFTER
<ReportWizard
  company={company.name}
  companyId={company.id}      // ← add: UUID for the interest POST
  wizardData={company.wizardData}
  token={token}
/>
```

### 1b. Accept `companyId` in `ReportWizard` and POST on form submit
In `src/components/report/wizard/ReportWizard.tsx`:

1. Add `companyId: string` to the `Props` interface (lines 16–20).
2. Change `token: _token` → `token` in the destructure on line 22 (token is now used in the fetch).
3. Replace the `HubSpotModal` render block (lines 108–113):

```tsx
{modalOpen && (
  <HubSpotModal
    onClose={() => setModalOpen(false)}
    onSubmitted={(email) => {
      if (email) {
        // Mirror to our DB (fire-and-forget). HubSpot remains source of record.
        // This makes wizard CTA leads visible on /admin/downloads → CTA Lead filter.
        fetch(
          `/api/report/${companyId}/interest?token=${encodeURIComponent(token)}`,
          {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ email, source: "cta" }),
          }
        ).catch(() => {});
      }
      setModalOpen(false);
    }}
  />
)}
```

**Why no API change needed:**
`HubSpotModal` already extracts email from the `onFormSubmitted` postMessage at `HubSpotModal.tsx:133` and passes it to `onSubmitted(email?: string)`. The existing `/api/report/[companyId]/interest/route.ts` validates token, validates email format, and inserts into `reportLeads` with `source:'cta'`.

**Two modal entry points (both need this wiring):**
- Bottom bar: `WizardBottomBar.tsx:94` — label **"Get your full analysis →"** (only on step 4; orange background)
- Nav button: `WizardNav.tsx:95` — label **"Get your custom analysis"** (always visible; same orange)
Both call `setModalOpen(true)` in `ReportWizard.tsx`, so the single `onSubmitted` handler covers both.

---

## STEP 2 — Add plain-language framing to `/admin/analytics`
**File:** `src/app/admin/analytics/page.tsx`

### 2a. Header subtitle
At line 151, update the subtitle `<p>` text:

```
// BEFORE
"Engagement on personalised report links sent in outbound campaigns"

// AFTER
"Self-hosted mirror of PostHog report events — opens, sessions, and downloads per company. Scroll depth and section views only appear for legacy analysis (DashboardView) sessions, not wizard."
```

### 2b. Topline card subtitles — plain-language per metric
The 4 topline cards (lines 157–180) have only `label` + `value`. Add a `sub` field and render it below the value (10px muted color, same style as the existing `hint` field):

| Card label | Sub text to add |
|---|---|
| Companies engaged | `distinct sessions > 0 out of all token-enabled companies` |
| Forwarded | `link accessed from 2+ distinct device/network signatures` |
| Total sessions | `distinct sessionIds · new session per tab/page-mount` |
| Total downloads | `report_downloaded events · role-card (Card) + in-report (Page)` |

**Note:** Total downloads will be 0 for pure wizard traffic — `report_downloaded` is not fired by the wizard (see Background section above).

### 2c. Engagement filter pills — document in the migration doc
`AnalyticsCompanyTable.tsx` already renders **All / Engaged / Downloaded / Forwarded** filter pills (lines 31–38). These are a key usability feature. No code change needed, but they must be described in `docs/analytics-migration.md`:
- **Engaged** = `sessions > 0`
- **Downloaded** = `downloads > 0` (will be 0 for all wizard-only companies)
- **Forwarded** = `devices > 1`

### 2d. Range toggle scope note
Above `<AnalyticsCompanyTable>` (after line 191), add a one-line informational note:
```
"Showing: {range} · Range applies to event timestamps. Companies with 0 events in range still appear with zero counts."
```

---

## STEP 3 — Add plain-language framing to `/admin/analytics/[identifier]`
**File:** `src/app/admin/analytics/[identifier]/page.tsx`

### 3a. Topline card subtitles
At lines 203–226 the 5 topline cards have only `label` + `value`. Add sub-labels:

| Card | Sub text |
|---|---|
| Opens | `report_opened events · one per page-mount` |
| Sessions | `distinct sessionIds · new session per browser tab` |
| Unique devices | `distinct ip_hash + user_agent combos · >1 = likely forwarded` |
| Downloads | `report_downloaded events · 0 for wizard (hub) sessions` |
| Avg time/visit | `from report_session_end · 0s if tab closed without sending` |

### 3b. Scroll depth funnel — clarify wizard gap
At line 233, update the subtitle:

```
// BEFORE
"Sessions that reached each milestone"

// AFTER
"Sessions that reached each scroll milestone — report_scrolled_depth events. Only fires from DashboardView (analysis) sessions, not wizard (hub) sessions. Expect 0 for companies with only wizard traffic."
```

### 3c. Sections viewed — clarify wizard gap
At line 256, update the subtitle:

```
// BEFORE
"Distinct sessions per section (analysis pages)"

// AFTER
"Distinct sessions per report section — report_section_viewed events. Only fires from DashboardView (analysis) sessions, not wizard (hub) sessions."
```

### 3d. Sessions table — clarify Type column
Under the "Sessions" section header (lines 316–318), add a `<p>` subtitle:
```
"hub = wizard v2 · analysis = legacy DashboardView per-role · multiple devices on same token = link was forwarded"
```

### 3e. Download Events section — wizard gap warning
The `<DownloadEventsTable>` component appears at the bottom of `/admin/analytics/page.tsx` (line 195). On the page itself, add a note **above** the component:
```
"Download events (report_downloaded) are only fired from DashboardView PDF downloads — not the wizard report. This table will be empty for wizard-only companies."
```

### 3f. Event timeline — label each event type
Under the "Event timeline" header (line 395), add a subtitle:
```
"report_opened · report_tab_hidden/visible · report_scrolled_depth · report_section_viewed · report_downloaded · report_session_end — all server-mirrored from PostHog dual-write"
```

---

## STEP 4 — Update `/admin/downloads` header to explain row types
**File:** `src/app/admin/downloads/page.tsx`

### 4a. Subtitle copy
At lines 52–54, keep the counts line and add a second `<p>` below it:

```tsx
// Existing line (keep)
{cardRows.length + pageRows.length} download{...} · {ctaRows.length} CTA lead{...} · {total} total

// Add below:
"Card = role-card PDF gate → report_leads (source:download)
 Page = in-report PDF download → report_downloads (has referrer + delete)
 CTA Lead = 'Get your full analysis' form → report_leads (source:cta)"
```

**Referrer note:** Only **Page** rows (`report_downloads`) have a referrer value — `report_leads` has no referrer column, so Card and CTA Lead rows always show "—" in the Referrer column. No schema change needed; just document this.

### 4b. No changes to `DownloadsTable.tsx`
All/Card/Page/CTA toggle, TYPE_META badges, and `mailto:` email links are already correct.

---

## STEP 5 — Create `docs/analytics-migration.md`
**File:** `docs/analytics-migration.md` (new file)

### Section 1: Architecture — dual-write flow
```
User opens report
  └─► ReportTelemetry.tsx (useEffect on mount)
        └─► reportTrack.track(event, ctx, props)   [src/lib/reportTrack.ts:26]
              ├─► posthog.capture(event, props)      [client → PostHog cloud]
              └─► POST /api/track                    [→ report_events table in Postgres]
                      └─► db.insert(reportEvents) + ipHash(sha256) + geoip enrichment
                          [src/app/api/track/route.ts:44]
```

### Section 2: Event → admin page mapping table

| PostHog event | DB event name | Fires from | Admin page | Where shown |
|---|---|---|---|---|
| `report_opened` | `report_opened` | `ReportTelemetry.tsx:32` (all sessions) | `/admin/analytics` | "Companies engaged" card + "Opens" drill-down card |
| *(session boundary)* | distinct `session_id` | `reportTrack.getSessionId()` | `/admin/analytics` | "Total sessions" card |
| `report_scrolled_depth` | `report_scrolled_depth` | `DashboardView.tsx:262` (**analysis only**) | `/admin/analytics/[id]` | Scroll depth funnel |
| `report_section_viewed` | `report_section_viewed` | `DashboardView.tsx:283` (**analysis only**) | `/admin/analytics/[id]` | Sections viewed bars |
| `report_downloaded` | `report_downloaded` | `DashboardView.tsx:306` + `DownloadRolePdfButton.tsx:62` (**analysis only**) | `/admin/analytics` | Total downloads card + DownloadEventsTable |
| `report_session_end` | `report_session_end` | `ReportTelemetry.tsx:41` (all sessions) | `/admin/analytics/[id]` | "Avg time/visit" card |
| `report_tab_hidden/visible` | same | `ReportTelemetry.tsx:35` (all sessions) | — | Raw event timeline only |
| `$pageview` | *(PostHog autocapture — no server mirror)* | PostHog JS | — | PostHog only |

**⚠️ Wizard (hub) sessions only generate:** `report_opened`, `report_tab_hidden/visible`, `report_session_end`. All others are analysis-only.

### Section 3: Lead/download write paths

```
Table            ← Write path                                                   Source
─────────────────────────────────────────────────────────────────────────────────────────
report_events    ← POST /api/track                                              All report visits
                   [src/app/api/track/route.ts:44]

report_leads     ← POST /api/report/[companyId]/interest?token=                 Email gate
                   [src/app/api/report/[companyId]/interest/route.ts:39]
                   source:'cta'      = wizard HubSpot modal (after Step 1 fix)
                   source:'download' = DownloadRolePdfButton (orphaned — not live)

report_downloads ← POST /api/preview/track-download                             PDF download
                   [src/app/api/preview/track-download/route.ts:17]
                   NOTE: No auth guard — anyone can POST. Referrer + UA captured.
                   Currently only populated from DashboardView flows (not wizard).
```

### Section 4: Admin page feature inventory

**`/admin/analytics` (`AnalyticsCompanyTable`):**
- Search by company name or slug
- Engagement filter pills: **All / Engaged / Downloaded / Forwarded**
  - Engaged = sessions > 0; Downloaded = downloads > 0; Forwarded = devices > 1
- Date range selector: 7d / 30d / 90d / All (server-side SQL re-query)
- Columns: Company, Top location (geo), Opens, Sessions, Devices, Downloads (card+page breakdown), Last activity
- Click any row → drill down to `/admin/analytics/[identifier]`

**`/admin/analytics/[identifier]` drill-down:**
- Scroll depth funnel (25/50/75/100%) — analysis sessions only
- Sections viewed bars — analysis sessions only
- Top regions (geo, accuracy-aware)
- Sessions table: Started, Type (hub/analysis), Role, Location, Device, Duration, Max scroll, Sections, DL
- Event timeline (latest 200 raw events)
- Download Events (DownloadEventsTable) — analysis sessions only, always 0 for wizard companies

**`/admin/downloads`:**
- All/Card/Page/CTA Lead toggle
- Each row: Type badge, Email (mailto:), Company, Report slug (Page only), Referrer (Page only; Card/CTA = "—"), Date
- Delete button: Page rows only (removes from `report_downloads`)

### Section 5: PostHog vs admin — what each covers

| Concern | PostHog | Admin pages |
|---|---|---|
| Behavioral events (opens, scroll, downloads) | ✅ Full history | ✅ Full history (same source, dual-write) |
| Wizard CTA leads (email) | ❌ Never (HubSpot captures it) | ✅ After Step 1 fix |
| Role-card PDF leads | ❌ Not in PostHog | ✅ report_leads (source:download) |
| PDF download details (referrer, UA) | ❌ | ✅ report_downloads |
| Group analytics (by company) | ❌ Free plan locked | ✅ (direct SQL aggregation) |
| Email-as-PostHog-identity | ❌ Not wired | n/a |
| `$pageview` autocapture | ✅ | ❌ Not mirrored |

**PostHog free-plan limits (from `docs/report-analytics.md`):**
- Group analytics locked → use `distinct_id` (= report token) for per-company aggregation.
- No data warehouse pipeline → data stays in PostHog cloud; admin reads Postgres only.

**To wire email identity into PostHog (currently "Not yet" — `docs/report-analytics.md:166`):**
Inside `HubSpotModal`'s `onSubmitted` handler, add:
```ts
posthog.identify(email, { token });
```

### Section 6: Known dead code / cleanup items

1. **`hasMxRecord` in `/interest` route** (`src/app/api/report/[companyId]/interest/route.ts:7–14`): The function is defined but never called. It was removed in commit `b9f1d17` to stop silently dropping `report_leads` rows for domains without MX records. Safe to delete in a cleanup PR.

2. **`DownloadRolePdfButton.tsx`** and **`DownloadAllButton.tsx`**: No live import sites. Kept intentionally for future Download button swap (see Section 7).

3. **PDF API routes** (`/api/report/[companyId]/[analysisId]/pdf`, `/api/report/[companyId]/download`): No live callers in wizard. Kept for future use.

### Section 7: Future — Download button swap recipe

When ready to replace (or add alongside) the bottom "Get your full analysis" CTA with a Download button:

**Entry point:** `src/components/report/wizard/WizardBottomBar.tsx` line 94.
On the final step (`isLast = step === totalSteps`), the button calls `onContinue` → `handleContinue` in `ReportWizard.tsx:57` → `setModalOpen(true)`.
To swap: branch `handleContinue` → `if (step < TOTAL_STEPS) goTo(step + 1); else triggerDownload();`

**Two ways to wire downloads into the admin DB:**

| Path | API endpoint | DB table | Admin filter |
|---|---|---|---|
| Email-gated per-role PDF | `/api/report/[companyId]/interest?token=` with `source:'download'` | `report_leads` | **Card** filter |
| Direct PDF download tracking | `/api/preview/track-download` (no auth) | `report_downloads` | **Page** filter (gets delete button) |

**Orphaned components ready to re-use:**
- `src/components/report/DownloadRolePdfButton.tsx` — inline email gate + `source:'download'` POST + `report_downloaded` event
- `src/components/report/DownloadAllButton.tsx` — client ZIP via `/api/report/[id]/download`

---

## STEP 6 — End-to-end DB verification
Run the dev server and confirm all three tables flow through to the admin pages.

### 6a. Setup
```bash
npm run dev
# Grab a real company row (need id, slug, reportToken):
# SELECT id, slug, report_token FROM companies WHERE report_token IS NOT NULL LIMIT 3;
```

### 6b. Verify `report_leads` (CTA path) — the primary wizard wiring test
1. Open `http://localhost:3000/report/<slug>?token=<reportToken>` in Chrome.
2. Click **"Get your custom analysis"** (nav) OR advance to Step 4 and click **"Get your full analysis →"** (bottom bar).
3. Submit the HubSpot form with `verify+cta@imocha-test.com`.
4. Check DB:
   ```sql
   SELECT id, company_id, email, source, created_at
   FROM report_leads ORDER BY created_at DESC LIMIT 1;
   ```
   → expect `source='cta'`, correct `company_id`, email present.
5. Open `http://localhost:3000/admin/downloads` → **CTA Lead** filter → row appears with company name + mailto link. ✅

### 6c. Verify `report_leads` (download source) — endpoint guards
```bash
# Happy path
curl -s -X POST "http://localhost:3000/api/report/<companyId>/interest?token=<token>" \
  -H "Content-Type: application/json" \
  -d '{"email":"verify+dl@imocha-test.com","source":"download"}' | jq
# → {"ok":true}

# Bad token → 403
curl -s -X POST "http://localhost:3000/api/report/<companyId>/interest?token=WRONG" \
  -H "Content-Type: application/json" \
  -d '{"email":"verify+dl@imocha-test.com"}' | jq
# → {"error":"Unauthorized"}

# Bad email format → 400
curl -s -X POST "http://localhost:3000/api/report/<companyId>/interest?token=<token>" \
  -H "Content-Type: application/json" \
  -d '{"email":"notanemail"}' | jq
# → {"error":"Valid email required."}
```
Then `/admin/downloads` **Card** filter shows the row.

### 6d. Verify `report_downloads` — track-download endpoint (no auth)
```bash
curl -s -X POST "http://localhost:3000/api/preview/track-download" \
  -H "Content-Type: application/json" \
  -d '{"email":"verify+page@imocha-test.com","reportSlug":"<slug>","companyName":"<name>"}' | jq
# → {"ok":true}
```
Check DB:
```sql
SELECT email, report_slug, company_name, referrer, downloaded_at
FROM report_downloads ORDER BY downloaded_at DESC LIMIT 1;
```
`/admin/downloads` **Page** filter shows the row with a delete button (referrer will be null from curl — expected).

### 6e. Verify `report_events` → `/admin/analytics`
1. Keep the report open in Chrome for 10+ seconds (triggers `report_opened` on mount, `report_session_end` on close).
2. Check DB:
   ```sql
   SELECT event, company_id, report_type, ip_hash, country, created_at
   FROM report_events ORDER BY created_at DESC LIMIT 5;
   ```
   → `report_opened` row with `report_type='hub'`, correct `company_id`, `ip_hash` populated, geo fields populated if GeoLite2 mmdb present in `data/`.
3. `/admin/analytics` → company's **Opens** and **Sessions** counts increment.
4. `/admin/analytics/<slug>` → sessions table shows new session with duration after tab close.
5. Confirm scroll funnel and sections viewed remain **0** (wizard sessions don't fire these events — this is expected, not a bug).

### 6f. Readability spot-check (Steps 2–4)
- Each topline card on both analytics pages has a plain subtitle.
- `/admin/analytics/[id]` funnel and sections cards note they're analysis-only.
- Download Events table on analytics notes it's empty for wizard companies.
- `/admin/downloads` header explains Card vs Page vs CTA Lead + referrer gap.
- `docs/analytics-migration.md` event table marks which events are wizard vs analysis.

---

## Files changed (sequential order)

| # | File | What changes |
|---|---|---|
| 1 | `src/app/report/[companyId]/page.tsx` | Pass `companyId={company.id}` to `ReportWizard` |
| 2 | `src/components/report/wizard/ReportWizard.tsx` | Add `companyId` prop; `onSubmitted` POSTs to `/interest` |
| 3 | `src/app/admin/analytics/page.tsx` | Updated subtitle + topline card sub-labels + note above DownloadEventsTable |
| 4 | `src/app/admin/analytics/[identifier]/page.tsx` | Card sub-labels + funnel/sections/sessions/timeline subtitles |
| 5 | `src/app/admin/downloads/page.tsx` | Header subtitle explaining Card/Page/CTA row types + referrer note |
| 6 | `docs/analytics-migration.md` | New file: event map, architecture, admin inventory, PostHog vs admin, dead code, future Download hooks |

## Download placeholder files — DO NOT DELETE

These files have no live import sites in the wizard but are kept as ready-to-wire placeholders for the future Download button swap. Do not remove them during cleanup.

| File | Status | Purpose when re-wired |
|---|---|---|
| `src/components/report/DownloadRolePdfButton.tsx` | Orphaned placeholder | Inline email gate; POSTs `source:'download'` to `/interest` → `report_leads` Card filter |
| `src/components/report/DownloadAllButton.tsx` | Orphaned placeholder | Client-side ZIP download via `/api/report/[id]/download` |
| `src/app/api/report/[companyId]/[analysisId]/pdf/route.ts` | Orphaned placeholder | Playwright/Chromium PDF generation (maxDuration 60s) |
| `src/app/api/report/[companyId]/download/route.ts` | Orphaned placeholder | JSON payload for ZIP download |
| `src/app/api/preview/track-download/route.ts` | Active (admin/preview use) | Inserts into `report_downloads` → Page filter on `/admin/downloads` |

## Files intentionally NOT touched (analytics layer — frozen)
`ReportTelemetry.tsx` · `reportTrack.ts` · `PostHogProvider.tsx` · all `posthog.capture` calls ·
`HubSpotModal.tsx` · `DownloadsTable.tsx` · `DownloadEventsTable.tsx` · `AnalyticsCompanyTable.tsx`
