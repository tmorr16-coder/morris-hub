import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentClaims } from "@/lib/supabase/server";
import WaitlistForm from "./_landing/WaitlistForm";
import "./front-door.css";

/**
 * The front door.
 *
 * Deliberately not the iOS design system the rest of the app uses. That system
 * is built for a tool opened forty times a day; this page is read once, by
 * someone who has never seen the product, and has to say what it is.
 *
 * The palette is the eight module colours the app already assigns — slate,
 * moss, tobacco, amber, pine, iris, delft, verdigris — lifted for a dark
 * ground. Eight domains under one roof is the product, so the page is built
 * from them rather than from one accent chosen for the occasion. See
 * app/front-door.css.
 *
 * A server component, and that is the point. It used to be a client component
 * that rendered the whole page and then discovered, in an effect, that the
 * visitor was already signed in — so anyone opening the app at the root
 * watched the entire marketing page paint and then vanish. The check now
 * happens before anything is sent, and a signed-in visitor never sees this
 * page at all. getCurrentClaims() verifies the token locally, so it costs no
 * round trip.
 */

// ── Module definitions ──────────────────────────────────────────────────────
// `dot` mirrors the in-app module colour; `tone` is the same hue lifted to hold
// its own against the dark ground here.

const MODULES = [
  {
    key: "hub",
    label: "Hub",
    tone: "var(--m-hub)",
    glyph: "⌂",
    headline: "Your daily command center",
    description: "Reminders, weather, news, sports, and a full-family overview — all on one personalized home screen.",
    tags: ["Reminders", "News", "Weather", "Sports"],
  },
  {
    key: "health",
    label: "Health",
    tone: "var(--m-health)",
    glyph: "♡",
    headline: "Track what matters to your body",
    description: "Body composition trends, workout logging, GLP-1 dose tracking, and real-time sync with Oura and Withings.",
    tags: ["Workouts", "Body comp", "Oura sync", "Zepbound"],
  },
  {
    key: "finance",
    label: "Finance",
    tone: "var(--m-finance)",
    glyph: "$",
    headline: "Family finances, unified",
    description: "Connected accounts, net worth over time, shared visibility between family members, and AI spending insights.",
    tags: ["Net worth", "Bank sync", "Family sharing"],
  },
  {
    key: "investments",
    label: "Investments",
    tone: "var(--m-investments)",
    glyph: "↗",
    headline: "Research-grade stock analysis",
    description: "Deep research with real-time web search, live charts, watchlist, and paper trading via Alpaca — all in one dashboard.",
    tags: ["Deep research", "Live charts", "Paper trading"],
  },
  {
    key: "career",
    label: "Career",
    tone: "var(--m-career)",
    glyph: "◈",
    headline: "Your personal career advisor",
    description: "AI coaching grounded in your resume and goals. Track milestones, learning paths, and key relationships.",
    tags: ["AI advisor", "Goal tracking", "Learning log"],
  },
  {
    key: "student",
    label: "Student Success",
    tone: "var(--m-student)",
    glyph: "✦",
    headline: "Academic progress, tracked",
    description: "LSAT prep with AI scoring, certification paths, course tracking, and performance analytics.",
    tags: ["LSAT prep", "Certifications", "Course log"],
  },
  {
    key: "bible",
    label: "Bible",
    tone: "var(--m-bible)",
    glyph: "✝",
    headline: "Scripture, read together",
    description: "Reading plans that keep the whole family in step, hands-free audio that plays straight through, plus highlights and notes.",
    tags: ["Reading plans", "Audio", "Family challenges"],
  },
  {
    key: "travel",
    label: "Travel",
    tone: "var(--m-travel)",
    glyph: "✈",
    headline: "Plan the trip, then track it",
    description: "Search flights, stays, and cars with real prices and points, build the itinerary, and get check-in reminders when it's time.",
    tags: ["Flights", "Stays & cars", "Trip alerts"],
  },
];


// ── Page ────────────────────────────────────────────────────────────────────

export default async function LandingPage() {
  // Decided before the page is sent, so there is nothing to flash.
  if (await getCurrentClaims()) redirect("/home");

  return (
    <div className="lp">
      <header className="lp-head">
        <div className="lp-bar">
          <Link href="/" className="lp-mark">
            <span className="lp-mark-dot" aria-hidden />
            <span className="lp-mark-text">
              morrisai<i>.family</i>
            </span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Link href="/login" className="lp-btn lp-btn--quiet">Sign in</Link>
            <a href="#waitlist" className="lp-btn lp-btn--solid">Request access</a>
          </div>
        </div>
      </header>

      <main className="lp-wrap">
        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <section className="lp-hero">
          <p className="lp-eyebrow">
            <span aria-hidden />
            Private · Invitation only
          </p>
          <h1 className="lp-title">
            Eight apps for one family.
            <em>Built for this one.</em>
          </h1>
          <p className="lp-lede">
            Health, finance, investments, career, academics, scripture, travel and a shared
            home screen. Everything reads from the same records, so the advice each one gives
            is grounded in what the others already know.
          </p>
          <div className="lp-cta">
            <a href="#waitlist" className="lp-btn lp-btn--solid">Request access</a>
            <Link href="/login" className="lp-btn lp-btn--ghost">Sign in</Link>
          </div>

          {/* The spectrum: eight columns in module order. Colour, name and
              count are all real, so it states the shape of the product
              without a line of copy. */}
          <nav className="lp-spectrum" aria-label="The eight modules">
            {MODULES.map((m) => (
              <a
                key={m.key}
                href={`#${m.key}`}
                className="lp-spec"
                style={{ "--c": m.tone } as React.CSSProperties}
              >
                <span className="lp-spec-bar" />
                <span className="lp-spec-name">{m.label}</span>
              </a>
            ))}
          </nav>
        </section>

        {/* ── Modules ────────────────────────────────────────────────────── */}
        <section className="lp-section">
          <p className="lp-kicker">The eight</p>
          <h2 className="lp-h2">
            One record, read <em>eight ways.</em>
          </h2>
          <div className="lp-modules">
            {MODULES.map((m) => (
              <article
                key={m.key}
                id={m.key}
                className="lp-mod"
                style={{ "--c": m.tone } as React.CSSProperties}
              >
                <div className="lp-mod-id">
                  <span className="lp-mod-glyph" aria-hidden>{m.glyph}</span>
                  <span className="lp-mod-name">{m.label}</span>
                </div>
                <div>
                  <h3 className="lp-mod-headline">{m.headline}</h3>
                  <p className="lp-mod-desc">{m.description}</p>
                  <div className="lp-tags">
                    {m.tags.map((t) => (
                      <span key={t} className="lp-tag">{t}</span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ── Waitlist ───────────────────────────────────────────────────── */}
        <section className="lp-section" id="waitlist">
          <p className="lp-kicker">Access</p>
          <h2 className="lp-h2">
            Built for one household. <em>Open to a few more.</em>
          </h2>
          <p className="lp-lede" style={{ marginTop: 14 }}>
            morrisai.family is invitation-only. Leave your name and we&rsquo;ll reach out when
            access opens.
          </p>
          <div className="lp-panel">
            <WaitlistForm />
          </div>
        </section>

        <footer className="lp-foot">
          <span>morrisai.family — a private family platform</span>
          <Link href="/privacy">Privacy &amp; data handling</Link>
        </footer>
      </main>
    </div>
  );
}
