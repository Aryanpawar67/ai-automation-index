export const dynamic = "force-dynamic";

import CompanyReportList from "@/components/report/CompanyReportList";

function ExpiredScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "linear-gradient(160deg, #FFF8F5 0%, #FFFFFF 50%, #F9F7FB 100%)" }}>
      <div className="card p-10 max-w-sm w-full text-center">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: "#fef2f2" }}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="text-lg font-bold mb-2" style={{ color: "#220133" }}>Link expired or invalid</h1>
        <p className="text-sm leading-relaxed" style={{ color: "#9988AA" }}>
          Report links are valid for 7 days. Please contact your iMocha representative for a fresh link.
        </p>
      </div>
    </div>
  );
}

export default async function CompanyReportHub({
  params,
  searchParams,
}: {
  params:       Promise<{ companyId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { companyId }  = await params;
  const { token = "" } = await searchParams;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res    = await fetch(
    `${appUrl}/api/report/${companyId}?token=${encodeURIComponent(token)}`,
    { cache: "no-store" }
  );

  if (!res.ok) return <ExpiredScreen />;

  const data = await res.json() as {
    company:  string;
    analyses: Array<{
      analysisId:   string;
      jdTitle:      string;
      jdDepartment: string | null;
      overallScore: number | null;
      hoursSaved:   string | null;
      createdAt:    string;
    }>;
    token: string;
  };

  return (
    <div className="min-h-screen" style={{ background: "#F9F7FB" }}>
      <nav className="px-6 py-4 flex items-center justify-between"
        style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid #EAE4EF" }}>
        <div className="flex items-center gap-2">
          <svg width="22" height="22" viewBox="0 0 51 51" fill="none">
            <path d="M50.085 20.368C49.736 18.111 48.861 15.855 47.812 13.772C46.762 14.466 45.538 14.813 44.139 14.813C40.29 14.813 37.142 11.689 37.142 7.871C37.142 6.308 37.667 4.92 38.541 3.705C35.743 1.969 32.769 0.754 29.446 0.06C28.046 -0.287 26.822 0.928 26.822 2.316V8.218C26.822 9.259 27.522 10.3 28.571 10.474C33.819 11.863 38.017 15.855 39.416 21.062C39.766 22.103 40.64 22.798 41.69 22.798H47.637C49.211 23.145 50.435 21.756 50.085 20.368Z" fill="#FD5A0F"/>
            <path d="M10.73 21.409C12.129 16.202 16.327 12.036 21.575 10.821C22.624 10.474 23.324 9.606 23.324 8.565V2.49C23.324 1.101 21.925 -0.114 20.7 0.234C10.205 2.143 1.984 10.127 0.06 20.368C-0.289 21.756 0.935 23.145 2.334 23.145H8.456C9.506 23.145 10.555 22.277 10.73 21.409Z" fill="#FD5A0F"/>
            <path d="M21.575 39.46C16.327 38.072 12.129 34.08 10.73 28.873C10.38 27.831 9.506 27.137 8.456 27.137H2.334C0.935 27.137 -0.289 28.525 0.06 29.914C1.984 40.154 10.205 48.139 20.525 50.048C21.925 50.395 23.149 49.18 23.149 47.792V41.89C23.324 40.502 22.624 39.634 21.575 39.46Z" fill="#FD5A0F"/>
            <path d="M39.591 28.699C38.192 33.906 33.994 37.898 28.746 39.287C27.697 39.634 26.997 40.502 26.997 41.543V47.444C26.997 48.833 28.396 50.048 29.621 49.701C39.941 47.792 48.162 39.807 50.086 29.567C50.436 28.178 49.211 26.79 47.812 26.79H41.69C40.64 26.963 39.766 27.658 39.591 28.699Z" fill="#FD5A0F"/>
          </svg>
          <span className="font-bold text-sm" style={{ color: "#220133" }}>iMocha</span>
          <span style={{ color: "#D0C8D8" }}>|</span>
          <span className="text-sm font-medium" style={{ color: "#553366" }}>AI Automation Index</span>
        </div>
        <span className="text-xs font-mono flex items-center gap-1.5" style={{ color: "#9988AA" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
          Powered by Claude
        </span>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <CompanyReportList
          company={data.company}
          analyses={data.analyses}
          companyId={companyId}
          token={token}
        />
      </main>

      <footer className="text-center py-8 text-xs" style={{ color: "#D0C8D8" }}>
        iMocha AI Automation Index &nbsp;·&nbsp; Analysis by Claude &nbsp;·&nbsp; Results are indicative
      </footer>
    </div>
  );
}
