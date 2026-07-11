import Link from "next/link";

export const metadata = {
  title: "Privacy & Data Handling — morrisai.family",
  description: "How morrisai.family collects, stores, and protects your personal, financial, health, and academic data.",
};

const LAST_UPDATED = "June 28, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-ink)", marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid var(--color-rule)" }}>
        {title}
      </h2>
      <div style={{ fontSize: 14, color: "var(--color-ink-2)", lineHeight: 1.75 }}>
        {children}
      </div>
    </section>
  );
}

function DataRow({ category, data, storage, retention, shared }: {
  category: string;
  data: string;
  storage: string;
  retention: string;
  shared: string;
}) {
  return (
    <tr>
      <td style={{ padding: "10px 12px 10px 0", fontWeight: 600, color: "var(--color-ink)", verticalAlign: "top", whiteSpace: "nowrap" }}>{category}</td>
      <td style={{ padding: "10px 12px", color: "var(--color-ink-2)", verticalAlign: "top", fontSize: 13 }}>{data}</td>
      <td style={{ padding: "10px 12px", color: "var(--color-ink-2)", verticalAlign: "top", fontSize: 13 }}>{storage}</td>
      <td style={{ padding: "10px 12px", color: "var(--color-ink-2)", verticalAlign: "top", fontSize: 13 }}>{retention}</td>
      <td style={{ padding: "10px 0 10px 12px", color: "var(--color-ink-2)", verticalAlign: "top", fontSize: 13 }}>{shared}</td>
    </tr>
  );
}

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>

      {/* Nav */}
      <nav style={{ borderBottom: "1px solid var(--color-rule)", padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
        <Link href="/" style={{ display: "flex", alignItems: "baseline", gap: 6, textDecoration: "none" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--color-accent)", alignSelf: "center", flexShrink: 0 }} />
          <span className="serif" style={{ fontSize: 20, color: "var(--color-ink)" }}>morrisai</span>
          <span className="serif" style={{ color: "var(--color-accent-dark)", fontStyle: "italic", fontSize: 18 }}>.family</span>
        </Link>
        <Link href="/login" style={{ fontSize: 13, color: "var(--color-ink-3)", textDecoration: "none" }}>Sign in</Link>
      </nav>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 28px 100px" }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-4)", marginBottom: 10 }}>
            Legal
          </div>
          <h1 className="serif" style={{ fontSize: 40, lineHeight: 1.1, marginBottom: 12, color: "var(--color-ink)" }}>
            Privacy &amp; Data Handling
          </h1>
          <p style={{ fontSize: 14, color: "var(--color-ink-3)", lineHeight: 1.6 }}>
            Last updated: {LAST_UPDATED}
          </p>
        </div>

        {/* Summary callout */}
        <div style={{ padding: "18px 20px", background: "var(--color-accent-soft)", border: "1px solid rgba(59,92,127,0.2)", borderRadius: 10, marginBottom: 40 }}>
          <p style={{ fontSize: 14, color: "var(--color-ink)", lineHeight: 1.65, margin: 0 }}>
            <strong>The short version:</strong> morrisai.family is a private platform for one family. Your financial, health, and academic data is stored in a dedicated database, never sold, never shared with advertisers, and only shared with other family members when you explicitly choose to do so. AI features send data to Anthropic for processing — never for training.
          </p>
        </div>

        <Section title="Who we are">
          <p>morrisai.family is a private, invitation-only platform operated for personal family use. It is not a commercial product available to the general public. Access is managed by invitation only.</p>
          <p style={{ marginTop: 10 }}>Contact: <a href="mailto:tmorr16@gmail.com" style={{ color: "var(--color-accent)" }}>tmorr16@gmail.com</a></p>
        </Section>

        <Section title="Data we collect">
          <p style={{ marginBottom: 14 }}>We collect only data that you actively provide or that is necessary for platform features to work:</p>
          <ul style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
            <li><strong>Account data:</strong> Name and email address via Google OAuth. We do not store passwords.</li>
            <li><strong>Health data:</strong> Body weight, body composition, workout logs, dose tracking (Zepbound/GLP-1), sleep and HRV metrics synced from Oura and Withings. Stored only for your own personal use.</li>
            <li><strong>Financial data:</strong> Bank account balances, transaction history, and net worth via SimpleFIN. Investment account data via Alpaca. Manually entered account balances.</li>
            <li><strong>Academic data:</strong> LSAT practice scores, course progress, certification tracking, and study logs.</li>
            <li><strong>Career data:</strong> Resume text, career goals, learning logs, and professional contacts that you enter. Used solely to power the AI career advisor.</li>
            <li><strong>Preferences:</strong> Location, news topics, stock tickers, sports teams, and widget settings that personalise your home screen.</li>
            <li><strong>Usage data:</strong> Standard server logs (request timestamps, error rates). No ad tracking, no fingerprinting, no behavioural profiling.</li>
          </ul>
        </Section>

        <Section title="How we store and protect your data">
          <p>All data is stored in a dedicated Supabase (PostgreSQL) database. Row-Level Security (RLS) is enforced at the database level — every query is scoped to your user ID. No user can read another user&rsquo;s data unless you have explicitly shared it.</p>
          <p style={{ marginTop: 10 }}>Sensitive credentials (OAuth tokens, API keys, encryption keys) are stored as environment variables in Vercel and never committed to source code.</p>
          <p style={{ marginTop: 10 }}>Financial account access tokens (SimpleFIN) are encrypted at rest using AES-256-GCM before storage.</p>
          <p style={{ marginTop: 10 }}>The platform is deployed on Vercel (US) with Supabase (US East) as the data store. Data does not leave US infrastructure except when sent to third-party APIs listed below.</p>
        </Section>

        <Section title="Data by module">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--color-rule)" }}>
                  {["Module", "Data collected", "Stored where", "Retention", "Family-shareable"].map((h) => (
                    <th key={h} style={{ padding: "8px 12px 8px 0", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-ink-3)", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <DataRow category="Health" data="Weight, body comp, workouts, doses, sleep, HRV" storage="Supabase (hub/health schema)" retention="Until you delete it" shared="No — private by default" />
                <DataRow category="Finance" data="Account balances, transactions, net worth" storage="Supabase (finance schema)" retention="Until you disconnect or delete" shared="Per-account, you choose" />
                <DataRow category="Investments" data="Watchlist tickers, research notes, paper trades" storage="Supabase (hub schema)" retention="Until you delete it" shared="No" />
                <DataRow category="Career" data="Resume, goals, notes, contacts" storage="Supabase (career schema)" retention="Until you delete it" shared="No" />
                <DataRow category="Student" data="LSAT scores, courses, certifications" storage="Supabase (student schema)" retention="Until you delete it" shared="No" />
                <DataRow category="Hub" data="Reminders, preferences, widgets" storage="Supabase (hub schema)" retention="Account lifetime" shared="No" />
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Third-party services">
          <p style={{ marginBottom: 14 }}>The following external services receive data to power platform features:</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { name: "Anthropic (Claude API)", purpose: "AI features — chat, research, summaries, career coaching", data: "Your messages and relevant context (profile, account data you've provided)", training: "Not used for model training per Anthropic's API terms" },
              { name: "Google (OAuth)", purpose: "Authentication", data: "Name and email only", training: "N/A" },
              { name: "SimpleFIN", purpose: "Bank account connectivity", data: "Bank credentials are handled by SimpleFIN — the platform receives read-only account and transaction data only", training: "N/A" },
              { name: "Alpaca Markets", purpose: "Investment research and paper trading", data: "Ticker searches, watchlist, paper orders", training: "N/A" },
              { name: "Finnhub, Yahoo Finance", purpose: "Real-time market data and charts", data: "Ticker symbols only — no personal data", training: "N/A" },
              { name: "Vercel", purpose: "Hosting and serverless compute", data: "Request logs (IP, path, timestamp)", training: "N/A" },
              { name: "Supabase", purpose: "Database and authentication", data: "All stored data listed above", training: "N/A" },
              { name: "Twilio", purpose: "SMS reminders (optional)", data: "Phone number and reminder text", training: "N/A" },
            ].map((svc) => (
              <div key={svc.name} style={{ padding: "14px 16px", background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 8 }}>
                <div style={{ fontWeight: 700, color: "var(--color-ink)", marginBottom: 4 }}>{svc.name}</div>
                <div style={{ fontSize: 13, color: "var(--color-ink-3)", marginBottom: 2 }}><strong style={{ color: "var(--color-ink-2)" }}>Purpose:</strong> {svc.purpose}</div>
                <div style={{ fontSize: 13, color: "var(--color-ink-3)", marginBottom: 2 }}><strong style={{ color: "var(--color-ink-2)" }}>Data sent:</strong> {svc.data}</div>
                <div style={{ fontSize: 13, color: "var(--color-ink-3)" }}><strong style={{ color: "var(--color-ink-2)" }}>Training:</strong> {svc.training}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Family sharing">
          <p>morrisai.family includes voluntary sharing between family members. Sharing is always:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            <li><strong>Explicit:</strong> You initiate each share. Nothing is shared by default.</li>
            <li><strong>Per-item:</strong> You choose which accounts to share, not a blanket &ldquo;share everything.&rdquo;</li>
            <li><strong>Revocable:</strong> You can revoke access at any time from the import settings page.</li>
            <li><strong>Scoped:</strong> The recipient sees a read-only view of what you shared. They cannot modify your data.</li>
          </ul>
          <p style={{ marginTop: 10 }}>Health, career, academic, and investment data are never shared automatically. Only financial accounts explicitly shared by the owner are visible to other members.</p>
        </Section>

        <Section title="AI and your data">
          <p>Several features use Anthropic&rsquo;s Claude API. When you use these features, relevant context (your messages, profile summary, account data) is sent to Anthropic to generate a response.</p>
          <ul style={{ paddingLeft: 20, marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            <li>Data sent to the Claude API is <strong>not used to train Anthropic&rsquo;s models</strong> per their API usage terms.</li>
            <li>Conversation context is sent only when needed for a specific request — it is not stored by Anthropic beyond the API call.</li>
            <li>We do not send financial credentials, raw bank data, or health device tokens to the Claude API. We send summaries and figures only.</li>
          </ul>
        </Section>

        <Section title="Your rights and controls">
          <ul style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
            <li><strong>Access:</strong> All your data is visible through the platform.</li>
            <li><strong>Export:</strong> Contact us to request a data export.</li>
            <li><strong>Delete:</strong> Contact us to request full account and data deletion. Third-party connections (SimpleFIN, Alpaca) should be disconnected from within the platform before requesting deletion.</li>
            <li><strong>Correction:</strong> You can update most data directly through the platform settings.</li>
            <li><strong>Disconnect integrations:</strong> You can disconnect SimpleFIN, Oura, Withings, or Alpaca at any time from the relevant settings pages. This removes our access tokens but does not delete historical data unless you also request deletion.</li>
          </ul>
        </Section>

        <Section title="Cookies and tracking">
          <p>We use a single session cookie (set by Supabase Auth) to maintain your login. No advertising cookies, analytics pixels, or cross-site tracking. We do not use Google Analytics, Facebook Pixel, or similar tools.</p>
        </Section>

        <Section title="Children">
          <p>The platform is not directed at children under 13. Family members using the platform must be 13 or older.</p>
        </Section>

        <Section title="Changes to this policy">
          <p>We will notify platform members of material changes via the hub notification system. The date at the top of this page reflects the most recent update.</p>
        </Section>

        <Section title="Contact">
          <p>Questions or requests: <a href="mailto:tmorr16@gmail.com" style={{ color: "var(--color-accent)" }}>tmorr16@gmail.com</a></p>
        </Section>

      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--color-rule)", padding: "24px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <span className="serif" style={{ fontSize: 13, color: "var(--color-ink-4)", fontStyle: "italic" }}>morrisai.family</span>
        <div style={{ display: "flex", gap: 20 }}>
          <Link href="/" style={{ fontSize: 12, color: "var(--color-ink-4)", textDecoration: "none" }}>Home</Link>
          <Link href="/login" style={{ fontSize: 12, color: "var(--color-ink-4)", textDecoration: "none" }}>Sign in</Link>
        </div>
      </footer>
    </div>
  );
}
