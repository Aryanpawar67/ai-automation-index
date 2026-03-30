# iMocha AI Automation Index — UI Revamp Tracker

> End-to-end admin UI redesign. Flow: **Suggest → Approve → Implement**, one page at a time.

---

## Design System (applied globally)

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#F4EFF6` | Page background (admin) |
| `--surface` | `#ffffff` | Cards, panels |
| `--border` | `#EAE4EF` | Card borders, dividers |
| `--primary` | `#220133` | Headings, primary text |
| `--secondary` | `#553366` | Body text, labels |
| `--muted` | `#9988AA` | Helper text, column headers |
| `--accent` | `#FD5A0F` | CTA buttons, active states, highlights |
| `--accent-light` | `#FFF0EA` | Button bg tints, banner backgrounds |
| `--sidebar-bg` | `#160022` | Left sidebar background |
| `--sidebar-border` | `rgba(255,255,255,0.06)` | Sidebar dividers |

**Typography:** Inter, system-ui. Headings bold 800. Labels 10–11px uppercase tracking-wide.

**Motion principles:**
- `fadeInUp` on page load — 0.4s ease, staggered 50–70ms per item
- `pulse` — 1.4s ease-in-out infinite — live status dots only
- `shimmer` — 1.8s — active progress bars only
- Hover transitions: `0.15s` for color/bg, `0.18s` for transform/shadow
- Sidebar collapse: `0.25s cubic-bezier(0.4,0,0.2,1)`

---

## Navigation — Left Sidebar ✅

**File:** `src/components/admin/AdminSidebar.tsx`
**Layout file:** `src/app/admin/layout.tsx`

- Collapsible: **240px** expanded → **64px** icon-only
- Dark `#160022` background, iMocha logo at top
- Active route: orange `3px` left border + `rgba(253,90,15,0.10)` tint
- Labels + logo text slide/fade out on collapse
- Collapsed: icons only + orange dot active indicator + `title` tooltip
- Collapse arrow rotates 180° on toggle
- "AI Automation Index" version label at bottom (hidden when collapsed)

---

## Pages

---

### ✅ Page 1 — Batch Detail (`/admin/batches/[batchId]`)

**Files changed:**
- `src/app/admin/batches/[batchId]/page.tsx`
- `src/components/admin/BatchProgressTable.tsx`

**What was done:**
- **Hero banner** — dark purple gradient (`#1A0028 → #2D0050`), batch filename as H1, animated status badge (live pulse dot on scraping/analyzing), thick 8px progress bar with shimmer on active batches
- **Stats tiles row** — 4 cards (Companies / Total JDs / Processed / Failed), staggered `fadeInUp`, hover lift
- **BatchProgressTable restyle:**
  - Company avatar: colored initial circle, color hashed from company name
  - Row hover: left orange `3px` border slides in + `#FDFBFE` bg
  - Status pills: colored glow + live pulse dot for in-progress
  - JD count chips: inline colored tags (awaiting / running / failed / invalid / skipped)
  - Progress bar: green gradient healthy, red failed
  - `View ↗` report button: fills orange on hover
  - Analyse All banner cleaned up with scale-on-hover CTA
  - Proper empty/loading state with animated bars

---

### ✅ Page 2 — All Batches (`/admin/batches`)

**Files changed:**
- `src/app/admin/batches/page.tsx`

**What was done:**
- Summary strip: 3 stat chips (Complete / Active / Failed) inline at top
- Batch rows redesigned as "card rows":
  - Colored left border by status (green/orange/red)
  - File icon + bold filename, relative time ("2 days ago") with full date tooltip
  - Inline mini progress bar at bottom of each row
  - Delete button ghost-hidden, fades in on row hover
  - Status badge with glow shadow
  - Staggered `fadeInUp` on load
- `+ New Batch` button: orange gradient, scale + shadow on hover
- Proper empty state with SVG upload icon + CTA

---

### ✅ Page 3 — Admin Home / Quick Upload (`/admin`)

**Planned:**
- Full-screen centered upload card with drag-and-drop zone
- Animated dashed border on drag-over
- Step indicator (Upload → Scrape → Analyse → Report)
- Recent activity feed (last 3 batches inline)

---

### ✅ Page 4 — Dataset (`/admin/dataset`)

**Files changed:**
- `src/components/admin/DatasetTable.tsx`

**What was done:**
- **ATS color-coded pills**: Workday=blue, Oracle HCM=red, Oracle Taleo=amber, SAP SF=green with distinct per-platform colors
- **Company avatars**: Colored initial circles with deterministic hash — consistent on every load
- **Shimmer skeleton rows**: `SkeletonRow` component with `shimmer` animation while loading
- **Filter bar**: Icons inside inputs, orange focus ring on all fields
- **Row selection**: Orange left border + `#FFF8F5` bg tint on selected rows
- **Status pills with dots**: Live pulse dot for in-progress statuses
- **Modals**: `backdropFilter: blur(6px)`, `modalIn` slide-up animation, orange focus borders
- **Pagination strip**: `#FAFAFA` footer with clean prev/next controls

---

### ✅ Page 5 — Company JD View (`/admin/batches/[id]/companies/[id]`)

**Files changed:**
- `src/components/admin/CompanyJDSplitView.tsx`

**What was done:**
- **Header stats chips**: Roles / Analysed / Awaiting / Skipped as colored pill chips — replaces plain text counts
- **Status pills**: Full `STATUS_CFG` with glow rings and pulse dots — consistent with rest of revamp
- **Role list items**: Orange left border on selected, status-color left border on others, hover `#F9F7FB` bg
- **Score card**: Orange gradient chip showing score/100 + hours/wk inline in detail header
- **Detail header**: Gradient `#FDFCFE → #fff` fade, larger title, metadata below
- **Invalid/cancelled states**: Styled error/muted boxes instead of plain text
- **Full JD toggle button**: Hover color change + arrow rotates 180°
- **Empty state**: Centered icon + message instead of plain text
- **Removed all Tailwind classes**: Pure inline styles matching design system

---

### ✅ Page 6 — Individual Role Report (`/report/[companyId]/[analysisId]`)

**Files changed:**
- `src/components/DashboardView.tsx`

**What was done:**
- **Hero banner**: Dark purple gradient (`#1A0028 → #2D0050`) with job title, department badge, executive summary in frosted box
- **KPI cards**: 36px bold numbers, icon boxes, hover lift + glow border + color ring, tooltip with caret arrow
- **Tab bar**: Pill-style with orange active state + glow shadow, `fadeIn` transition on content switch
- **Overview**: Score ring + category radar grid, ROI highlights with 40px numbers in 3-column layout, skills analysis color-coded boxes
- **Tasks**: Chart card + 3-column task card grid, 28px score number, progress bar per card, staggered `fadeInUp`
- **Opportunities**: 2-column grid, impact/effort badges, tool chips in orange
- **Removed all Tailwind classes**: Pure inline styles throughout

---

---

### ✅ Page 7 — Company Report Hub (`/report/[companyId]`)

**Files changed:**
- `src/app/report/[companyId]/page.tsx`
- `src/components/report/CompanyReportList.tsx`

**What was done:**
- **Page nav**: Converted all Tailwind to inline styles — sticky with `backdropFilter: blur`, logo, "Powered by Claude" live dot
- **ExpiredScreen**: Inline styles, centered card with icon
- **Summary stat chips**: Inline color-coded pills (total / avg score / total hours / high potential) replacing the flat card
- **Sort bar**: Orange pill buttons with active state + ▲▼ indicator — replaces plain column header clicks
- **Role cards grid**: 2-column card grid replacing the table — score as 32px bold number, potential badge, progress bar, hours/wk, hover-fill "View report →" button
- **CEO banner**: Cleaned up Tailwind removal, hover effect on "Talk to us →" link
- **Empty state**: Icon + message card instead of bare text

---

## Feature Additions (non-revamp)

| Feature | Status | Files |
|---|---|---|
| Company-wise ZIP download | ✅ Done | `src/components/report/DownloadAllButton.tsx`, `src/app/api/report/[companyId]/download/route.ts` |
| Per-role PDF download | ✅ Already existed | `src/components/DashboardView.tsx` (window.print) |
| iMocha logo on admin pages | ✅ Done | `src/app/admin/layout.tsx` |
| CEO value prop banner on report hub | ✅ Done | `src/components/report/CompanyReportList.tsx` |
| Full analysis lead capture strip | ✅ Done | `src/components/report/FullAnalysisHeroStrip.tsx`, `src/app/api/report/[companyId]/interest/route.ts`, `src/lib/db/schema.ts` (report_leads table) |

---

## Current Session Progress

- [x] Sidebar nav (left collapsible)
- [x] Batch Detail page revamp
- [x] All Batches page revamp
- [x] Admin Home / Quick Upload
- [x] Dataset page
- [x] Company JD view
- [x] Individual role report

---

*Last updated: 2026-03-26*
