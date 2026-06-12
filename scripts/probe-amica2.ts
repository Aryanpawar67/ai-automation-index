// Direct Firecrawl probe to see what content we actually get for Amica
(async () => {
  const url = "https://careers.amica.com/search/jobs";
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${process.env.FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify({ url, formats: ["markdown", "rawHtml"], waitFor: 8000 }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    console.log("Firecrawl failed:", res.status, await res.text());
    return;
  }
  const data = await res.json();
  const md   = data?.data?.markdown ?? "";
  const html = data?.data?.rawHtml ?? "";
  console.log("markdown length:", md.length);
  console.log("rawHtml length: ", html.length);

  // Find every link that contains a numeric id (typical job posting ID pattern)
  const numericLinks = [...md.matchAll(/\[([^\]]{5,200})\]\((https?:\/\/[^\)]+\/(?:job|jobs|requisition|position)[s]?\/[^\)]*\d+[^\)]*)\)/gi)];
  console.log("\nNumeric job-like links from markdown:", numericLinks.length);
  numericLinks.slice(0, 25).forEach(m => console.log(" -", m[1].slice(0, 80), "→", m[2]));

  // Look at all anchor hrefs in raw HTML
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
  const jobHrefs = hrefs.filter(h => /\/jobs?\/[^/]*\d+/.test(h) || /requisition/i.test(h));
  console.log("\nJob-like hrefs from rawHtml:", jobHrefs.length);
  [...new Set(jobHrefs)].slice(0, 25).forEach(h => console.log(" -", h));

  // Find embedded API calls / endpoints that the page uses
  const apis = [...html.matchAll(/["'](https?:\/\/[^"'\s]+\/(?:api|rest|services|graphql)[^"']*)["']/gi)].map(m => m[1]);
  const uniqueApis = [...new Set(apis)];
  console.log("\nAPI URLs in page:", uniqueApis.length);
  uniqueApis.slice(0, 20).forEach(a => console.log(" -", a));

  // Print 1.5KB of markdown so we can eyeball
  console.log("\n--- MARKDOWN (chars 1500-3500) ---");
  console.log(md.slice(1500, 3500));
})();
