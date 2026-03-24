import { inngest }            from "./client";
import { db }                 from "@/lib/db/client";
import { companies, jobDescriptions } from "@/lib/db/schema";
import { scrapeCareerPage }   from "@/lib/scraper";
import { eq }                 from "drizzle-orm";

export const scrapeCompanyFn = inngest.createFunction(
  {
    id:          "scrape-company",
    concurrency: { limit: 5 },
    triggers:    [{ event: "company/scrape" }],
  },
  async ({ event }: { event: { data: { companyId: string; batchId: string } } }) => {
    const { companyId, batchId } = event.data;

    await db.update(companies)
      .set({ scrapeStatus: "in_progress" })
      .where(eq(companies.id, companyId));

    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!company) throw new Error(`Company ${companyId} not found`);

    const result = await scrapeCareerPage(company.careerPageUrl);

    if (!result.success) {
      await db.update(companies).set({
        scrapeStatus: result.blocked ? "blocked" : "failed",
        scrapeError:  result.error,
      }).where(eq(companies.id, companyId));
      return { status: "failed", reason: result.error };
    }

    // Persist scraped JDs
    if (result.jds.length > 0) {
      await db.insert(jobDescriptions).values(
        result.jds.map(jd => ({
          companyId,
          batchId,
          title:      jd.title,
          rawText:    jd.rawText,
          sourceUrl:  jd.sourceUrl ?? null,
          department: jd.department ?? null,
          status:     "pending" as const,
        }))
      );
    }

    await db.update(companies).set({
      scrapeStatus: "complete",
      scrapedAt:    new Date(),
    }).where(eq(companies.id, companyId));

    // Fan out — one analyzeJD event per JD
    const jds = await db.select()
      .from(jobDescriptions)
      .where(eq(jobDescriptions.companyId, companyId));

    if (jds.length > 0) {
      await inngest.send(
        jds.map(jd => ({
          name: "jd/analyze" as const,
          data: { jobDescriptionId: jd.id, batchId },
        }))
      );
    }

    return { status: "complete", jdCount: jds.length };
  }
);
