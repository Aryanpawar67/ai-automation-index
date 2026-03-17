/**
 * Shared utilities for agent files.
 */

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
