// Free web search — no API keys, no rate limits
// Primary:  DuckDuckGo HTML endpoint (scraping-friendly, no auth required)
// Fallback: Google Custom Search API (100 req/day free tier)
//
// Drop-in replacement for SerpAPI / Exa.ai at $0 cost.
// Usage: const results = await webSearch("Accenture HCM software", 5);

import * as cheerio from "cheerio";

export interface SearchResult {
  title:   string;
  snippet: string;
  url:     string;
}

// ── User-Agent rotation (browser-like, avoids bot detection) ──────────────────

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0",
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ── DuckDuckGo HTML scraper (primary) ─────────────────────────────────────────
// Uses html.duckduckgo.com/html — returns plain HTML, no JS required, no auth.
// DDG does not block server-side scrapers at low volume.

async function duckDuckGoSearch(query: string, num = 5): Promise<SearchResult[]> {
  const url  = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=us-en`;
  try {
    const res  = await fetch(url, {
      method:  "GET",
      signal:  AbortSignal.timeout(10000),
      headers: {
        "User-Agent":      randomUA(),
        "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control":   "no-cache",
        "Referer":         "https://duckduckgo.com/",
      },
    });
    if (!res.ok) return [];

    const html = await res.text();
    const $    = cheerio.load(html);
    const results: SearchResult[] = [];

    $(".result.results_links, .result.web-result").each((_i, el) => {
      if (results.length >= num) return false;

      const titleEl   = $(el).find(".result__a").first();
      const snippetEl = $(el).find(".result__snippet").first();
      const urlEl     = $(el).find(".result__url").first();

      const title   = titleEl.text().trim();
      const snippet = snippetEl.text().trim();

      // DDG wraps the real URL in a redirect — decode it from href uddg param
      const rawHref = titleEl.attr("href") ?? "";
      let url = urlEl.text().trim();
      if (rawHref.includes("uddg=")) {
        try {
          const params = new URLSearchParams(rawHref.split("?")[1]);
          url = decodeURIComponent(params.get("uddg") ?? url);
        } catch { /* use text fallback */ }
      } else if (rawHref.startsWith("http")) {
        url = rawHref;
      }

      if (title && url) results.push({ title, snippet, url });
    });

    return results;
  } catch {
    return [];
  }
}

// ── Google CSE fallback (secondary — 100 req/day free) ───────────────────────

async function googleCseSearch(query: string, num = 5): Promise<SearchResult[]> {
  const key = process.env.GOOGLE_CSE_KEY;
  const cx  = process.env.GOOGLE_CSE_CX;
  if (!key || !cx) return [];
  try {
    const url  = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(key)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(query)}&num=${num}`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json() as { items?: { title: string; snippet: string; link: string }[] };
    return (data.items ?? []).map(i => ({ title: i.title, snippet: i.snippet, url: i.link }));
  } catch {
    return [];
  }
}

// ── Main export ───────────────────────────────────────────────────────────────
// Tries DDG first, falls back to Google CSE if DDG returns nothing.

export async function webSearch(query: string, num = 5): Promise<SearchResult[]> {
  const ddgResults = await duckDuckGoSearch(query, num);
  if (ddgResults.length > 0) return ddgResults;

  // DDG returned nothing (rare) — fall back to Google CSE
  return googleCseSearch(query, num);
}

// Convenience: returns results formatted as a single text block for LLM consumption
export async function webSearchText(query: string, num = 5): Promise<string> {
  const results = await webSearch(query, num);
  if (results.length === 0) return "";
  return results
    .map(r => `${r.title}\n${r.snippet}\n${r.url}`)
    .join("\n\n");
}
