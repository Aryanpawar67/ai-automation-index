import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Automation Index – Discover AI Opportunities in Any Role",
  description: "Paste any job description to instantly uncover AI automation potential, task-level opportunities, and implementation roadmaps.",
  openGraph: {
    title: "AI Automation Index",
    description: "Discover AI implementation opportunities in any role.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
