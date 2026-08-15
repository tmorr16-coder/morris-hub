import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono, Instrument_Serif } from "next/font/google";
import { RateLimitErrorBoundary } from "@/components/RateLimitErrorBoundary";
import ThemeApplier from "@/components/ThemeApplier";
import GlobalBackButton from "@/components/GlobalBackButton";
import { NavModeProvider } from "@/components/NavModeProvider";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isPersonalPersona } from "@/lib/prefs";
import "./globals.css";
import "./ios.css";

/** Whether the signed-in user is a solo (personal) user — drives "Me" vs "Family" nav. */
async function resolvePersonalMode(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = createServiceClient() as any;
    const { data } = await service
      .schema("hub")
      .from("preferences")
      .select("persona")
      .eq("user_id", user.id)
      .maybeSingle();
    return isPersonalPersona(data?.persona);
  } catch {
    return false;
  }
}

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
    statusBarStyle: "black-translucent",
  },
  // Icons come from the file-based app/icon.tsx + app/apple-icon.tsx (the M mark).
};

export const viewport: Viewport = {
  themeColor: "#356FB0",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const personal = await resolvePersonalMode();
  return (
    <html
      lang="en"
      className={`${geist.variable} ${jetBrainsMono.variable} ${instrumentSerif.variable}`}
    >
      <body>
        <ThemeApplier />
        <GlobalBackButton />
        <NavModeProvider personal={personal}>
          <RateLimitErrorBoundary>{children}</RateLimitErrorBoundary>
        </NavModeProvider>
      </body>
    </html>
  );
}
