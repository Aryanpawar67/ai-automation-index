# Plan: Multi-Touch Landing Pages for Email Outreach Campaigns

## Context
The current outreach flow has a single landing page (`/preview` with 4 hero variations) that the first email points to. Sales runs a 3-touch email sequence and needs **distinct landing pages per touch** so each follow-up has a different interactive angle to re-engage cold prospects. The reports themselves (`/preview/report`) stay identical — only the landing funnel changes per touch. Email capture stays on `/preview/report` (per user choice — landings are pure marketing funnels).

User has designs ready for Touch 2 and partial for Touch 3 (will provide separately) — so this plan focuses on **scaffolding the routing + shared components + analytics** so the user's designs can be dropped into clean shells.

---

## Files to Modify/Create

| File | Action |
|------|--------|
| `src/app/preview/t/[touchId]/page.tsx` | **New** — dynamic touch router |
| `src/app/preview/_components/LandingShell.tsx` | **New** — shared wrapper (footer, fonts, tracking pixel) |
| `src/app/preview/_components/TrackingPixel.tsx` | **New** — fires landing visit event on mount |
| `src/app/preview/_components/ReportHandoff.tsx` | **New** — CTA button → `/preview/report?token=X` |
| `src/app/preview/_landings/Touch1Landing.tsx` | **New** — extract current `/preview` content |
| `src/app/preview/_landings/Touch2Landing.tsx` | **New** — placeholder shell ready for user's design |
| `src/app/preview/_landings/Touch3Landing.tsx` | **New** — placeholder shell ready for user's design |
| `src/app/preview/page.tsx` | Refactor — keep route, render `Touch1Landing` |
| `src/lib/db/schema.ts` | Add `landingVisits` table; add touch columns to `reportDownloads`/`reportLeads` |
| `drizzle/0005_landing_visits.sql` | **New** — migration |
| `src/app/api/preview/track-visit/route.ts` | **New** — POST endpoint for landing visits |
| `src/app/api/preview/track-download/route.ts` | Modify — accept `touchNumber`, `landingVariant`, `companyToken` |
| `src/app/api/admin/export/workday-outreach/route.ts` | Add per-touch link columns + per-touch email text |

---

## URL Pattern: `/preview/t/[touchId]?token=<companyToken>`

- `/preview/t/1?token=X` → Touch 1 (current banner-variations landing)
- `/preview/t/2?token=X` → Touch 2 (follow-up landing — user's design)
- `/preview/t/3?token=X` → Touch 3 (last-chance landing — user's design)
- `/preview/report?token=X` → Report page (unchanged, all touches funnel here)

**Why path-based not query**: survives sales-tool URL wrapping (Outreach/Salesloft) better than query params; cleaner in email clients.

The `?token=` reuses the existing `companies.reportToken` from `src/lib/db/schema.ts` — no new token system needed. Token is carried into `/preview/report` for analytics correlation.

---

## Step 1: Schema + Migration

Add to `src/lib/db/schema.ts`:

```ts
export const landingVisits = pgTable("landing_visits", {
  id:              uuid("id").primaryKey().defaultRandom(),
  companyToken:    text("company_token"),
  touchNumber:     integer("touch_number").notNull(),
  landingVariant:  text("landing_variant"),
  userAgent:       text("user_agent"),
  referrer:        text("referrer"),
  visitedAt:       timestamp("visited_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Alter existing tables (add nullable columns):
- `reportDownloads`: `touchNumber INTEGER`, `landingVariant TEXT`, `companyToken TEXT`
- `reportLeads`: `touchNumber INTEGER`, `landingVariant TEXT`, `source TEXT`

**Migration file**: `drizzle/0005_landing_visits.sql` — `CREATE TABLE` + 6 `ALTER TABLE ADD COLUMN` statements. Apply with `npx drizzle-kit push` (interactive mode).

---

## Step 2: Shared Components

### `LandingShell.tsx`
- Outer wrapper: bg `#F4EFF6`, fonts (DM Sans/Mono, Playfair, Source Serif), max-width 1200, footer
- Mounts `<TrackingPixel touchId={N} token={token} />`
- Props: `children`, `touchId`, `token`

### `TrackingPixel.tsx`
- Client component, fires `POST /api/preview/track-visit` on mount with `{ token, touchNumber, landingVariant }`
- Fire-and-forget; silent fail

### `ReportHandoff.tsx`
- The CTA button. Constructs `/preview/report?token=${token}&from=t${touchId}` and navigates
- Props: `token`, `touchId`, `label`, optional `variant` for styling

---

## Step 3: Dynamic Route — `/preview/t/[touchId]/page.tsx`

```tsx
const LANDINGS = {
  "1": Touch1Landing,
  "2": Touch2Landing,
  "3": Touch3Landing,
};

export default async function Page({ params, searchParams }) {
  const { touchId } = await params;
  const { token } = await searchParams;
  const Landing = LANDINGS[touchId];
  if (!Landing) notFound();
  return (
    <LandingShell touchId={Number(touchId)} token={token}>
      <Landing token={token} />
    </LandingShell>
  );
}
```

Each landing is self-contained, receives `token` prop, uses `<ReportHandoff>` as the CTA.

---

## Step 4: Touch 1 — Refactor existing `/preview`

- Move content from `src/app/preview/page.tsx` (the 4 hero banner variations) into `_landings/Touch1Landing.tsx`
- The existing `/preview/page.tsx` becomes a thin wrapper: renders `<LandingShell touchId={1}><Touch1Landing /></LandingShell>` — preserves backward compatibility for any existing email links pointing at `/preview`
- Visit `/preview/t/1?token=X` and `/preview` should look identical

## Step 5: Touch 2 + Touch 3 — Placeholder shells

User will provide actual designs. For now:
- `Touch2Landing.tsx`: a hero + 2 sections + CTA (`<ReportHandoff label="See your report" />`). Mark with TODO comment for design drop-in.
- `Touch3Landing.tsx`: same shell pattern, marked TODO.
- Both render correctly so the routing + analytics are testable end-to-end before designs land.

---

## Step 6: API Routes

### `POST /api/preview/track-visit/route.ts`
- Body: `{ token, touchNumber, landingVariant? }`
- Inserts into `landing_visits` with `userAgent` + `referer` from headers
- Returns `{ ok: true }`

### Modify `POST /api/preview/track-download/route.ts`
- Add optional `touchNumber`, `landingVariant`, `companyToken` to body schema
- Persist them on insert into `report_downloads`
- Backward compatible (all new fields nullable)

The `/preview/report` page already calls `track-download` — extend it to read `?from=t2` query param and forward `touchNumber: 2` etc.

---

## Step 7: XLSX Export Extension

In `src/app/api/admin/export/workday-outreach/route.ts`:

- Add 3 new columns to the sheet:
  - `Touch 1 Link`: `${origin}/preview/t/1?token=${reportToken}`
  - `Touch 2 Link`: `${origin}/preview/t/2?token=${reportToken}`
  - `Touch 3 Link`: `${origin}/preview/t/3?token=${reportToken}`
- Extend existing `buildEmailText(...)` helper to accept a `touchNumber` param and output 3 distinct subject + body variants
- Add 3 columns: `Email 1 Text`, `Email 2 Text`, `Email 3 Text`
- Update `ws["!cols"]` widths

Keep the existing `Report Link` column for backward compatibility.

---

## Verification

1. Apply migration: `npx drizzle-kit push` (interactive)
2. Visit `/preview/t/1?token=<any-token>` → renders Touch 1 (current banner variations)
3. Visit `/preview/t/2?token=X` → renders Touch 2 placeholder
4. Visit `/preview/t/3?token=X` → renders Touch 3 placeholder
5. Visit `/preview/t/99?token=X` → 404
6. Open browser devtools, refresh `/preview/t/2?token=abc` → see `POST /api/preview/track-visit` fire with `touchNumber: 2`
7. Query `landing_visits` table → row exists with `touch_number=2, company_token='abc'`
8. Click CTA on a touch landing → lands on `/preview/report?token=abc&from=t2`
9. Submit email + download → `report_downloads` row has `touch_number=2, company_token='abc'`
10. Run XLSX export from admin panel → verify 3 link columns + 3 email text columns
11. Verify `/preview` still works (Touch 1 renders identically)
12. Verify `/preview/report` is unchanged visually

---

## Out of Scope (Future Phases)

- **Actual Touch 2/3 visual designs** — user is providing these separately; this plan only scaffolds the shells
- **Admin analytics dashboard** — querying `landing_visits` for per-touch funnel metrics; defer to next round
- **Per-persona variants within a touch** (e.g., `?persona=chro`) — schema supports it via `landingVariant` column but UI not implemented
- **Real countdown timer** for Touch 3 (would need `?sent=<timestamp>` in email URL or stored in DB)
- **Pre-filling email on `/preview/report`** if captured on landing — moot since email gate stays only on report page

---

## Gotchas

- **Token shared across touches**: Same `reportToken` is used for all 3 URLs per company — intentional (identifies company); preview report is generic, not confidential
- **Out-of-order visits**: Prospect could visit Touch 3 link before reading email 1 — fine, each landing is self-contained, analytics shows actual visit order
- **Sales tool URL wrapping**: Outreach/Salesloft will wrap links — test that `?token=` survives in the redirect (path-based touch ID definitely will)
- **Underscore folders** (`_components`, `_landings`) are ignored by Next.js routing — keeps components co-located without creating accidental routes
