# Analytics Migration: PostHog → Admin Pages

## Architecture: Dual-Write Flow

```
User opens report
  └─► ReportTelemetry.tsx (useEffect on mount)
        └─► reportTrack.track(event, ctx, props)   [src/lib/reportTrack.ts:26]
              ├─► posthog.capture(event, props)      [client → PostHog cloud]
              └─► POST /api/track                    [→ report_events table in Postgres]
                      └─► db.insert(reportEvents) + ipHash(sha256) + geoip enrichment
                          [src/app/api/track/route.ts:44]
```

PostHog is **legacy-frozen** — `posthog.capture` calls are not removed. Admin pages are the readable layer on top of the same Postgres data.

---

## Event → Admin Page Mapping

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

> **⚠️ Wizard (hub) sessions only generate:** `report_opened`, `report_tab_hidden/visible`, `report_session_end`. Scroll depth, sections viewed, and download events are `DashboardView` (analysis) only. These charts show 0 for wizard-only companies — this is expected, not a bug.

---

## Lead/Download Write Paths

```
Table               ← Write path                                                   Admin filter
────────────────────────────────────────────────────────────────────────────────────────────────
report_events       ← POST /api/track                                              /admin/analytics
                      [src/app/api/track/route.ts:44]
                      All report visits (behavioral events)

report_leads        ← POST /api/report/[companyId]/interest?token=                 /admin/downloads
                      [src/app/api/report/[companyId]/interest/route.ts:39]
                      source:'cta'       = wizard HubSpot modal (ReportWizard.tsx)
                      source:'download'  = DownloadRolePdfButton (orphaned — not live)

report_downloads    ← POST /api/preview/track-download                             /admin/downloads → Page filter
                      [src/app/api/preview/track-download/route.ts:17]
                      No auth guard. Referrer + UA captured from request headers.
                      Currently only populated from DashboardView/preview flows.
```

---

## Admin Page Feature Inventory

### `/admin/analytics` (AnalyticsCompanyTable)
- Search by company name or slug
- Engagement filter pills: **All / Engaged / Downloaded / Forwarded**
  - Engaged = `sessions > 0`; Downloaded = `downloads > 0`; Forwarded = `devices > 1`
- Date range: 7d / 30d / 90d / All (server-side SQL re-query)
- Columns: Company, Top location (geo), Opens, Sessions, Devices, Downloads (card+page breakdown), Last activity
- Click row → `/admin/analytics/[identifier]` drill-down

### `/admin/analytics/[identifier]` drill-down
- 5 topline cards: Opens, Sessions, Unique devices, Downloads, Avg time/visit
- Scroll depth funnel (25/50/75/100%) — **analysis sessions only**
- Sections viewed bars — **analysis sessions only**
- Top regions (accuracy-aware geo)
- Sessions table: Started, Type (hub/analysis), Role, Location, Device, Duration, Max scroll, Sections, DL
- Event timeline (latest 200 raw events)
- Download Events table (DownloadEventsTable) — **analysis sessions only, always empty for wizard companies**

### `/admin/downloads` (DownloadsTable)
- Filters: All / Card / Page / CTA Lead
- **Card** = `report_leads` where `source='download'` — role-card PDF gate
- **Page** = `report_downloads` — in-report PDF download (has referrer + delete button)
- **CTA Lead** = `report_leads` where `source='cta'` — wizard "Get your full analysis" form
- Each row: Type badge, Email (mailto:), Company, Report slug, Referrer (Page only), Date
- Referrer is `null` for Card and CTA Lead rows — `report_leads` has no referrer column

---

## PostHog vs Admin Pages

| Concern | PostHog | Admin pages |
|---|---|---|
| Behavioral events (opens, scroll, downloads) | ✅ Full history | ✅ Full history (same source, dual-write) |
| Wizard CTA leads (email) | ❌ Never (HubSpot captures it) | ✅ `report_leads` source:cta |
| Role-card PDF leads | ❌ Not in PostHog | ✅ `report_leads` source:download |
| PDF download details (referrer, UA) | ❌ | ✅ `report_downloads` |
| Group analytics (by company) | ❌ Free plan locked | ✅ Direct SQL aggregation |
| `$pageview` autocapture | ✅ | ❌ Not mirrored |

**PostHog free-plan limits:**
- Group analytics locked → aggregate by `distinct_id` (= report token) instead
- No data warehouse pipeline — PostHog data stays in PostHog cloud; admin reads Postgres only

---

## Known Dead Code / Cleanup Items

1. **`hasMxRecord` in `/interest` route** (`src/app/api/report/[companyId]/interest/route.ts:7–14`): Defined but never called. Removed in commit `b9f1d17` to stop silently dropping leads for domains without MX records. Safe to delete in a cleanup PR.

2. **`DownloadRolePdfButton.tsx`** and **`DownloadAllButton.tsx`**: No live import sites in the wizard. Kept as placeholders — see Future section below.

3. **PDF API routes** (`/api/report/[companyId]/[analysisId]/pdf`, `/api/report/[companyId]/download`): No live callers. Kept for future Download button.

---

## Future: Download Button Swap Recipe

When ready to replace (or add alongside) the bottom "Get your full analysis →" CTA with a Download button:

**Entry point:** `src/components/report/wizard/WizardBottomBar.tsx:94`
On `isLast = step === totalSteps`, button calls `onContinue` → `handleContinue` in `ReportWizard.tsx:57` → `setModalOpen(true)`.
To swap: `else triggerDownload()` instead of (or after) the modal.

**Two ways downloads reach the admin DB:**

| Path | Endpoint | DB table | Admin filter |
|---|---|---|---|
| Email-gated per-role PDF | `POST /api/report/[companyId]/interest?token=` with `source:'download'` | `report_leads` | **Card** |
| Direct PDF tracking | `POST /api/preview/track-download` (no auth) | `report_downloads` | **Page** (has delete button) |

**Orphaned components ready to re-use:**
- `src/components/report/DownloadRolePdfButton.tsx` — inline email gate + `source:'download'` POST + `report_downloaded` track event
- `src/components/report/DownloadAllButton.tsx` — client-side ZIP via `/api/report/[id]/download`

---

*Last updated: 2026-06-14 — reflects wizard v2 migration on branch `feat/wizard-v2-migration`*
