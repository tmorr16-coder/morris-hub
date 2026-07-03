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
      <div data-ui="ios" style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="ios-subhead" style={{ color: "var(--ios-label-2)" }}>Loading…</span>
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
    width: "100%", padding: "13px 15px", borderRadius: 10,
    border: "0.5px solid var(--ios-separator)", background: "var(--ios-bg-elevated)",
    color: "var(--ios-label)", fontSize: 17, fontFamily: "inherit",
    outline: "none", boxSizing: "border-box",
  };

  return (
    <div data-ui="ios" className="ios-scroll" style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px var(--ios-gutter)" }}>
      {/* Logo */}
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 32 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--ios-tint)", flexShrink: 0 }} />
        <span className="ios-title-3" style={{ letterSpacing: "-0.01em", color: "var(--ios-label)" }}>
          morrisai<span style={{ color: "var(--ios-tint)" }}>.family</span>
        </span>
      </Link>

      {/* Card */}
      <div style={{ width: "100%", maxWidth: 360, background: "var(--ios-cell)", borderRadius: "var(--ios-radius-tile)", padding: "32px 26px" }}>
        <h1 className="ios-title-2" style={{ textAlign: "center", marginBottom: 4 }}>
          Sign in
        </h1>
        <p className="ios-subhead" style={{ color: "var(--ios-label-2)", textAlign: "center", marginBottom: 26, lineHeight: 1.4 }}>
          Access the Morris family platform
        </p>

        {/* Google OAuth — primary */}
        <button
          onClick={signInWithGoogle}
          className="ios-btn ios-btn--full"
          style={{
            gap: 10, background: "var(--ios-bg-elevated)",
            border: "0.5px solid var(--ios-separator)", color: "var(--ios-label)",
            fontSize: 17, fontWeight: 500,
          }}
        >
          <GoogleIcon />
          Continue with Google
        </button>

        {/* Test auth — only shown when NEXT_PUBLIC_ENABLE_TEST_AUTH=true */}
        {TEST_AUTH_ENABLED && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0 0" }}>
              <div style={{ flex: 1, height: "0.5px", background: "var(--ios-separator)" }} />
              <span className="ios-footnote" style={{ color: "var(--ios-label-3)" }}>or</span>
              <div style={{ flex: 1, height: "0.5px", background: "var(--ios-separator)" }} />
            </div>

            {!showTestForm ? (
              <button
                onClick={() => setShowTestForm(true)}
                className="ios-btn ios-btn--full"
                style={{
                  marginTop: 12, background: "var(--ios-fill)",
                  color: "var(--ios-label-2)", fontSize: 15, fontWeight: 500,
                }}
              >
                🧪 Sign in with test account
              </button>
            ) : (
              <form onSubmit={handleTestLogin} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                <div className="ios-caption" style={{ fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ios-label-3)", textAlign: "center" }}>
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
                  <div className="ios-footnote" style={{ color: "var(--ios-red)", padding: "8px 12px", background: "var(--ios-fill)", borderRadius: 8 }}>
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="ios-btn ios-btn--primary"
                  style={{ cursor: submitting ? "wait" : "pointer", opacity: submitting ? 0.6 : 1 }}
                >
                  {submitting ? "Signing in…" : "Sign in"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowTestForm(false); setError(null); }}
                  className="ios-footnote"
                  style={{ color: "var(--ios-label-3)", padding: 4 }}
                >
                  Cancel
                </button>
              </form>
            )}
          </>
        )}

        <p className="ios-footnote" style={{ color: "var(--ios-label-2)", textAlign: "center", marginTop: 20, lineHeight: 1.4 }}>
          Access is by invitation only.{" "}
          <Link href="/#waitlist" style={{ color: "var(--ios-tint)" }}>Request access →</Link>
        </p>
      </div>
    </div>
  );
}
