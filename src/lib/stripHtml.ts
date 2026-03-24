/**
 * Converts HTML job description content to clean plain text.
 * Applied to all Tier 1 scraper output before storing rawText.
 */
export function stripHtml(html: string): string {
  return html
    // Remove <style> and <script> blocks entirely (including content)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    // Convert list items to bullet points before stripping tags
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/li>/gi, "")
    // Convert block elements to newlines
    .replace(/<\/?(p|div|br|h[1-6]|section|article|header|footer|tr)[^>]*>/gi, "\n")
    // Strip all remaining tags
    .replace(/<[^>]+>/g, "")
    // Decode common HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#?[a-zA-Z0-9]+;/g, " ")
    // Collapse 3+ consecutive newlines to 2
    .replace(/\n{3,}/g, "\n\n")
    // Collapse multiple spaces on a single line
    .replace(/[ \t]+/g, " ")
    // Trim each line
    .split("\n").map(l => l.trim()).join("\n")
    .trim()
    // Hard cap at 8000 chars
    .slice(0, 8000);
}
