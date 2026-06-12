(async () => {
  const url = "https://careers.amica.com/jobs/17678056-associate-apd-claims-representative";
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${process.env.FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify({ url, formats: ["markdown"], waitFor: 5000 }),
    signal: AbortSignal.timeout(60_000),
  });
  const data = await res.json();
  const md = data?.data?.markdown ?? "";
  console.log("markdown length:", md.length);
  console.log("title from metadata:", data?.data?.metadata?.title);
  console.log("\n--- markdown chars 0-2500 ---");
  console.log(md.slice(0, 2500));
  console.log("\n--- markdown chars 2500-5000 ---");
  console.log(md.slice(2500, 5000));
})();
