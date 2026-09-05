import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono, Instrument_Serif } from "next/font/google";
import { RateLimitErrorBoundary } from "@/components/RateLimitErrorBoundary";
import ThemeApplier from "@/components/ThemeApplier";
import GlobalBackButton from "@/components/GlobalBackButton";
import PullToRefresh from "@/components/PullToRefresh";
import { NavModeProvider } from "@/components/NavModeProvider";
import { createServiceClient, getCurrentClaims } from "@/lib/supabase/server";
import { unstable_cache } from "next/cache";
import { isPersonalPersona } from "@/lib/prefs";
import "./globals.css";
import "./ios.css";

/**
 * One user's persona, cached across requests for five minutes.
 *
 * A persona changes when someone switches between a solo and a family account,
 * which is to say almost never — but this was read from the database on every
 * render of every route, because the root layout needs it.
 */
const cachedPersona = unstable_cache(
  async (userId: string): Promise<string | null> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = createServiceClient() as any;
    const { data } = await service
      .schema("hub")
      .from("preferences")
      .select("persona")
      .eq("user_id", userId)
      .maybeSingle();
    return (data?.persona as string | null) ?? null;
  },
  ["layout-persona"],
  { revalidate: 300 },
);

/**
 * Whether the signed-in user is a solo (personal) user — drives "Me" vs "Family" nav.
 *
 * Every route in the app waits on this before a single byte of HTML is sent,
 * because it is awaited in the root layout. That put it in front of even the
 * route-level loading skeletons: `app/home/loading.tsx` cannot paint until the
 * shell it lives inside has rendered, so after signing in the user watched a
 * blank page for the length of these calls rather than a skeleton.
 *
 * It used to be two network round trips — getUser() to verify the JWT, then a
 * preferences read — on every navigation. Now the identity is verified locally
 * and the preference is served from the data cache, so the common path is no
 * round trips at all. A logged-out visitor (the landing and sign-in pages) does
 * no work here whatsoever.
 */
async function resolvePersonalMode(): Promise<boolean> {
  try {
    const claims = await getCurrentClaims();
    if (!claims) return false;
    return isPersonalPersona(await cachedPersona(claims.id));
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
        <PullToRefresh />
        <NavModeProvider personal={personal}>
          <RateLimitErrorBoundary>{children}</RateLimitErrorBoundary>
        </NavModeProvider>
      </body>
    </html>
  );
}
