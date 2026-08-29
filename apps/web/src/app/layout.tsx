import type { Metadata, Viewport } from "next";
import { barlow, oswald } from "@/lib/fonts";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Short Fuse — Official Merchandise",
    template: "%s | Short Fuse",
  },
  description:
    "Official Short Fuse merchandise. Shirts, CDs, hats, flags and more, straight from the band.",
  openGraph: {
    type: "website",
    siteName: "Short Fuse",
    title: "Short Fuse — Official Merchandise",
    description:
      "Official Short Fuse merchandise. Shirts, CDs, hats, flags and more, straight from the band.",
    images: [{ url: "/brand/hero.jpg", width: 1200, height: 630, alt: "Short Fuse" }],
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0a0908",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${oswald.variable} ${barlow.variable}`}>
      <body className="flex min-h-screen flex-col antialiased">
        <a
          href="#main"
          className="stamp sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-blood focus:px-4 focus:py-2 focus:text-bone"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
