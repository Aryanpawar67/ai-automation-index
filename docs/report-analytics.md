# Report Analytics (PostHog)

How to read prospect engagement on the personalised report links sent in the
`100-leads-90-days` outbound campaign.

URL shape: `/report/<company-slug>?token=<unique-token>` (hub) and
`/report/<company-slug>/<analysisId>?token=<unique-token>` (per-role report).

The token is unique per company and acts as the PostHog `distinct_id`. Same
token from a different device/IP = the link was forwarded.

---

## Tracking layer

Files:
- `src/components/report/ReportTelemetry.tsx` — identify, group, page-level events.
- `src/components/DashboardView.tsx` — section / scroll / download tracking on the per-role report.
- Mounted from both `src/app/report/[companyId]/page.tsx` (hub) and `src/app/report/[companyId]/[analysisId]/page.tsx` (role report).

All events carry these base properties:
- `company` — company slug from URL
- `token` — token query param (also the distinct_id)
- `campaign` — `100-leads-90-days`
- `report_url` — full `window.location.href`
- `report_type` — `hub` | `analysis`
- `job_title` — present on per-role events

If `token` is missing the client tracker no-ops (server-side token gate already
404s invalid tokens, so this is defence in depth).

---

## Events

| Event | Fires on | Page | Notes |
|---|---|---|---|
| `$pageview` | every route change | both | PostHog autocapture |
| `report_opened` | mount | both | Includes `report_type` |
| `report_section_viewed` | section enters viewport ≥40% | analysis | One per section per session. `section` ∈ `impact_summary`, `kpis`, `score_breakdown`, `category_radar`, `skills_analysis`, `tasks`, `opportunities` |
| `report_scrolled_depth` | crossing 25 / 50 / 75 / 100% page depth | analysis | One per milestone per session. `depth_pct` |
| `report_downloaded` | Download PDF clicked | analysis | Includes `email` if email gate submitted |
| `report_tab_hidden` | `document.hidden = true` | both | Tab backgrounded |
| `report_tab_visible` | `document.hidden = false` | both | Tab refocused |
| `report_session_end` | `pagehide` / `beforeunload` | both | Includes `time_spent_seconds` |

`posthog.identify(token, …)` runs on mount so all sessions on the same link are
attributed to one person identity. `posthog.group('company', slug, …)` is also
called — see "Free plan limits" below for what that buys you.

---

## Page A — Report Hub (`/report/<slug>?token=…`)

Landing index listing all role reports for a company. Mostly navigation; engagement
signal is coarse.

Events emitted: `$pageview`, `report_opened`, `report_tab_hidden`,
`report_tab_visible`, `report_session_end`.

### Questions you can answer

- **Did axa-us open the email link at all?**
  Trends → `report_opened` filter `company = axa-us`. First timestamp = first open.

- **Did they bounce immediately?**
  Trends → `report_session_end` filter `report_type = hub` AND `time_spent_seconds < 10`.

- **How many roles did they explore?**
  Trends → `report_opened` filter `report_type = analysis`, breakdown by `distinct_id` (or `company`). Count per identity = roles viewed.

- **Hub → role click-through rate**
  Funnel → step 1 `report_opened` (`report_type = hub`) → step 2 `report_opened` (`report_type = analysis`).
  Below ~40% = hub copy isn't selling the click.

---

## Page B — Role Report (`/report/<slug>/<analysisId>?token=…`)

The DashboardView. Rich engagement signal lives here.

Events emitted: `$pageview`, `report_opened`, `report_section_viewed`,
`report_scrolled_depth`, `report_downloaded`, `report_tab_hidden`,
`report_tab_visible`, `report_session_end`.

### Questions you can answer

1. **Did the prospect open the report, and when?**
   Trends → `report_opened` (`report_type = analysis`), breakdown by `company`. First event per distinct_id = first open. Repeats on the same distinct_id = return visits.

2. **How long did they spend reading it?**
   Trends → `report_session_end`, math = average of `time_spent_seconds`, breakdown by `company` / `job_title`. Useful buckets: <10s bounce, 10–60s skim, 60–300s read, >300s deep dive.

3. **How far did they scroll?**
   Funnel → `report_opened` → `report_scrolled_depth (depth_pct=25)` → 50 → 75 → 100. Drop-off shape shows where attention dies.

4. **Did they see the automation score / recommendations?**
   Trends → `report_section_viewed`, breakdown by `section`. Comparing `kpis` vs `opportunities` view rate shows whether prospects reach the recommendations or stop at the score.

5. **Did they download the PDF?**
   Funnel → `report_opened` → `report_downloaded`. Conversion % per company = deep-interest signal. Downloaded events also include the email they entered.

6. **Was the link forwarded?**
   - Persons view → search by `distinct_id = <token>`. Different `$device_id` / `$ip` / `$browser` / `$geoip_city` values across sessions on one token = forwarded.
   - Trends → `report_opened`, math = unique sessions vs unique persons. Delta = forwards.

7. **Did they come back?**
   Retention or Trends with unique sessions on `report_opened` per `distinct_id`. ≥2 sessions across separate days = returner. Returners are high-intent (showing colleagues / re-reading before a call).

8. **Which section did they spend most time on?**
   Partial — `report_section_viewed` tells you *what* they saw, not *how long*. Proxy: cross-reference section view timestamps with `report_tab_hidden` events to see what was on screen when they tabbed away. For real per-section dwell, add an "exited section" event (not currently instrumented).

9. **Tab behavior**
   - Many `report_tab_hidden` ↔ `report_tab_visible` pairs in one session = high intent (cross-referencing with another tab).
   - `report_tab_hidden` with no `_visible` before `report_session_end` = distracted close.

---

## Useful PostHog views to build

### Per-company dashboard
Filter all insights by `properties.company`:
- Open count + first-opened-at
- Time-spent histogram (`report_session_end.time_spent_seconds`)
- Scroll-depth funnel
- Section view rates
- Download count
- Forwarded yes/no flag (multiple devices on one token)
- Return-visit count

### Cohorts worth building

- **Engaged but didn't download**: `report_opened` AND `report_scrolled_depth (depth_pct≥75)` AND NOT `report_downloaded`. Warmest leads who almost converted — manual follow-up list.
- **Forwarded internally**: distinct_id with sessions across ≥2 distinct devices/IPs. Report is being passed up the chain (probably to a decision-maker).
- **Deep readers**: `time_spent_seconds > 180` AND `report_section_viewed (section=opportunities)`. Send a follow-up referencing a specific opportunity from their report.

### Per-job-title comparison (analysis page only)
Breakdown any insight by `properties.job_title`. Reveals which roles in their org generate the most interest — often a hint at where the pain lives.

---

## Free plan limits (current PostHog plan)

Plan includes:
- 1 project
- 1-year data retention
- Community support

Plan does **not** include:
- **Capped usage** — events beyond the monthly free allowance are dropped, not billed. Watch the project usage page; if usage spikes you'll lose events until the cap resets.
- **Group analytics** — the `posthog.group('company', slug, …)` call still fires and tags events with `$groups.company`, so you can filter/breakdown by `properties.$groups__company` like any other property. What's locked is the "Aggregate by group" rollup view (e.g. "average time spent *per company* as a single number across all visitors on that token"). Workaround: use `distinct_id` (= token) as the aggregation unit, since one token ≈ one company. Good enough for outbound at ~100 leads scale.
- **Data pipeline addons** — no warehouse/destination forwarding. All analysis stays in PostHog.

Practical implications at 100 leads / 90 days:
- Event volume is tiny. Each opened report generates ~10–30 events. Even with heavy engagement (downloads, returns, forwards) total monthly events stay well within Free tier.
- The missing "group rollup" doesn't hurt much because each token maps 1:1 to a company in your CRM. Filter-by-company gives you the same answers.
- 1-year retention is fine for a 90-day campaign.

---

## Known gaps

- **Per-section dwell time** — only entry events; no exit events. See question 8.
- **Hover / interaction on KPI tooltips / charts** — not tracked. Could add `report_kpi_hovered`, `report_task_card_hovered` if needed.
- **PDF read-through** — lost after download (no PDF-side instrumentation).
- **Email-as-identity** — the prospect's email is only captured at the download gate. `distinct_id` stays as the token; the email→token mapping lives in your outbound CRM, not PostHog. To make email the canonical identity in PostHog after submit, call `posthog.identify(email, { token })` inside `handleEmailSubmit` in `DashboardView.tsx`. Not yet wired.
