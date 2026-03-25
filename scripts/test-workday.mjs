// Quick test script — runs via: node --experimental-vm-modules scripts/test-workday.mjs
// Uses dynamic import with tsx register

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// We test URLs directly using fetch — no module import needed
const TEST_URLS = [
  ["Comcast",         "https://jobs.comcast.com/"],
  ["IQVIA",           "https://jobs.iqvia.com/en"],
  ["Valmet",          "https://www.valmet.com/careers"],
  ["BD",              "https://jobs.bd.com/en"],
  ["Pfizer",          "https://www.pfizer.com/about/careers"],
  ["Airbus",          "https://www.airbus.com/en/careers"],
  ["Sun Life",        "https://www.sunlife.ca/en/careers/"],
  ["RedHat",          "https://www.redhat.com/en/jobs"],
  ["Thomson Reuters", "https://www.thomsonreuters.com/en/careers"],
  ["Deloitte",        "https://www.deloitte.com/global/en/careers/job-search.html"],
  ["DXC Technology",  "https://dxc.com/careers"],
  ["Guidehouse",      "https://guidehouse.com/careers"],
  ["Otto Intl",       "https://ottoint.wd116.myworkdayjobs.com/careers"],
  ["Valeo",           "https://valeo.wd3.myworkdayjobs.com/en-EN/valeo_jobs"],
  ["TIBA",            "https://romeu.wd3.myworkdayjobs.com/en-US/Romeu_Jobs"],
];

const WD_RE = /https?:\/\/([a-z0-9-]+)\.(?:wd\d+\.)?myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([a-z0-9_-]+)/i;
const CXS_RE = /\/wday\/cxs\/([a-z0-9_-]+)\/([a-z0-9_-]+)\/jobs/i;

function extractFromUrl(url) {
  const m = url.match(/https?:\/\/([^.]+)\.(?:wd\d+\.)?myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([^/?#\s]+)/i);
  return m ? { tenant: m[1], jobSite: m[2] } : null;
}

async function resolve(url) {
  const direct = extractFromUrl(url);
  if (direct) return { ...direct, resolvedUrl: null };

  let html;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    html = await res.text();
  } catch { return null; }

  // CxS API pattern
  const cxs = html.match(CXS_RE);
  if (cxs) return { tenant: cxs[1], jobSite: cxs[2], resolvedUrl: null };

  // myworkdayjobs.com href anywhere
  const wdLink = html.match(/https?:\/\/([a-z0-9-]+)\.(?:wd\d+\.)?myworkdayjobs\.com\/[^"'\s>]*/gi);
  if (wdLink) {
    for (const link of wdLink) {
      const p = extractFromUrl(link);
      if (p) return { ...p, resolvedUrl: link.split('"')[0].split("'")[0] };
    }
  }

  // One-hop: scan for off-domain job links
  const hrefRe = /href="([^"#\s]{10,})"/gi;
  const candidates = new Set();
  let m;
  while ((m = hrefRe.exec(html)) !== null) {
    try {
      const abs = m[1].startsWith("http") ? m[1] : new URL(m[1], url).href;
      if (new URL(abs).hostname !== new URL(url).hostname && /job|career|work/i.test(abs)) {
        const p = extractFromUrl(abs);
        if (p) return { ...p, resolvedUrl: abs };
        candidates.add(abs.split("?")[0]);
      }
    } catch {}
  }

  for (const candidate of [...candidates].slice(0, 3)) {
    try {
      const res = await fetch(candidate, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(7000) });
      if (!res.ok) continue;
      const hopHtml = await res.text();
      const wdLinks = hopHtml.match(/https?:\/\/([a-z0-9-]+)\.(?:wd\d+\.)?myworkdayjobs\.com\/[^"'\s>]*/gi);
      if (wdLinks) {
        for (const link of wdLinks) {
          const p = extractFromUrl(link);
          if (p) return { ...p, resolvedUrl: link };
        }
      }
      const cxsHop = hopHtml.match(CXS_RE);
      if (cxsHop) return { tenant: cxsHop[1], jobSite: cxsHop[2], resolvedUrl: candidate };
    } catch { continue; }
  }
  return null;
}

console.log("Testing Workday URL resolution...\n");
let ok = 0, fail = 0;
for (const [name, url] of TEST_URLS) {
  process.stdout.write(name.padEnd(18) + " ");
  const r = await resolve(url);
  if (r) {
    console.log(`✓  tenant=${r.tenant}  jobSite=${r.jobSite}${r.resolvedUrl ? "\n" + " ".repeat(19) + "→ " + r.resolvedUrl : ""}`);
    ok++;
  } else {
    console.log("✗  not resolved");
    fail++;
  }
}
console.log(`\n${ok} resolved, ${fail} failed / ${TEST_URLS.length} total`);
