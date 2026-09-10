import type { NextConfig } from "next";

// ── Subdomain routing ─────────────────────────────────────────────────────────
// index.imocha.io points to THIS app via Cloudflare (one-time, already set).
// To add a new tool at index.imocha.io/<slug>, add an entry below and redeploy.
// No Cloudflare changes needed.
// ─────────────────────────────────────────────────────────────────────────────

const TOOL_ROUTES: { source: string; destination: string }[] = [
  // SkillLens — Competency-to-skill mapping tool
  // Live at: index.imocha.io/skill-lens
  {
    source: "/skill-lens/:path*",
    destination: "https://skill-blueprint-api-production.up.railway.app/:path*",
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["xlsx"],
  async rewrites() {
    return {
      // beforeFiles runs BEFORE Next.js checks its own filesystem routes.
      // This is required for any proxied path that contains /api/ — otherwise
      // Next.js intercepts the request internally and returns 404/405 before
      // ever forwarding to the upstream service.
      beforeFiles: TOOL_ROUTES,
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
