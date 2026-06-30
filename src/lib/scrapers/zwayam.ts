import { stripHtml }         from "../stripHtml";
import { targetScrapeCount } from "../jdLimits";
import { looksNonEnglish, translateToEnglish } from "../translate";
import type { ScrapedJD }    from "../scraper";

// Zwayam ATS (e.g. career.crisil.com).
//   list:   POST https://public.zwayam.com/jobs/search   (multipart form)
//             filterCri = {"paginationStartNo":N,"selectedCall":"sort",
//                          "sortCriteria":{"name":"modifiedDate","isAscending":false},
//                          "anyOfTheseWords":""}
//             domain = <career domain>, companyId = <base64 id>
//           → { data: { totalCount, data: [{ _source: { id, jobTitle, jobUrl,
//                departmentName } }] } }   (the list's description is usually empty)
//   detail: POST https://public.zwayam.com/jobs-service/v1/jobs/careersite
//             { jobUrl, externalSource:"CareerSite", campusUrl:"empty",
//               companyId:<numeric>, jobId:<id> }
//           → { jobTitle, longDescription }
// companyId isn't in the page's static HTML (Angular SPA), so it's configured
// per company (base64) — like the Phenom refNum / Workday tenant maps.

const SEARCH_URL = "https://public.zwayam.com/jobs/search";
const DETAIL_URL = "https://public.zwayam.com/jobs-service/v1/jobs/careersite";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120";
const PAGE = 10;
const CONCURRENCY = 5;

export interface ZwayamConfig {
  /** Career domain sent to the API, e.g. "career.crisil.com". */
  domain:    string;
  /** Base64-encoded company id, e.g. "MTU0Mzg=" for Crisil (15438). */
  companyId: string;
}

interface ZwayamSource {
  id?:                        number | string;
  jobTitle?:                  string;
  jobUrl?:                    string;
  departmentName?:            string;
  companyId?:                 number | string;
  role?:                      string;   // full HTML job description
  mediumDescription?:         string;   // truncated HTML description
  desiredSkill?:              string;
  jdSkillsKnown?:             string;
  skillsToEvaluate?:          string;
  yrsOfExperience?:           string;
  experienceUIField?:         string;
  location?:                  string;
  designation?:               string;
  roles?:                     string;
}
interface ZwayamResp { data?: { totalCount?: number; data?: Array<{ _source?: ZwayamSource }> } }

function numericCompanyId(b64: string): string {
  try { return Buffer.from(b64, "base64").toString("utf8"); } catch { return b64; }
}

async function searchPage(cfg: ZwayamConfig, startNo: number): Promise<ZwayamResp | null> {
  const form = new FormData();
  form.append("filterCri", JSON.stringify({
    paginationStartNo: startNo, selectedCall: "sort",
    sortCriteria: { name: "modifiedDate", isAscending: false }, anyOfTheseWords: "",
  }));
  form.append("domain", cfg.domain);
  form.append("companyId", cfg.companyId);
  try {
    const res = await fetch(SEARCH_URL, {
      method:  "POST",
      headers: { "Accept": "application/json", "User-Agent": UA, "Referer": `https://${cfg.domain}/` },
      body:    form,
      signal:  AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return await res.json() as ZwayamResp;
  } catch { return null; }
}

async function jobDetail(cfg: ZwayamConfig, src: ZwayamSource): Promise<{ title: string; rawText: string } | null> {
  // Try the detail API for a richer longDescription; use it as the body if available.
  const resolvedId = src.companyId != null ? String(src.companyId) : numericCompanyId(cfg.companyId);
  let longDesc = "";
  try {
    const res = await fetch(DETAIL_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json", "User-Agent": UA, "Referer": `https://${cfg.domain}/` },
      body:    JSON.stringify({
        jobUrl: `${src.jobUrl}?id=${src.id}`, externalSource: "CareerSite",
        campusUrl: "empty", companyId: resolvedId, jobId: String(src.id),
      }),
      signal:  AbortSignal.timeout(12_000),
    });
    if (res.ok) {
      const d = await res.json() as { jobTitle?: string; longDescription?: string };
      longDesc = stripHtml(d.longDescription ?? "");
    }
  } catch { /* fall through to inline composition */ }

  // Always compose a structured body — ensures skills/metadata are present for
  // validation even when the listing only has short bullet-point descriptions.
  const rawText = buildInlineText(src, longDesc);
  if (!rawText) return null;
  return { title: src.jobTitle ?? "Untitled", rawText };
}

/** Compose a structured JD body from Zwayam listing fields.
 *  longDesc (from the detail API) is used as the responsibilities body when richer. */
function buildInlineText(src: ZwayamSource, longDesc = ""): string {
  const parts: string[] = [];
  const title = src.roles ?? src.jobTitle ?? "";
  if (title) parts.push(`Role: ${title}`);
  if (src.departmentName) parts.push(`Department: ${src.departmentName}`);
  if (src.location) parts.push(`Location: ${src.location}`);
  if (src.yrsOfExperience || src.experienceUIField)
    parts.push(`Experience required: ${src.yrsOfExperience ?? src.experienceUIField}`);
  if (src.designation) parts.push(`Designation: ${src.designation}`);

  // Prefer detail API longDesc when it's richer than the listing's role field.
  const inlineDesc = stripHtml(src.role ?? src.mediumDescription ?? "");
  const body = longDesc.length > inlineDesc.length ? longDesc : inlineDesc;
  if (body) parts.push(`\nKey Responsibilities:\n${body}`);

  const skills = [src.jdSkillsKnown, src.skillsToEvaluate, src.desiredSkill]
    .filter(Boolean).join(", ");
  if (skills) parts.push(`\nSkills required: ${skills}`);

  return parts.join("\n");
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
    }),
  );
  return out;
}

export async function scrapeZwayam(cfg: ZwayamConfig): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  const first = await searchPage(cfg, 0);
  if (!first) return { jds: [], totalAvailable: 0 };
  const totalAvailable = first.data?.totalCount ?? (first.data?.data ?? []).length;
  if (totalAvailable === 0) return { jds: [], totalAvailable: 0 };

  const keep = targetScrapeCount(totalAvailable);
  const sources: ZwayamSource[] = (first.data?.data ?? []).map(h => h._source ?? {}).filter(s => s.id);
  // Collect a buffer of list rows; descriptions come from the detail call.
  for (let start = PAGE; sources.length < keep + 4 && start < totalAvailable; start += PAGE) {
    const r = await searchPage(cfg, start);
    const hits = (r?.data?.data ?? []).map(h => h._source ?? {}).filter(s => s.id);
    if (hits.length === 0) break;
    sources.push(...hits);
  }

  const fetched = await mapWithConcurrency(sources, CONCURRENCY, async (src) => {
    const d = await jobDetail(cfg, src);
    if (!d) return null;
    let { title, rawText } = d;
    if (looksNonEnglish(rawText) || looksNonEnglish(title)) {
      const t = await translateToEnglish(title, rawText);
      title = t.title; rawText = t.rawText;
    }
    return {
      title,
      rawText:    rawText.slice(0, 12_000),
      sourceUrl:  `https://${cfg.domain}/${cfg.domain.split(".")[1] ?? ""}/jobview/${src.jobUrl}?id=${src.id}`,
      department: src.departmentName,
    } satisfies ScrapedJD;
  });

  const jds = fetched.filter((x): x is ScrapedJD => x !== null).slice(0, keep);
  return { jds, totalAvailable };
}
