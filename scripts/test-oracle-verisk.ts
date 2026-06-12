import { scrapeOracleHCM } from '../src/lib/scrapers/oracleHCM';

// Quick inline test of context extraction
async function testContext() {
  const url = 'https://www.verisk.com/company/careers/';
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)" },
    signal: AbortSignal.timeout(12_000),
  });
  const html = await res.text();
  const fullMatch = html.match(
    /https?:\/\/([a-z0-9-]+)\.fa\.([a-z0-9-]+)\.oraclecloud\.com[^"'\s]*\/sites\/([A-Za-z0-9_-]+)/i
  );
  console.log('fullMatch:', fullMatch?.[0], '→ siteNumber:', fullMatch?.[3]);

  if (fullMatch) {
    const base = `https://${fullMatch[1]}.fa.${fullMatch[2]}.oraclecloud.com`;
    const probeUrl = `${base}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList&finder=findReqs;siteNumber=${fullMatch[3]},Offset=0,Limit=5`;
    console.log('probeUrl:', probeUrl);
    const p = await fetch(probeUrl, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000) }).catch(e => { console.log('probe err:', e.message); return null; });
    console.log('probe status:', p?.status);
    if (p?.ok) {
      const d = await p.json();
      const jobs = d?.items?.[0]?.requisitionList ?? [];
      console.log('jobs on probe:', jobs.length, '| TotalJobsCount:', d?.items?.[0]?.TotalJobsCount);
    }
  }
}

async function main() {
  await testContext();
  console.log('\n--- Calling scrapeOracleHCM ---');
  const { jds, totalAvailable } = await scrapeOracleHCM('https://www.verisk.com/company/careers/');
  console.log(`totalAvailable: ${totalAvailable}, jds: ${jds.length}`);
}
main().catch(console.error);
