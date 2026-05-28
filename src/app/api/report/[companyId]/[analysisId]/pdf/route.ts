import { NextRequest, NextResponse }  from "next/server";
import { db }                         from "@/lib/db/client";
import { companies }                  from "@/lib/db/schema";
import { eq }                         from "drizzle-orm";
import { chromium as playwrightChrome } from "playwright-core";

export const maxDuration = 60;

function getBaseUrl(req: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL)  return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host  = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

const DEV_CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
];

async function getLaunchOptions() {
  if (process.env.NODE_ENV === "production") {
    const chromium = (await import("@sparticuz/chromium")).default;
    return {
      executablePath: await chromium.executablePath(),
      args:           chromium.args,
      headless:       true as const,
    };
  }
  // Dev: find a local Chrome/Chromium install
  const fs = await import("fs");
  const executablePath = DEV_CHROME_PATHS.find(p => fs.existsSync(p));
  if (!executablePath) throw new Error("No local Chrome found for PDF generation in dev");
  return {
    executablePath,
    args:    [] as string[],
    headless: true as const,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string; analysisId: string }> }
) {
  const { companyId, analysisId } = await params;
  const token = req.nextUrl.searchParams.get("token") ?? "";

  const [company] = await db
    .select({ name: companies.name, reportToken: companies.reportToken })
    .from(companies)
    .where(eq(companies.id, companyId));

  if (!company || !company.reportToken || token !== company.reportToken)
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const reportUrl = `${getBaseUrl(req)}/report/${companyId}/${analysisId}?token=${encodeURIComponent(token)}`;

  let browser;
  try {
    const launchOpts = await getLaunchOptions();
    browser = await playwrightChrome.launch(launchOpts);

    const page = await browser.newPage();
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.goto(reportUrl, { waitUntil: "networkidle", timeout: 30_000 });

    // Wait for initial render
    await page.waitForSelector("[data-ph-section]", { timeout: 15_000 }).catch(() => {});

    // Mirror the internal download: fire beforeprint so DashboardView sets printMode=true,
    // making all hidden tab panels (tasks, opportunities) visible. Then wait 800ms for
    // Recharts ResponsiveContainer to re-measure and repaint — same timing as triggerDownload().
    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    await page.waitForTimeout(800);

    const pdfBuffer = await page.pdf({
      format:          "A4",
      printBackground: true,
      margin:          { top: "0", right: "0", bottom: "0", left: "0" },
    });

    const filename = `${company.name.replace(/[^a-zA-Z0-9]/g, "_")}_AI_Report.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control":       "no-store",
      },
    });
  } catch (err) {
    console.error("[pdf-route] error:", err);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  } finally {
    await browser?.close();
  }
}
