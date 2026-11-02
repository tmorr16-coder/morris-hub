import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordFailure } from "@/lib/system-events";

// Finishes a Google sign-in: trades the one-time code for a session.
//
// A failure here used to bounce to the front page with `?error=auth_failed`,
// which nothing read. The person clicked "Continue with Google", came back to
// the page they started on, and had no idea anything had happened. Now the
// reason reaches the sign-in page and the platform status log.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/home";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/home";

  let reason: string;
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
    reason = error.message;
  } else {
    // Supabase reports provider-side failures (a redirect URL it does not
    // allow, a cancelled consent screen) as query parameters, with no code.
    reason = searchParams.get("error_description") ?? searchParams.get("error") ?? "No sign-in code was returned";
  }

  await recordFailure({
    source: "auth",
    subject: "google-sign-in",
    severity: "warning",
    message: `Google sign-in failed: ${reason}`,
    detail: { host: new URL(request.url).host, hadCode: !!code, userAgent: request.headers.get("user-agent") ?? "" },
  });

  const res = NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(reason)}`);
  // Whatever session cookies the browser brought along did not get it in, and
  // a dead refresh token left in place would fail the next attempt the same way.
  for (const name of (request.headers.get("cookie") ?? "").split(";").map((c) => c.trim().split("=")[0]).filter((n) => n.startsWith("sb-") && !n.includes("code-verifier"))) {
    res.cookies.set(name, "", { maxAge: 0, path: "/" });
    if (process.env.NEXT_PUBLIC_COOKIE_DOMAIN) res.cookies.set(name, "", { maxAge: 0, path: "/", domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN });
  }
  return res;
}
