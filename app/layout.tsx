import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RSG Predictive Hiring Radar",
  description:
    "Strategic intelligence dashboard surfacing predictive hiring signals from public market data.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-bg-base text-text-primary font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
