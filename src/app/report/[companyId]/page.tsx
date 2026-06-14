export const dynamic = "force-dynamic";

import ReportTelemetry from "@/components/report/ReportTelemetry";
import ReportWizard    from "@/components/report/wizard/ReportWizard";
import Script          from "next/script";
import { db }          from "@/lib/db/client";
import { companies }   from "@/lib/db/schema";
import { eq }          from "drizzle-orm";
import { notFound }    from "next/navigation";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CompanyReportHub({
  params,
  searchParams,
}: {
  params:       Promise<{ companyId: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { companyId: identifier } = await params;
  const { token }                 = await searchParams;

  const [company] = await db
    .select({
      id:          companies.id,
      name:        companies.name,
      slug:        companies.slug,
      reportToken: companies.reportToken,
      wizardData:  companies.wizardData,
    })
    .from(companies)
    .where(UUID_RE.test(identifier) ? eq(companies.id, identifier) : eq(companies.slug, identifier));

  if (!company) return notFound();
  if (!token || !company.reportToken || token !== company.reportToken) return notFound();

  const publicIdentifier = company.slug ?? company.id;

  // If wizard data isn't computed yet, show a placeholder rather than crashing
  if (!company.wizardData) {
    return (
      <div style={{ minHeight: "100vh", background: "#0e0e10", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.5)", fontFamily: "sans-serif", fontSize: 14 }}>
        Report is being prepared — check back in a moment.
      </div>
    );
  }

  return (
    <>
      <Script src="https://js.hsforms.net/forms/embed/v2.js" strategy="lazyOnload" />
      <ReportTelemetry
        token={token}
        companySlug={publicIdentifier}
        companyName={company.name}
        reportType="hub"
      />
      <ReportWizard
        company={company.name}
        companyId={company.id}
        wizardData={company.wizardData}
        token={token}
      />
    </>
  );
}
