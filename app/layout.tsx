import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://rsg-radar.vercel.app"),
  title: {
    default: "RSG · Predictive Hiring Radar",
    template: "%s · RSG Hiring Radar",
  },
  description:
    "Predictive Hiring Intelligence für den DACH-Markt — wer stellt jetzt ein, wer als nächstes, wer baut ab. Forward-looking Signale aus öffentlichen Marktdaten.",
  applicationName: "RSG Hiring Radar",
  authors: [{ name: "Recruiting SG" }],
  keywords: [
    "Hiring Intelligence",
    "Predictive Recruiting",
    "DACH",
    "Talent Acquisition",
    "Market Signals",
    "Stellenmarkt",
  ],
  openGraph: {
    type: "website",
    locale: "de_DE",
    title: "RSG · Predictive Hiring Radar",
    description:
      "Dem Markt einen Schritt voraus — predictive Hiring-Signale aus öffentlichen Quellen.",
    siteName: "RSG Hiring Radar",
  },
  twitter: {
    card: "summary_large_image",
    title: "RSG · Predictive Hiring Radar",
    description:
      "Predictive Hiring Intelligence für den DACH-Markt.",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#ECE4D2",
  width: "device-width",
  initialScale: 1,
};

/**
 * Plausible Analytics — DSGVO-konform, cookie-frei, EU-gehostet.
 *
 * Aktivierung via env:
 *   NEXT_PUBLIC_PLAUSIBLE_DOMAIN=rsg-radar.vercel.app
 *   NEXT_PUBLIC_PLAUSIBLE_SCRIPT=https://plausible.io/js/script.js   (optional)
 *
 * Wenn Domain nicht gesetzt → Script wird nicht geladen (kein Tracking).
 * outbound-links + file-downloads + tagged-events plugins aktiv.
 */
const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || "";
const PLAUSIBLE_SCRIPT =
  process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT ||
  "https://plausible.io/js/script.outbound-links.tagged-events.js";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className="light">
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
          crossOrigin=""
        />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        {PLAUSIBLE_DOMAIN ? (
          <>
            <Script
              defer
              data-domain={PLAUSIBLE_DOMAIN}
              src={PLAUSIBLE_SCRIPT}
              strategy="afterInteractive"
            />
            <Script id="plausible-init" strategy="afterInteractive">
              {`window.plausible = window.plausible || function() { (window.plausible.q = window.plausible.q || []).push(arguments) }`}
            </Script>
          </>
        ) : null}
      </head>
      <body className="bg-bg-base text-text-primary font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
