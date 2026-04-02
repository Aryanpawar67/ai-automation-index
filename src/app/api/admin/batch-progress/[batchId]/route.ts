import { NextRequest }      from "next/server";
import { db }               from "@/lib/db/client";
import { companies, jobDescriptions, pocs } from "@/lib/db/schema";
import { eq, inArray, sql } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      let active = true;
      const deadline = Date.now() + 30 * 60 * 1000; // 30-minute hard stop
      req.signal.addEventListener("abort", () => { active = false; });

      while (active && Date.now() < deadline) {
        try {
          // Collect company IDs from pocs (new batches) + jobDescriptions (old batches / fallback)
          const [pocRows, jdRows] = await Promise.all([
            db.select({ companyId: pocs.companyId }).from(pocs).where(eq(pocs.batchId, batchId)),
            db.select().from(jobDescriptions).where(eq(jobDescriptions.batchId, batchId)),
          ]);

          const batchCompanyIds = [
            ...new Set([
              ...pocRows.map(p => p.companyId),
              ...jdRows.map(j => j.companyId),
            ]),
          ];

          // Nothing found yet — keep waiting
          if (batchCompanyIds.length === 0) {
            send({ type: "progress", rows: [] });
            await new Promise(r => setTimeout(r, 2500));
            continue;
          }

          // Aggregate JDs per company
          const byCompany: Record<string, {
            total: number; complete: number; failed: number; analyzing: number; invalid: number; scraped: number; cancelled: number;
          }> = {};
          for (const id of batchCompanyIds) {
            byCompany[id] = { total: 0, complete: 0, failed: 0, analyzing: 0, invalid: 0, scraped: 0, cancelled: 0 };
          }
          const jdTitlesByCompany: Record<string, string[]> = {};
          for (const jd of jdRows) {
            byCompany[jd.companyId].total++;
            if (jd.status === "complete")  byCompany[jd.companyId].complete++;
            if (jd.status === "failed")    byCompany[jd.companyId].failed++;
            if (jd.status === "analyzing") byCompany[jd.companyId].analyzing++;
            if (jd.status === "invalid")   byCompany[jd.companyId].invalid++;
            if (jd.status === "scraped")   byCompany[jd.companyId].scraped++;
            if (jd.status === "cancelled") byCompany[jd.companyId].cancelled++;
            if (jd.status === "scraped") {
              if (!jdTitlesByCompany[jd.companyId]) jdTitlesByCompany[jd.companyId] = [];
              if (jdTitlesByCompany[jd.companyId].length < 5) jdTitlesByCompany[jd.companyId].push(jd.title);
            }
          }

          const [companyRows, pocRows2] = await Promise.all([
            db.select({
              id:                  companies.id,
              name:                companies.name,
              scrapeStatus:        companies.scrapeStatus,
              scrapeError:         companies.scrapeError,
              totalJobsAvailable:  companies.totalJobsAvailable,
              careerPageUrl:       companies.careerPageUrl,
              atsType:             companies.atsType,
              slug:                companies.slug,
              reportToken:         companies.reportToken,
            }).from(companies).where(inArray(companies.id, batchCompanyIds)),
            db.select({
              companyId:   pocs.companyId,
              firstName:   sql<string>`MIN(${pocs.firstName})`,
              lastName:    sql<string>`MIN(${pocs.lastName})`,
            }).from(pocs)
              .where(eq(pocs.batchId, batchId))
              .groupBy(pocs.companyId),
          ]);

          const pocMap = new Map(pocRows2.map(p => [p.companyId, p]));

          const payload = companyRows.map(c => {
            const poc = pocMap.get(c.id);
            return {
              companyId:           c.id,
              companyName:         c.name,
              scrapeStatus:        c.scrapeStatus,
              scrapeError:         c.scrapeError,
              totalJobsAvailable:  c.totalJobsAvailable ?? null,
              careerPageUrl:       c.careerPageUrl,
              atsType:             c.atsType ?? null,
              slug:                c.slug ?? null,
              reportToken:         c.reportToken ?? null,
              pocFirstName:        poc?.firstName ?? null,
              pocLastName:         poc?.lastName  ?? null,
              jdTitles:            jdTitlesByCompany[c.id] ?? [],
              jds:                 byCompany[c.id] ?? { total: 0, complete: 0, failed: 0, analyzing: 0, invalid: 0, scraped: 0, cancelled: 0 },
            };
          });

          send({ type: "progress", rows: payload });

          // Only mark complete when we have all companies AND everything is settled
          const allScrapesDone = companyRows.length === batchCompanyIds.length &&
            companyRows.every(c => ["complete", "failed", "blocked"].includes(c.scrapeStatus));
          const allJdsDone = jdRows.length > 0 &&
            jdRows.every(j => ["complete", "failed", "invalid", "scraped", "cancelled"].includes(j.status));
          if (allScrapesDone && (jdRows.length === 0 || allJdsDone)) {
            send({ type: "complete" });
            break;
          }
        } catch (err) {
          console.error("SSE progress error:", err);
        }

        await new Promise(r => setTimeout(r, 2500));
      }

      try { controller.close(); } catch { /* already closed */ }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":      "text/event-stream",
      "Cache-Control":     "no-cache, no-transform",
      "Connection":        "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
