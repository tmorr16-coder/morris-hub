import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono, Instrument_Serif } from "next/font/google";
import { RateLimitErrorBoundary } from "@/components/RateLimitErrorBoundary";
import ThemeApplier from "@/components/ThemeApplier";
import "./globals.css";
import "./ios.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "morrisai.family",
  description: "Personal & family productivity platform",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Morris AI",
    statusBarStyle: "default",
  },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#3B5C7F",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${jetBrainsMono.variable} ${instrumentSerif.variable}`}
    >
      <body>
        <ThemeApplier />
        <RateLimitErrorBoundary>{children}</RateLimitErrorBoundary>
      </body>
    </html>
  );
}
