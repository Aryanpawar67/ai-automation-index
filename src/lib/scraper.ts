import * as cheerio from "cheerio";

export interface ScrapedJD {
  title:      string;
  rawText:    string;
  sourceUrl?: string;
  department?: string;
}

export type ScrapeResult =
  | { success: true;  jds: ScrapedJD[] }
  | { success: false; error: string; blocked: boolean };

// ── Tier 1: Known ATS public APIs ─────────────────────────────────────────────

function detectATS(url: string): string | null {
  if (/greenhouse\.io/i.test(url))  return "greenhouse";
  if (/lever\.co/i.test(url))       return "lever";
  if (/teamtailor\.com/i.test(url)) return "teamtailor";
  if (/workable\.com/i.test(url))   return "workable";
  return null;
}

async function scrapeGreenhouse(url: string): Promise<ScrapedJD[]> {
  const match = url.match(/greenhouse\.io\/([^/?#]+)/i);
  if (!match) return [];
  const board = match[1];
  const res   = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`,
    { signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) return [];
  const data = await res.json() as { jobs?: Array<{ title: string; content: string; absolute_url: string; departments?: Array<{ name: string }> }> };
  return (data.jobs ?? []).slice(0, 10).map(j => ({
    title:      j.title,
    rawText:    j.content ?? j.title,
    sourceUrl:  j.absolute_url,
    department: j.departments?.[0]?.name,
  }));
}

async function scrapeLever(url: string): Promise<ScrapedJD[]> {
  const match = url.match(/lever\.co\/([^/?#]+)/i);
  if (!match) return [];
  const company = match[1];
  const res     = await fetch(
    `https://api.lever.co/v0/postings/${company}?mode=json&limit=10`,
    { signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) return [];
  const data = await res.json() as Array<{ text: string; descriptionPlain: string; hostedUrl: string; categories?: { team?: string } }>;
  return (Array.isArray(data) ? data : []).slice(0, 10).map(j => ({
    title:      j.text,
    rawText:    j.descriptionPlain ?? j.text,
    sourceUrl:  j.hostedUrl,
    department: j.categories?.team,
  }));
}

// ── Tier 2: Static HTML scraping with cheerio ─────────────────────────────────

async function scrapeStatic(url: string): Promise<ScrapedJD[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];

  const html = await res.text();
  const $    = cheerio.load(html);

  // Collect job-like links
  const seen     = new Set<string>();
  const jobLinks: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const text = $(el).text().toLowerCase();
    if (/job|career|position|opening|vacancy|role/.test(href + text)) {
      try {
        const absolute = href.startsWith("http") ? href : new URL(href, url).href;
        if (!seen.has(absolute)) { seen.add(absolute); jobLinks.push(absolute); }
      } catch { /* invalid url, skip */ }
    }
  });

  const jds: ScrapedJD[] = [];
  for (const link of jobLinks.slice(0, 10)) {
    try {
      const jdRes = await fetch(link, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)" },
        signal: AbortSignal.timeout(8_000),
      });
      if (!jdRes.ok) continue;
      const jdHtml = await jdRes.text();
      const $jd    = cheerio.load(jdHtml);
      $jd("script,style,nav,footer,header").remove();
      const rawText = $jd("body").text().replace(/\s{3,}/g, "\n").trim().slice(0, 8000);
      const title   = $jd("h1").first().text().trim() || "Untitled Position";
      if (rawText.length > 200) jds.push({ title, rawText, sourceUrl: link });
    } catch { /* skip failed individual JD */ }
  }
  return jds;
}

// ── Tier 3: Firecrawl (handles JS-rendered pages) ────────────────────────────

async function scrapeFirecrawl(url: string): Promise<ScrapedJD[]> {
  if (!process.env.FIRECRAWL_API_KEY) return [];
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/crawl", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        url,
        limit:         10,
        scrapeOptions: { formats: ["markdown"] },
        includePaths:  ["*job*", "*career*", "*position*", "*opening*"],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return [];
    const data = await res.json() as { data?: Array<{ metadata?: { title?: string }; markdown?: string; url?: string }> };
    return (data.data ?? []).slice(0, 10).map(page => ({
      title:     page.metadata?.title ?? "Untitled Position",
      rawText:   (page.markdown ?? "").slice(0, 8000),
      sourceUrl: page.url,
    })).filter(j => j.rawText.length > 100);
  } catch {
    return [];
  }
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function scrapeCareerPage(url: string): Promise<ScrapeResult> {
  try {
    // Tier 1 — known ATS APIs
    const ats = detectATS(url);
    if (ats === "greenhouse") {
      const jds = await scrapeGreenhouse(url);
      if (jds.length > 0) return { success: true, jds };
    }
    if (ats === "lever") {
      const jds = await scrapeLever(url);
      if (jds.length > 0) return { success: true, jds };
    }

    // Tier 2 — static HTML
    const staticJds = await scrapeStatic(url);
    if (staticJds.length > 0) return { success: true, jds: staticJds };

    // Tier 3 — Firecrawl for JS-rendered pages
    const firecrawlJds = await scrapeFirecrawl(url);
    if (firecrawlJds.length > 0) return { success: true, jds: firecrawlJds };

    return { success: false, error: "No job listings found on this page.", blocked: false };
  } catch (err: unknown) {
    const msg     = err instanceof Error ? err.message : String(err);
    const blocked = /403|401|forbidden|blocked|ECONNREFUSED/i.test(msg);
    return { success: false, error: msg, blocked };
  }
}
