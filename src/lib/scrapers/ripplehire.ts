import { stripHtml }         from "../stripHtml";
import { targetScrapeCount } from "../jdLimits";
import { looksNonEnglish, translateToEnglish } from "../translate";
import type { ScrapedJD }    from "../scraper";

// RippleHire career sites (e.g. ltimindtree.ripplehire.com/candidate/?token=...).
//   list:   POST /candidate/candidatejobsearch
//           form careerSiteUrlParams={page,search:"*:*",token,source,pagesize,geo}&lang=en
//           → { jobVoList: [{ jobSeq, jobTitle }], totalJobCount }
//   detail: GET /candidate/candidatejobdetail?jobSeq={seq}&token={token}&source=CAREERSITE&lang=en
//           → { jobVO: { jobTitle, jobDesc } }
// The career link's token is required; an optional geo filter rides in the URL
// hash (#list/geo=...). The list response omits descriptions, so each role needs
// a detail call.

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120";
const PAGE = 15, MAX_PAGES = 6, CONCURRENCY = 5;

interface RippleParams { origin: string; token: string; geo: string }

/** Origin + token + optional geo from a RippleHire career URL. */
export function parseRipplehire(url: string): RippleParams | null {
  try {
    const u = new URL(url);
    if (!/\.ripplehire\.com$/i.test(u.hostname)) return null;
    const token = u.searchParams.get("token") ?? "";
    if (!token) return null;
    // geo filter is in the hash fragment: #list/geo=Canada,United States
    const geo = decodeURIComponent((u.hash.match(/geo=([^&/]+)/i)?.[1] ?? "")).replace(/\+/g, " ");
    return { origin: u.origin, token, geo };
  } catch { return null; }
}

interface RippleListItem { jobSeq?: number; jobTitle?: string }
interface RippleListResp { jobVoList?: RippleListItem[]; totalJobCount?: number }

async function searchPage(p: RippleParams, page: number): Promise<RippleListResp | null> {
  const params = {
    page, search: "*:*", token: p.token, source: "CAREERSITE", pagesize: PAGE,
    ...(p.geo ? { geo: p.geo } : {}),
  };
  try {
    const body = `careerSiteUrlParams=${encodeURIComponent(JSON.stringify(params))}&lang=en`;
    const res = await fetch(`${p.origin}/candidate/candidatejobsearch`, {
      method:  "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json",
        "User-Agent": UA, "Referer": `${p.origin}/candidate/?token=${p.token}&lang=en&source=CAREERSITE`,
      },
      body, signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return await res.json() as RippleListResp;
  } catch { return null; }
}

async function detail(p: RippleParams, jobSeq: number): Promise<{ title: string; rawText: string } | null> {
  try {
    const res = await fetch(
      `${p.origin}/candidate/candidatejobdetail?jobSeq=${jobSeq}&token=${p.token}&source=CAREERSITE&lang=en`,
      { headers: { "Accept": "application/json", "User-Agent": UA, "Referer": `${p.origin}/candidate/?token=${p.token}` }, signal: AbortSignal.timeout(12_000) }
    );
    if (!res.ok) return null;
    const d = await res.json() as { jobVO?: { jobTitle?: string; jobDesc?: string } };
    const rawText = stripHtml(d.jobVO?.jobDesc ?? "");
    if (rawText.length < 100) return null;
    return { title: d.jobVO?.jobTitle ?? "Untitled", rawText };
  } catch { return null; }
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

export async function scrapeRipplehire(url: string): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  const p = parseRipplehire(url);
  if (!p) return { jds: [], totalAvailable: 0 };

  const first = await searchPage(p, 0);
  if (!first) return { jds: [], totalAvailable: 0 };
  const totalAvailable = first.totalJobCount ?? (first.jobVoList ?? []).length;

  const items: RippleListItem[] = [...(first.jobVoList ?? [])];
  const want = targetScrapeCount(totalAvailable);
  for (let page = 1; page < MAX_PAGES && items.length < want; page++) {
    const r = await searchPage(p, page);
    const list = r?.jobVoList ?? [];
    if (list.length === 0) break;
    items.push(...list);
  }

  const toFetch = items.filter(j => j.jobSeq).slice(0, want + 5);
  const fetched = await mapWithConcurrency(toFetch, CONCURRENCY, async (j) => {
    const d = await detail(p, j.jobSeq!);
    if (!d) return null;
    let { title, rawText } = d;
    if (looksNonEnglish(rawText) || looksNonEnglish(title)) {
      const t = await translateToEnglish(title, rawText);
      title = t.title; rawText = t.rawText;
    }
    return {
      title,
      rawText:   rawText.slice(0, 12_000),
      sourceUrl: `${p.origin}/candidate/?token=${p.token}&source=CAREERSITE#detail/job/${j.jobSeq}`,
    } satisfies ScrapedJD;
  });

  const jds = (fetched.filter((x): x is NonNullable<typeof x> => x !== null) as ScrapedJD[]).slice(0, want);
  return { jds, totalAvailable };
}
