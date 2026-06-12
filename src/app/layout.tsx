import type { Metadata, Viewport } from "next";
import "./globals.css";
import PostHogProvider from "@/components/PostHogProvider";
import Script from "next/script";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

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
      <body className="antialiased">
        <PostHogProvider>{children}</PostHogProvider>
        {process.env.NODE_ENV === "production" && (
          <Script
            id="clarity-script"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","wy69st0vxt");`,
            }}
          />
        )}
      </body>
    </html>
  );
}
