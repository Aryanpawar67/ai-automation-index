async function main() {
  const url = 'https://www.verisk.com/company/careers/';
  
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)" },
    signal: AbortSignal.timeout(12_000),
  });
  console.log('Page status:', res.status);
  const html = await res.text();
  console.log('Page length:', html.length);
  
  // Test regex
  const domainMatch = html.match(/https?:\/\/([a-z0-9-]+)\.fa\.([a-z0-9-]+)\.oraclecloud\.com/i);
  console.log('domainMatch:', domainMatch?.[0]);
  
  if (domainMatch) {
    const base = `https://${domainMatch[1]}.fa.${domainMatch[2]}.oraclecloud.com`;
    console.log('base:', base);
    
    const cxMatch = html.match(/siteNumber[=:]["']?\s*(CX_\d+)/i);
    const nameMatch = html.match(/\/sites\/([A-Za-z0-9_-]+)/i);
    console.log('cxMatch:', cxMatch?.[1]);
    console.log('nameMatch:', nameMatch?.[1]);
    
    const siteNumber = cxMatch?.[1] ?? nameMatch?.[1] ?? "";
    console.log('siteNumber:', siteNumber);
    
    // Test probe URL
    const finderParts = siteNumber ? `siteNumber=${encodeURIComponent(siteNumber)},` : "";
    const probeUrl = `${base}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList&finder=findReqs;${finderParts}Offset=0,Limit=5`;
    console.log('probeUrl:', probeUrl);
    
    const probe = await fetch(probeUrl, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(6_000),
    }).catch(e => { console.log('probe error:', e.message); return null; });
    console.log('probe status:', probe?.status, probe?.ok);
  }
}
main().catch(console.error);
