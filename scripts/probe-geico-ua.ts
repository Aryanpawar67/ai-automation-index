(async () => {
  const url = "https://geico.wd1.myworkdayjobs.com/wday/cxs/geico/External/jobs";
  const body = JSON.stringify({ appliedFacets: {}, limit: 3, offset: 0, searchText: "" });

  const r1 = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json", "User-Agent": "Mozilla/5.0" },
    body,
  });
  console.log("with UA:", r1.status);

  const r2 = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body,
  });
  console.log("without UA:", r2.status);
})();
