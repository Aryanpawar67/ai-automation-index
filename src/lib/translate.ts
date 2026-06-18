// ── JD translation helper ────────────────────────────────────────────────────
// Some career sites only publish job descriptions in a non-English language
// (e.g. Döhler, a German company on SAP SuccessFactors). The whole analysis
// pipeline and the customer-facing report are English-only, so any non-English
// JD text must be translated to English before it is stored and analysed.

import { ChatAnthropic } from "@langchain/anthropic";

// Reuse the same cheap model the rest of the pipeline uses for extraction work.
let _model: ChatAnthropic | null = null;
const getModel = () => _model ??= new ChatAnthropic({ model: "claude-haiku-4-5-20251001", temperature: 0 });

// Heuristic German detector — counts common German stopwords + umlauts against a
// small set of English stopwords. Deliberately cheap: it only gates the (paid)
// LLM translation call, so a false positive just costs one translation.
const DE_MARKERS = [
  " und ", " der ", " die ", " das ", " für ", " mit ", " sie ", " wir ",
  " eine ", " sind ", " bei ", " aufgaben", " kenntnisse", " erfahrung",
  " anforderungen", " bewerb", " stelle", " unternehmen",
];
const EN_MARKERS = [
  " and ", " the ", " for ", " with ", " you ", " we ", " your ", " our ",
  " will ", " are ", " responsibilities", " requirements", " experience",
];

function score(text: string, markers: string[]): number {
  const lower = ` ${text.toLowerCase()} `;
  return markers.reduce((n, m) => n + (lower.includes(m) ? 1 : 0), 0);
}

/** True if the text looks predominantly German rather than English. */
export function looksGerman(text: string): boolean {
  const de = score(text, DE_MARKERS) + (/[äöüß]/.test(text) ? 1 : 0);
  const en = score(text, EN_MARKERS);
  return de > en;
}

/**
 * Translate a job title + description to English. On any failure the original
 * strings are returned unchanged so a translation hiccup never drops the JD.
 */
export async function translateToEnglish(
  title: string,
  text: string,
): Promise<{ title: string; rawText: string }> {
  try {
    const res = await getModel().invoke([
      {
        role: "system",
        content:
          "You are a professional translator. Translate the given job posting into natural, " +
          "fluent English. Preserve all structure (headings, bullet points, line breaks) and all " +
          "factual detail. Do not summarise, add, or omit anything. If a passage is already English, " +
          "leave it as-is. Respond with the title on the first line prefixed exactly with 'TITLE: ', " +
          "then a blank line, then the translated description body. Output nothing else.",
      },
      { role: "user", content: `TITLE: ${title}\n\n${text}` },
    ]);

    const out = (typeof res.content === "string" ? res.content : String(res.content)).trim();
    const m = out.match(/^TITLE:\s*(.+?)\n+([\s\S]*)$/);
    if (!m) return { title, rawText: out.length > 50 ? out : text };
    return { title: m[1].trim() || title, rawText: m[2].trim() || text };
  } catch {
    return { title, rawText: text };
  }
}
