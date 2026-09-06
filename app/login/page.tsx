"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { withAuthRetrySafe } from "@/lib/supabase/auth-retry";
import "../front-door.css";

/**
 * Sign in — the second half of the front door.
 *
 * Shares app/front-door.css with the landing page rather than the iOS system
 * behind the login, because a visitor who crosses from one look to the other
 * while deciding whether to hand over an account notices, and it reads as two
 * different products.
 */

const TEST_AUTH_ENABLED = process.env.NEXT_PUBLIC_ENABLE_TEST_AUTH === "true";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
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

  // An already-signed-in visitor is sent straight to Today. This deliberately
  // does not gate the render: the card used to be replaced by a "Loading…" line
  // until an auth round trip came back, so on a phone the first thing you saw
  // after tapping "Sign in" was a spinner. The check is local and resolves in a
  // frame or two, so the card is drawn immediately.
  useEffect(() => {
    if (!loading && user) router.replace("/home");
  }, [user, loading, router]);

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
      // Session cookie is set by the server route — reload to pick it up.
      window.location.href = "/home";
    } catch {
      setError("Network error — try again");
      setSubmitting(false);
    }
  }

  return (
    <div className="lp">
      <div className="lp-auth">
        <Link href="/" className="lp-mark">
          <span className="lp-mark-dot" aria-hidden />
          <span className="lp-mark-text">
            morrisai<i>.family</i>
          </span>
        </Link>

        <div className="lp-auth-card">
          <h1 className="lp-auth-title">Welcome back</h1>
          <p className="lp-auth-sub">Sign in to the Morris family platform.</p>

          <button onClick={signInWithGoogle} className="lp-oauth">
            <GoogleIcon />
            Continue with Google
          </button>

          {/* Only when NEXT_PUBLIC_ENABLE_TEST_AUTH is on. */}
          {TEST_AUTH_ENABLED && (
            <>
              <div className="lp-or">or</div>

              {!showTestForm ? (
                <button onClick={() => setShowTestForm(true)} className="lp-auth-alt">
                  Use the walkthrough account
                </button>
              ) : (
                <form onSubmit={handleTestLogin} className="lp-auth-form">
                  <div className="lp-auth-formlabel">Walkthrough account</div>
                  <input
                    autoFocus
                    type="email"
                    className="lp-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="test@morrisai.family"
                    autoComplete="username"
                    required
                  />
                  <input
                    type="password"
                    className="lp-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    autoComplete="current-password"
                    required
                  />
                  {error && <div className="lp-err">{error}</div>}
                  <button type="submit" disabled={submitting} className="lp-oauth">
                    {submitting ? "Signing in…" : "Sign in"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowTestForm(false); setError(null); }}
                    className="lp-auth-alt"
                    style={{ border: "none" }}
                  >
                    Cancel
                  </button>
                </form>
              )}
            </>
          )}

          <p className="lp-auth-foot">
            Access is by invitation.{" "}
            <Link href="/#waitlist">Request it →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
