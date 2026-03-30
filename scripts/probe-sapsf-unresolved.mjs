const companies = [
  { name: "VC ERP Consulting",   url: "https://www.vc-erp.com/career.html" },
  { name: "Atos Syntel Inc.",    url: "https://atos.net/en/join-us" },
  { name: "Wipro",               url: "https://careers.wipro.com/" },
  { name: "imocha",              url: "https://www.imocha.io/careers" },
];

const SF_CDN_RE = /^rmkcdn\.|^cdn\.|^static\.|^assets\.|^images?\.|rmk-map-/i;
const STATIC_EXT_RE = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map)(\?|$)/i;

async function fetchHtml(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(15_000),
      redirect: "follow",
    });
    return res.ok ? await res.text() : null;
  } catch { return null; }
}

for (const co of companies) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${co.name} — ${co.url}`);
  console.log(`${"─".repeat(60)}`);
  const html = await fetchHtml(co.url);
  if (!html) { console.log("  [FAILED to fetch]"); continue; }
  
  // Look for SF signals
  const j2w = [...html.matchAll(/([a-z0-9_-]+)\.jobs2web\.com/gi)].map(m => m[0]).filter(u => !SF_CDN_RE.test(u.split('.')[0]));
  const sfUrls = [...html.matchAll(/https?:\/\/[a-z0-9._-]*successfactors\.com\/[^\s"'<>]{10,}/gi)].map(m => m[0]).filter(u => !STATIC_EXT_RE.test(u));
  const companyCode = html.match(/[?&](?:career_)?company=([A-Za-z0-9_-]{3,})/i)?.[1];
  const companyIdMatch = html.match(/[Cc]ompany[Ii]d["'\s:=]+["']([A-Za-z0-9_-]{3,})["']/)?.[1];
  const sfRedirect = html.match(/career1[0-9]\.successfactors\.com[^\s"'<>]*/gi)?.[0];

  if (j2w.length)       console.log("  jobs2web refs:", j2w.join(", "));
  if (sfUrls.length)    console.log("  SF URLs:", sfUrls.slice(0,3).join("\n           "));
  if (companyCode)      console.log("  company param:", companyCode);
  if (companyIdMatch)   console.log("  CompanyId:", companyIdMatch);
  if (sfRedirect)       console.log("  career1x URL:", sfRedirect);
  if (!j2w.length && !sfUrls.length && !companyCode && !companyIdMatch && !sfRedirect)
    console.log("  [no SAP SF signals found]");
  
  // Show a snippet of html for manual inspection
  const snippet = html.substring(0, 300).replace(/\s+/g, ' ');
  console.log("  HTML snippet:", snippet);
}
