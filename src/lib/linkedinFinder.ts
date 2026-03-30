// LinkedIn profile URL finder — zero cost approach
// Primary:  DuckDuckGo web scraper via webSearch.ts (no API key, no limits)
// Fallback: Google Custom Search API (100 req/day) — automatic inside webSearch.ts
// Paid upgrade: replace findLinkedIn() with Apollo.io People Match API
//   POST https://api.apollo.io/v1/people/match with APOLLO_API_KEY
//   Returns linkedin_url directly with 65–80% hit rate vs 45–65% free

import { webSearch, SearchResult } from "@/lib/webSearch";

export interface LinkedInFinderInput {
  firstName:   string;
  lastName:    string;
  companyName: string;
  emailDomain: string;
}

export interface LinkedInFinderOutput {
  url:        string | null;
  confidence: number;
  source:     "web_search" | "not_found";
}

function scoreResult(item: SearchResult, input: LinkedInFinderInput): number {
  // Must be a /in/ profile URL (not /company/ or /jobs/)
  if (!item.url.includes("linkedin.com/in/")) return 0;

  const full      = `${item.title} ${item.snippet}`.toLowerCase();
  const firstName = input.firstName.toLowerCase();
  const lastName  = input.lastName.toLowerCase();
  const company   = input.companyName.toLowerCase();
  const domainKey = input.emailDomain.toLowerCase().replace(/\.[^.]+$/, "").split(".").pop() ?? "";

  if (!full.includes(firstName) || !full.includes(lastName)) return 0;

  const hasCompany = full.includes(company.split(" ")[0]) || (domainKey && full.includes(domainKey));
  return hasCompany ? 90 : 60;
}

export async function findLinkedIn(input: LinkedInFinderInput): Promise<LinkedInFinderOutput> {
  const { firstName, lastName, companyName } = input;
  if (!firstName || !lastName) return { url: null, confidence: 0, source: "not_found" };

  // Primary: name + company scoped to linkedin.com/in/
  const q1 = `site:linkedin.com/in/ "${firstName} ${lastName}" "${companyName}"`;
  let results = await webSearch(q1, 5);

  // Fallback: name only (handles company name mismatches)
  if (results.length === 0) {
    await new Promise(r => setTimeout(r, 300));
    results = await webSearch(`site:linkedin.com/in/ "${firstName} ${lastName}"`, 5);
  }

  if (results.length === 0) return { url: null, confidence: 0, source: "not_found" };

  let best: { url: string; confidence: number } | null = null;
  for (const item of results) {
    const score = scoreResult(item, input);
    if (score > 0 && (!best || score > best.confidence)) {
      best = { url: item.url, confidence: score };
    }
  }

  if (!best) return { url: null, confidence: 0, source: "not_found" };
  return { url: best.url, confidence: best.confidence, source: "web_search" };
}
