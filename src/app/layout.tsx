import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { SkipLink } from "@/components/common/skip-link";
import { brandColors } from "@/config/brand";
import { robotsMetadata } from "@/config/indexing";
import { publicEnv } from "@/lib/env/public";
import "./globals.css";

/** Explicit viewport: device width, 1x scale; pinch-zoom is NOT disabled (accessibility / 200% zoom). */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: brandColors.primary,
};

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  // Resolves relative canonical / Open Graph URLs against the configured site URL.
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
  // noindex until SITE_INDEXING=enabled (see src/config/indexing.ts). Admin and /dev routes always set their own noindex.
  robots: robotsMetadata(),
  title: { default: "Sagar Traders", template: "%s | Sagar Traders" },
  description:
    "Quality building materials and construction supplies. Browse indicative rates and request quotations online.",
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png" }],
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "/",
    siteName: "Sagar Traders",
    title: "Sagar Traders",
    description:
      "Quality building materials and construction supplies. Browse indicative rates and request quotations online.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sagar Traders",
    description:
      "Quality building materials and construction supplies. Browse indicative rates and request quotations online.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SkipLink />
        {children}
      </body>
    </html>
  );
}
