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

/** True if the rawText contains enough job-description signal words. */
export function isValidContent(rawText: string): boolean {
  const lower = rawText.toLowerCase();
  const wordCount = lower.split(/\s+/).filter(Boolean).length;

  const hits = [
    // Structural section headers
    /\bresponsibilit/,                              // responsibilities / responsible
    /\brequirement/,                                // requirements
    /\bqualification/,                              // qualifications
    /\baccountabilit/,                              // key accountabilities
    /\bkey (skills?|duties|deliverables|tasks)/,    // key skills / duties
    /\bobjectiv/,                                   // objectives / job objective

    // Role-description phrasing
    /\bthis role\b/,                                // "this role involves / requires"
    /\bthe role\b/,                                 // "the role will be responsible"
    /\bthe position\b/,                             // "the position requires"
    /\bthe (successful )?(candidate|applicant)\b/,  // "the successful candidate"
    /\bjob (description|summary|overview|purpose)/,

    // Who-we-are-looking-for phrasing
    /\bwe (are|re|'re) (looking|hiring|seeking|searching)/,
    /\bwe'?re looking/,
    /\byou (will|'ll|should|must)\b/,               // "you will be responsible"
    /\bthe ideal candidate\b/,
    /\bwhat you('ll| will) (do|bring|need)/,        // "what you'll do"
    /\bwhat we('re| are) looking for/,
    /\byour responsibilities\b/,
    /\byour role\b/,

    // Experience / skills
    /\bexperience (with|in|of)\b/,
    /\bproven experience\b/,
    /\byears of experience\b/,
    /\bskills?\b/,
    /\bproficien/,                                  // proficient / proficiency
    /\bknowledge of\b/,

    // Standard JD boilerplate
    /\bapply\b/,
    /\bbenefits?\b/,
    /\bsalary\b/,
    /\bcompensation\b/,
    /\bequal opportunity\b/,
  ].filter(re => re.test(lower)).length;

  // Short JDs (< 120 words) only need 1 signal — they're often compact API-returned summaries
  const threshold = wordCount < 120 ? 1 : 2;
  return hits >= threshold;
}

/** Combined check — both title and content must pass. */
export function isValidJD(title: string, rawText: string): boolean {
  return isValidTitle(title) && isValidContent(rawText);
}
