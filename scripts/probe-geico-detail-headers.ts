(async () => {
  const url = "https://geico.wd1.myworkdayjobs.com/wday/cxs/geico/External/job/Tucson-AZ/Inside-Sales-Representative_R0063502";

  const minimal = await fetch(url, {
    headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)" },
  });
  console.log("minimal detail:", minimal.status);
  if (minimal.ok) {
    const d = await minimal.json();
    console.log("  title:", d?.jobPostingInfo?.title);
    console.log("  desc len:", (d?.jobPostingInfo?.jobDescription ?? "").length);
  }

  const browser = await fetch(url, {
    headers: {
      "Accept":          "application/json",
      "Accept-Language": "en-US,en;q=0.9",
      "Origin":          "https://geico.wd1.myworkdayjobs.com",
      "Referer":         "https://geico.wd1.myworkdayjobs.com/External",
      "User-Agent":      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36",
    },
  });
  console.log("browser-like detail:", browser.status);
  if (browser.ok) {
    const d = await browser.json();
    console.log("  title:", d?.jobPostingInfo?.title);
    console.log("  desc len:", (d?.jobPostingInfo?.jobDescription ?? "").length);
  }
})();
