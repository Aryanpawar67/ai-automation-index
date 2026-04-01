# Industry Sector Enrichment — Feature Plan

## Goal

Enrich every company in the dataset with a **market industry segment** (e.g. Insurance, Banking, Healthcare) so outreach can be prioritised by segment independently of ATS type.

**Key distinction:**
- `ats_type` = the HR platform (Workday, SAP SF, Oracle, etc.) — already in the DB
- `industry` = market segment (Insurance, Banking, Healthcare, etc.) — what this feature adds

**Example workflow:**
> All Workday companies have been processed. Next priority: Insurance companies.
> Filter: `industry = "Insurance"` → returns all Insurance companies regardless of ATS.
> Combine: `industry = "Insurance" AND ats_type = "workday"` → Insurance companies on Workday.

---

## Detection Method

1. **2 web searches** per company (company name + domain → industry profile snippets)
2. **Claude Haiku** classifies the snippets into exactly one canonical label from the taxonomy
3. Result stored as a single `text` column — direct equality filter, no fuzzy matching needed

Cost per company: ~2 web search queries + ~$0.0001 Haiku call. Batch cap: 50 companies/run.

---

## Industry Taxonomy (28 sectors)

```
Insurance
Banking
Financial Services
Investment Management
Healthcare
Pharmaceuticals & Life Sciences
Medical Devices
Technology
Software & SaaS
Telecommunications
Retail
Consumer Goods
Food & Beverage
Manufacturing
Automotive
Energy & Utilities
Oil & Gas
Construction & Real Estate
Logistics & Transportation
Airlines & Travel
Hospitality
Media & Entertainment
Education
Government & Public Sector
Consulting & Professional Services
Legal Services
Non-Profit
Other
```

`Insurance` is a first-class leaf node (not grouped under Financial Services) — this makes `WHERE industry = 'Insurance'` a clean equality match.

---

## DB Changes

**Table:** `dataset_rows`

| Column | Type | Description |
|--------|------|-------------|
| `industry` | `text` | Canonical sector label e.g. `"Insurance"` |
| `industry_status` | `text` | `pending \| running \| complete \| failed \| not_found` |
| `industry_discovered_at` | `timestamp with time zone` | When enrichment ran |

**Migration file:** `drizzle/0003_industry_column.sql`

---

## Files to Create / Modify

| Step | Action | File |
|------|--------|------|
| 1 | Create | `drizzle/0003_industry_column.sql` |
| 2 | Modify | `src/lib/db/schema.ts` |
| 3 | Create | `src/lib/industryEnricher.ts` |
| 4 | Create | `src/app/api/admin/dataset/enrich-industry/route.ts` |
| 5 | Modify | `src/app/api/admin/enrichment-stats/route.ts` |
| 6 | Modify | `src/app/admin/enrichment/page.tsx` |
| 7 | Modify | `src/app/api/admin/dataset/route.ts` |
| 8 | Modify | `src/components/admin/DatasetTable.tsx` |
| 9 | Verify | `src/app/api/admin/dataset/export/route.ts` + `src/lib/excel.ts` |

---

## API

### `POST /api/admin/dataset/enrich-industry`

```json
// Request
{ "rowIds": ["uuid", ...], "onlyMissing": true }

// Response
{ "total": 50, "completed": 44, "notFound": 4, "failed": 2 }
```

- `onlyMissing: true` skips companies where `industry_status = 'complete'`
- Omit `rowIds` to run on all companies in the dataset
- Max batch: 50 rows per call

### `GET /api/admin/dataset?industry=Insurance&ats=workday`

Compound filter — both are equality conditions on `dataset_rows`, no joins needed.

---

## UI Changes

### Enrichment Tab — new "Industry Sector" card

- Progress bar: X / total companies have industry set
- "Run Missing" button — enriches only companies without a sector
- "Run All" button — re-runs enrichment for all companies
- Quota note: ~2 queries/company, safe limit ~50 companies/run

### Dataset Table

- New **Industry** column (shown when enrichment columns are visible)
  - Badge: green pill with sector name
  - States: `Detecting…` (yellow) / `—` (grey, not yet enriched)
- New **Industry** dropdown filter in the filter bar
  - Dynamically populated from `DISTINCT industry` values in DB
  - Empty until enrichment runs; auto-populates as data comes in

---

## Implementation Todo

- [ ] **Step 1** — Write `drizzle/0003_industry_column.sql` and apply to Neon
- [ ] **Step 2** — Add 3 columns to `dataset_rows` in `src/lib/db/schema.ts`
- [ ] **Step 3** — Create `src/lib/industryEnricher.ts`
  - [ ] Define `INDUSTRY_TAXONOMY` constant (28 sectors)
  - [ ] `enrichIndustry(input)` — web search → Haiku classification → return status + label
  - [ ] Export taxonomy for reuse in API and UI
- [ ] **Step 4** — Create `src/app/api/admin/dataset/enrich-industry/route.ts`
  - [ ] POST handler — batch up to 50 rows, call `enrichIndustry`, write results to DB
  - [ ] Skip rows where `industry_status = 'complete'` when `onlyMissing = true`
- [ ] **Step 5** — Update `src/app/api/admin/enrichment-stats/route.ts`
  - [ ] Add industry complete / notFound / failed / pending counts
  - [ ] Return under `industry` key in response JSON
- [ ] **Step 6** — Update `src/app/admin/enrichment/page.tsx`
  - [ ] Add `industry` to `Stats` interface
  - [ ] Add `indLoad` state
  - [ ] Add Industry Sector `StatCard` (green, batchSize=50)
- [ ] **Step 7** — Update `src/app/api/admin/dataset/route.ts`
  - [ ] Accept `industry` query param
  - [ ] Add `eq(datasetRows.industry, industry)` to conditions
  - [ ] Return `industryOptions` in filters response
- [ ] **Step 8** — Update `src/components/admin/DatasetTable.tsx`
  - [ ] Add `industry` / `industryStatus` to `DatasetRow` interface
  - [ ] Add `industry` to filter state + URLSearchParams
  - [ ] Add Industry dropdown in filter bar
  - [ ] Add Industry column (badge) in enrichment columns section
  - [ ] Update skeleton row column count
- [ ] **Step 9** — Verify export includes `industry` column in XLSX output
