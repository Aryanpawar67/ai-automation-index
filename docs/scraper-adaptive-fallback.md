# Scraper: garbage-output detection + adaptive Workday fallback

## Context

When the scraper hits a Workday-backed careers page that the URL-pattern matcher misses, it falls through to the Firecrawl tier. Firecrawl returns the listing page as markdown, and the current extraction logic turns every `[anchor](url)` into a "JD" — including navigation anchors like `Skip to main content`, `Search`, `Filters`. The result: junk titles in the role list, every "JD" with the same listing-page rawText, and a fabricated `totalAvailable`.

Two recent examples:

- **Everest** (`https://wd5.myworkdaysite.com/recruiting/everestre/careers`) — failed because `myworkdaysite.com` wasn't recognized as a Workday host. Fixed in commit `16d4877`.
- **CRC Group** (`https://tihinsurance.wd1.myworkdayjobs.com/CRC_Careers`) — direct `myworkdayjobs.com` URL that *should* be matched by the existing regex. CxS API verified working manually (`total: 118`). The screenshot showing junk is likely stale, but the failure mode itself is real.

The user wants this fixed structurally rather than per-tenant: **detect garbage results, sniff the page for Workday signals, and auto-retry through the CxS API.** This way new failing tenants self-heal instead of needing a code change each time.

## Verified facts (from manual probes)

```
POST https://tihinsurance.wd1.myworkdayjobs.com/wday/cxs/tihinsurance/CRC_Careers/jobs
→ {"total":118,"jobPostings":[{"title":"FP&A Analyst", ...}, ...]}

GET  https://tihinsurance.wd1.myworkdayjobs.com/wday/cxs/tihinsurance/CRC_Careers/job/CRC---Dallas-TX-12377-Merit-Dr/FP-A-Analyst_R0000002534
→ {"jobPostingInfo":{"title":"FP&A Analyst","jobDescription":"<p>...</p>", ...}}
```

CxS API works on both `wdN.myworkdayjobs.com` and `wdN.myworkdaysite.com`.

## Design

Three layers, ordered cheapest to most invasive.

### Layer 1 — Filter junk inside Firecrawl (prevent the symptom)

In `src/lib/scraper.ts → scrapeFirecrawl`, drop matches whose title is a known navigation phrase before pushing the JD. New constant:

```ts
const NAV_TITLE_RE = /^(skip to (main )?content|search( for jobs)?|filters?|jobs page (is )?loaded|view (all )?jobs?|all jobs?|jump to|menu|home|login|sign[- ]?in|apply now|next page|previous page)$/i;
```

Skip a match if `NAV_TITLE_RE.test(title.trim())`.

Also drop the "whole page as one JD" fallback if its `rawText` contains listing-page markers (`/\b\d+\s+JOBS\s+FOUND\b/i`, multiple consecutive `### [text](url)` lines).

### Layer 2 — Detect garbage results post-scrape (safety net)

New helper `looksLikeListingNoise(jds: ScrapedJD[]): boolean` in `src/lib/scraper.ts`. Returns true when:

- ≥1 title matches `NAV_TITLE_RE`, **or**
- ≥2 JDs share identical `rawText.slice(0, 500)` (Firecrawl symptom: every JD gets the same listing markdown), **or**
- any `rawText` matches `/\b\d+\s+JOBS\s+FOUND\b/i` and contains 3+ markdown links of form `### [...](...)`.

### Layer 3 — Adaptive Workday recovery (the "learn the pattern" piece)

New helper `findWorkdayConfigOnPage(url: string): Promise<WorkdayTenant | null>` in `src/lib/scrapers/workday.ts`:

1. Fetch the URL once (HTML).
2. Reuse **existing** `extractTenantFromHtml(html)` (`src/lib/scrapers/workday.ts:38-78`) — already scans for `/wday/cxs/<tenant>/<site>/jobs`, `<script id="wd-app">` JSON, embedded `myworkdayjobs.com` URLs, `window.__WD_CONFIG__`, and inline `tenant`/`jobSite` JSON.
3. **Crucially:** when the request URL host is itself a Workday hosted-careers domain (`wdN.myworkdaysite.com` or `wdN.myworkdayjobs.com`), preserve that **actual host** rather than rewriting to `${tenant}.myworkdayjobs.com`. Today `extractTenantFromHtml` always rewrites — fine for off-Workday marketing pages, wrong for already-on-Workday pages. Patch the function to accept a `pageUrl` hint and use its host when applicable.

In `scrapeCareerPage` (`src/lib/scraper.ts`), after each tier returns success, gate on `looksLikeListingNoise(jds)`:

```ts
if (looksLikeListingNoise(jds)) {
  const wd = await findWorkdayConfigOnPage(url);
  if (wd) {
    const retry = await scrapeWorkday(url, wd);  // optional pre-resolved tenant
    if (retry.jds.length > 0 && !looksLikeListingNoise(retry.jds)) {
      return { success: true, jds: retry.jds, resolvedUrl: retry.resolvedUrl, totalAvailable: retry.totalAvailable };
    }
  }
  return { success: false, error: "Scraped content looks like listing-page noise; no JDs extracted.", blocked: false };
}
```

`scrapeWorkday` gets an optional second arg: a pre-resolved `WorkdayTenant` that bypasses `resolveWorkdayEntryPoint`. Backwards-compatible.

### Why this is durable

- Layer 1 stops Firecrawl from emitting nav-anchor entries — the symptom most visible to the user.
- Layer 2 is content-driven, not URL-driven — catches future tenants on hosts we haven't catalogued (Avature, custom wd-shards, vanity domains in front of Workday).
- Layer 3 reuses the existing tenant-extractor, so any heuristic improvement to `extractTenantFromHtml` automatically benefits the recovery path. Adding support for a new Workday host pattern in one place fixes both the URL-match path and the recovery path simultaneously.

## Files to modify

| File | Change |
|---|---|
| `src/lib/scraper.ts` | Add `NAV_TITLE_RE`, `looksLikeListingNoise`; tighten `scrapeFirecrawl` to filter nav titles + listing-page fallback; add the post-tier garbage-detection guard at the end of `scrapeCareerPage` |
| `src/lib/scrapers/workday.ts` | Patch `extractTenantFromHtml` to take optional `pageUrl?: string` and preserve real host for `myworkdaysite.com` / `myworkdayjobs.com` page URLs; add exported `findWorkdayConfigOnPage(url)`; add optional `preResolved` param to `scrapeWorkday` |

No new files. No DB schema changes. No new env vars.

## Verification

1. **CRC Group** (`https://tihinsurance.wd1.myworkdayjobs.com/CRC_Careers`) — should scrape via existing Workday tier (118 total available, ≥15 JDs). The new layers shouldn't fire because Workday tier already wins.
2. **Everest** (`https://wd5.myworkdaysite.com/recruiting/everestre/careers`) — already fixed by commit `16d4877`; re-verify.
3. **Synthetic garbage test**: temporarily comment out the Workday URL match in `scrapeCareerPage` so CRC falls through to Firecrawl. With Layers 1+2+3 the result should still be 118 total + real JDs (Layer 3 recovers). Without the new code, junk like the screenshot. Restore the comment after.
4. **Negative test**: a non-Workday URL with genuine listing junk (e.g., a marketing page mistakenly given as `careerPageUrl`) should now return `{ success: false }` instead of pushing nav-anchor JDs into the DB.
5. `npx tsc --noEmit` clean (ignoring pre-existing unrelated `SapScrapeResult` errors in working tree).
6. End-to-end: a small `tsx` harness that calls `scrapeCareerPage` for both URLs and prints `totalAvailable`, `jds.length`, first 3 titles + first sourceUrl. Same harness used to validate the Everest fix.

## Out of scope

- Doesn't try to learn *new* ATS platforms beyond Workday — the same pattern can be cloned for Oracle / SAP SF later if the same symptom appears there.
- Doesn't deduplicate junk JDs already in the DB from prior scrapes; that's a separate cleanup.
- Doesn't alter `targetScrapeCount` or any limits — purely a correctness fix.
