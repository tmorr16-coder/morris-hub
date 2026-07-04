"use client";

import { useState } from "react";
import { completeOnboarding } from "../actions";
import { lookupZip } from "@/app/home/actions";
import { Icons, Chip } from "@/components/ios";
import { AVAILABLE_SPORTS_TEAMS, getTeamInfo } from "@/lib/sports-teams";

// News topics — mirrors AVAILABLE_TOPICS in app/home/settings/_components/SettingsForm.tsx.
// Keep in sync; do not add topics the news pipeline doesn't support.
const NEWS_TOPICS: { id: string; label: string }[] = [
  { id: "politics", label: "Politics" },
  { id: "ai", label: "AI" },
  { id: "claude", label: "Claude" },
  { id: "technology", label: "Technology" },
  { id: "business", label: "Business" },
  { id: "world", label: "World" },
  { id: "sports", label: "Sports" },
];

// ── Types ────────────────────────────────────────────────────────────────────

type Persona = "parent" | "student" | "individual";

interface Profile {
  displayName: string;
  locationName: string;
  latitude?: number | null;
  longitude?: number | null;
}

type ModuleKey = "health" | "finance" | "investments" | "career" | "student-success" | "children" | "bible";

type Glyph = (p: React.SVGProps<SVGSVGElement>) => React.JSX.Element;

// ── Persona definitions ───────────────────────────────────────────────────────

const PERSONAS: { key: Persona; label: string; emoji: string; tagline: string; description: string; defaultModules: ModuleKey[] }[] = [
  {
    key: "parent",
    label: "Parent",
    emoji: "⌂",
    tagline: "Managing family life",
    description: "Overseeing family finances, tracking health for yourself and your household, investment research, and career development.",
    defaultModules: ["health", "finance", "investments", "career", "children"],
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

const PERSONA_ICON: Record<Persona, Glyph> = {
  parent: Icons.PeopleIcon,
  student: Icons.BookIcon,
  individual: Icons.PersonIcon,
};

// ── Module definitions ────────────────────────────────────────────────────────

const MODULES: { key: ModuleKey; label: string; dot: string; icon: string; description: string }[] = [
  { key: "health",          label: "Health",          dot: "#34C759", icon: "♡", description: "Body composition, workouts, GLP-1 tracking, Oura & Withings sync" },
  { key: "finance",         label: "Finance",         dot: "#C58B4F", icon: "$", description: "Family accounts, net worth, Plaid-connected, family sharing" },
  { key: "investments",     label: "Investments",     dot: "#FF9F0A", icon: "↗", description: "Stock research, AI deep analysis, live charts, paper trading" },
  { key: "career",          label: "Career",          dot: "#356FB0", icon: "◈", description: "AI advisor, goal tracking, learning log, relationship mapping" },
  { key: "student-success", label: "Courses",         dot: "#6B5B95", icon: "✦", description: "College course tracking, assignments, and grades — lives on your Me dashboard" },
  { key: "children",        label: "Children",        dot: "#C97A9B", icon: "⌘", description: "Profile cards, activities, and support for each of your kids" },
  { key: "bible",           label: "Bible",           dot: "#6B3B7C", icon: "✟", description: "Scripture study, daily plans, notes, challenges" },
];

const MODULE_ICON: Record<ModuleKey, Glyph> = {
  health: Icons.HeartIcon,
  finance: Icons.WalletIcon,
  investments: Icons.TrendUpIcon,
  career: Icons.BriefcaseIcon,
  "student-success": Icons.BookIcon,
  children: Icons.PeopleIcon,
  bible: Icons.BookIcon,
};

// ── Integration definitions ───────────────────────────────────────────────────

const INTEGRATIONS: Record<Persona, { key: string; label: string; description: string; icon: string; href: string; available: boolean }[]> = {
  parent: [
    { key: "plaid",     label: "Plaid",     icon: "🏦", description: "Connect bank accounts and credit cards for automatic finance sync", href: "/finance/dashboard?connect=true", available: true },
    { key: "oura",      label: "Oura Ring", icon: "💍", description: "Sync sleep, HRV, and readiness scores from your Oura ring", href: "/health/settings/integrations", available: true},
    { key: "withings",  label: "Withings",  icon: "⚖️", description: "Connect your smart scale for body composition tracking", href: "/health/settings/integrations", available: true},
    { key: "alpaca",    label: "Alpaca",    icon: "📈", description: "Paper trade stocks while you learn — no real money needed", href: "/investments/stocks", available: true },
  ],
  student: [
    { key: "oura",      label: "Oura Ring", icon: "💍", description: "Track sleep and recovery — critical for academic performance", href: "/health/settings/integrations", available: true},
    { key: "lsat",      label: "LSAT Prep", icon: "📝", description: "Set up your LSAT practice schedule and target score", href: "/career/lsat", available: true },
    { key: "career",    label: "Career Profile", icon: "◈", description: "Upload your resume and complete the career assessment", href: "/career/profile", available: true },
  ],
  individual: [
    { key: "plaid",     label: "Plaid",     icon: "🏦", description: "Connect bank accounts and credit cards for automatic finance sync", href: "/finance/dashboard?connect=true", available: true },
    { key: "oura",      label: "Oura Ring", icon: "💍", description: "Sync sleep, HRV, and readiness scores from your Oura ring", href: "/health/settings/integrations", available: true},
    { key: "alpaca",    label: "Alpaca",    icon: "📈", description: "Paper trade stocks while you learn — no real money needed", href: "/investments/stocks", available: true },
    { key: "career",    label: "Career Profile", icon: "◈", description: "Upload your resume and set your career goals to activate the AI advisor", href: "/career/profile", available: true },
  ],
};

const INTEGRATION_ICON: Record<string, Glyph> = {
  plaid: Icons.WalletIcon,
  oura: Icons.HeartIcon,
  withings: Icons.ChartIcon,
  alpaca: Icons.TrendUpIcon,
  lsat: Icons.BookIcon,
  career: Icons.BriefcaseIcon,
};

function CheckMark({ color = "var(--ios-tint)" }: { color?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 6.5" />
    </svg>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 40 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{ height: 3, width: 40, borderRadius: 2, background: i < step ? "var(--ios-tint)" : "var(--ios-separator)", transition: "background 0.3s" }} />
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
  const [step, setStep] = useState(1);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [profile, setProfile] = useState<Profile>({ displayName: initialName, locationName: initialLocation });
  const [modules, setModules] = useState<Set<ModuleKey>>(new Set());
  const [saving, setSaving] = useState(false);

  // Interests — all optional; new users capture their own so they don't inherit defaults.
  const [zip, setZip] = useState("");
  const [resolvingZip, setResolvingZip] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  const [stocksInput, setStocksInput] = useState("");
  const [employerInput, setEmployerInput] = useState("");

  async function handleResolveZip() {
    if (!zip.trim()) return;
    setResolvingZip(true);
    setZipError(null);
    const res = await lookupZip(zip);
    setResolvingZip(false);
    if (res.error) { setZipError(res.error); return; }
    if (res.location) {
      setProfile((p) => ({
        ...p,
        locationName: res.location!.name,
        latitude: res.location!.latitude,
        longitude: res.location!.longitude,
      }));
      setZip("");
    }
  }
  const [newsTopics, setNewsTopics] = useState<Set<string>>(new Set());
  const [sportsTeams, setSportsTeams] = useState<Set<string>>(new Set());
  const [teamSearch, setTeamSearch] = useState("");

  function toggleTopic(id: string) {
    setNewsTopics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleTeam(id: string) {
    setSportsTeams((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

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
    const stockTickers = stocksInput
      .split(/[,\s]+/)
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);
    const employerTicker = employerInput.trim().toUpperCase() || null;
    const city = profile.locationName.trim();
    await completeOnboarding({
      persona: persona!,
      displayName: profile.displayName,
      locationName: profile.locationName,
      latitude: profile.latitude ?? null,
      longitude: profile.longitude ?? null,
      appAccess,
      stockTickers,
      employerTicker,
      newsTopics: Array.from(newsTopics),
      sportsTeams: Array.from(sportsTeams),
      // The city captured on the profile step doubles as the local-news city.
      cityNames: city ? [city] : [],
    });
    // Hard navigation (not router.replace) so the root layout re-renders and picks
    // up the new persona — otherwise the tab bar keeps its stale "Family" state
    // until a manual reload.
    window.location.href = "/home";
  }

  const cardStyle = (selected: boolean, color = "var(--ios-tint)"): React.CSSProperties => ({
    padding: "16px 18px",
    borderRadius: "var(--ios-radius-tile)",
    border: `1.5px solid ${selected ? color : "var(--ios-separator)"}`,
    background: selected ? "var(--ios-fill)" : "var(--ios-cell)",
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
    transition: "all 0.15s",
    width: "100%",
  });

  const primaryBtn = (enabled: boolean, busy = false): React.CSSProperties => ({
    opacity: enabled ? 1 : 0.4,
    cursor: !enabled ? "not-allowed" : busy ? "wait" : "pointer",
  });

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: 10,
    border: "0.5px solid var(--ios-separator)", background: "var(--ios-cell)",
    color: "var(--ios-label)", fontSize: 17, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 13, fontWeight: 400, color: "var(--ios-label-2)",
    textTransform: "uppercase", letterSpacing: "0.02em", marginBottom: 7,
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--ios-bg)", display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 24px 80px" }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 40 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--ios-tint)", flexShrink: 0 }} />
        <span className="ios-headline" style={{ color: "var(--ios-label)" }}>morrisai</span>
        <span className="ios-headline" style={{ color: "var(--ios-tint)", fontWeight: 400 }}>.family</span>
      </div>

      <ProgressBar step={step} total={5} />

      <div style={{ width: "100%", maxWidth: 560 }}>

        {/* ── Screen 1: Who are you ── */}
        {step === 1 && (
          <div>
            <h1 className="ios-title-1" style={{ color: "var(--ios-label)", marginBottom: 6, textAlign: "center" }}>Who are you?</h1>
            <p className="ios-subhead" style={{ color: "var(--ios-label-2)", textAlign: "center", marginBottom: 28, lineHeight: 1.5 }}>
              We&rsquo;ll pre-configure the platform for your situation. You can change everything later.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {PERSONAS.map((p) => {
                const PIcon = PERSONA_ICON[p.key];
                return (
                  <button key={p.key} onClick={() => selectPersona(p.key)} style={cardStyle(persona === p.key)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                      <span className="ios-icon" style={{ background: "var(--ios-tint)" }}><PIcon /></span>
                      <div>
                        <div className="ios-headline" style={{ color: "var(--ios-label)" }}>{p.label}</div>
                        <div className="ios-caption" style={{ color: "var(--ios-tint)", fontWeight: 600, letterSpacing: "0.02em" }}>{p.tagline}</div>
                      </div>
                      {persona === p.key && <span style={{ marginLeft: "auto" }}><CheckMark /></span>}
                    </div>
                    <p className="ios-footnote" style={{ color: "var(--ios-label-2)", lineHeight: 1.4, margin: 0 }}>{p.description}</p>
                  </button>
                );
              })}
            </div>
            <button onClick={() => setStep(2)} disabled={!persona}
              className="ios-btn ios-btn--primary" style={{ marginTop: 24, ...primaryBtn(!!persona) }}>
              Continue
            </button>
          </div>
        )}

        {/* ── Screen 2: Profile ── */}
        {step === 2 && (
          <div>
            <h1 className="ios-title-1" style={{ color: "var(--ios-label)", marginBottom: 6, textAlign: "center" }}>Your profile</h1>
            <p className="ios-subhead" style={{ color: "var(--ios-label-2)", textAlign: "center", marginBottom: 28, lineHeight: 1.5 }}>
              This personalises your home screen greeting and local data like weather.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>How should we address you?</label>
                <input
                  value={profile.displayName}
                  onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))}
                  placeholder="e.g. Terry, Dad, Coach"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Your ZIP code</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={zip}
                    onChange={(e) => { setZip(e.target.value); setZipError(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleResolveZip(); } }}
                    placeholder="e.g. 46037"
                    inputMode="numeric"
                    maxLength={5}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={handleResolveZip}
                    disabled={resolvingZip || !zip.trim()}
                    className="ios-btn"
                    style={{ flexShrink: 0, background: "var(--ios-fill)", color: "var(--ios-tint)", opacity: resolvingZip || !zip.trim() ? 0.5 : 1 }}
                  >
                    {resolvingZip ? "Looking up…" : "Look up"}
                  </button>
                </div>
                <div className="ios-caption" style={{ color: zipError ? "var(--ios-red)" : "var(--ios-label-3)", marginTop: 6 }}>
                  {zipError
                    ? zipError
                    : profile.locationName
                      ? `📍 ${profile.locationName} — used for weather & local news on your home screen.`
                      : "Used for weather and local news on your home screen. Optional."}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
              <button onClick={() => setStep(1)} className="ios-btn" style={{ flex: 1, background: "var(--ios-fill)", color: "var(--ios-tint)" }}>Back</button>
              <button onClick={() => setStep(3)} disabled={!profile.displayName.trim()}
                className="ios-btn ios-btn--primary" style={{ flex: 2, ...primaryBtn(!!profile.displayName.trim()) }}>
                Continue
              </button>
            </div>
          </div>
        )}

        {/* ── Screen 3: Choose modules ── */}
        {step === 3 && (
          <div>
            <h1 className="ios-title-1" style={{ color: "var(--ios-label)", marginBottom: 6, textAlign: "center" }}>Choose your modules</h1>
            <p className="ios-subhead" style={{ color: "var(--ios-label-2)", textAlign: "center", marginBottom: 8, lineHeight: 1.5 }}>
              We&rsquo;ve pre-selected the right ones for a <strong style={{ color: "var(--ios-label)" }}>{persona}</strong>. Toggle any you want to add or remove.
            </p>
            <div className="ios-caption" style={{ color: "var(--ios-label-3)", textAlign: "center", marginBottom: 24 }}>Hub is always included as your home screen.</div>

            {/* Hub — always on */}
            <div style={{ padding: "14px 18px", borderRadius: "var(--ios-radius-tile)", border: "1.5px solid var(--ios-tint)", background: "var(--ios-fill)", marginBottom: 10, display: "flex", alignItems: "center", gap: 12 }}>
              <span className="ios-icon" style={{ background: "var(--ios-tint)" }}><Icons.HomeIcon /></span>
              <div style={{ flex: 1 }}>
                <div className="ios-headline" style={{ color: "var(--ios-label)" }}>Hub</div>
                <div className="ios-caption" style={{ color: "var(--ios-label-2)" }}>Your daily home screen — always enabled</div>
              </div>
              <span className="ios-caption" style={{ fontWeight: 600, color: "var(--ios-tint)" }}>Always on</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {MODULES.map((mod) => {
                const on = modules.has(mod.key);
                const MIcon = MODULE_ICON[mod.key];
                return (
                  <button key={mod.key} onClick={() => toggleModule(mod.key)} style={cardStyle(on, mod.dot)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span className="ios-icon" style={{ background: mod.dot }}><MIcon /></span>
                      <div style={{ flex: 1, textAlign: "left" }}>
                        <div className="ios-headline" style={{ color: "var(--ios-label)" }}>{mod.label}</div>
                        <div className="ios-caption" style={{ color: "var(--ios-label-2)", lineHeight: 1.4 }}>{mod.description}</div>
                      </div>
                      <span style={{ width: 51, height: 31, borderRadius: 999, background: on ? mod.dot : "var(--ios-fill)", transition: "background 0.2s", flexShrink: 0, position: "relative" }}>
                        <span style={{ position: "absolute", top: 2, left: on ? 22 : 2, width: 27, height: 27, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button onClick={() => setStep(2)} className="ios-btn" style={{ flex: 1, background: "var(--ios-fill)", color: "var(--ios-tint)" }}>Back</button>
              <button onClick={() => setStep(4)} className="ios-btn ios-btn--primary" style={{ flex: 2 }}>
                Continue
              </button>
            </div>
          </div>
        )}

        {/* ── Screen 4: Your interests ── */}
        {step === 4 && (
          <div>
            <h1 className="ios-title-1" style={{ color: "var(--ios-label)", marginBottom: 6, textAlign: "center" }}>Your interests</h1>
            <p className="ios-subhead" style={{ color: "var(--ios-label-2)", textAlign: "center", marginBottom: 8, lineHeight: 1.5 }}>
              These fill your home screen widgets. Everything here is optional — skip anything and add it later in Settings.
            </p>
            <div className="ios-caption" style={{ color: "var(--ios-label-3)", textAlign: "center", marginBottom: 24 }}>Nothing is pre-filled — this is all yours.</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Stocks to watch */}
              <div>
                <label style={labelStyle}>Stocks to watch</label>
                <input
                  value={stocksInput}
                  onChange={(e) => setStocksInput(e.target.value)}
                  placeholder="e.g. AAPL, MSFT, NVDA"
                  style={inputStyle}
                />
                <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 6 }}>Comma or space separated ticker symbols.</div>
              </div>

              {/* Employer ticker */}
              <div>
                <label style={labelStyle}>Your employer&rsquo;s stock ticker</label>
                <input
                  value={employerInput}
                  onChange={(e) => setEmployerInput(e.target.value.toUpperCase())}
                  placeholder="e.g. NVDA"
                  maxLength={10}
                  style={{ ...inputStyle, textTransform: "uppercase" }}
                />
                <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 6 }}>Drives the Company News widget. Leave blank to hide it.</div>
              </div>

              {/* News topics */}
              <div>
                <label style={labelStyle}>News topics</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {NEWS_TOPICS.map((t) => (
                    <Chip key={t.id} small selected={newsTopics.has(t.id)} onClick={() => toggleTopic(t.id)}>
                      {t.label}
                    </Chip>
                  ))}
                </div>
              </div>

              {/* Sports teams — searchable across every league */}
              <div>
                <label style={labelStyle}>Sports teams</label>
                <input
                  value={teamSearch}
                  onChange={(e) => setTeamSearch(e.target.value)}
                  placeholder="Search any team — e.g. Colts, Lakers, Alabama"
                  style={inputStyle}
                />
                {/* Your picks */}
                {sportsTeams.size > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                    {Array.from(sportsTeams).map((teamId) => (
                      <Chip key={teamId} small selected onClick={() => toggleTeam(teamId)}>
                        {getTeamInfo(teamId)?.name ?? teamId} ✕
                      </Chip>
                    ))}
                  </div>
                )}
                {/* Search results, grouped by league */}
                {teamSearch.trim() ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 10 }}>
                    {Object.entries(AVAILABLE_SPORTS_TEAMS).map(([league, teams]) => {
                      const q = teamSearch.trim().toLowerCase();
                      const matches = teams.filter(
                        (t) =>
                          t.name.toLowerCase().includes(q) ||
                          t.fullName.toLowerCase().includes(q) ||
                          t.code.toLowerCase().includes(q) ||
                          league.toLowerCase().includes(q)
                      );
                      if (!matches.length) return null;
                      return (
                        <div key={league}>
                          <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>{league}</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {matches.map((team) => {
                              const teamId = `${league}:${team.code}`;
                              return (
                                <Chip key={teamId} small selected={sportsTeams.has(teamId)} onClick={() => toggleTeam(teamId)}>
                                  {team.name}
                                </Chip>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 8 }}>
                    Search across MLB, NFL, NBA, WNBA, NHL, and major college programs to follow your teams. Optional.
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
              <button onClick={() => setStep(3)} className="ios-btn" style={{ flex: 1, background: "var(--ios-fill)", color: "var(--ios-tint)" }}>Back</button>
              <button onClick={() => setStep(5)} className="ios-btn ios-btn--primary" style={{ flex: 2 }}>
                Continue
              </button>
            </div>
          </div>
        )}

        {/* ── Screen 5: Integrations ── */}
        {step === 5 && persona && (
          <div>
            <h1 className="ios-title-1" style={{ color: "var(--ios-label)", marginBottom: 6, textAlign: "center" }}>Connect your first integrations</h1>
            <p className="ios-subhead" style={{ color: "var(--ios-label-2)", textAlign: "center", marginBottom: 8, lineHeight: 1.5 }}>
              These are the most impactful connections for a <strong style={{ color: "var(--ios-label)" }}>{persona}</strong>. You can skip any and connect later.
            </p>
            <div className="ios-caption" style={{ color: "var(--ios-label-3)", textAlign: "center", marginBottom: 24 }}>Each opens in a new tab — set up now or anytime later in Settings. Nothing is required to continue.</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {INTEGRATIONS[persona].map((intg) => {
                const IIcon = INTEGRATION_ICON[intg.key] ?? Icons.SparkleIcon;
                return (
                  <div key={intg.key} style={{ padding: "14px 16px", borderRadius: "var(--ios-radius-tile)", border: "1.5px solid var(--ios-separator)", background: "var(--ios-cell)", display: "flex", alignItems: "center", gap: 14 }}>
                    <span className="ios-icon" style={{ background: "var(--ios-fill)", color: "var(--ios-label-2)" }}><IIcon /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="ios-headline" style={{ color: "var(--ios-label)", marginBottom: 2 }}>{intg.label}</div>
                      <div className="ios-caption" style={{ color: "var(--ios-label-2)", lineHeight: 1.4 }}>{intg.description}</div>
                    </div>
                    {/* Opens the real setup in a new tab — the connection is only confirmed
                        there, so we never mark it "connected" here. */}
                    <a
                      href={intg.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ios-chip ios-chip--sm"
                      style={{ flexShrink: 0, whiteSpace: "nowrap" }}
                    >
                      Set up ↗
                    </a>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
              <button onClick={() => setStep(4)} className="ios-btn" style={{ flex: 1, background: "var(--ios-fill)", color: "var(--ios-tint)" }}>Back</button>
              <button onClick={finish} disabled={saving}
                className="ios-btn ios-btn--primary" style={{ flex: 2, ...primaryBtn(!saving, saving) }}>
                {saving ? "Setting up…" : "Enter the platform"}
              </button>
            </div>

            <button onClick={finish} disabled={saving} className="ios-btn ios-btn--plain" style={{ width: "100%", marginTop: 12, color: "var(--ios-label-3)" }}>
              Skip all — I&rsquo;ll set up integrations later
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
