(async () => {
  const url = "https://careers.progressive.com/search/jobs/";
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${process.env.FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify({ url, formats: ["markdown"], waitFor: 8000 }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) {
    console.log("Firecrawl failed:", res.status, await res.text());
    return;
  }
  const data = await res.json();
  const md = data?.data?.markdown ?? "";
  console.log("md length:", md.length);

  // Find Showing/total pattern
  const total = md.match(/Showing\s+\d+\s*[-–]\s*\d+\s+of\s+(\d+)\s+result/i);
  console.log("total match:", total?.[1] ?? "NONE");

  // Find job links
  const links = [...md.matchAll(/\[([^\]]{4,200})\]\((https?:\/\/[^\)#?\s]+)\)/g)]
    .map(m => ({ title: m[1].trim(), url: m[2] }))
    .filter(l => /\/jobs?\/\d+/.test(l.url));
  console.log("\njob-detail links found:", links.length);
  for (const l of links.slice(0, 8)) {
    console.log(" -", l.title.slice(0,60), "→", l.url);
  }
  console.log("\n--- markdown chars 1500-3500 ---");
  console.log(md.slice(1500, 3500));
})();
