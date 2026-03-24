import { inngest }                         from "./client";
import { db }                              from "@/lib/db/client";
import { jobDescriptions, analyses, companies, batches } from "@/lib/db/schema";
import { generateReportToken }             from "@/lib/token";
import { createAnalysisGraph }             from "@/app/api/analyze/graph";
import { isValidJD }                       from "@/lib/validation";
import { eq, sql }                         from "drizzle-orm";
import type { FinalAnalysis }              from "@/app/api/analyze/agents/types";

export const analyzeJDFn = inngest.createFunction(
  {
    id:       "analyze-jd",
    concurrency: { limit: 3 },
    retries:  2,
    triggers: [{ event: "jd/analyze" }],
  },
  async ({ event }: { event: { data: { jobDescriptionId: string; batchId: string } } }) => {
    const { jobDescriptionId, batchId } = event.data;

    await db.update(jobDescriptions)
      .set({ status: "analyzing" })
      .where(eq(jobDescriptions.id, jobDescriptionId));

    try {
      const [jd] = await db.select().from(jobDescriptions)
        .where(eq(jobDescriptions.id, jobDescriptionId));
      if (!jd) throw new Error("JD not found");

      // Validation gate — catches old bad JDs or any that slipped through scraping
      if (jd.status === "invalid" || !isValidJD(jd.title, jd.rawText)) {
        await db.update(jobDescriptions)
          .set({ status: "invalid" })
          .where(eq(jobDescriptions.id, jobDescriptionId));
        return { status: "skipped", reason: "did not pass JD validation" };
      }

      const [companyRow] = await db.select({ name: companies.name })
        .from(companies)
        .where(eq(companies.id, jd.companyId));

      const graph       = createAnalysisGraph();
      const graphStream = await graph.stream(
        { jobDescription: jd.rawText, company: companyRow?.name ?? "" },
        { streamMode: "updates" }
      );

      let finalResult: FinalAnalysis | null = null;
      for await (const update of graphStream) {
        const nodeUpdate = update as Record<string, Record<string, unknown>>;
        const nodeName   = Object.keys(nodeUpdate)[0];
        if (nodeName === "finalise" && nodeUpdate[nodeName]?.result) {
          finalResult = nodeUpdate[nodeName].result as FinalAnalysis;
        }
      }

      if (!finalResult) throw new Error("Pipeline produced no result");

      await db.insert(analyses).values({
        jobDescriptionId,
        companyId:    jd.companyId,
        result:       finalResult,
        overallScore: finalResult.overallAutomationScore,
        hoursSaved:   String(finalResult.estimatedHoursSavedPerWeek),
      });

      // Sync the LangGraph-extracted job title back to the JD row so the
      // report card always shows the clean, LLM-parsed title.
      const cleanTitle = finalResult.jobTitle?.trim();
      await db.update(jobDescriptions)
        .set({
          status: "complete",
          error:  null,
          ...(cleanTitle && cleanTitle.length > 3 ? { title: cleanTitle } : {}),
        })
        .where(eq(jobDescriptions.id, jobDescriptionId));

      // Increment batch processed counter
      await db.update(batches)
        .set({ processedJds: sql`processed_jds + 1` })
        .where(eq(batches.id, batchId));

      // Generate report token for the company if not yet set
      const [company] = await db.select().from(companies)
        .where(eq(companies.id, jd.companyId));
      if (company && !company.reportToken) {
        const { token, expiresAt } = generateReportToken(jd.companyId);
        await db.update(companies)
          .set({ reportToken: token, tokenExpiresAt: expiresAt })
          .where(eq(companies.id, jd.companyId));
      }

      return { status: "complete" };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await db.update(jobDescriptions)
        .set({ status: "failed", error: msg, retryCount: sql`retry_count + 1` })
        .where(eq(jobDescriptions.id, jobDescriptionId));
      await db.update(batches)
        .set({ failedJds: sql`failed_jds + 1` })
        .where(eq(batches.id, batchId));
      throw err;
    }
  }
);
