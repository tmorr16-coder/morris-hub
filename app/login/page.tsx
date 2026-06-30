"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { withAuthRetrySafe } from "@/lib/supabase/auth-retry";

const TEST_AUTH_ENABLED = process.env.NEXT_PUBLIC_ENABLE_TEST_AUTH === "true";

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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTestForm, setShowTestForm] = useState(false);

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

  async function handleTestLogin(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/test-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Sign-in failed");
        setSubmitting(false);
        return;
      }
      // Session cookie is set by the server route — reload to pick it up
      window.location.href = "/home";
    } catch {
      setError("Network error — try again");
      setSubmitting(false);
    }
  }

  const input: React.CSSProperties = {
    width: "100%", padding: "11px 14px", borderRadius: 10,
    border: "1px solid var(--color-rule)", background: "var(--color-bg)",
    color: "var(--color-ink)", fontSize: 14, fontFamily: "inherit",
    outline: "none", boxSizing: "border-box",
  };

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

        {/* Google OAuth — primary */}
        <button
          onClick={signInWithGoogle}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
            gap: 10, padding: "13px 20px", borderRadius: 10,
            border: "1px solid var(--color-rule)", background: "var(--color-bg)",
            color: "var(--color-ink)", fontSize: 14, fontWeight: 500,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <GoogleIcon />
          Continue with Google
        </button>

        {/* Test auth — only shown when NEXT_PUBLIC_ENABLE_TEST_AUTH=true */}
        {TEST_AUTH_ENABLED && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0 0" }}>
              <div style={{ flex: 1, height: 1, background: "var(--color-rule)" }} />
              <span style={{ fontSize: 11, color: "var(--color-ink-4)" }}>or</span>
              <div style={{ flex: 1, height: 1, background: "var(--color-rule)" }} />
            </div>

            {!showTestForm ? (
              <button
                onClick={() => setShowTestForm(true)}
                style={{
                  width: "100%", marginTop: 12, padding: "11px 20px", borderRadius: 10,
                  border: "1px dashed var(--color-rule)", background: "transparent",
                  color: "var(--color-ink-3)", fontSize: 13, fontWeight: 500,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                🧪 Sign in with test account
              </button>
            ) : (
              <form onSubmit={handleTestLogin} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-4)", textAlign: "center" }}>
                  Test account login
                </div>
                <input
                  autoFocus
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="test@morrisai.family"
                  required
                  style={input}
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  style={input}
                />
                {error && (
                  <div style={{ fontSize: 12, color: "var(--color-red)", padding: "8px 12px", background: "rgba(154,59,42,0.06)", borderRadius: 8 }}>
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: "12px", borderRadius: 10, border: "none",
                    background: "var(--color-accent)", color: "#FFFDF8",
                    fontSize: 14, fontWeight: 600, fontFamily: "inherit",
                    cursor: submitting ? "wait" : "pointer", opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting ? "Signing in…" : "Sign in"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowTestForm(false); setError(null); }}
                  style={{ background: "none", border: "none", fontSize: 12, color: "var(--color-ink-4)", cursor: "pointer", fontFamily: "inherit" }}
                >
                  Cancel
                </button>
              </form>
            )}
          </>
        )}

        <p style={{ fontSize: 11, color: "var(--color-ink-4)", textAlign: "center", marginTop: 20, lineHeight: 1.5 }}>
          Access is by invitation only.{" "}
          <Link href="/#waitlist" style={{ color: "var(--color-accent)" }}>Request access →</Link>
        </p>
      </div>
    </div>
  );
}
