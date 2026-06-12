import { extractWorkdayTenant, resolveWorkdayEntryPoint, scrapeWorkday } from "../src/lib/scrapers/workday";

(async () => {
  const url = "https://geico.wd1.myworkdayjobs.com/External";
  console.log("extractWorkdayTenant:", extractWorkdayTenant(url));
  const resolved = await resolveWorkdayEntryPoint(url);
  console.log("resolveWorkdayEntryPoint:", resolved);
  if (!resolved) return;

  // Now call the CxS API directly with the same params the scraper would use
  const res = await fetch(`https://${resolved.host}/wday/cxs/${resolved.tenant}/${resolved.jobSite}/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: "" }),
  });
  console.log("CxS list status:", res.status);
  if (res.ok) {
    const d = await res.json();
    console.log("total:", d.total, "postings:", (d.jobPostings ?? []).length);
    if (d.jobPostings?.[0]) console.log("first:", d.jobPostings[0].title, "→", d.jobPostings[0].externalPath);
  }

  // Now run the actual scraper end-to-end
  console.log("\n--- scrapeWorkday end-to-end ---");
  const r = await scrapeWorkday(url);
  console.log("totalAvailable:", r.totalAvailable, "jds:", r.jds.length);
  for (const j of r.jds.slice(0, 3)) {
    console.log(" -", j.title, "len=", j.rawText.length);
    console.log("   url:", j.sourceUrl);
    console.log("   preview:", j.rawText.slice(0, 200).replace(/\s+/g, " "));
  }
})();
