// Career page URL validation utility
// SSRF-safe: blocks private IPs and non-HTTP schemes
// ATS-aware: detects 19 ATS/HCM platforms from URL patterns + HTML fingerprinting
// Smart recovery: HTTPS upgrade, common path discovery, 403 bot-detection retry

const PRIVATE_IP =
  /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.|0\.0\.0\.0|::1|localhost)/i;

// ── ATS URL patterns ──────────────────────────────────────────────────────────

export const ATS_PATTERNS: Record<string, RegExp[]> = {
  workday:          [/myworkdayjobs\.com/i, /workday\.com\/en-US\//i],
  oracle_hcm:       [/\.fa\.[a-z0-9-]+\.oraclecloud\.com/i],
  oracle_taleo:     [/taleo\.net/i],
  sap_sf:           [/jobs2web\.com/i, /successfactors\.com/i, /sapsf\.com/i],
  greenhouse:       [/greenhouse\.io/i, /boards\.greenhouse\.io/i],
  lever:            [/lever\.co/i, /jobs\.lever\.co/i],
  bamboohr:         [/bamboohr\.com\/careers/i, /\.bamboohr\.com/i],
  icims:            [/careers\.icims\.com/i, /\.icims\.com\/jobs/i],
  smartrecruiters:  [/jobs\.smartrecruiters\.com/i, /smartrecruiters\.com\/list\//i],
  ashby:            [/jobs\.ashbyhq\.com/i, /ashbyhq\.com\/jobs/i],
  jobvite:          [/jobs\.jobvite\.com/i, /jobvite\.com\/careers/i],
  workable:         [/apply\.workable\.com/i, /\.workable\.com\/j\//i],
  personio:         [/\.jobs\.personio\./i, /\.personio\.com\/job-listings/i, /\.personio\.de\/job-listings/i],
  rippling:         [/ats\.rippling\.com/i],
  breezyhr:         [/\.breezy\.hr/i],
  jazzhr:           [/\.jazz\.co/i, /app\.jazz\.co/i],
  cornerstone:      [/\.csod\.com\/ux\/ats/i, /\.csod\.com\/careers/i],
  adp:              [/\.adp\.com\/mascsr.*recruitment/i, /\.adp\.com\/recruiting/i],
  pinpoint:         [/\.pinpointhq\.com/i],
};

// ── HTML fingerprints (script src / iframe / data attrs / globals) ─────────────

const HTML_FINGERPRINTS: Array<{ pattern: RegExp; ats: string }> = [
  // Script src markers
  { pattern: /greenhouse\.io/i,             ats: "greenhouse"      },
  { pattern: /lever\.co/i,                  ats: "lever"           },
  { pattern: /myworkdayjobs\.com/i,         ats: "workday"         },
  { pattern: /bamboohr\.com/i,              ats: "bamboohr"        },
  { pattern: /icims\.com/i,                 ats: "icims"           },
  { pattern: /smartrecruiters\.com/i,       ats: "smartrecruiters" },
  { pattern: /ashbyhq\.com/i,               ats: "ashby"           },
  { pattern: /jobvite\.com/i,               ats: "jobvite"         },
  { pattern: /workable\.com/i,              ats: "workable"        },
  { pattern: /personio\.(com|de)/i,         ats: "personio"        },
  { pattern: /rippling\.com/i,              ats: "rippling"        },
  { pattern: /breezy\.hr/i,                 ats: "breezyhr"        },
  { pattern: /jazz\.co/i,                   ats: "jazzhr"          },
  { pattern: /csod\.com/i,                  ats: "cornerstone"     },
  { pattern: /pinpointhq\.com/i,            ats: "pinpoint"        },
  { pattern: /taleo\.net/i,                 ats: "oracle_taleo"    },
  { pattern: /successfactors\.com/i,        ats: "sap_sf"          },
  { pattern: /oraclecloud\.com/i,           ats: "oracle_hcm"      },
  // JS globals / data attributes
  { pattern: /window\.__WORKDAY__/i,        ats: "workday"         },
  { pattern: /data-gh-root/i,               ats: "greenhouse"      },
  { pattern: /data-lever-/i,                ats: "lever"           },
  { pattern: /"@type"\s*:\s*"JobPosting"/i, ats: "generic_jd"     },
];

// ── Common careers path candidates (tried in order when URL is unreachable) ────

const CAREERS_PATHS = [
  "/careers",
  "/jobs",
  "/work-with-us",
  "/about/careers",
  "/company/careers",
  "/join-us",
  "/opportunities",
  "/en/careers",
  "/en/jobs",
  "/career",
  "/open-positions",
  "/hiring",
];

// ── Browser-like headers for 403 bot-detection retry ──────────────────────────

const BROWSER_HEADERS = {
  "User-Agent":                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept":                    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language":           "en-US,en;q=0.9",
  "Accept-Encoding":           "gzip, deflate, br",
  "Sec-Fetch-Dest":            "document",
  "Sec-Fetch-Mode":            "navigate",
  "Sec-Fetch-Site":            "none",
  "Upgrade-Insecure-Requests": "1",
};

// ── Types ──────────────────────────────────────────────────────────────────────

export interface UrlValidationResult {
  reachable:    boolean;
  httpStatus:   number | null;
  detectedAts:  string | null;
  matchedHint:  string | null;  // regex pattern that matched
  suggestedUrl: string | null;  // populated when input URL failed
  confidence:   "high" | "medium" | "low" | "blocked";
  reason:       string;
  finalUrl:     string | null;  // after redirects, if different from input
  isCareerPage: boolean | null; // null = unknown (no body scan done)
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function detectAtsFromUrl(url: string): { ats: string; hint: string } | null {
  for (const [ats, patterns] of Object.entries(ATS_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(url)) return { ats, hint: pattern.source };
    }
  }
  return null;
}

function detectAtsFromHtml(html: string): string | null {
  for (const { pattern, ats } of HTML_FINGERPRINTS) {
    if (pattern.test(html)) return ats;
  }
  return null;
}

function isCareerPageHtml(html: string): boolean {
  const lower = html.toLowerCase();
  const careerKeywords = [
    "career", "job opening", "job listing", "open position",
    "we're hiring", "join our team", "apply now", "job posting",
    "current opening", "vacancies", "vacancy", "job opportunit",
    "view opening", "explore opportunit", "join us", "work with us",
  ];
  return careerKeywords.some(kw => lower.includes(kw));
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function validateCareerUrl(
  rawUrl:          string,
  declaredAtsType?: string | null,
  timeoutMs        = 8000,
): Promise<UrlValidationResult> {

  // 1. Parse URL
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return {
      reachable:    false,
      httpStatus:   null,
      detectedAts:  null,
      matchedHint:  null,
      suggestedUrl: null,
      confidence:   "low",
      reason:       "Invalid URL format — cannot be parsed.",
      finalUrl:     null,
      isCareerPage: null,
    };
  }

  // 2. SSRF guard
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return {
      reachable:    false,
      httpStatus:   null,
      detectedAts:  null,
      matchedHint:  null,
      suggestedUrl: null,
      confidence:   "low",
      reason:       `Disallowed protocol: ${parsed.protocol}`,
      finalUrl:     null,
      isCareerPage: null,
    };
  }
  if (PRIVATE_IP.test(parsed.hostname)) {
    return {
      reachable:    false,
      httpStatus:   null,
      detectedAts:  null,
      matchedHint:  null,
      suggestedUrl: null,
      confidence:   "low",
      reason:       "Private/internal IP address — blocked for security.",
      finalUrl:     null,
      isCareerPage: null,
    };
  }

  // 3. ATS detection from URL (instant, no network)
  const urlAts = detectAtsFromUrl(rawUrl);
  let detectedAts:  string | null = urlAts?.ats  ?? null;
  let matchedHint:  string | null = urlAts?.hint ?? null;

  // 4. HTTP reachability
  let httpStatus:   number | null = null;
  let finalUrl:     string | null = null;
  let reachable                   = false;
  let reason                      = "";
  let isCareerPage: boolean | null = null;
  let responseBody: string | null = null;

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // 4a. HEAD first (lightweight)
    let res = await fetch(rawUrl, {
      method:   "HEAD",
      redirect: "follow",
      signal:   controller.signal,
      headers:  { "User-Agent": "Mozilla/5.0 (compatible; CareerURLValidator/1.0)" },
    });

    // 4b. 405 → fall back to GET
    if (res.status === 405) {
      res = await fetch(rawUrl, {
        method:   "GET",
        redirect: "follow",
        signal:   controller.signal,
        headers:  { "User-Agent": "Mozilla/5.0 (compatible; CareerURLValidator/1.0)" },
      });
      httpStatus = res.status;
      finalUrl   = res.url !== rawUrl ? res.url : null;
      reachable  = res.status < 400;
      reason     = reachable ? "URL is reachable (GET fallback)." : `HTTP ${res.status}`;
      if (reachable) {
        responseBody = await res.text().catch(() => null);
      }
    }
    // 4c. 403 → retry with browser headers (bot-detection bypass attempt)
    else if (res.status === 403) {
      const retryRes = await fetch(rawUrl, {
        method:   "GET",
        redirect: "follow",
        signal:   controller.signal,
        headers:  BROWSER_HEADERS,
      });
      httpStatus = retryRes.status;
      finalUrl   = retryRes.url !== rawUrl ? retryRes.url : null;
      reachable  = retryRes.status < 400;
      if (reachable) {
        reason       = "URL is reachable (browser-header retry after 403).";
        responseBody = await retryRes.text().catch(() => null);
      } else {
        reason = `HTTP 403 — likely bot-detection block (retry also failed with ${retryRes.status}).`;
      }
    } else {
      const headStatus = res.status;
      httpStatus = headStatus;
      finalUrl   = res.url !== rawUrl ? res.url : null;
      reachable  = headStatus < 400;
      reason     = reachable ? "URL is reachable." : `HTTP ${headStatus} — server returned an error.`;

      // Always do a GET for body fingerprinting.
      // If HEAD failed (4xx), retry GET with browser headers — many servers block HEAD
      // requests or return fake 4xx for bot User-Agents (adani.com returns 404 on HEAD).
      try {
        const getRes = await fetch(rawUrl, {
          method:   "GET",
          redirect: "follow",
          signal:   controller.signal,
          headers:  reachable
            ? { "User-Agent": "Mozilla/5.0 (compatible; CareerURLValidator/1.0)" }
            : BROWSER_HEADERS,
        });
        if (getRes.ok) {
          if (!reachable) {
            // HEAD lied — browser GET succeeded
            httpStatus = getRes.status;
            finalUrl   = getRes.url !== rawUrl ? getRes.url : null;
            reachable  = true;
            reason     = `URL is reachable (browser GET after HEAD ${headStatus}).`;
          }
          responseBody = await getRes.text().catch(() => null);
          if (getRes.url !== rawUrl) finalUrl = getRes.url;
        }
      } catch { /* GET failed — continue without body */ }
    }
  } catch (err: unknown) {
    const msg  = err instanceof Error ? err.message : String(err);
    reachable  = false;
    httpStatus = null;
    reason     = msg.includes("abort") || msg.includes("signal")
      ? `Request timed out after ${timeoutMs / 1000}s.`
      : `Network error: ${msg}`;
  } finally {
    clearTimeout(timer);
  }

  // 5. ATS detection from redirect target
  if (finalUrl && !detectedAts) {
    const redirectAts = detectAtsFromUrl(finalUrl);
    if (redirectAts) {
      detectedAts = redirectAts.ats;
      matchedHint = redirectAts.hint;
    }
  }

  // 6. HTML body fingerprinting (only if we have a body and still no ATS)
  if (responseBody) {
    if (!detectedAts) {
      const htmlAts = detectAtsFromHtml(responseBody);
      if (htmlAts && htmlAts !== "generic_jd") detectedAts = htmlAts;
    }
    isCareerPage = isCareerPageHtml(responseBody);
  }

  // 7. Smart URL discovery — try HTTPS upgrade or common paths if unreachable
  let suggestedUrl: string | null = null;
  if (!reachable) {
    suggestedUrl = await discoverCareerUrl(parsed, controller.signal, timeoutMs);
  }

  // 8. Confidence scoring
  let confidence: "high" | "medium" | "low" | "blocked" = "low";
  if (reachable && detectedAts)                          confidence = "high";
  else if (reachable && isCareerPage)                    confidence = "high";
  else if (reachable)                                    confidence = "medium";
  else if (reason.includes("bot-detection"))             confidence = "blocked";

  // 9. ATS mismatch note
  if (reachable && declaredAtsType && detectedAts && declaredAtsType !== detectedAts) {
    reason += ` Note: declared ATS is "${declaredAtsType}" but URL pattern matches "${detectedAts}".`;
  }

  return {
    reachable,
    httpStatus,
    detectedAts,
    matchedHint,
    suggestedUrl,
    confidence,
    reason,
    finalUrl,
    isCareerPage,
  };
}

// ── Smart URL discovery ────────────────────────────────────────────────────────

async function discoverCareerUrl(
  parsed:   URL,
  signal:   AbortSignal,
  timeoutMs: number,
): Promise<string | null> {
  const base = `${parsed.protocol}//${parsed.host}`;

  // 1. HTTPS upgrade first (if http://)
  if (parsed.protocol === "http:") {
    const httpsUrl = `https://${parsed.host}${parsed.pathname}${parsed.search}`;
    if (await isReachable(httpsUrl, signal)) return httpsUrl;
  }

  // 2. Common careers paths on same domain
  for (const path of CAREERS_PATHS) {
    const candidate = `${base}${path}`;
    if (await isReachable(candidate, signal)) return candidate;
  }

  return null;
}

async function isReachable(url: string, signal: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method:   "HEAD",
      redirect: "follow",
      signal,
      headers:  { "User-Agent": "Mozilla/5.0 (compatible; CareerURLValidator/1.0)" },
    });
    return res.status < 400;
  } catch {
    return false;
  }
}
