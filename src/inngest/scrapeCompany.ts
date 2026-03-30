import { inngest }            from "./client";
import { db }                 from "@/lib/db/client";
import { companies, jobDescriptions, batches } from "@/lib/db/schema";
import { scrapeCareerPage }   from "@/lib/scraper";
import { isValidJD }          from "@/lib/validation";
import { eq, sql }            from "drizzle-orm";

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

    try {
      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (!company) {
        await db.update(companies)
          .set({ scrapeStatus: "failed", scrapeError: "Company record not found" })
          .where(eq(companies.id, companyId));
        return { status: "failed", reason: "Company record not found" };
      }

      const result = await scrapeCareerPage(company.careerPageUrl, company.atsType ?? undefined);

      // Persist the resolved ATS URL + total available jobs count
      if (result.success) {
        const updates: Record<string, unknown> = {};
        if (result.resolvedUrl && result.resolvedUrl !== company.careerPageUrl)
          updates.careerPageUrl = result.resolvedUrl;
        if (result.totalAvailable)
          updates.totalJobsAvailable = result.totalAvailable;
        if (Object.keys(updates).length > 0)
          await db.update(companies).set(updates).where(eq(companies.id, companyId));
      }

      if (!result.success) {
        await db.update(companies).set({
          scrapeStatus: result.blocked ? "blocked" : "failed",
          scrapeError:  result.error,
        }).where(eq(companies.id, companyId));
        return { status: "failed", reason: result.error };
      }

      // Persist ALL scraped JDs — valid ones as 'scraped', invalid as 'invalid'
      // Both are stored so admins can inspect what was collected
      if (result.jds.length > 0) {
        const jdRows = result.jds.map(jd => ({
          companyId,
          batchId,
          title:      jd.title,
          rawText:    jd.rawText,
          sourceUrl:  jd.sourceUrl ?? null,
          department: jd.department ?? null,
          status:     isValidJD(jd.title, jd.rawText) ? ("scraped" as const) : ("invalid" as const),
        }));
        await db.insert(jobDescriptions).values(jdRows);

        // Increment batch totalJds by the number of valid (non-invalid) JDs
        const validCount = jdRows.filter(j => j.status === "scraped").length;
        if (validCount > 0) {
          await db.update(batches)
            .set({ totalJds: sql`total_jds + ${validCount}` })
            .where(eq(batches.id, batchId));
        }
      }

      await db.update(companies).set({
        scrapeStatus: "complete",
        scrapedAt:    new Date(),
      }).where(eq(companies.id, companyId));

      const scraped  = result.jds.length;
      const invalid  = result.jds.filter(j => !isValidJD(j.title, j.rawText)).length;
      return { status: "complete", scrapedCount: scraped - invalid, invalidCount: invalid };
    } catch (err) {
      // Ensure company never stays stuck in 'in_progress' if something unexpected throws
      const message = err instanceof Error ? err.message : String(err);
      await db.update(companies)
        .set({ scrapeStatus: "failed", scrapeError: message })
        .where(eq(companies.id, companyId));
      throw err; // re-throw so Inngest can log it
    }
  }
);
