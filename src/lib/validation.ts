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
    // ── English structural section headers ───────────────────────────────────
    /\bresponsibilit/,                              // responsibilities / responsible
    /\brequirement/,                                // requirements
    /\bqualification/,                              // qualifications
    /\baccountabilit/,                              // key accountabilities
    /\bkey (skills?|duties|deliverables|tasks)/,    // key skills / duties
    /\bobjectiv/,                                   // objectives / job objective

    // ── English role-description phrasing ────────────────────────────────────
    /\bthis role\b/,
    /\bthe role\b/,
    /\bthe position\b/,
    /\bthe (successful )?(candidate|applicant)\b/,
    /\bjob (description|summary|overview|purpose)/,
    /\bwe (are|re|'re) (looking|hiring|seeking|searching)/,
    /\bwe'?re looking/,
    /\byou (will|'ll|should|must)\b/,
    /\bthe ideal candidate\b/,
    /\bwhat you('ll| will) (do|bring|need)/,
    /\bwhat we('re| are) looking for/,
    /\byour responsibilities\b/,
    /\byour role\b/,

    // ── English experience / skills ──────────────────────────────────────────
    /\bexperience (with|in|of)\b/,
    /\bproven experience\b/,
    /\byears of experience\b/,
    /\bskills?\b/,
    /\bproficien/,
    /\bknowledge of\b/,

    // ── English boilerplate ──────────────────────────────────────────────────
    /\bapply\b/,
    /\bbenefits?\b/,
    /\bsalary\b/,
    /\bcompensation\b/,
    /\bequal opportunity\b/,

    // ── French ──────────────────────────────────────────────────────────────
    /\bresponsabilit/,                              // responsabilités / responsabilité
    /\bcompétences?\b/,
    /\bexpérience\b/,
    /\bmissions?\b/,
    /\bprofil\b/,
    /\bcandidature\b/,
    /\bposte\b/,

    // ── German ──────────────────────────────────────────────────────────────
    /\baufgaben\b/,                                 // tasks / responsibilities
    /\bkenntnisse\b/,                               // knowledge / skills
    /\berfahrung\b/,                                // experience
    /\banforderungen\b/,                            // requirements
    /\bstellenbeschreibung\b/,                      // job description
    /\bbewerber\b/,                                 // applicant

    // ── Spanish / Portuguese ─────────────────────────────────────────────────
    /\bresponsabilidades\b/,
    /\brequisitos\b/,
    /\bhabilidades\b/,
    /\bcandidato\b/,
    /\bexperiên/,                                   // experiência / experiências
    /\bvaga\b/,                                     // job opening (pt)

    // ── Dutch ────────────────────────────────────────────────────────────────
    /\bverantwoordelijkheden\b/,
    /\bkwalificaties\b/,
    /\bervaring\b/,
    /\bvacature\b/,

    // ── Italian ──────────────────────────────────────────────────────────────
    /\bresponsabilità\b/,
    /\brequisiti\b/,
    /\besperienza\b/,
  ].filter(re => re.test(lower)).length;

  // Short JDs (< 120 words) only need 1 signal — often compact API-returned summaries
  const threshold = wordCount < 120 ? 1 : 2;
  if (hits >= threshold) return true;

  // Non-English fallback: long text with Cyrillic / accented characters is almost
  // certainly a structured JD in another language (Russian, Arabic, CJK, etc.)
  if (wordCount >= 100 && /[^\x00-\x7F]/.test(rawText)) return true;

  // Very long text with zero signals = non-English JD we don't have patterns for yet
  if (wordCount >= 250) return true;

  return false;
}

/** Combined check — both title and content must pass. */
export function isValidJD(title: string, rawText: string): boolean {
  return isValidTitle(title) && isValidContent(rawText);
}
