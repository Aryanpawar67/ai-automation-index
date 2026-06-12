(async () => {
  const url  = "https://geico.wd1.myworkdayjobs.com/wday/cxs/geico/External/jobs";
  const body = JSON.stringify({ appliedFacets: {}, limit: 3, offset: 0, searchText: "" });

  const variants = [
    { name: "minimal",
      headers: { "Content-Type": "application/json", "Accept": "application/json" } },
    { name: "with UA only",
      headers: { "Content-Type": "application/json", "Accept": "application/json", "User-Agent": "Mozilla/5.0" } },
    { name: "browser-like",
      headers: {
        "Content-Type":   "application/json",
        "Accept":         "application/json",
        "Accept-Language":"en-US,en;q=0.9",
        "Origin":         "https://geico.wd1.myworkdayjobs.com",
        "Referer":        "https://geico.wd1.myworkdayjobs.com/External",
        "User-Agent":     "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36",
      } },
  ];

  for (const v of variants) {
    try {
      const r = await fetch(url, { method: "POST", headers: v.headers, body });
      console.log(v.name, "→", r.status);
    } catch (e) {
      console.log(v.name, "→ ERR:", (e as Error).message);
    }
  }
})();
