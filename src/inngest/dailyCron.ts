import { inngest }   from "./client";
import { db }        from "@/lib/db/client";
import { companies, jobDescriptions } from "@/lib/db/schema";
import { eq }        from "drizzle-orm";

export const dailyCronFn = inngest.createFunction(
  {
    id:       "daily-batch-cron",
    triggers: [{ cron: "0 6 * * *" }],  // 6 AM UTC daily
  },
  async () => {
    // Pick up to 100 companies still pending scrape
    const pending = await db.select()
      .from(companies)
      .where(eq(companies.scrapeStatus, "pending"))
      .limit(100);

    if (pending.length === 0) {
      // Re-queue any JDs stuck in pending state (missed events)
      const pendingJDs = await db.select()
        .from(jobDescriptions)
        .where(eq(jobDescriptions.status, "pending"))
        .limit(50);

      if (pendingJDs.length > 0) {
        await inngest.send(
          pendingJDs.map(jd => ({
            name: "jd/analyze" as const,
            data: { jobDescriptionId: jd.id, batchId: jd.batchId },
          }))
        );
        return { message: `Re-queued ${pendingJDs.length} stuck JDs` };
      }
      return { message: "No pending work" };
    }

    await inngest.send(
      pending.map(c => ({
        name: "company/scrape" as const,
        data: { companyId: c.id, batchId: "cron" },
      }))
    );

    return { queued: pending.length, companies: pending.map(c => c.name) };
  }
);
