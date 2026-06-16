import { db }                  from "@/lib/db/client";
import { companies, analyses, jobDescriptions } from "@/lib/db/schema";
import { eq }                   from "drizzle-orm";
import { computeWizardData }    from "@/lib/report/aggregate";
import type { FinalAnalysis }   from "@/app/api/analyze/agents/types";

const slugFilter = process.argv.find(a => a.startsWith("--slug="))?.split("=")[1];

async function main() {
  const rows = await db
    .select({ id: companies.id, name: companies.name, slug: companies.slug })
    .from(companies);

  const targets = slugFilter ? rows.filter(c => c.slug === slugFilter) : rows;

  console.log(`Computing wizard data for ${targets.length} company/companies...`);

  let ok = 0, skipped = 0;

  for (const company of targets) {
    const analysisRows = await db
      .select({ id: analyses.id, result: analyses.result, department: jobDescriptions.department })
      .from(analyses)
      .innerJoin(jobDescriptions, eq(analyses.jobDescriptionId, jobDescriptions.id))
      .where(eq(analyses.companyId, company.id));

    if (analysisRows.length === 0) {
      console.log(`  SKIP  ${company.slug ?? company.id} — no analyses`);
      skipped++;
      continue;
    }

    const wizardData = computeWizardData(
      analysisRows.map(a => ({
        analysisId: a.id,
        result:     a.result as FinalAnalysis,
        department: a.department,
      })),
      company.slug ?? undefined
    );

    await db.update(companies)
      .set({ wizardData })
      .where(eq(companies.id, company.id));

    console.log(`  OK    ${company.slug ?? company.id} — ${wizardData.totalRolesAnalyzed} roles, ${wizardData.totalHoursSavedPerWeek}h/wk`);
    ok++;
  }

  console.log(`\nDone: ${ok} updated, ${skipped} skipped`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
