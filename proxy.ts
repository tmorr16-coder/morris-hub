import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { withAuthRetry } from "@/lib/supabase/auth-retry";

const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key"),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, {
              ...options,
              ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
            })
          );
        },
      },
    }
  );

  if (process.env.NEXT_PUBLIC_AUTH_BYPASS === "true") return response;

  // Verify the session locally rather than asking Supabase to do it.
  //
  // This used to call supabase.auth.getUser(), which is a network round trip to
  // /auth/v1/user — paid before *every* navigation into a protected section,
  // and then paid again by the layout rendering that same request. Two serial
  // trips to answer one question, in front of the first byte of HTML.
  //
  // The project signs tokens with an asymmetric key, so getClaims() checks the
  // signature with WebCrypto here at the edge. auth-js keeps the public key in
  // a process-wide cache for 10 minutes, so this costs one fetch per container
  // and nothing thereafter. See getCurrentClaims() in lib/supabase/server.ts
  // for the revocation trade-off; RLS still guards every query.
  //
  // The retry wrapper stays for the cold-start fetch of the signing key, which
  // is the only part that can still be rate limited.
  const claims = await withAuthRetry(
    async () => {
      const { data } = await supabase.auth.getClaims();
      return data?.claims ?? null;
    },
    { maxAttempts: 3, initialDelayMs: 100 }
  ).catch(() => null);
  const user = claims?.sub ? claims : null;

  // This used to set x-user-id / x-user-email on the response, described as a
  // way to avoid redundant getUser() calls downstream. It never could: response
  // headers travel to the browser, not to the server components rendering this
  // request, and nothing ever read them. Server components dedupe their own
  // getUser() via getCurrentUser() in lib/supabase/server.ts instead.
  //
  // To also collapse THIS call into that one, forward the verified id on the
  // *request* headers — delete any client-supplied x-user-id first, then set it
  // and pass `NextResponse.next({ request: { headers } })` — and have
  // getCurrentUser() prefer it. Left undone deliberately: it makes a spoofable
  // header load-bearing for auth, which wants its own review.

  const { pathname } = request.nextUrl;
  const isProtected =
    pathname.startsWith("/home") ||
    pathname.startsWith("/health") ||
    pathname.startsWith("/finance") ||
    pathname.startsWith("/investments") ||
    pathname.startsWith("/student-success") ||
    pathname.startsWith("/children");

  if (!user && isProtected) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return response;
}

export const config = {
  matcher: [
    "/home/:path*",
    "/health/:path*",
    "/finance/:path*",
    "/investments/:path*",
    "/student-success/:path*",
    "/children/:path*",
  ],
};
