/**
 * Shared utilities for agent files.
 */

/** Normalize a task name for fuzzy key matching: lowercase, strip punctuation, collapse spaces. */
function normalizeTaskName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Look up tools for a task name using normalized key matching.
 * First tries exact match, then normalized match, then partial substring match.
 * Returns empty array if no match found.
 */
export function lookupTools(taskName: string, toolsMapping: Record<string, string[]>): string[] {
  if (toolsMapping[taskName]) return toolsMapping[taskName];

  const normTarget = normalizeTaskName(taskName);
  for (const [key, tools] of Object.entries(toolsMapping)) {
    if (normalizeTaskName(key) === normTarget) return tools;
  }
  for (const [key, tools] of Object.entries(toolsMapping)) {
    const normKey = normalizeTaskName(key);
    if (normKey.includes(normTarget) || normTarget.includes(normKey)) return tools;
  }
  return [];
}

/** Calls Tavily search API and returns concatenated result snippets.
 *  Returns an empty string if TAVILY_API_KEY is not set or the request fails.
 */
export async function searchWeb(query: string): Promise<string> {
  if (!process.env.TAVILY_API_KEY) return "";
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        max_results: 4,
        search_depth: "basic",
      }),
    });
    const data = await res.json();
    return (data.results ?? [])
      .map((r: { title: string; content: string }) => `${r.title}: ${r.content}`)
      .join("\n\n");
  } catch {
    return "";
  }
}
