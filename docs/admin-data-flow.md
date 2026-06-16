# Admin Data Flow: Analytics & Downloads

How user actions on report pages translate into rows in the database and what the admin pages display.

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `report_events` | Every behavioral event (opens, scrolls, downloads, sessions) |
| `report_leads` | Email captures from the wizard CTA (source='cta') or PDF gate (source='download') |
| `report_downloads` | PDF download records with referrer URL (from DashboardView) |

### `report_events` columns
```
id, company_id, token, session_id, event, report_type ('hub'|'analysis'),
job_title, props (jsonb), user_agent, ip_hash (SHA256), referrer,
country, region, city, accuracy_km (MaxMind), created_at
```
- `session_id` = one UUID per browser tab
- `ip_hash` = SHA256(ip + REPORT_EVENTS_IP_SALT env var) — used to count unique devices

### `report_leads` columns
```
id, company_id, email, source ('cta'|'download'), created_at
```

### `report_downloads` columns
```
id, email, report_slug, company_name, user_agent, referrer, downloaded_at
```

---

## User Actions → DB Writes

### Hub page (`/report/[companyId]`) — wizard

| User action | Event fired | Where it lands |
|-------------|-------------|----------------|
| Page loads | `report_opened` (reportType='hub') | `report_events` |
| Switches tab away | `report_tab_hidden` | `report_events` |
| Switches tab back | `report_tab_visible` | `report_events` |
| Closes/navigates away | `report_session_end` (props: time_spent_seconds) | `report_events` |
| Submits email in wizard CTA modal | — | `report_leads` (source='cta') via `/api/report/[companyId]/interest` |

**Scroll depth, section views, and download events do NOT fire on hub pages.**

### Analysis page (`/report/[companyId]/[analysisId]`) — DashboardView

| User action | Event fired | Where it lands |
|-------------|-------------|----------------|
| Page loads | `report_opened` (reportType='analysis') | `report_events` |
| Scrolls past 25/50/75/100% | `report_scrolled_depth` (props: depth_pct) | `report_events` |
| Section enters viewport ≥40% | `report_section_viewed` (props: section) | `report_events` |
| Clicks Download PDF (page) | `report_downloaded` (props: source='report_page', email) | `report_events` + `report_downloads` |
| Clicks Download PDF (role card) | `report_downloaded` (props: source='role_card', email) | `report_events` + `report_downloads` |
| Switches tab / closes | (same as hub) | `report_events` |

---

## How Events Are Sent

All `report_events` writes go through:
```
Client component → reportTrack.track() → POST /api/track → INSERT report_events
```

`report_session_end` uses `navigator.sendBeacon()` so it fires reliably on page unload.

Lead captures:
```
HubSpotModal onSubmitted callback → POST /api/report/[companyId]/interest?token= → INSERT report_leads
```

Download tracking:
```
DashboardView download click → POST /api/preview/track-download → INSERT report_downloads
```

---

## `/admin/analytics` Page

**Source:** aggregates `report_events` LEFT JOIN `companies`, grouped by `company_id`

### Topline cards
| Card | SQL |
|------|-----|
| Companies engaged | count of companies with `sessions > 0` |
| Forwarded | count of companies with `devices > 1` (multiple distinct ip_hash+user_agent) |
| Total sessions | SUM of distinct session_ids across all companies |
| Total downloads | SUM of `report_downloaded` event count |

### Company table columns
| Column | How computed |
|--------|-------------|
| Opens | `COUNT(*) WHERE event='report_opened'` |
| Sessions | `COUNT(DISTINCT session_id)` |
| Devices | `COUNT(DISTINCT ip_hash || user_agent)` |
| Downloads (card) | `COUNT(*) WHERE event='report_downloaded' AND props->>'source'='role_card'` |
| Downloads (page) | `COUNT(*) WHERE event='report_downloaded' AND props->>'source'!='role_card'` |
| Last activity | `MAX(created_at)` |
| Top location | MaxMind geo from events (city if accuracy_km < 50, else region, else country) |

### Client-side filters
- **Search:** company name or slug
- **Engagement pills:** All / Engaged (sessions > 0) / Downloaded (downloads > 0) / Forwarded (devices > 1)
- **Date range:** 7d / 30d / 90d / All (server-side re-query, filtered on `created_at`)

### Download Events table (bottom of analytics page)
- Latest 200 `report_downloaded` events across all companies
- Toggle: All / Card (`source='role_card'`) / Page (`source!='role_card'`)
- Columns: type badge, email, company, role, date

---

## `/admin/analytics/[slug]` Drill-down

**Source:** all `report_events` for one company, then aggregated in-memory by session_id

### Topline cards
| Card | Source |
|------|--------|
| Opens | count `report_opened` events |
| Sessions | count distinct `session_id` |
| Unique devices | count distinct `ip_hash || user_agent` |
| Downloads | count `report_downloaded` events |
| Avg time/visit | avg `props.time_spent_seconds` from `report_session_end` events |

### Scroll depth funnel (analysis sessions only)
Groups `report_scrolled_depth` events by `props.depth_pct` (25/50/75/100). Shows how many sessions reached each milestone.

### Sections viewed (analysis sessions only)
Groups `report_section_viewed` events by `props.section`. Shows which sections were actually seen and by how many sessions.

### Top regions
Groups non-null geo events by `(city, region, country)`, shows top 8 by session count. City shown only if `accuracy_km < 50`.

### Sessions table
One row per `session_id`:
- Started, Type (hub/analysis), Role (job_title), Location, Device (UA shorthand)
- Duration (from event timestamps or `time_spent_seconds`)
- Max scroll %, Sections count, Download flag

### Event timeline
Raw event rows (latest 200), sorted newest first. Shows event name, props detail, and timestamp.

---

## `/admin/downloads` Page

Merges three sources into one table, sorted by timestamp descending:

| Filter tab | Source table | Condition |
|------------|-------------|-----------|
| CTA Lead | `report_leads` | `source = 'cta'` |
| Card | `report_leads` | `source = 'download'` |
| Page | `report_downloads` | all rows |

**Note:** Only `report_downloads` rows have a referrer URL (used to see where the user came from). `report_leads` rows show "—" for referrer.

**Delete:** Only `report_downloads` rows can be deleted (DELETE icon → calls `/api/admin/downloads` DELETE).

---

## Quick Reference: Action → Admin Column

| What the user did | Where you see it |
|-------------------|-----------------|
| Opened a hub report | Analytics → Opens (reportType='hub' in raw timeline) |
| Opened an analysis | Analytics → Opens (reportType='analysis') |
| Scrolled to 75% | Drill-down → Scroll Depth Funnel |
| Viewed "tasks" section | Drill-down → Sections Viewed |
| Downloaded a PDF | Analytics → Downloads column; raw in Download Events table |
| Submitted email in wizard CTA | Downloads page → CTA Lead tab |
| Different tab/browser same report | Analytics → Devices count (devices > 1 = "Forwarded") |

---

## Key Gotchas

- **Wizard-only companies show 0 downloads** — scroll/section/download events only fire in DashboardView (analysis pages), not in the wizard.
- **`report_leads.source='download'`** is placeholder code — the PDF gate was removed, so no rows are created with this source currently.
- **GeoIP requires `data/GeoLite2-City.mmdb`** — without it, all geo columns are NULL.
- **Session = browser tab**, not person. Same person, two tabs = two sessions.
- **`ip_hash` anonymizes the IP** but lets you group tabs by device/network (used for the Forwarded metric).
