"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { withAuthRetrySafe } from "@/lib/supabase/auth-retry";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.259c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71C3.784 10.17 3.682 9.593 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

async function signInWithGoogle() {
  const supabase = createClient();
  await withAuthRetrySafe(async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  });
}

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();

  useEffect(() => {
    if (!loading && user) router.replace("/home");
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 13, color: "var(--color-ink-3)" }}>Loading…</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", background: "var(--color-bg)" }}>
      {/* Logo */}
      <Link href="/" style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 40, textDecoration: "none" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--color-accent)", alignSelf: "center", flexShrink: 0 }} />
        <span className="serif" style={{ fontSize: 22, color: "var(--color-ink)" }}>morrisai</span>
        <span className="serif" style={{ color: "var(--color-accent-dark)", fontStyle: "italic", fontSize: 20 }}>.family</span>
      </Link>

      {/* Card */}
      <div style={{ width: "100%", maxWidth: 360, background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 16, padding: "36px 32px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-ink)", marginBottom: 6, textAlign: "center" }}>
          Sign in
        </h1>
        <p style={{ fontSize: 13, color: "var(--color-ink-3)", textAlign: "center", marginBottom: 28, lineHeight: 1.5 }}>
          Access the Morris family platform
        </p>

        <button
          onClick={signInWithGoogle}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
            gap: 10, padding: "13px 20px", borderRadius: 10,
            border: "1px solid var(--color-rule)", background: "var(--color-bg)",
            color: "var(--color-ink)", fontSize: 14, fontWeight: 500,
            cursor: "pointer", fontFamily: "inherit", boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            transition: "box-shadow 0.15s",
          }}
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <p style={{ fontSize: 11, color: "var(--color-ink-4)", textAlign: "center", marginTop: 20, lineHeight: 1.5 }}>
          Access is by invitation only.{" "}
          <Link href="/#waitlist" style={{ color: "var(--color-accent)" }}>Request access →</Link>
        </p>
      </div>
    </div>
  );
}
