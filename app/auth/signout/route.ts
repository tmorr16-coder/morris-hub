import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Ends the browser's session and clears its cookies, then sends it on.
//
// Exists for the case where the cookies hold a token that still verifies
// locally but that Supabase no longer honours — the session was ended on
// another device, or a refresh-token rotation left this copy behind. Nothing
// server-rendered can clear a cookie, so a page that discovers this state
// sends the browser here. A route handler can.
//
// The redirect target is constrained to a same-site path so this cannot be
// used to bounce someone off-site.

const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const next = searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  const supabase = await createClient();
  try {
    // Local scope: drop this browser's session. The server-side session is
    // usually already gone, which is how we got here; asking Supabase to end
    // it again would just fail.
    await supabase.auth.signOut({ scope: "local" });
  } catch { /* the cookie clearing below is what matters */ }

  const res = NextResponse.redirect(`${origin}${safeNext}`);

  // Belt and braces: expire every auth cookie on the response itself, both
  // with the shared domain the app sets them under and without, so a cookie
  // written under either survives nothing.
  const names = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((c) => c.trim().split("=")[0])
    .filter((n) => n.startsWith("sb-"));
  for (const name of names) {
    res.cookies.set(name, "", { maxAge: 0, path: "/" });
    if (COOKIE_DOMAIN) res.cookies.set(name, "", { maxAge: 0, path: "/", domain: COOKIE_DOMAIN });
  }
  return res;
}
