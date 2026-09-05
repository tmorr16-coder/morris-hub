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

/**
 * Stamp the appearance choice on <html> before the first paint.
 *
 * This runs synchronously in the document head, ahead of any React render, for
 * two reasons. It removes the flash of the default theme that an effect-based
 * applier always produces; and it puts the decision on one element above every
 * screen, which is what makes it reliable at all.
 *
 * The previous design stamped each `[data-ui="ios"]` scope from an effect keyed
 * on the pathname. Two things went wrong with that. Scopes nest — a module
 * layout opens one and a page opens another inside it — and app/ios.css
 * declares the light palette on the bare `[data-ui="ios"]` selector, so any
 * scope that missed the stamp did not merely fail to go dark, it actively
 * repainted its whole subtree light and reset the brand tint. And a scope that
 * mounted after the effect never got stamped at all: navigating to Today
 * rendered the loading skeleton's scope, stamped that, then swapped in the real
 * page's scope with no pathname change to trigger a re-run. Today came out
 * light while every other screen honoured the setting.
 *
 * Written as a string because it must be inline and parser-blocking. Failures
 * are swallowed: private mode can throw on localStorage, and an unthemed app is
 * a far better outcome than a blank one.
 */
const THEME_BOOT = `(function(){try{
var d=document.documentElement,t=localStorage.getItem("ios-theme"),s=localStorage.getItem("ios-scheme");
if(t==="light"||t==="dark"){d.setAttribute("data-theme",t)}else{d.removeAttribute("data-theme")}
if(s==="famu"||s==="braves"){d.setAttribute("data-scheme",s)}else{d.removeAttribute("data-scheme")}
}catch(e){}})()`;

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
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
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
