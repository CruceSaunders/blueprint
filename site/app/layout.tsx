import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SITE, SHOTS } from "@/site.config";

const sans = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-schibsted", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: SITE.title,
  description: SITE.description,
  alternates: { canonical: "/" },
  openGraph: {
    title: SITE.title,
    description: SITE.description,
    url: SITE.url,
    siteName: SITE.name,
    type: "website",
    images: [{ url: SHOTS.og.src, width: SHOTS.og.width, height: SHOTS.og.height, alt: SHOTS.og.alt }],
  },
  twitter: { card: "summary_large_image", title: SITE.title, description: SITE.description, images: [{ url: SHOTS.og.src, alt: SHOTS.og.alt }] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0f" },
  ],
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE.name,
  description: SITE.description,
  applicationCategory: "DesignApplication",
  operatingSystem: "macOS (Apple silicon)",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  url: SITE.url,
  image: new URL(SHOTS.og.src, SITE.url).toString(),
  downloadUrl: SITE.downloadUrl,
  codeRepository: SITE.githubUrl,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <head>
        {/* Marks the page as scripted so scroll reveals may start hidden; without JS everything is visible. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
