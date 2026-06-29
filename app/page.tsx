"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useRouter } from "next/navigation";

// ── Module definitions ──────────────────────────────────────────────────────

const MODULES = [
  {
    key: "hub",
    label: "Hub",
    dot: "#3B5C7F",
    icon: "⌂",
    headline: "Your daily command center",
    description: "Reminders, weather, news, sports, and a full-family overview — all on one personalized home screen.",
    tags: ["Reminders", "News", "Weather", "Sports"],
  },
  {
    key: "health",
    label: "Health",
    dot: "#4D6B3A",
    icon: "♡",
    headline: "Track what matters to your body",
    description: "Body composition trends, workout logging, GLP-1 dose tracking, and real-time sync with Oura and Withings.",
    tags: ["Workouts", "Body comp", "Oura sync", "Zepbound"],
  },
  {
    key: "finance",
    label: "Finance",
    dot: "#8B6A47",
    icon: "$",
    headline: "Family finances, unified",
    description: "Connected accounts, net worth over time, shared visibility between family members, and AI spending insights.",
    tags: ["Net worth", "Plaid sync", "Family sharing"],
  },
  {
    key: "investments",
    label: "Investments",
    dot: "#C97A3A",
    icon: "↗",
    headline: "Research-grade stock analysis",
    description: "Deep research with real-time web search, live charts, watchlist, and paper trading via Alpaca — all in one dashboard.",
    tags: ["Deep research", "Live charts", "Paper trading"],
  },
  {
    key: "career",
    label: "Career",
    dot: "#2A6049",
    icon: "◈",
    headline: "Your personal career advisor",
    description: "AI coaching grounded in your resume and goals. Track milestones, learning paths, and key relationships.",
    tags: ["AI advisor", "Goal tracking", "Learning log"],
  },
  {
    key: "student",
    label: "Student Success",
    dot: "#6B5B95",
    icon: "✦",
    headline: "Academic progress, tracked",
    description: "LSAT prep with AI scoring, certification paths, course tracking, and performance analytics.",
    tags: ["LSAT prep", "Certifications", "Course log"],
  },
];

// ── Waitlist form ───────────────────────────────────────────────────────────

function WaitlistForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();
      if (!res.ok) { setErrorMsg(data.error ?? "Something went wrong."); setStatus("error"); return; }
      setStatus("done");
    } catch {
      setErrorMsg("Could not submit. Check your connection.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div style={{ textAlign: "center", padding: "28px 20px" }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>✓</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-ink)", marginBottom: 6 }}>You&rsquo;re on the list</div>
        <div style={{ fontSize: 13, color: "var(--color-ink-3)", lineHeight: 1.6 }}>We&rsquo;ll be in touch when access opens up for new members.</div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
        style={{ padding: "11px 14px", borderRadius: 8, border: "1px solid var(--color-rule)", background: "var(--color-bg)", color: "var(--color-ink)", fontSize: 14, fontFamily: "inherit", outline: "none" }} />
      <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address"
        style={{ padding: "11px 14px", borderRadius: 8, border: "1px solid var(--color-rule)", background: "var(--color-bg)", color: "var(--color-ink)", fontSize: 14, fontFamily: "inherit", outline: "none" }} />
      {errorMsg && <div style={{ fontSize: 12, color: "var(--color-red)" }}>{errorMsg}</div>}
      <button type="submit" disabled={status === "loading"}
        style={{ padding: "12px", borderRadius: 10, border: "none", background: "var(--color-accent)", color: "#FFFDF8", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: status === "loading" ? "wait" : "pointer", opacity: status === "loading" ? 0.7 : 1 }}>
        {status === "loading" ? "Requesting…" : "Request Access"}
      </button>
    </form>
  );
}

// ── Landing page ────────────────────────────────────────────────────────────

export default function LandingPage() {
  const { user, loading } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/home");
  }, [user, loading, router]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>

      {/* Nav */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--color-bg)", borderBottom: "1px solid var(--color-rule)", padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--color-accent)", alignSelf: "center", flexShrink: 0 }} />
          <span className="serif" style={{ fontSize: 20, color: "var(--color-ink)" }}>morrisai</span>
          <span className="serif" style={{ color: "var(--color-accent-dark)", fontStyle: "italic", fontSize: 18 }}>.family</span>
        </div>
        <Link href="/login" style={{ fontSize: 13, fontWeight: 500, color: "var(--color-ink-2)", textDecoration: "none", padding: "7px 16px", borderRadius: 8, border: "1px solid var(--color-rule)", background: "var(--color-bg-card)" }}>
          Sign in
        </Link>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: 760, margin: "0 auto", padding: "80px 28px 64px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 14px", borderRadius: 20, background: "var(--color-accent-soft)", marginBottom: 24 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-accent)", flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-accent)" }}>Private · Family · AI-powered</span>
        </div>
        <h1 className="serif" style={{ fontSize: 56, lineHeight: 1.05, marginBottom: 18, color: "var(--color-ink)" }}>
          Your family&rsquo;s<br />
          <span style={{ fontStyle: "italic", color: "var(--color-accent-dark)" }}>intelligent platform.</span>
        </h1>
        <p style={{ fontSize: 18, color: "var(--color-ink-3)", lineHeight: 1.65, maxWidth: 520, margin: "0 auto 36px" }}>
          Six integrated apps — health, finance, investments, career, academics, and a shared family hub — powered by AI and built for one family.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="#waitlist" style={{ padding: "13px 28px", borderRadius: 10, background: "var(--color-accent)", color: "#FFFDF8", fontSize: 15, fontWeight: 700, textDecoration: "none" }}>
            Request Access
          </a>
          <Link href="/login" style={{ padding: "13px 28px", borderRadius: 10, border: "1px solid var(--color-rule)", background: "var(--color-bg-card)", color: "var(--color-ink)", fontSize: 15, fontWeight: 500, textDecoration: "none" }}>
            Sign in →
          </Link>
        </div>
      </section>

      {/* 6 module grid */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 28px 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
          {MODULES.map((mod) => (
            <div key={mod.key} style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 14, padding: "24px 26px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: mod.dot + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: mod.dot }}>
                  {mod.icon}
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: mod.dot }}>
                  {mod.label}
                </span>
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--color-ink)", marginBottom: 8, lineHeight: 1.3 }}>
                {mod.headline}
              </h3>
              <p style={{ fontSize: 13, color: "var(--color-ink-3)", lineHeight: 1.6, marginBottom: 14 }}>
                {mod.description}
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {mod.tags.map((tag) => (
                  <span key={tag} style={{ fontSize: 10, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: mod.dot + "12", color: mod.dot, letterSpacing: "0.03em" }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Waitlist */}
      <section id="waitlist" style={{ background: "var(--color-bg-deep)", borderTop: "1px solid var(--color-rule)", borderBottom: "1px solid var(--color-rule)", padding: "64px 28px" }}>
        <div style={{ maxWidth: 440, margin: "0 auto", textAlign: "center" }}>
          <h2 className="serif" style={{ fontSize: 32, marginBottom: 10, color: "var(--color-ink)" }}>
            Request access
          </h2>
          <p style={{ fontSize: 14, color: "var(--color-ink-3)", lineHeight: 1.6, marginBottom: 28 }}>
            morrisai.family is invitation-only. Leave your name and email and we&rsquo;ll reach out when access opens.
          </p>
          <WaitlistForm />
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: "28px", textAlign: "center" }}>
        <span className="serif" style={{ fontSize: 14, color: "var(--color-ink-4)", fontStyle: "italic" }}>
          morrisai.family &mdash; Private family platform
        </span>
      </footer>
    </div>
  );
}
