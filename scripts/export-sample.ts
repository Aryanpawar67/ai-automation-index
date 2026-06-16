import { db } from '@/lib/db/client';
import { companies } from '@/lib/db/schema';
import { eq, isNotNull } from 'drizzle-orm';

async function main() {
  const [row] = await db.select({ name: companies.name, wizardData: companies.wizardData })
    .from(companies)
    .where(eq(companies.slug, 'aig'))
    .limit(1);
  if (row?.wizardData) {
    // Only export top 8 roles to keep file small
    const d = { ...row.wizardData, roles: row.wizardData.roles.slice(0, 8) };
    console.log(JSON.stringify({ company: row.name, data: d }));
  }
  process.exit(0);
}
main();
