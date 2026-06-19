import { stripHtml }         from "../stripHtml";
import { targetScrapeCount } from "../jdLimits";
import { looksNonEnglish, translateToEnglish } from "../translate";
import type { ScrapedJD }    from "../scraper";

// Dassault Systèmes (www.3ds.com/careers/jobs) — a custom Exalead-backed search:
//   list: GET /apisearch/card_search_api?q=#all card_content_lang:en
//             (card_content_type="career")&s=desc(card_content_start_datetime)
//             &b=<startrow>&hf=15&output_format=json
//         → { nhits, hits: [{ url:"CARD_ID=NNN&...", metas:[{name,value}] }] }
//   The hit's `metas` carry content_title and a content_summary that holds the
//   full posting (longer than the per-card detail endpoint), so no detail call.

const ORIGIN = "https://www.3ds.com";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120";
const PAGE = 15;

interface DassaultMeta { name: string; value: string }
interface DassaultHit { url?: string; metas?: DassaultMeta[] }
interface DassaultResp { nhits?: number; hits?: DassaultHit[] }

function listUrl(startrow: number): string {
  const q = '#all card_content_lang:en   (card_content_type="career") ';
  const p = new URLSearchParams({
    q, s: "desc(card_content_start_datetime)", b: String(startrow), hf: String(PAGE), output_format: "json",
  });
  return `${ORIGIN}/apisearch/card_search_api?${p.toString()}`;
}

function meta(hit: DassaultHit, name: string): string {
  return hit.metas?.find(m => m.name === name)?.value ?? "";
}

async function fetchPage(startrow: number): Promise<DassaultResp | null> {
  try {
    const res = await fetch(listUrl(startrow), {
      headers: { "Accept": "application/json", "User-Agent": UA, "Referer": `${ORIGIN}/careers/jobs` },
      signal:  AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return await res.json() as DassaultResp;
  } catch { return null; }
}

export async function scrapeDassault(): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  const first = await fetchPage(0);
  if (!first) return { jds: [], totalAvailable: 0 };
  const totalAvailable = first.nhits ?? (first.hits ?? []).length;
  if (totalAvailable === 0) return { jds: [], totalAvailable: 0 };

  const keep = targetScrapeCount(totalAvailable);
  const hits: DassaultHit[] = [...(first.hits ?? [])];
  for (let start = PAGE; hits.length < keep + 4 && start < totalAvailable; start += PAGE) {
    const r = await fetchPage(start);
    const h = r?.hits ?? [];
    if (h.length === 0) break;
    hits.push(...h);
  }

  const out: ScrapedJD[] = [];
  for (const hit of hits) {
    if (out.length >= keep) break;
    let rawText = stripHtml(meta(hit, "content_summary"));
    if (rawText.length < 100) continue;
    let title = (meta(hit, "content_title") || "Untitled").trim();
    if (looksNonEnglish(rawText) || looksNonEnglish(title)) {
      const t = await translateToEnglish(title, rawText);
      title = t.title; rawText = t.rawText;
    }
    const cardId = meta(hit, "url").match(/CARD_ID=(\d+)/i)?.[1] ?? hit.url?.match(/CARD_ID=(\d+)/i)?.[1];
    out.push({
      title,
      rawText:   rawText.slice(0, 12_000),
      sourceUrl: cardId ? `${ORIGIN}/careers/jobs?CARD_ID=${cardId}` : `${ORIGIN}/careers/jobs`,
    });
  }
  return { jds: out, totalAvailable };
}
