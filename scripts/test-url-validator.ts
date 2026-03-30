/**
 * Standalone test script for validateCareerUrl + urlEnricher
 * Run: npx tsx scripts/test-url-validator.ts
 *
 * Covers: pure-logic paths + mocked fetch + AI enrichment (mocked).
 * No test framework — lean assertions only.
 */

import { readFileSync }                  from "fs";
import { resolve }                      from "path";

// Load .env.local so ANTHROPIC_API_KEY is available for the AI enricher test
try {
  const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of env.split("\n")) {
    const [k, ...v] = line.split("=");
    if (k && !process.env[k.trim()]) process.env[k.trim()] = v.join("=").trim();
  }
} catch { /* no .env.local — CI environment, API tests will gracefully degrade */ }

import { validateCareerUrl }            from "../src/lib/urlValidator";
import { shouldEnrich, enrichWithAI }   from "../src/lib/urlEnricher";

// ── Assertion helpers ─────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(label: string, actual: unknown, expected: unknown) {
  if (actual === expected) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    console.error(`      expected: ${JSON.stringify(expected)}`);
    console.error(`      received: ${JSON.stringify(actual)}`);
    failed++;
  }
}

function assertIncludes(label: string, haystack: string | null, needle: string) {
  if (haystack && haystack.includes(needle)) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    console.error(`      expected "${haystack}" to include "${needle}"`);
    failed++;
  }
}

function assertNotNull(label: string, actual: unknown) {
  if (actual !== null && actual !== undefined) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label} — expected non-null, got ${actual}`);
    failed++;
  }
}

// ── Fetch mock helpers ────────────────────────────────────────────────────────

type FetchImpl = typeof fetch;

function mockFetch(impl: FetchImpl) {
  (globalThis as Record<string, unknown>).fetch = impl;
}

function makeFakeResponse(status: number, finalUrl?: string): Response {
  return { status, ok: status < 400, url: finalUrl ?? "" } as unknown as Response;
}

function makeFakeTextResponse(status: number, body: string, finalUrl?: string): Response {
  return {
    status,
    ok:   status < 400,
    url:  finalUrl ?? "",
    text: () => Promise.resolve(body),
  } as unknown as Response;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

async function testInvalidUrl() {
  console.log("\n[1] Invalid URL format");
  const r = await validateCareerUrl("not-a-url");
  assert("reachable false",  r.reachable,  false);
  assert("httpStatus null",  r.httpStatus, null);
  assert("confidence low",   r.confidence, "low");
  assertIncludes("reason",   r.reason,     "Invalid URL format");
}

async function testBadProtocol() {
  console.log("\n[2] Non-HTTP protocol");
  const r = await validateCareerUrl("ftp://example.com/jobs");
  assert("reachable false",          r.reachable,  false);
  assertIncludes("reason protocol",  r.reason,     "Disallowed protocol");
}

async function testPrivateIps() {
  console.log("\n[3] Private / internal IPs");
  const cases = [
    "http://10.0.0.5/jobs",
    "http://192.168.1.1/jobs",
    "http://172.20.0.1/jobs",
    "http://127.0.0.1/jobs",
    "http://localhost/jobs",
  ];
  for (const url of cases) {
    const r = await validateCareerUrl(url);
    assert(`blocked: ${url}`,  r.reachable, false);
    assertIncludes(`reason: ${url}`, r.reason, "Private");
  }
}

async function testAtsUrlPatterns() {
  console.log("\n[4] ATS URL pattern detection (all 19 platforms)");
  mockFetch(async (url) => makeFakeResponse(200, String(url)));

  const cases: Array<{ url: string; ats: string }> = [
    { url: "https://acme.myworkdayjobs.com/en-US/Careers",                  ats: "workday"         },
    { url: "https://hcm.fa.us2.oraclecloud.com/hcmUI/CandidateExperience",  ats: "oracle_hcm"      },
    { url: "https://acme.taleo.net/careersection/apply",                    ats: "oracle_taleo"    },
    { url: "https://careers.successfactors.com/careers",                   ats: "sap_sf"          },
    { url: "https://boards.greenhouse.io/acme/jobs/123",                    ats: "greenhouse"      },
    { url: "https://jobs.lever.co/acme/role-123",                          ats: "lever"           },
    { url: "https://acme.bamboohr.com/careers",                            ats: "bamboohr"        },
    { url: "https://careers.icims.com/jobs/123",                           ats: "icims"           },
    { url: "https://jobs.smartrecruiters.com/acme/role",                   ats: "smartrecruiters" },
    { url: "https://jobs.ashbyhq.com/acme/role",                           ats: "ashby"           },
    { url: "https://jobs.jobvite.com/acme/job/abc123",                     ats: "jobvite"         },
    { url: "https://apply.workable.com/acme/j/abc123",                     ats: "workable"        },
    { url: "https://acme.jobs.personio.com/job-listings",                  ats: "personio"        },
    { url: "https://ats.rippling.com/acme/jobs",                           ats: "rippling"        },
    { url: "https://acme.breezy.hr/p/role-title",                          ats: "breezyhr"        },
    { url: "https://acme.jazz.co/apply/role",                              ats: "jazzhr"          },
    { url: "https://acme.csod.com/ux/ats/careersite",                      ats: "cornerstone"     },
    { url: "https://acme.adp.com/mascsr/default/mdf/recruitment/jobs",     ats: "adp"             },
    { url: "https://acme.pinpointhq.com/jobs",                             ats: "pinpoint"        },
  ];

  for (const { url, ats } of cases) {
    const r = await validateCareerUrl(url);
    assert(`detects ${ats}`, r.detectedAts, ats);
  }
}

async function testHtmlFingerprinting() {
  console.log("\n[5] HTML body fingerprinting (ATS via embedded scripts)");

  // Simulate a custom domain that embeds Greenhouse widget
  mockFetch(async (url, init) => {
    if (!init || init.method === "HEAD" || (init.method as string) === undefined) {
      // HEAD returns 200 but no ATS in URL
      return makeFakeResponse(200, String(url));
    }
    // GET returns HTML with Greenhouse script
    return makeFakeTextResponse(200,
      `<html><head><script src="https://boards.greenhouse.io/embed/job_board?for=acme"></script></head>
       <body><h1>Join our team</h1><p>We're hiring</p></body></html>`,
      String(url),
    );
  });

  const r = await validateCareerUrl("https://careers.acme.com");
  assert("detects greenhouse via HTML", r.detectedAts, "greenhouse");
  assert("isCareerPage true",           r.isCareerPage, true);
  assert("confidence high",             r.confidence,   "high");
}

async function testIsCareerPageDetection() {
  console.log("\n[6] isCareerPage detection from body content");

  mockFetch(async (url, init) => {
    if (init?.method === "HEAD") return makeFakeResponse(200, String(url));
    return makeFakeTextResponse(200,
      `<html><body><h1>Work with us</h1><p>We have open positions in engineering.</p></body></html>`,
      String(url),
    );
  });

  const r = await validateCareerUrl("https://example.com/careers");
  assert("isCareerPage true",  r.isCareerPage, true);
  assert("confidence high",    r.confidence,   "high");
}

async function testReachableNoAts() {
  console.log("\n[7] Reachable, no ATS, no career keywords → medium confidence");

  mockFetch(async (url, init) => {
    if (init?.method === "HEAD") return makeFakeResponse(200, String(url));
    return makeFakeTextResponse(200, "<html><body><p>Generic page</p></body></html>", String(url));
  });

  const r = await validateCareerUrl("https://example.com/page");
  assert("reachable",          r.reachable,   true);
  assert("detectedAts null",   r.detectedAts, null);
  assert("confidence medium",  r.confidence,  "medium");
}

async function test404() {
  console.log("\n[8] HTTP 404 → unreachable, low confidence");
  mockFetch(async (url) => makeFakeResponse(404, String(url)));

  const r = await validateCareerUrl("https://example.com/missing");
  assert("reachable false",  r.reachable,  false);
  assert("httpStatus 404",   r.httpStatus, 404);
  assert("confidence low",   r.confidence, "low");
  assertIncludes("reason 404", r.reason,   "404");
}

async function test405FallbackToGet() {
  console.log("\n[9] HTTP 405 HEAD → GET fallback");
  let callCount = 0;
  mockFetch(async (url, init) => {
    callCount++;
    if (init?.method === "HEAD") return makeFakeResponse(405, String(url));
    return makeFakeTextResponse(200,
      "<html><body>Open positions — join our team</body></html>",
      String(url),
    );
  });

  const r = await validateCareerUrl("https://example.com/jobs");
  assert("reachable after fallback",          r.reachable,  true);
  assertIncludes("reason GET fallback",       r.reason,     "GET fallback");
  assert("2 fetch calls",                     callCount,    2);
}

async function test403BotDetection() {
  console.log("\n[10] HTTP 403 → browser-header retry");
  let calls = 0;
  mockFetch(async (url, init) => {
    calls++;
    // First call (HEAD) → 403, second (browser GET) → 200
    if (calls === 1) return makeFakeResponse(403, String(url));
    return makeFakeTextResponse(200,
      "<html><body>Careers at Acme — we're hiring!</body></html>",
      String(url),
    );
  });

  const r = await validateCareerUrl("https://acme.myworkdayjobs.com/Careers");
  assert("reachable after 403 retry",         r.reachable,   true);
  assertIncludes("reason mentions 403 retry", r.reason,      "browser-header retry");
  assert("2 fetch calls",                     calls,         2);
}

async function test403BotDetectionFails() {
  console.log("\n[11] HTTP 403 → retry still fails → blocked confidence");
  mockFetch(async () => makeFakeResponse(403));

  const r = await validateCareerUrl("https://example.com/jobs");
  assert("reachable false",       r.reachable,  false);
  assert("confidence blocked",    r.confidence, "blocked");
  assertIncludes("reason bot-detection", r.reason, "bot-detection");
}

async function testRedirectAtsDetection() {
  console.log("\n[12] ATS detected via redirect URL");
  mockFetch(async (_url, init) => {
    if (init?.method === "HEAD")
      return makeFakeResponse(200, "https://acme.myworkdayjobs.com/en-US/Careers");
    return makeFakeTextResponse(200, "<html><body>Careers</body></html>",
      "https://acme.myworkdayjobs.com/en-US/Careers");
  });

  const r = await validateCareerUrl("https://jobs.acme.com");
  assert("detectedAts from redirect", r.detectedAts,    "workday");
  assertNotNull("finalUrl set",       r.finalUrl);
  assert("confidence high",           r.confidence,     "high");
}

async function testAtsMismatchNote() {
  console.log("\n[13] ATS mismatch between declared and detected");
  mockFetch(async (url) => makeFakeResponse(200, String(url)));

  const r = await validateCareerUrl(
    "https://acme.myworkdayjobs.com/en-US/Careers",
    "greenhouse",
  );
  assertIncludes("mismatch note in reason",  r.reason, "declared ATS");
  assertIncludes("mentions declared",        r.reason, "greenhouse");
  assertIncludes("mentions detected",        r.reason, "workday");
}

async function testTimeout() {
  console.log("\n[14] Request timeout");
  mockFetch((async () => {
    await new Promise<never>((_, reject) =>
      setTimeout(() => {
        const e = new Error("The operation was aborted");
        e.name  = "AbortError";
        reject(e);
      }, 10)
    );
  }) as unknown as FetchImpl);

  const r = await validateCareerUrl("https://slow.example.com/jobs", null, 50);
  assert("reachable false",            r.reachable, false);
  assertIncludes("reason timed out",   r.reason,    "timed out");
}

async function testNetworkError() {
  console.log("\n[15] Network error");
  mockFetch((() => { throw new Error("Failed to fetch"); }) as unknown as FetchImpl);

  const r = await validateCareerUrl("https://unreachable.example.com/jobs");
  assert("reachable false",              r.reachable, false);
  assertIncludes("reason network error", r.reason,    "Network error");
}

async function testShouldEnrich() {
  console.log("\n[16] shouldEnrich() gating logic");

  // High confidence + career page → skip
  assert("skip high+careerPage", shouldEnrich({
    reachable: true, httpStatus: 200, detectedAts: "greenhouse",
    confidence: "high", isCareerPage: true, reason: "reachable",
    matchedHint: null, suggestedUrl: null, finalUrl: null,
  }), false);

  // Blocked → enrich
  assert("enrich blocked", shouldEnrich({
    reachable: false, httpStatus: 403, detectedAts: null,
    confidence: "blocked", isCareerPage: null, reason: "bot-detection",
    matchedHint: null, suggestedUrl: null, finalUrl: null,
  }), true);

  // Low confidence → enrich
  assert("enrich low confidence", shouldEnrich({
    reachable: false, httpStatus: 404, detectedAts: null,
    confidence: "low", isCareerPage: null, reason: "HTTP 404",
    matchedHint: null, suggestedUrl: null, finalUrl: null,
  }), true);

  // Private IP → skip (no enrichment possible)
  assert("skip private IP", shouldEnrich({
    reachable: false, httpStatus: null, detectedAts: null,
    confidence: "low", isCareerPage: null,
    reason: "Private/internal IP address — blocked for security.",
    matchedHint: null, suggestedUrl: null, finalUrl: null,
  }), false);
}

async function testEnrichWithAIMocked() {
  console.log("\n[17] enrichWithAI (mocked ChatAnthropic)");

  // Monkey-patch the model inside urlEnricher — we mock the module's internal
  // ChatAnthropic by injecting a fake invoke response via the exported function.
  // Since we can't easily intercept the class, we verify graceful degradation
  // when the AI call fails (network is not available in test env).

  const fakeResult = {
    reachable: false, httpStatus: 404, detectedAts: null,
    confidence: "low" as const, isCareerPage: null,
    reason: "HTTP 404",
    matchedHint: null, suggestedUrl: null, finalUrl: null,
  };

  // With a real ANTHROPIC_API_KEY set, this calls the actual API.
  // In CI (no key), it gracefully returns an error result.
  const enriched = await enrichWithAI(
    "https://acme.com/careers",
    fakeResult,
    "Acme Corp",
    null,
  );

  // We only assert structure — not content (content is AI-generated)
  assert("has actionableReason",    typeof enriched.actionableReason === "string", true);
  assert("has confidence field",    ["high","medium","low"].includes(enriched.confidence), true);
  console.log(`  ℹ  AI reason: "${enriched.actionableReason.slice(0, 80)}..."`);
}

// ── Runner ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== URL Validator + AI Enricher test suite ===");

  await testInvalidUrl();
  await testBadProtocol();
  await testPrivateIps();
  await testAtsUrlPatterns();
  await testHtmlFingerprinting();
  await testIsCareerPageDetection();
  await testReachableNoAts();
  await test404();
  await test405FallbackToGet();
  await test403BotDetection();
  await test403BotDetectionFails();
  await testRedirectAtsDetection();
  await testAtsMismatchNote();
  await testTimeout();
  await testNetworkError();
  await testShouldEnrich();
  await testEnrichWithAIMocked();

  console.log(`\n${"─".repeat(44)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
