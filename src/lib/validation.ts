// ── Shared JD quality validation ────────────────────────────────────────────
// Used in both scrapeCompany (pre-storage) and analyzeJD (pre-LangGraph).

export const MARKETING_TITLE_PATTERNS = [
  /^untitled position$/i,
  /hear from (our|the) leadership/i,
  /^ons management/i,
  /^information von/i,
  /life at \w/i,
  /^meet the team/i,
  /^our (culture|values|story|mission)/i,
  /^why (join|work at)/i,
  /^about us/i,
  /^(benefits|perks|diversity|inclusion)$/i,
  /^stripe\s*:/i,        // e.g. "Stripe: Jobs University"
  /jobs university/i,
  /^watch video/i,
];

/** True if the title looks like a real job role (not marketing/navigation content). */
export function isValidTitle(title: string): boolean {
  const t = title.trim();
  if (t.length < 4 || t.length > 140) return false;
  return !MARKETING_TITLE_PATTERNS.some(re => re.test(t));
}

/** True if the rawText contains enough job-description signal words (≥2). */
export function isValidContent(rawText: string): boolean {
  const lower = rawText.toLowerCase();
  const hits = [
    /\bresponsibilit/,
    /\brequirement/,
    /\bqualification/,
    /\bwe (are|re) (looking|hiring|seeking)/,
    /\byou (will|ll|should|must)/,
    /\bexperience (with|in)/,
    /\bskills?\b/,
    /\bapply\b/,
  ].filter(re => re.test(lower)).length;
  return hits >= 2;
}

/** Combined check — both title and content must pass. */
export function isValidJD(title: string, rawText: string): boolean {
  return isValidTitle(title) && isValidContent(rawText);
}
