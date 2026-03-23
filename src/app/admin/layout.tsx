import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "#F9F7FB" }}>
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-3.5"
        style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(16px)", borderBottom: "1px solid #EAE4EF" }}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "#FD5A0F" }}>
              <svg width="12" height="12" fill="none" viewBox="0 0 16 16">
                <path d="M8 1a3 3 0 0 1 3 3v1h1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1V4a3 3 0 0 1 3-3zm0 1.5A1.5 1.5 0 0 0 6.5 4v1h3V4A1.5 1.5 0 0 0 8 2.5z" fill="white"/>
              </svg>
            </div>
            <span className="font-bold text-sm" style={{ color: "#220133" }}>iMocha Admin</span>
          </div>
          <span style={{ color: "#D0C8D8" }}>|</span>
          <div className="flex items-center gap-1">
            <Link href="/admin"
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
              style={{ color: "#553366" }}
              onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.background = "#F4EFF6")}
              onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.background = "transparent")}>
              Upload
            </Link>
            <Link href="/admin/batches"
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
              style={{ color: "#553366" }}
              onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.background = "#F4EFF6")}
              onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.background = "transparent")}>
              Batches
            </Link>
          </div>
        </div>
        <span className="text-xs font-mono" style={{ color: "#9988AA" }}>AI Automation Index</span>
      </nav>
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
