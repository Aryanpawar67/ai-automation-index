(async () => {
  const url = "https://careers.progressive.com/search/jobs/?page=2";
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${process.env.FIRECRAWL_API_KEY}`,
    },
    body:   JSON.stringify({ url, formats: ["markdown"], waitFor: 8000 }),
    signal: AbortSignal.timeout(60_000),
  });
  const d = await res.json();
  const md = d?.data?.markdown ?? "";
  const links = [...md.matchAll(/\[([^\]]+)\]\((https:\/\/[^\/]+\/jobs\/(\d+)-[^\)#?]+)\)/g)];
  console.log("page=2 link count:", links.length);
  for (const m of links.slice(0, 10)) console.log(" -", m[1].slice(0, 70));
  const total = md.match(/of\s+\**\s*(\d+)\s*\**\s+results?/i);
  console.log("total in md:", total?.[1]);
})();
