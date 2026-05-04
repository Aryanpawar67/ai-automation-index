import { stripHtml }         from "../stripHtml";
import { targetScrapeCount } from "../jdLimits";
import type { ScrapedJD }    from "../scraper";

const FEED_BASE = "https://www.metlifecareers.com/en_US/ml/SearchJobs/feed/";
const JD_BASE   = "https://www.metlifecareers.com";

// Skip jobs whose titles contain CJK characters, Japanese punctuation,
// or explicit non-US country markers — these are Japan/Asia/LatAm roles
const NON_US_TITLE = /[　-鿿豈-﫿＀-￯一-鿿]|[가-힯]|\(Japan\)|\/Japan\(|Japan\/|Oman|Brasil|México|Chile|Colombia|Singapore|Hong Kong|Malaysia|Korea/;

interface FeedItem { title: string; link: string }

async function fetchFeedPage(start: number, perPage = 20): Promise<FeedItem[]> {
  try {
    const res = await fetch(`${FEED_BASE}?jobRecordsPerPage=${perPage}&start=${start}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)" },
      signal:  AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items: FeedItem[] = [];
    const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
    for (const block of itemBlocks) {
      const titleMatch = block.match(/<title><!\[CDATA\[([^\]]+)\]\]>/);
      const linkMatch  = block.match(/<link>(https?:\/\/[^<]+)<\/link>/) ??
                         block.match(/<guid[^>]*>(https?:\/\/[^<]+)<\/guid>/);
      if (titleMatch && linkMatch) {
        items.push({ title: titleMatch[1].trim(), link: linkMatch[1].trim() });
      }
    }
    return items;
  } catch { return []; }
}

async function fetchJobDetail(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)" },
      signal:  AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Strip scripts/styles and grab the body text after the h1
    const cleaned = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "");
    const bodyStart = cleaned.toLowerCase().indexOf("<main");
    const relevant  = bodyStart >= 0 ? cleaned.slice(bodyStart) : cleaned;
    return stripHtml(relevant).replace(/\s{3,}/g, "\n").trim().slice(0, 8000);
  } catch { return null; }
}

export async function scrapeAvatureMetLife(): Promise<{ jds: ScrapedJD[]; totalAvailable: number }> {
  // Fetch multiple pages to get enough candidates after filtering non-US jobs
  const TOTAL_FETCH = 80; // fetch up to 80 to find enough US jobs
  const perPage     = 20;
  const allItems: FeedItem[] = [];

  for (let start = 0; start < TOTAL_FETCH && allItems.length < TOTAL_FETCH; start += perPage) {
    const page = await fetchFeedPage(start, perPage);
    if (page.length === 0) break;
    allItems.push(...page);
    if (page.length < perPage) break; // last page
  }

  // Filter to likely US/Americas roles
  const usItems = allItems.filter(item => !NON_US_TITLE.test(item.title));
  const totalAvailable = usItems.length; // approximate — we don't have a true US-only count
  const keep           = targetScrapeCount(totalAvailable > 50 ? 463 : usItems.length);

  const jds: ScrapedJD[] = [];
  for (const item of usItems.slice(0, keep)) {
    const rawText = await fetchJobDetail(item.link);
    if (!rawText || rawText.length < 200) continue;
    jds.push({ title: item.title, rawText, sourceUrl: item.link });
  }

  return { jds, totalAvailable: 463 }; // report total as the known 463 for tier decisions
}
