import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { withAuthRetry } from "@/lib/supabase/auth-retry";

const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  // Fetch user with retry logic for rate limit resilience
  const user = await withAuthRetry(
    async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
    { maxAttempts: 3, initialDelayMs: 100 }
  ).catch(() => null);

  // Cache user info in response headers for downstream handlers
  // This avoids redundant getUser() calls in protected routes
  if (user) {
    response.headers.set("x-user-id", user.id);
    if (user.email) {
      response.headers.set("x-user-email", user.email);
    }
  }

  const { pathname } = request.nextUrl;
  const isProtected =
    pathname.startsWith("/home") ||
    pathname.startsWith("/health") ||
    pathname.startsWith("/finance") ||
    pathname.startsWith("/investments") ||
    pathname.startsWith("/student-success");

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
  ],
};
