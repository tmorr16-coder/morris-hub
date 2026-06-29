"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding } from "../actions";

// ── Types ────────────────────────────────────────────────────────────────────

type Persona = "parent" | "student" | "individual";

interface Profile {
  displayName: string;
  locationName: string;
}

type ModuleKey = "health" | "finance" | "investments" | "career" | "student-success" | "bible";

// ── Persona definitions ───────────────────────────────────────────────────────

const PERSONAS: { key: Persona; label: string; emoji: string; tagline: string; description: string; defaultModules: ModuleKey[] }[] = [
  {
    key: "parent",
    label: "Parent",
    emoji: "⌂",
    tagline: "Managing family life",
    description: "Overseeing family finances, tracking health for yourself and your household, investment research, and career development.",
    defaultModules: ["health", "finance", "investments", "career"],
  },
  {
    key: "student",
    label: "Student",
    emoji: "✦",
    tagline: "Focused on growth",
    description: "Academic progress, certification tracking, LSAT prep, career coaching, and personal health — built around your academic life.",
    defaultModules: ["health", "career", "student-success"],
  },
  {
    key: "individual",
    label: "Individual",
    emoji: "◈",
    tagline: "Personal command center",
    description: "Your own finance tracker, investment research dashboard, health trends, and career advisor — everything for one person.",
    defaultModules: ["health", "finance", "investments", "career"],
  },
];

// ── Module definitions ────────────────────────────────────────────────────────

const MODULES: { key: ModuleKey; label: string; dot: string; icon: string; description: string }[] = [
  { key: "health",          label: "Health",          dot: "#4D6B3A", icon: "♡", description: "Body composition, workouts, GLP-1 tracking, Oura & Withings sync" },
  { key: "finance",         label: "Finance",         dot: "#8B6A47", icon: "$", description: "Family accounts, net worth, Plaid-connected, family sharing" },
  { key: "investments",     label: "Investments",     dot: "#C97A3A", icon: "↗", description: "Stock research, AI deep analysis, live charts, paper trading" },
  { key: "career",          label: "Career",          dot: "#2A6049", icon: "◈", description: "AI advisor, goal tracking, learning log, relationship mapping" },
  { key: "student-success", label: "Student Success", dot: "#6B5B95", icon: "✦", description: "LSAT prep, certifications, course tracking, performance analytics" },
  { key: "bible",           label: "Bible",           dot: "#6B3B7C", icon: "✟", description: "Scripture study, daily plans, notes, challenges" },
];

// ── Integration definitions ───────────────────────────────────────────────────

const INTEGRATIONS: Record<Persona, { key: string; label: string; description: string; icon: string; href: string; available: boolean }[]> = {
  parent: [
    { key: "plaid",     label: "Plaid",     icon: "🏦", description: "Connect bank accounts and credit cards for automatic finance sync", href: "/finance/dashboard?connect=true", available: true },
    { key: "oura",      label: "Oura Ring", icon: "💍", description: "Sync sleep, HRV, and readiness scores from your Oura ring", href: "/health/settings", available: true },
    { key: "withings",  label: "Withings",  icon: "⚖️", description: "Connect your smart scale for body composition tracking", href: "/health/settings", available: true },
    { key: "alpaca",    label: "Alpaca",    icon: "📈", description: "Paper trade stocks while you learn — no real money needed", href: "/investments/stocks", available: true },
  ],
  student: [
    { key: "oura",      label: "Oura Ring", icon: "💍", description: "Track sleep and recovery — critical for academic performance", href: "/health/settings", available: true },
    { key: "lsat",      label: "LSAT Prep", icon: "📝", description: "Set up your LSAT practice schedule and target score", href: "/student-success/lsat", available: true },
    { key: "career",    label: "Career Profile", icon: "◈", description: "Upload your resume and complete the career assessment", href: "/career/profile", available: true },
  ],
  individual: [
    { key: "plaid",     label: "Plaid",     icon: "🏦", description: "Connect bank accounts and credit cards for automatic finance sync", href: "/finance/dashboard?connect=true", available: true },
    { key: "oura",      label: "Oura Ring", icon: "💍", description: "Sync sleep, HRV, and readiness scores from your Oura ring", href: "/health/settings", available: true },
    { key: "alpaca",    label: "Alpaca",    icon: "📈", description: "Paper trade stocks while you learn — no real money needed", href: "/investments/stocks", available: true },
    { key: "career",    label: "Career Profile", icon: "◈", description: "Upload your resume and set your career goals to activate the AI advisor", href: "/career/profile", available: true },
  ],
};

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 40 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{ height: 3, width: 40, borderRadius: 2, background: i < step ? "var(--color-accent)" : "var(--color-rule)", transition: "background 0.3s" }} />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  initialName: string;
  initialLocation: string;
}

export default function OnboardingFlow({ initialName, initialLocation }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [profile, setProfile] = useState<Profile>({ displayName: initialName, locationName: initialLocation });
  const [modules, setModules] = useState<Set<ModuleKey>>(new Set());
  const [connectedIntegrations, setConnectedIntegrations] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // When persona is selected, pre-populate modules
  function selectPersona(p: Persona) {
    setPersona(p);
    const preset = PERSONAS.find((x) => x.key === p)!;
    setModules(new Set(preset.defaultModules));
  }

  function toggleModule(key: ModuleKey) {
    setModules((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function finish() {
    setSaving(true);
    const appAccess = ["hub", ...Array.from(modules)];
    await completeOnboarding({
      persona: persona!,
      displayName: profile.displayName,
      locationName: profile.locationName,
      appAccess,
    });
    router.replace("/home");
  }

  const cardStyle = (selected: boolean, color = "var(--color-accent)"): React.CSSProperties => ({
    padding: "20px 22px",
    borderRadius: 12,
    border: `1.5px solid ${selected ? color : "var(--color-rule)"}`,
    background: selected ? color + "0d" : "var(--color-bg-card)",
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
    transition: "all 0.15s",
    width: "100%",
  });

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)", display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 24px 80px" }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 40 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--color-accent)", alignSelf: "center", flexShrink: 0 }} />
        <span className="serif" style={{ fontSize: 20, color: "var(--color-ink)" }}>morrisai</span>
        <span className="serif" style={{ color: "var(--color-accent-dark)", fontStyle: "italic", fontSize: 18 }}>.family</span>
      </div>

      <ProgressBar step={step} total={4} />

      <div style={{ width: "100%", maxWidth: 560 }}>

        {/* ── Screen 1: Who are you ── */}
        {step === 1 && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--color-ink)", marginBottom: 6, textAlign: "center" }}>Who are you?</h1>
            <p style={{ fontSize: 14, color: "var(--color-ink-3)", textAlign: "center", marginBottom: 28, lineHeight: 1.6 }}>
              We&rsquo;ll pre-configure the platform for your situation. You can change everything later.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {PERSONAS.map((p) => (
                <button key={p.key} onClick={() => selectPersona(p.key)} style={cardStyle(persona === p.key)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                    <span style={{ fontSize: 22 }}>{p.emoji}</span>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-ink)" }}>{p.label}</div>
                      <div style={{ fontSize: 11, color: "var(--color-accent)", fontWeight: 600, letterSpacing: "0.04em" }}>{p.tagline}</div>
                    </div>
                    {persona === p.key && <span style={{ marginLeft: "auto", color: "var(--color-accent)", fontSize: 18 }}>✓</span>}
                  </div>
                  <p style={{ fontSize: 13, color: "var(--color-ink-3)", lineHeight: 1.5, margin: 0 }}>{p.description}</p>
                </button>
              ))}
            </div>
            <button onClick={() => setStep(2)} disabled={!persona}
              style={{ marginTop: 24, width: "100%", padding: "13px", borderRadius: 10, border: "none", background: "var(--color-accent)", color: "#FFFDF8", fontSize: 15, fontWeight: 700, fontFamily: "inherit", cursor: persona ? "pointer" : "not-allowed", opacity: persona ? 1 : 0.4 }}>
              Continue →
            </button>
          </div>
        )}

        {/* ── Screen 2: Profile ── */}
        {step === 2 && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--color-ink)", marginBottom: 6, textAlign: "center" }}>Your profile</h1>
            <p style={{ fontSize: 14, color: "var(--color-ink-3)", textAlign: "center", marginBottom: 28, lineHeight: 1.6 }}>
              This personalises your home screen greeting and local data like weather.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 6 }}>
                  How should we address you?
                </label>
                <input
                  value={profile.displayName}
                  onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))}
                  placeholder="e.g. Terry, Dad, Coach"
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--color-rule)", background: "var(--color-bg)", color: "var(--color-ink)", fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 6 }}>
                  Your city or town
                </label>
                <input
                  value={profile.locationName}
                  onChange={(e) => setProfile((p) => ({ ...p, locationName: e.target.value }))}
                  placeholder="e.g. Fishers, IN"
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--color-rule)", background: "var(--color-bg)", color: "var(--color-ink)", fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                />
                <div style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 4 }}>Used for weather and local news on your home screen.</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, padding: "13px", borderRadius: 10, border: "1px solid var(--color-rule)", background: "transparent", color: "var(--color-ink-2)", fontSize: 14, fontFamily: "inherit", cursor: "pointer" }}>← Back</button>
              <button onClick={() => setStep(3)} disabled={!profile.displayName.trim()}
                style={{ flex: 2, padding: "13px", borderRadius: 10, border: "none", background: "var(--color-accent)", color: "#FFFDF8", fontSize: 15, fontWeight: 700, fontFamily: "inherit", cursor: profile.displayName.trim() ? "pointer" : "not-allowed", opacity: profile.displayName.trim() ? 1 : 0.4 }}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ── Screen 3: Choose modules ── */}
        {step === 3 && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--color-ink)", marginBottom: 6, textAlign: "center" }}>Choose your modules</h1>
            <p style={{ fontSize: 14, color: "var(--color-ink-3)", textAlign: "center", marginBottom: 8, lineHeight: 1.6 }}>
              We&rsquo;ve pre-selected the right ones for a <strong style={{ color: "var(--color-ink-2)" }}>{persona}</strong>. Toggle any you want to add or remove.
            </p>
            <div style={{ fontSize: 11, color: "var(--color-ink-4)", textAlign: "center", marginBottom: 24 }}>Hub is always included as your home screen.</div>

            {/* Hub — always on */}
            <div style={{ padding: "14px 18px", borderRadius: 10, border: "1.5px solid var(--color-accent)", background: "var(--color-accent-soft)", marginBottom: 10, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 20, color: "var(--color-accent)" }}>⌂</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-ink)" }}>Hub</div>
                <div style={{ fontSize: 11, color: "var(--color-ink-3)" }}>Your daily home screen — always enabled</div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-accent)", background: "rgba(59,92,127,0.12)", padding: "3px 8px", borderRadius: 6 }}>Always on</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {MODULES.map((mod) => {
                const on = modules.has(mod.key);
                return (
                  <button key={mod.key} onClick={() => toggleModule(mod.key)} style={cardStyle(on, mod.dot)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: mod.dot + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: mod.dot, flexShrink: 0 }}>
                        {mod.icon}
                      </div>
                      <div style={{ flex: 1, textAlign: "left" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-ink)" }}>{mod.label}</div>
                        <div style={{ fontSize: 11, color: "var(--color-ink-3)", lineHeight: 1.4 }}>{mod.description}</div>
                      </div>
                      <div style={{ width: 40, height: 24, borderRadius: 12, background: on ? mod.dot : "var(--color-rule)", transition: "background 0.2s", flexShrink: 0, position: "relative" }}>
                        <div style={{ position: "absolute", top: 3, left: on ? 18 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button onClick={() => setStep(2)} style={{ flex: 1, padding: "13px", borderRadius: 10, border: "1px solid var(--color-rule)", background: "transparent", color: "var(--color-ink-2)", fontSize: 14, fontFamily: "inherit", cursor: "pointer" }}>← Back</button>
              <button onClick={() => setStep(4)}
                style={{ flex: 2, padding: "13px", borderRadius: 10, border: "none", background: "var(--color-accent)", color: "#FFFDF8", fontSize: 15, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ── Screen 4: Integrations ── */}
        {step === 4 && persona && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--color-ink)", marginBottom: 6, textAlign: "center" }}>Connect your first integrations</h1>
            <p style={{ fontSize: 14, color: "var(--color-ink-3)", textAlign: "center", marginBottom: 8, lineHeight: 1.6 }}>
              These are the most impactful connections for a <strong style={{ color: "var(--color-ink-2)" }}>{persona}</strong>. You can skip any and connect later.
            </p>
            <div style={{ fontSize: 11, color: "var(--color-ink-4)", textAlign: "center", marginBottom: 24 }}>Connections open in the relevant app section.</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {INTEGRATIONS[persona].map((intg) => {
                const connected = connectedIntegrations.has(intg.key);
                return (
                  <div key={intg.key} style={{ padding: "16px 18px", borderRadius: 12, border: `1.5px solid ${connected ? "var(--color-green)" : "var(--color-rule)"}`, background: connected ? "rgba(74,107,58,0.05)" : "var(--color-bg-card)", display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ fontSize: 26, flexShrink: 0 }}>{intg.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-ink)", marginBottom: 2 }}>{intg.label}</div>
                      <div style={{ fontSize: 11, color: "var(--color-ink-3)", lineHeight: 1.4 }}>{intg.description}</div>
                    </div>
                    {connected ? (
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-green)", flexShrink: 0 }}>✓ Connected</span>
                    ) : (
                      <a
                        href={intg.href}
                        onClick={() => setConnectedIntegrations((s) => new Set(s).add(intg.key))}
                        style={{ fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--color-rule)", background: "var(--color-bg)", color: "var(--color-ink-2)", textDecoration: "none", flexShrink: 0, whiteSpace: "nowrap" }}
                      >
                        Set up →
                      </a>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
              <button onClick={() => setStep(3)} style={{ flex: 1, padding: "13px", borderRadius: 10, border: "1px solid var(--color-rule)", background: "transparent", color: "var(--color-ink-2)", fontSize: 14, fontFamily: "inherit", cursor: "pointer" }}>← Back</button>
              <button onClick={finish} disabled={saving}
                style={{ flex: 2, padding: "13px", borderRadius: 10, border: "none", background: "var(--color-accent)", color: "#FFFDF8", fontSize: 15, fontWeight: 700, fontFamily: "inherit", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Setting up…" : "Enter the platform →"}
              </button>
            </div>

            <button onClick={finish} disabled={saving} style={{ display: "block", width: "100%", marginTop: 12, padding: "10px", borderRadius: 10, border: "none", background: "transparent", color: "var(--color-ink-4)", fontSize: 12, fontFamily: "inherit", cursor: "pointer" }}>
              Skip all — I&rsquo;ll set up integrations later
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
