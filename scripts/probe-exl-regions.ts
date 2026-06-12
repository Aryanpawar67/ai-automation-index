/**
 * Probe EXL Oracle CX API for total job counts per location filter.
 * Run: npx tsx --env-file=.env.local scripts/probe-exl-regions.ts
 */
const BASE = "https://fa-ewjt-saasfaprod1.fa.ocs.oraclecloud.com";
const SITE = "CX_2";

async function totalFor(finderExtras: string, label: string): Promise<number> {
  const finder = `findReqs;siteNumber=${SITE}${finderExtras}`;
  const url = `${BASE}/hcmRestApi/resources/latest/recruitingCEJobRequisitions` +
    `?onlyData=true&limit=1&expand=requisitionList&finder=${encodeURIComponent(finder)}`;
  try {
    const res = await fetch(url, {
      headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    if (!res.ok) {
      console.log(`${label}: HTTP ${res.status} ${text.slice(0, 200)}`);
      return -1;
    }
    const data = JSON.parse(text);
    const total = data?.items?.[0]?.TotalJobsCount ?? -1;
    console.log(`${label}: ${total}  (finder=${finder})`);
    return total;
  } catch (e) {
    console.log(`${label}: ERROR ${(e as Error).message}`);
    return -1;
  }
}

async function listFacet(): Promise<void> {
  // Pull the full LOCATIONS facet — request a larger size and try alternate names
  const finder = `findReqs;siteNumber=${SITE},facetsList=LOCATIONS`;
  const url = `${BASE}/hcmRestApi/resources/latest/recruitingCEJobRequisitions` +
    `?onlyData=true&limit=1&expand=requisitionList,locationsFacet,flexFieldsFacet.values&finder=${encodeURIComponent(finder)}`;
  console.log("\n--- LOCATIONS facet ---");
  try {
    const res = await fetch(url, {
      headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) { console.log("HTTP", res.status, await res.text()); return; }
    const data = await res.json();
    const item = data?.items?.[0] ?? {};
    console.log("locationsFacet:", JSON.stringify(item.locationsFacet, null, 2));
    console.log("workLocationsFacet:", JSON.stringify(item.workLocationsFacet, null, 2));
    console.log("Facets:", JSON.stringify(item.Facets, null, 2));
  } catch (e) {
    console.log("err:", (e as Error).message);
  }
}

(async () => {
  await totalFor("", "TENANT TOTAL (no filter)");
  await totalFor(",locationId=300000000467584,locationLevel=country", "United States");
  await listFacet();
})();
