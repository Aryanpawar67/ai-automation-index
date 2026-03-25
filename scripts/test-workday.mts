import { resolveWorkdayEntryPoint, extractWorkdayTenant } from "../src/lib/scrapers/workday";

const TEST_URLS: [string, string][] = [
  ["Comcast",         "https://jobs.comcast.com/"],
  ["IQVIA",           "https://jobs.iqvia.com/en"],
  ["Valmet",          "https://www.valmet.com/careers"],
  ["BD",              "https://jobs.bd.com/en"],
  ["MiQ Digital",     "https://www.wearemiq.com/careers"],
  ["Pfizer",          "https://www.pfizer.com/about/careers"],
  ["Pluralsight",     "https://www.pluralsight.com/careers"],
  ["Airbus",          "https://www.airbus.com/en/careers"],
  ["Sun Life",        "https://www.sunlife.ca/en/careers/"],
  ["RedHat",          "https://www.redhat.com/en/jobs"],
  ["JLL",             "https://www.jll.com/en-in/careers"],
  ["Thomson Reuters", "https://www.thomsonreuters.com/en/careers"],
  ["Deloitte",        "https://www.deloitte.com/global/en/careers/job-search.html"],
  ["DXC Technology",  "https://dxc.com/careers"],
  ["Guidehouse",      "https://guidehouse.com/careers"],
  ["Otto Intl",       "https://ottoint.wd116.myworkdayjobs.com/careers"],
  ["Valeo",           "https://valeo.wd3.myworkdayjobs.com/en-EN/valeo_jobs"],
  ["TIBA",            "https://romeu.wd3.myworkdayjobs.com/en-US/Romeu_Jobs"],
];

console.log("Testing Workday URL resolution...\n");

let resolved = 0, failed = 0;
for (const [name, url] of TEST_URLS) {
  process.stdout.write(`${name.padEnd(18)} `);
  try {
    const r = await resolveWorkdayEntryPoint(url);
    if (r) {
      console.log(`✓ tenant=${r.tenant}  jobSite=${r.jobSite}${r.resolvedUrl ? `\n${"".padEnd(19)}  → ${r.resolvedUrl}` : ""}`);
      resolved++;
    } else {
      console.log("✗ not resolved");
      failed++;
    }
  } catch (e: unknown) {
    console.log(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
    failed++;
  }
}

console.log(`\n${resolved} resolved, ${failed} failed out of ${TEST_URLS.length}`);
