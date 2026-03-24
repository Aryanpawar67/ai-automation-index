import { inngest }            from "./client";
import { db }                 from "@/lib/db/client";
import { companies, jobDescriptions } from "@/lib/db/schema";
import { scrapeCareerPage }   from "@/lib/scraper";
import { isValidJD }          from "@/lib/validation";
import { eq, and }            from "drizzle-orm";

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

    const result = await scrapeCareerPage(company.careerPageUrl, company.atsType ?? undefined);

    if (!result.success) {
      await db.update(companies).set({
        scrapeStatus: result.blocked ? "blocked" : "failed",
        scrapeError:  result.error,
      }).where(eq(companies.id, companyId));
      return { status: "failed", reason: result.error };
    }

    // Persist ALL scraped JDs — valid ones as 'pending', invalid as 'invalid'
    // Both are stored so admins can inspect what was collected
    if (result.jds.length > 0) {
      await db.insert(jobDescriptions).values(
        result.jds.map(jd => ({
          companyId,
          batchId,
          title:      jd.title,
          rawText:    jd.rawText,
          sourceUrl:  jd.sourceUrl ?? null,
          department: jd.department ?? null,
          status:     isValidJD(jd.title, jd.rawText) ? ("pending" as const) : ("invalid" as const),
        }))
      );
    }

    await db.update(companies).set({
      scrapeStatus: "complete",
      scrapedAt:    new Date(),
    }).where(eq(companies.id, companyId));

    // Fan out — only send valid (pending) JDs to LangGraph analysis
    const validJds = await db.select()
      .from(jobDescriptions)
      .where(and(
        eq(jobDescriptions.companyId, companyId),
        eq(jobDescriptions.status, "pending"),
      ));

    if (validJds.length > 0) {
      await inngest.send(
        validJds.map(jd => ({
          name: "jd/analyze" as const,
          data: { jobDescriptionId: jd.id, batchId },
        }))
      );
    }

    const totalJds = result.jds.length;
    const validCount = validJds.length;
    const invalidCount = totalJds - validCount;
    return { status: "complete", jdCount: validCount, invalidCount };
  }
);
