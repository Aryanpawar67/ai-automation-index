import { NextRequest }      from "next/server";
import { db }               from "@/lib/db/client";
import { companies, jobDescriptions } from "@/lib/db/schema";
import { eq }               from "drizzle-orm";

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
      req.signal.addEventListener("abort", () => { active = false; });

      while (active) {
        try {
          // Get all companies that have JDs in this batch
          const jdRows = await db.select().from(jobDescriptions)
            .where(eq(jobDescriptions.batchId, batchId));

          // Aggregate per company
          const byCompany: Record<string, {
            total: number; complete: number; failed: number; analyzing: number;
          }> = {};
          for (const jd of jdRows) {
            if (!byCompany[jd.companyId])
              byCompany[jd.companyId] = { total: 0, complete: 0, failed: 0, analyzing: 0 };
            byCompany[jd.companyId].total++;
            if (jd.status === "complete")  byCompany[jd.companyId].complete++;
            if (jd.status === "failed")    byCompany[jd.companyId].failed++;
            if (jd.status === "analyzing") byCompany[jd.companyId].analyzing++;
          }

          const companyIds = Object.keys(byCompany);
          const companyRows = companyIds.length > 0
            ? await db.select({
                id:           companies.id,
                name:         companies.name,
                scrapeStatus: companies.scrapeStatus,
                scrapeError:  companies.scrapeError,
                reportToken:  companies.reportToken,
              }).from(companies)
            : [];

          const payload = companyRows
            .filter(c => byCompany[c.id])
            .map(c => ({
              companyId:    c.id,
              companyName:  c.name,
              scrapeStatus: c.scrapeStatus,
              scrapeError:  c.scrapeError,
              reportToken:  c.reportToken,
              jds:          byCompany[c.id],
            }));

          send({ type: "progress", rows: payload });

          const allSettled = jdRows.length > 0 &&
            jdRows.every(j => j.status === "complete" || j.status === "failed");
          if (allSettled) {
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
