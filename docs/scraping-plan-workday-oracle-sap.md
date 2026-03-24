# Scraping Plan — Workday, Oracle HCM, SAP SuccessFactors

> **Status:** Plan — no code changes yet
> **Created:** 2026-03-24
> **Source data:** `imocha_prospects_careers_updated.xlsx` (2,460 companies, Q4 2025–Q1 2026)
> **Scope:** Tier 1 API scrapers for the three enterprise HCM platforms in the prospect list

---

## Why These Three First

From the prospect Excel file (230 companies with detected HCM/ATS):

| Platform | Companies in prospect list | Priority |
|---|---|---|
| **Workday** | 48 | 1 — largest cohort |
| **Oracle HCM** | 25 | 2 |
| **SAP SuccessFactors** | 12 | 3 |
| Oracle Taleo | 3 | Covered by Oracle HCM plan |

The current Tier 2 (static HTML) scraper fails completely for all three — the Excel's `Job 1–10` columns confirm this: scraped content is navigation labels (`"AnalyticsSee all 9 open roles"`), language selectors (`"中文 - Chinese"`), location filters (`"Atlanta"`, `"Bengaluru"`), and form fields (`"First Name"`, `"Email Address"`). Zero actual job roles collected from any of these platforms via static scraping.

---

## Key Constraint: Custom-Domain Problem

Most enterprise companies use Workday/Oracle/SAP behind a **custom career domain**, not the platform's own domain:

| Company | URL in Excel | Platform |
|---|---|---|
| Comcast | `jobs.comcast.com` | Workday |
| IQVIA | `jobs.iqvia.com/en` | Workday |
| Valmet | `valmet.com/careers` | Workday |
| BD | `jobs.bd.com/en` | Workday |
| JPMorgan | `jpmorganchase.com/careers` | Oracle HCM |
| Nebraska Medicine | `nebraskamed.com/careers` | Workday |

None of these URLs contain `myworkdayjobs.com` or `successfactors.com`. Detection from URL alone fails for ~80% of cases. **We have the ATS column in the Excel — this must be imported into the companies table and used to route scraping.**

---

## Schema Change Required

Add `atsType` column to the `companies` table:

```
companies.ats_type  text  -- 'workday' | 'oracle_hcm' | 'oracle_taleo' | 'sap_sf' | null
```

This field is populated from the `HCM / HRIS / ATS` column of the Excel at upload time. The scraper cascade checks this field before attempting URL-based detection.

---

## Platform 1: Workday (48 companies)

### How Workday career sites work

Workday career pages are React SPAs. The data powering them comes from an internal CxS (Candidate Experience Suite) API that is technically public (no auth required for external job listings). The frontend calls this to populate the job list.

### Detection strategy (in priority order)

1. `ats_type = 'workday'` in the companies table (from Excel import) — **primary**
2. URL contains `myworkdayjobs.com` — direct detection
3. URL contains `.wd1.` / `.wd3.` / `.wd5.` (Workday tenant subdomain patterns)
4. Page HTML contains `workday.com` in a `<script src>` or `<link href>` — fallback page-sniff

### Workday API approach

**Step 1: Extract tenant + jobSite from the URL**

Workday career URLs follow these patterns:
```
https://{tenant}.wd1.myworkdayjobs.com/en-US/{jobSite}
https://{tenant}.wd5.myworkdayjobs.com/{jobSite}
https://custom-domain.com/...  ← custom domain, no tenant in URL
```

For `myworkdayjobs.com` URLs, tenant and jobSite are extractable from the URL.
For custom domains (majority of cases), the page HTML contains the Workday config:
```html
<script type="application/json" id="wd-app">
  { "tenant": "comcast", "jobSite": "Comcast_Careers" }
</script>
```
Or in a `window.__WD_CONFIG__` JS variable. Cheerio can extract this without rendering.

**Step 2: Hit the CxS jobs search API**

```
POST https://{tenant}.myworkdayjobs.com/wday/cxs/{tenant}/{jobSite}/jobs
Content-Type: application/json

{
  "appliedFacets": {},
  "limit": 20,
  "offset": 0,
  "searchText": ""
}
```

Response shape:
```json
{
  "total": 847,
  "jobPostings": [
    {
      "title": "Senior Software Engineer",
      "locationsText": "Austin, TX",
      "timeType": "Full time",
      "postedOn": "Posted 3 Days Ago",
      "externalPath": "/en-US/Comcast_Careers/job/Austin-TX/Senior-Software-Engineer_R388821"
    }
  ]
}
```

**Step 3: Fetch individual JD pages**

Individual Workday job pages (`https://{tenant}.myworkdayjobs.com{externalPath}`) are **server-side rendered** and contain the full job description as static HTML. Cheerio can extract the JD text directly.

```
GET https://{tenant}.myworkdayjobs.com/en-US/{jobSite}/job/{jobId}/{slug}
```

The `<div class="css-*" data-automation-id="jobPostingDescription">` element contains the full JD.

**Step 4: Fallback for custom domains**

If tenant extraction from page HTML fails, fall through to Tier 3 (Firecrawl). Workday individual job pages do render SSR, so Tier 2 static scraping of individual listing pages (found from the search API's `externalPath`) would also work.

### Workday scraper pseudocode

```
scrapeWorkday(url, tenant?, jobSite?):
  1. If tenant/jobSite not known:
     - Fetch the career page HTML (raw fetch, no JS)
     - Extract tenant + jobSite from embedded JSON or script vars
     - If not found → return [] (fall through to Firecrawl)
  2. POST to CxS API → get list of job postings (limit 10)
  3. For each posting, fetch the individual job page:
     - GET https://{tenant}.myworkdayjobs.com{externalPath}
     - Extract JD text from data-automation-id="jobPostingDescription"
  4. Return ScrapedJD[] with real title, rawText, sourceUrl
```

### Known Workday edge cases

- **Gated/login-required postings**: Some internal positions require Workday login. These return a redirect to the login page. Skip if response contains login redirect.
- **Pagination**: CxS API paginates at 20. For companies with hundreds of jobs, we only need the first 10 — no pagination needed.
- **Rate limiting**: Workday doesn't document rate limits but aggressive crawling will get 429s. One call per tenant per batch is safe.
- **Custom domain tenant resolution**: ~30% of Workday sites don't embed the tenant in the page HTML and require a header sniff (`X-WD-Tenant` sometimes appears in response headers).

---

## Platform 2: Oracle HCM (25 companies + 3 Oracle Taleo)

### Sub-platforms to handle

Oracle has two separate products in the prospect list:
- **Oracle HCM Cloud** (25) — modern SaaS, `oraclecloud.com` branded portals
- **Oracle Taleo** (3) — legacy product, `taleo.net` URLs

Both need different approaches.

### Oracle HCM Cloud

**Detection:**
1. `ats_type = 'oracle_hcm'` in companies table
2. URL contains `oraclecloud.com`
3. Page HTML contains `oracle-hcm` or `fa.oraclecloud.com` in script/link tags

**API approach:**

Oracle HCM Cloud career portals expose a REST API that powers the public job search page:

```
GET https://{pod}.fa.{region}.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions
  ?onlyData=true
  &fields=Title,PrimaryLocation,JobFunction,JobPostingDescription,RequisitionId
  &limit=10
```

Where `{pod}` is the Oracle tenant (e.g., `cdbq`) and `{region}` is `us2`, `eu5` etc.

For JPMorgan (`jpmorganchase.com/careers`) — they use Oracle HCM but behind their own domain. Need to:
1. Fetch the careers page
2. Look for the Oracle HCM embedded config (tenant/pod/region appears in JS bundle or meta tags)
3. Fall back to Firecrawl if config not found

**Individual job page:** Oracle HCM job pages are SSR-renderable with a direct URL:
```
https://{pod}.fa.{region}.oraclecloud.com/hcmUI/CandidateExperience/en/sites/{site}/job/{requisitionId}
```

### Oracle Taleo

Taleo is simpler — it's an older system with a more accessible API:

```
GET https://{tenant}.taleo.net/careersection/rest/jobboard/header?lang=en
GET https://{tenant}.taleo.net/careersection/rest/jobboard/joblist?lang=en&act=showpage&pg=1
```

Individual JD:
```
GET https://{tenant}.taleo.net/careersection/api/jobdescription/en/detail/{jobId}
```

**Detection from URL:**
- URL contains `taleo.net` → direct tenant extraction
- `ats_type = 'oracle_taleo'` from companies table

### Oracle HCM known edge cases

- **Region variability**: Oracle HCM Cloud has 10+ regional pods (us2, uk3, eu5, ap2, etc.). If the region is wrong, API returns 404. Need to try common regions or extract from page.
- **Custom domains with no embedded config**: Large enterprises (JPMorgan) completely proxy Oracle HCM behind their own domain with no Oracle references in the HTML. For these, Firecrawl is the only option.
- **Taleo deprecation**: Oracle is end-of-lifing Taleo. Some companies may have migrated mid-dataset. Error handling must gracefully fall through.

---

## Platform 3: SAP SuccessFactors (12 companies)

### How SAP SuccessFactors career sites work

SAP SuccessFactors career portals are hosted either at:
- `{company}.jobs2web.com` — the SuccessFactors-hosted career site domain
- `{company}.successfactors.com/career?company={code}` — older format
- Custom company domain proxying to one of the above

### Detection strategy

1. `ats_type = 'sap_sf'` in companies table — **primary**
2. URL contains `jobs2web.com` or `successfactors.com`
3. Page HTML contains `sap-successfactors` or `jobs2web` in script/link sources

### SAP SuccessFactors API approach

SuccessFactors exposes a public job search API for external career sites:

```
GET https://{tenant}.jobs2web.com/job-invite/list/api
  ?limit=10
  &offset=0
  &lang=en
  &country=all
```

Response shape:
```json
{
  "total": 134,
  "results": [
    {
      "jobId": "REQ-001234",
      "title": "HR Business Partner",
      "location": "Munich, Germany",
      "department": "Human Resources",
      "description": "We are looking for...",
      "applyUrl": "https://{tenant}.jobs2web.com/job-invite/REQ-001234"
    }
  ]
}
```

The `description` field in the results often contains the full JD text — no second fetch needed for most SAP SF implementations.

**Alternative endpoint** for the `successfactors.com/career` format:

```
GET https://performancemanager.successfactors.com/odata/v2/JobRequisitionLocale
  ?$format=json
  &$select=jobReqId,externalTitle,jobDescription,country
  &$filter=lang eq 'en_US'
  &company='{companyCode}'
```

This is an OData endpoint that requires knowing the company code, extractable from the career page URL query param or page HTML.

### SAP SF known edge cases

- **`jobs2web.com` vs `successfactors.com` split**: Same company can use either endpoint depending on their SAP configuration version. Try `jobs2web` first.
- **HTML in description field**: SAP SF descriptions are rich HTML. Same HTML stripping issue as Greenhouse — must strip before passing to LangGraph.
- **Company code extraction**: For `successfactors.com` URLs, the company code is usually in the URL as `?company=SAPA` or in page HTML as `data-company-code`. If not found, fall through to Firecrawl.

---

## Implementation Architecture

### New `ats_type` routing in `scrapeCareerPage`

```
scrapeCareerPage(url, atsType?):

  // Tier 1a — existing ATS APIs (Greenhouse, Lever)
  if detectATS(url) === 'greenhouse' → scrapeGreenhouse()
  if detectATS(url) === 'lever' → scrapeLever()

  // Tier 1b — new enterprise HCM APIs (from atsType field)
  if atsType === 'workday' or url matches Workday patterns
    → scrapeWorkday(url)
  if atsType === 'oracle_hcm' or url matches Oracle HCM patterns
    → scrapeOracleHCM(url)
  if atsType === 'oracle_taleo' or url contains 'taleo.net'
    → scrapeOracleTaleo(url)
  if atsType === 'sap_sf' or url matches SAP SF patterns
    → scrapeSAPSuccessFactors(url)

  // Tier 2 — static HTML (non-SPA pages)
  if not isSPAJobSite(url) → scrapeStatic(url)

  // Tier 3 — Firecrawl (JS-rendered, last resort)
  → scrapeFirecrawl(url)
```

### Schema changes

```sql
-- Add to companies table
ALTER TABLE companies ADD COLUMN ats_type text;

-- Add to Drizzle schema
atsType: text("ats_type"),  -- 'workday' | 'oracle_hcm' | 'oracle_taleo' | 'sap_sf' | null
```

### Excel upload changes

When parsing the uploaded Excel file (`parseExcel()`), if the column `HCM / HRIS / ATS` is present:
- Map `"Workday"` → `'workday'`
- Map `"Oracle HCM"` → `'oracle_hcm'`
- Map `"Oracle Taleo"` → `'oracle_taleo'`
- Map `"SAP SuccessFactors"` → `'sap_sf'`
- Store on the company record

This means the scraper knows exactly which platform to use from the moment the batch is uploaded, without needing any URL sniffing.

### `scrapeCompany.ts` changes

Pass `atsType` from the company record to `scrapeCareerPage`:

```ts
const result = await scrapeCareerPage(company.careerPageUrl, company.atsType ?? undefined);
```

---

## HTML Stripping — Applies to All Three Platforms

All three platforms (and Greenhouse, already confirmed) return job description content as **rich HTML**. This directly impacts Agent 1 quality (confirmed in agent-pipeline-audit.md Break 1).

A shared `stripHtml(html: string): string` utility must be applied to `rawText` before storage for all Tier 1 scrapers. The function should:
1. Remove `<style>`, `<script>` tags and content
2. Convert `<li>` to `\n- ` (preserve list structure for Agent 2's task decomposition)
3. Convert `<p>`, `<br>`, `<div>` to `\n`
4. Strip remaining HTML tags
5. Collapse whitespace / normalise line breaks
6. Trim to 8,000 chars max

This single fix resolves **🔴 Break 1** in the agent-pipeline-audit for all platforms simultaneously.

---

## Effort Estimate

| Component | Scope |
|---|---|
| Schema: add `ats_type` to companies | Small — 1 column, drizzle migration |
| Excel parser: map HCM column → `ats_type` | Small — add to `parseExcel()` |
| `scrapeWorkday()` function | Medium — tenant extraction + CxS API + individual JD fetch |
| `scrapeOracleHCM()` function | Medium — pod/region detection + REST API |
| `scrapeOracleTaleo()` function | Small — well-documented Taleo API |
| `scrapeSAPSuccessFactors()` function | Medium — two endpoint variants |
| `stripHtml()` shared utility | Small — apply to all Tier 1 scrapers |
| `scrapeCareerPage` routing update | Small — add new branches |
| Tests / validation against prospect data | Medium |

---

## Open Questions (to resolve before implementation)

1. **Workday custom domain tenant resolution**: What % of the 48 Workday companies in the prospect list use custom domains where the tenant isn't in the URL? Need to sample 5-10 to validate the HTML extraction approach works.

2. **Oracle HCM regional pod distribution**: Need to identify which pods the prospect companies are on. May need a probe strategy (try common pods until one returns 200).

3. **SAP SF company code extraction**: The OData endpoint needs a company code. Validate that this is always present in the career page HTML for our 12 SF companies.

4. **Workday gated jobs**: Some companies post both internal and external jobs on the same career page. The CxS API returns all. Do we want only external/public postings?

5. **Rate limiting strategy**: All three platforms have undocumented rate limits. With `concurrency: 5` in Inngest, we could hit limits if multiple companies are on the same platform and on the same tenant. Need per-platform concurrency controls.
