import { db } from '@/lib/db/client';
import { companies } from '@/lib/db/schema';
import { isNotNull, and } from 'drizzle-orm';

async function main() {
  const rows = await db.select({ slug: companies.slug, token: companies.reportToken })
    .from(companies)
    .where(and(isNotNull(companies.reportToken), isNotNull(companies.wizardData)))
    .limit(5);
  rows.forEach(r => console.log(`/report/${r.slug}?token=${r.token}`));
  process.exit(0);
}
main();
