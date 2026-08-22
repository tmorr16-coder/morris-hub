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
    tags: ["Net worth", "Bank sync", "Family sharing"],
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
  {
    key: "bible",
    label: "Bible",
    dot: "#5B6B9E",
    icon: "✝",
    headline: "Scripture, read together",
    description: "Reading plans that keep the whole family in step, hands-free audio that plays straight through, plus highlights and notes.",
    tags: ["Reading plans", "Audio", "Family challenges"],
  },
  {
    key: "travel",
    label: "Travel",
    dot: "#2A8390",
    icon: "✈",
    headline: "Plan the trip, then track it",
    description: "Search flights, stays, and cars with real prices and points, build the itinerary, and get check-in reminders when it's time.",
    tags: ["Flights", "Stays & cars", "Trip alerts"],
  },
];

// ── Waitlist form ───────────────────────────────────────────────────────────

const iosInput: React.CSSProperties = {
  width: "100%",
  padding: "13px 15px",
  borderRadius: 10,
  border: "0.5px solid var(--ios-separator)",
  background: "var(--ios-bg-elevated)",
  color: "var(--ios-label)",
  fontSize: 17,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

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
        <div style={{ fontSize: 40, marginBottom: 8, color: "var(--ios-green)" }}>✓</div>
        <div className="ios-headline" style={{ marginBottom: 4 }}>You&rsquo;re on the list</div>
        <div className="ios-subhead" style={{ color: "var(--ios-label-2)" }}>We&rsquo;ll be in touch when access opens up for new members.</div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" style={iosInput} />
      <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" style={iosInput} />
      {errorMsg && <div className="ios-footnote" style={{ color: "var(--ios-red)" }}>{errorMsg}</div>}
      <button type="submit" disabled={status === "loading"} className="ios-btn ios-btn--primary"
        style={{ marginTop: 4, cursor: status === "loading" ? "wait" : "pointer", opacity: status === "loading" ? 0.6 : 1 }}>
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
    <div data-ui="ios" className="ios-scroll" style={{ minHeight: "100dvh" }}>

      {/* Top bar */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px var(--ios-gutter)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--ios-tint)", flexShrink: 0 }} />
          <span className="ios-headline" style={{ letterSpacing: "-0.01em" }}>
            morrisai<span style={{ color: "var(--ios-tint)" }}>.family</span>
          </span>
        </div>
        <Link href="/login" className="ios-headline" style={{ color: "var(--ios-tint)", fontWeight: 400 }}>
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <section style={{ padding: "48px var(--ios-gutter) 40px", textAlign: "center" }}>
        <div className="ios-chip ios-chip--sm" style={{ color: "var(--ios-tint)", marginBottom: 22 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ios-tint)", flexShrink: 0 }} />
          <span style={{ fontWeight: 600, letterSpacing: "0.02em" }}>Private · Family · AI-powered</span>
        </div>
        <h1 style={{ fontSize: 44, lineHeight: 1.06, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 16, color: "var(--ios-label)" }}>
          Your family&rsquo;s<br />intelligent platform.
        </h1>
        <p className="ios-body" style={{ color: "var(--ios-label-2)", maxWidth: 440, margin: "0 auto 28px", lineHeight: 1.5 }}>
          Eight integrated apps — health, finance, investments, career, academics, scripture, travel, and a shared family hub — powered by AI and built for one family.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 340, margin: "0 auto" }}>
          <a href="#waitlist" className="ios-btn ios-btn--primary">Request Access</a>
          <Link href="/login" className="ios-btn ios-btn--full" style={{ background: "var(--ios-fill)", color: "var(--ios-tint)" }}>
            Sign in
          </Link>
        </div>
      </section>

      {/* Module list */}
      <section style={{ padding: "0 var(--ios-gutter) 8px" }}>
        <h2 className="ios-group-header" style={{ padding: "0 4px 10px" }}>Eight apps, one platform</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {MODULES.map((mod) => (
            <div key={mod.key} style={{ background: "var(--ios-cell)", borderRadius: "var(--ios-radius-tile)", padding: "18px 18px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: mod.dot, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#fff", flexShrink: 0 }}>
                  {mod.icon}
                </div>
                <div>
                  <div className="ios-caption" style={{ fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ios-label-2)" }}>
                    {mod.label}
                  </div>
                  <div className="ios-headline" style={{ lineHeight: 1.25, marginTop: 1 }}>
                    {mod.headline}
                  </div>
                </div>
              </div>
              <p className="ios-subhead" style={{ color: "var(--ios-label-2)", lineHeight: 1.45, marginBottom: 12 }}>
                {mod.description}
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {mod.tags.map((tag) => (
                  <span key={tag} className="ios-chip ios-chip--sm" style={{ background: "var(--ios-fill)", color: "var(--ios-label-2)", fontSize: 12 }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Waitlist */}
      <section id="waitlist" style={{ padding: "36px var(--ios-gutter) 16px" }}>
        <div style={{ background: "var(--ios-cell)", borderRadius: "var(--ios-radius-tile)", padding: "28px 22px", textAlign: "center" }}>
          <h2 className="ios-title-2" style={{ marginBottom: 8 }}>Request access</h2>
          <p className="ios-subhead" style={{ color: "var(--ios-label-2)", lineHeight: 1.45, marginBottom: 22 }}>
            morrisai.family is invitation-only. Leave your name and email and we&rsquo;ll reach out when access opens.
          </p>
          <div style={{ textAlign: "left" }}>
            <WaitlistForm />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: "20px var(--ios-gutter) 32px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <span className="ios-footnote" style={{ color: "var(--ios-label-3)" }}>
          morrisai.family — Private family platform
        </span>
        <Link href="/privacy" className="ios-footnote" style={{ color: "var(--ios-tint)" }}>Privacy &amp; Data Handling</Link>
      </footer>
    </div>
  );
}
