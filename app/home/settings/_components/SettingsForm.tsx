"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePreferences, lookupZip } from "../../actions";
import { ALL_WIDGETS, DEFAULT_REMINDER_CATEGORIES, DEFAULT_NEWS_SOURCES } from "@/lib/prefs-shared";
import { AVAILABLE_SPORTS_TEAMS } from "@/lib/sports-teams";
import { CATEGORY_LABELS } from "@/lib/investment-ideas-constants";
import type { WidgetId, NewsSource } from "@/lib/prefs-shared";
import type { Preferences } from "@/lib/prefs";

const AVAILABLE_TOPICS = [
  { id: "politics", label: "Politics" },
  { id: "ai", label: "AI" },
  { id: "claude", label: "Claude" },
  { id: "technology", label: "Technology" },
  { id: "business", label: "Business" },
  { id: "world", label: "World" },
  { id: "sports", label: "Sports" },
];

const WIDGET_LABELS: Record<WidgetId, string> = {
  health:             "Health Summary",
  weather:            "Weather",
  reminders:          "Reminders",
  todos:              "To-dos",
  stocks:             "Stocks",
  sports:             "Sports Scores",
  lly_news:           "Company News",
  news:               "News",
  city_news:          "Local News",
  news_subscriptions: "My Subscriptions",
  tips:               "Claude Tips",
  career:             "Career Development",
};

export default function SettingsForm({ initialPrefs }: { initialPrefs: Preferences }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [zip, setZip] = useState("");
  const [locationName, setLocationName] = useState(initialPrefs.location_name ?? "");
  const [latitude, setLatitude] = useState(initialPrefs.latitude ?? 0);
  const [longitude, setLongitude] = useState(initialPrefs.longitude ?? 0);
  const [resolvingZip, setResolvingZip] = useState(false);

  const [tickersInput, setTickersInput] = useState(initialPrefs.stock_tickers.join(", "));
  const [employerTicker, setEmployerTicker] = useState(initialPrefs.employer_ticker ?? "");
  const [topics, setTopics] = useState<string[]>(initialPrefs.news_topics);
  const [citiesInput, setCitiesInput] = useState(initialPrefs.city_names.join(", "));
  const [sportsTeams, setSportsTeams] = useState<string[]>(initialPrefs.sports_enabled_teams);
  const [sportsInputs, setSportsInputs] = useState<Record<string, string>>({
    MLB: "",
    NFL: "",
    NBA: "",
    WNBA: "",
    COLLEGE: "",
  });
  const [investmentCategories, setInvestmentCategories] = useState<string[]>(
    initialPrefs.investment_categories ?? ["stocks", "real_estate", "transportation", "tech", "other"]
  );
  const [visibleWidgets, setVisibleWidgets] = useState<WidgetId[]>(
    initialPrefs.visible_widgets ?? [...ALL_WIDGETS]
  );
  const [appAccess, setAppAccess] = useState<string[]>(
    initialPrefs.app_access ?? ["hub", "health", "finance", "student-success", "investments"]
  );
  const [newsSources, setNewsSources] = useState<NewsSource[]>(
    initialPrefs.news_sources?.length ? initialPrefs.news_sources : DEFAULT_NEWS_SOURCES
  );
  const [customRssName, setCustomRssName] = useState("");
  const [customRssUrl, setCustomRssUrl] = useState("");

  // Medium topic/publication — extracted from the medium source's rss URL
  const initialMediumTopic = (() => {
    const src = (initialPrefs.news_sources ?? DEFAULT_NEWS_SOURCES).find((s) => s.id === "medium");
    if (!src?.rss) return "technology";
    const tagM = src.rss.match(/medium\.com\/feed\/tag\/([^/]+)/);
    if (tagM) return tagM[1];
    const pubM = src.rss.match(/medium\.com\/feed\/([^/]+)/);
    return pubM ? pubM[1] : "technology";
  })();
  const [mediumTopic, setMediumTopic] = useState(initialMediumTopic);
  const [customMediumInput, setCustomMediumInput] = useState("");

  const AVAILABLE_MODULES = [
    { id: "hub", label: "Hub", description: "Home dashboard and core features" },
    { id: "health", label: "Health", description: "Health tracking and workouts" },
    { id: "finance", label: "Finance", description: "Budget and account management" },
    { id: "student-success", label: "Student Success", description: "Courses and study materials" },
    { id: "investments", label: "Investments", description: "Investment ideas and tracking" },
  ];

  function toggleModule(moduleId: string) {
    setAppAccess((prev) =>
      prev.includes(moduleId) ? prev.filter((m) => m !== moduleId) : [...prev, moduleId]
    );
  }

  function moveWidget(id: WidgetId, dir: -1 | 1) {
    setVisibleWidgets((prev) => {
      const idx = prev.indexOf(id);
      if (idx === -1) return prev;
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }
  const [reminderCats, setReminderCats] = useState<string[]>(
    initialPrefs.reminder_categories ?? [...DEFAULT_REMINDER_CATEGORIES]
  );
  const [newCat, setNewCat] = useState("");

  async function handleResolveZip() {
    if (!zip.trim()) return;
    setResolvingZip(true);
    setError(null);
    const res = await lookupZip(zip);
    setResolvingZip(false);
    if (res.error) { setError(res.error); return; }
    if (res.location) {
      setLocationName(res.location.name);
      setLatitude(res.location.latitude);
      setLongitude(res.location.longitude);
      setZip("");
    }
  }

  function toggleTopic(id: string) {
    setTopics((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  function toggleWidget(id: WidgetId) {
    setVisibleWidgets((prev) =>
      prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]
    );
  }

  function toggleSportsTeam(teamId: string) {
    setSportsTeams((prev) =>
      prev.includes(teamId) ? prev.filter((t) => t !== teamId) : [...prev, teamId]
    );
  }

  function addSportsTeam(league: string) {
    const input = sportsInputs[league]?.trim().toUpperCase();
    if (!input) return;

    // Handle both "TEAM_CODE" and "LEAGUE:TEAM_CODE" formats
    const teamId = input.includes(":") ? input : `${league}:${input}`;

    if (sportsTeams.includes(teamId)) return;

    setSportsTeams((prev) => [...prev, teamId]);
    setSportsInputs((prev) => ({ ...prev, [league]: "" }));
  }

  function removeSportsTeam(teamId: string) {
    setSportsTeams((prev) => prev.filter((t) => t !== teamId));
  }

  function moveSportsTeam(teamId: string, dir: -1 | 1) {
    setSportsTeams((prev) => {
      const idx = prev.indexOf(teamId);
      if (idx === -1) return prev;
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }

  function toggleNewsSource(id: string) {
    setNewsSources((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  }

  function addCustomSource() {
    const name = customRssName.trim();
    const rss  = customRssUrl.trim();
    if (!name || !rss) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, "-");
    if (newsSources.some((s) => s.id === id || s.rss === rss)) return;
    setNewsSources((prev) => [...prev, { id, name, rss, url: rss, auth: "direct", enabled: true, custom: true }]);
    setCustomRssName("");
    setCustomRssUrl("");
  }

  function removeCustomSource(id: string) {
    setNewsSources((prev) => prev.filter((s) => s.id !== id || !s.custom));
  }

  function addCat() {
    const c = newCat.trim().toLowerCase();
    if (!c || reminderCats.includes(c)) return;
    setReminderCats((prev) => [...prev, c]);
    setNewCat("");
  }

  function removeCat(c: string) {
    setReminderCats((prev) => prev.filter((x) => x !== c));
  }

  async function handleSave() {
    setError(null);
    setSavedMsg(null);
    const tickers = tickersInput
      .split(/[,\s]+/)
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);
    if (tickers.some((t) => !/^[A-Z0-9.-]{1,8}$/.test(t))) {
      setError("Tickers must be uppercase letters, numbers, dots, or dashes (e.g. LLY, BRK.B)");
      return;
    }
    const cities = citiesInput
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    startTransition(async () => {
      const res = await savePreferences({
        location_name: locationName,
        latitude,
        longitude,
        stock_tickers: tickers,
        employer_ticker: employerTicker.trim().toUpperCase() || null,
        news_topics: topics,
        city_names: cities,
        sports_enabled_teams: sportsTeams,
        investment_categories: investmentCategories,
        visible_widgets: visibleWidgets,
        reminder_categories: reminderCats,
        app_access: appAccess,
        news_sources: newsSources.map((s) =>
          s.id === "medium"
            ? { ...s, rss: `https://medium.com/feed/tag/${mediumTopic.trim() || "technology"}` }
            : s
        ),
      });
      if (res.error) setError(res.error);
      else {
        setSavedMsg("Saved");
        setTimeout(() => setSavedMsg(null), 3000);
        router.refresh();
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Widgets — toggle + reorder */}
      <section style={card}>
        <SectionHeader title="Widgets" subtitle="Toggle which boxes appear and drag them into order" />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {visibleWidgets.map((w, i) => (
            <div key={w} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--color-bg)", border: "1px solid var(--color-rule)", borderRadius: 10 }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--color-ink)" }}>{WIDGET_LABELS[w]}</span>
              <button
                onClick={() => moveWidget(w, -1)}
                disabled={i === 0}
                style={{ ...reorderBtn, opacity: i === 0 ? 0.3 : 1 }}
                title="Move up"
              >↑</button>
              <button
                onClick={() => moveWidget(w, 1)}
                disabled={i === visibleWidgets.length - 1}
                style={{ ...reorderBtn, opacity: i === visibleWidgets.length - 1 ? 0.3 : 1 }}
                title="Move down"
              >↓</button>
              <button
                onClick={() => toggleWidget(w)}
                style={{ fontSize: 11, padding: "3px 9px", borderRadius: 12, border: "1px solid var(--color-rule)", background: "transparent", color: "var(--color-red)", cursor: "pointer", fontFamily: "inherit" }}
                title="Hide this widget"
              >Hide</button>
            </div>
          ))}
          {/* Hidden widgets — add back */}
          {ALL_WIDGETS.filter((w) => !visibleWidgets.includes(w)).map((w) => (
            <div key={w} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "transparent", border: "1px dashed var(--color-rule)", borderRadius: 10, opacity: 0.6 }}>
              <span style={{ flex: 1, fontSize: 13, color: "var(--color-ink-3)" }}>{WIDGET_LABELS[w]}</span>
              <button
                onClick={() => toggleWidget(w)}
                style={{ fontSize: 11, padding: "3px 9px", borderRadius: 12, border: "1px solid var(--color-rule)", background: "transparent", color: "var(--color-accent)", cursor: "pointer", fontFamily: "inherit" }}
              >Show</button>
            </div>
          ))}
        </div>
      </section>

      {/* Module access */}
      <section style={card}>
        <SectionHeader title="App access" subtitle="Which modules you can access" />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {AVAILABLE_MODULES.map((module) => (
            <label key={module.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer", padding: "10px 12px", borderRadius: 8, background: "var(--color-bg)", border: "1px solid var(--color-rule)" }}>
              <input
                type="checkbox"
                checked={appAccess.includes(module.id)}
                onChange={() => toggleModule(module.id)}
                style={{ marginTop: 2, cursor: "pointer", width: 18, height: 18 }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-ink)" }}>{module.label}</div>
                <div style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 2 }}>{module.description}</div>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Reminder categories */}
      <section style={card}>
        <SectionHeader title="Reminder categories" subtitle="Categories that appear in the reminder add form" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {reminderCats.map((c) => (
            <span
              key={c}
              style={{
                padding: "4px 10px",
                borderRadius: 14,
                background: "var(--color-bg)",
                border: "1px solid var(--color-rule)",
                fontSize: 12,
                color: "var(--color-ink-2)",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {c.charAt(0).toUpperCase() + c.slice(1)}
              <button
                onClick={() => removeCat(c)}
                title="Remove"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--color-ink-4)",
                  padding: 0,
                  fontSize: 12,
                  lineHeight: 1,
                  fontFamily: "inherit",
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCat()}
            placeholder="Add category…"
            style={{ ...input, flex: 1 }}
          />
          <button onClick={addCat} disabled={!newCat.trim()} style={secondaryBtn}>Add</button>
        </div>
      </section>

      {/* Location */}
      <section style={card}>
        <SectionHeader title="Location" subtitle="Used for the Weather widget" />
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <Label>ZIP code</Label>
            <input type="text" value={zip} onChange={(e) => setZip(e.target.value)} placeholder="e.g. 46037" maxLength={5} style={input} />
          </div>
          <button onClick={handleResolveZip} disabled={resolvingZip || !zip.trim()} style={secondaryBtn}>
            {resolvingZip ? "Looking up…" : "Look up"}
          </button>
        </div>
        <div style={{ fontSize: 12, color: "var(--color-ink-3)" }}>
          Current: <strong style={{ color: "var(--color-ink)" }}>{locationName || "Not set"}</strong>
          {latitude !== 0 && (
            <span className="mono" style={{ color: "var(--color-ink-4)", marginLeft: 6, fontSize: 11 }}>
              ({latitude.toFixed(4)}, {longitude.toFixed(4)})
            </span>
          )}
        </div>
      </section>

      {/* Stocks */}
      <section style={card}>
        <SectionHeader title="Stocks" subtitle="Comma-separated tickers to track" />
        <Label>Tickers</Label>
        <input type="text" value={tickersInput} onChange={(e) => setTickersInput(e.target.value)} placeholder="GOOGL, AMZN, NVDA, MSFT" style={input} />
        <p style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 6 }}>
          Examples: GOOGL · MSFT · NVDA · AAPL · AMZN · META · TSLA · BRK.B
        </p>
        <div style={{ marginTop: 16 }}>
          <Label>Employer ticker <span style={{ fontWeight: 400, color: "var(--color-ink-4)" }}>(drives Company News widget)</span></Label>
          <input
            type="text"
            value={employerTicker}
            onChange={(e) => setEmployerTicker(e.target.value.toUpperCase())}
            placeholder="e.g. LLY, NVDA, JPM"
            maxLength={10}
            style={{ ...input, textTransform: "uppercase" }}
          />
          <p style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 6 }}>
            Your home screen will show a live news feed for this ticker. Leave blank to hide the widget.
          </p>
        </div>
      </section>

      {/* Cities for local news */}
      <section style={card}>
        <SectionHeader title="Local news cities" subtitle="Cities to fetch local news from" />
        <Label>Cities</Label>
        <input type="text" value={citiesInput} onChange={(e) => setCitiesInput(e.target.value)} placeholder="Indianapolis, IN, Tallahassee, FL" style={input} />
        <p style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 6 }}>
          Format: City, State (separated by commas). Examples: Indianapolis, IN · Fishers, IN · Tallahassee, FL · Perry, FL
        </p>
      </section>

      {/* Sports teams */}
      <section style={card}>
        <SectionHeader title="Sports teams" subtitle="Search and add teams to track scores" />
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {Object.entries(AVAILABLE_SPORTS_TEAMS).map(([league, teams]) => (
            <div key={league}>
              <Label>{league}</Label>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
                <input
                  type="text"
                  value={sportsInputs[league] || ""}
                  onChange={(e) => setSportsInputs((prev) => ({ ...prev, [league]: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && addSportsTeam(league)}
                  placeholder={`e.g., ${teams[0]?.code || "ATL"}`}
                  style={{ ...input, flex: 1 }}
                />
                <button onClick={() => addSportsTeam(league)} disabled={!sportsInputs[league]?.trim()} style={secondaryBtn}>
                  Add
                </button>
              </div>
              {/* Show suggested teams */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: "var(--color-ink-4)", marginBottom: 4, textTransform: "uppercase" }}>
                  Suggested
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {teams.slice(0, 5).map((team) => (
                    <button
                      key={team.code}
                      onClick={() => {
                        const teamId = `${league}:${team.code}`;
                        if (!sportsTeams.includes(teamId)) {
                          setSportsTeams((prev) => [...prev, teamId]);
                        }
                      }}
                      style={{
                        fontSize: 10,
                        padding: "3px 8px",
                        borderRadius: 6,
                        border: "1px solid var(--color-rule)",
                        background: "transparent",
                        color: "var(--color-ink-3)",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                      title={`Add ${team.fullName}`}
                    >
                      {team.code}
                    </button>
                  ))}
                </div>
              </div>
              {/* Show added teams with reorder options */}
              {sportsTeams.filter((t) => t.startsWith(`${league}:`)).length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {sportsTeams
                    .filter((t) => t.startsWith(`${league}:`))
                    .map((teamId, idx) => {
                      const leagueTeams = sportsTeams.filter((t) => t.startsWith(`${league}:`));
                      return (
                        <div
                          key={teamId}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "6px 8px",
                            background: "var(--color-accent)",
                            borderRadius: 8,
                            color: "#FFFDF8",
                            fontSize: 12,
                            fontWeight: 500,
                          }}
                        >
                          <span style={{ flex: 1 }}>{teamId.split(":")[1]}</span>
                          <button
                            onClick={() => moveSportsTeam(teamId, -1)}
                            disabled={idx === 0}
                            style={{
                              ...reorderBtn,
                              opacity: idx === 0 ? 0.3 : 1,
                              background: "rgba(255,255,255,0.2)",
                              color: "#FFFDF8",
                              border: "1px solid rgba(255,255,255,0.3)",
                              width: 20,
                              height: 20,
                              padding: 0,
                              fontSize: 10,
                            }}
                            title="Move up"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveSportsTeam(teamId, 1)}
                            disabled={idx === leagueTeams.length - 1}
                            style={{
                              ...reorderBtn,
                              opacity: idx === leagueTeams.length - 1 ? 0.3 : 1,
                              background: "rgba(255,255,255,0.2)",
                              color: "#FFFDF8",
                              border: "1px solid rgba(255,255,255,0.3)",
                              width: 20,
                              height: 20,
                              padding: 0,
                              fontSize: 10,
                            }}
                            title="Move down"
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => removeSportsTeam(teamId)}
                            style={{
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              color: "#FFFDF8",
                              padding: 0,
                              fontSize: 14,
                              lineHeight: 1,
                              fontFamily: "inherit",
                            }}
                            title="Remove"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 12 }}>
          Enter team codes (e.g., ATL for Braves, IND for Colts) or click suggested teams to add them.
        </p>
      </section>

      {/* Investment categories */}
      <section style={card}>
        <SectionHeader title="Investment categories" subtitle="Which investment categories to explore" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
            const active = investmentCategories.includes(cat);
            return (
              <button
                key={cat}
                onClick={() =>
                  setInvestmentCategories((prev) =>
                    prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
                  )
                }
                style={{
                  padding: "6px 14px",
                  borderRadius: 18,
                  border: `1px solid ${active ? "var(--color-accent)" : "var(--color-rule)"}`,
                  background: active ? "var(--color-accent)" : "transparent",
                  color: active ? "#FFFDF8" : "var(--color-ink-2)",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      {/* News Subscriptions */}
      <section id="news-subscriptions" style={card}>
        <SectionHeader title="News subscriptions" subtitle="Publications shown in the My Subscriptions widget. Toggle to enable/disable, or add any RSS feed." />

        {/* Built-in + user sources */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {newsSources.map((source) => (
            <div key={source.id} style={{
              borderRadius: 8,
              border: `1px solid ${source.enabled ? "var(--color-accent)" : "var(--color-rule)"}`,
              background: source.enabled ? "var(--color-accent-soft)" : "var(--color-bg)",
              overflow: "hidden",
            }}>
              {/* Source row */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
                <button
                  onClick={() => toggleNewsSource(source.id)}
                  style={{
                    width: 36, height: 20, borderRadius: 10, border: "none",
                    background: source.enabled ? "var(--color-accent)" : "var(--color-rule)",
                    cursor: "pointer", position: "relative", flexShrink: 0, transition: "background 150ms",
                  }}
                  aria-label={source.enabled ? "Disable" : "Enable"}
                >
                  <span style={{
                    position: "absolute", top: 2, left: source.enabled ? 18 : 2,
                    width: 16, height: 16, borderRadius: "50%", background: "#fff",
                    transition: "left 150ms",
                  }} />
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)" }}>{source.name}</div>
                  <div style={{ fontSize: 10, color: "var(--color-ink-3)" }}>
                    {source.id === "medium"
                      ? `Topic: ${mediumTopic}`
                      : source.auth === "google" ? "🔑 Sign in with Google" : source.rss}
                  </div>
                </div>
                {source.authUrl && (
                  <a href={source.authUrl} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 11, color: "var(--color-accent)", textDecoration: "none", flexShrink: 0 }}>
                    Sign in ↗
                  </a>
                )}
                {source.custom && (
                  <button onClick={() => removeCustomSource(source.id)}
                    style={{ background: "none", border: "none", color: "var(--color-red)", fontSize: 14, cursor: "pointer", flexShrink: 0 }}>
                    ✕
                  </button>
                )}
              </div>

              {/* Medium topic picker — shown inline below the Medium row */}
              {source.id === "medium" && (
                <div style={{
                  borderTop: "1px solid var(--color-rule-soft)",
                  padding: "12px 14px",
                  background: "var(--color-bg)",
                }}>
                  <div style={{ fontSize: 11, color: "var(--color-ink-3)", marginBottom: 8 }}>
                    Medium shows articles by topic or publication — not your personal reading list (Medium doesn't expose that via RSS).
                  </div>
                  {/* Preset popular topics */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    {["technology", "ai", "science", "business", "programming", "design", "health", "politics", "startups"].map((t) => (
                      <button
                        key={t}
                        onClick={() => setMediumTopic(t)}
                        style={{
                          padding: "4px 12px", borderRadius: 16, fontSize: 12,
                          border: `1px solid ${mediumTopic === t ? "var(--color-accent)" : "var(--color-rule)"}`,
                          background: mediumTopic === t ? "var(--color-accent-soft)" : "transparent",
                          color: mediumTopic === t ? "var(--color-accent)" : "var(--color-ink-2)",
                          cursor: "pointer", fontFamily: "inherit", fontWeight: mediumTopic === t ? 600 : 400,
                          textTransform: "capitalize",
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  {/* Custom publication or tag */}
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--color-ink-3)", whiteSpace: "nowrap" }}>medium.com/feed/tag/</span>
                    <input
                      value={customMediumInput}
                      onChange={(e) => setCustomMediumInput(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))}
                      placeholder={mediumTopic}
                      style={{
                        flex: 1, padding: "6px 10px", borderRadius: 6,
                        border: "1px solid var(--color-rule)", fontSize: 12,
                        fontFamily: "inherit", background: "var(--color-bg-card)",
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && customMediumInput.trim()) {
                          setMediumTopic(customMediumInput.trim());
                          setCustomMediumInput("");
                        }
                      }}
                    />
                    <button
                      onClick={() => { if (customMediumInput.trim()) { setMediumTopic(customMediumInput.trim()); setCustomMediumInput(""); } }}
                      disabled={!customMediumInput.trim()}
                      style={{
                        padding: "6px 12px", borderRadius: 6, border: "none",
                        background: customMediumInput.trim() ? "var(--color-accent)" : "var(--color-rule)",
                        color: customMediumInput.trim() ? "#fff" : "var(--color-ink-3)",
                        fontSize: 12, cursor: "pointer",
                      }}
                    >
                      Set
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 8 }}>
                    Current: medium.com/feed/tag/<strong>{mediumTopic}</strong>
                    {" · "}
                    <a
                      href={`https://medium.com/feed/tag/${mediumTopic}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ color: "var(--color-accent)", textDecoration: "none" }}
                    >
                      Preview feed ↗
                    </a>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add custom RSS feed */}
        <div style={{ borderTop: "1px solid var(--color-rule-soft)", paddingTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-ink-3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Add a custom RSS feed
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              value={customRssName}
              onChange={(e) => setCustomRssName(e.target.value)}
              placeholder="Publication name"
              style={{ flex: "1 1 140px", padding: "8px 10px", borderRadius: 7, border: "1px solid var(--color-rule)", fontSize: 12, fontFamily: "inherit", background: "var(--color-bg)" }}
            />
            <input
              value={customRssUrl}
              onChange={(e) => setCustomRssUrl(e.target.value)}
              placeholder="https://example.com/rss"
              style={{ flex: "2 1 220px", padding: "8px 10px", borderRadius: 7, border: "1px solid var(--color-rule)", fontSize: 12, fontFamily: "inherit", background: "var(--color-bg)" }}
              onKeyDown={(e) => e.key === "Enter" && addCustomSource()}
            />
            <button
              onClick={addCustomSource}
              disabled={!customRssName.trim() || !customRssUrl.trim()}
              style={{
                padding: "8px 16px", borderRadius: 7, border: "none",
                background: customRssName && customRssUrl ? "var(--color-accent)" : "var(--color-rule)",
                color: customRssName && customRssUrl ? "#FFFDF8" : "var(--color-ink-3)",
                fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Add
            </button>
          </div>
        </div>
      </section>

      {/* News topics */}
      <section style={card}>
        <SectionHeader title="News topics" subtitle="What Claude searches when refreshing the news feed" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {AVAILABLE_TOPICS.map((t) => {
            const active = topics.includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() => toggleTopic(t.id)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 18,
                  border: `1px solid ${active ? "var(--color-accent)" : "var(--color-rule)"}`,
                  background: active ? "var(--color-accent)" : "transparent",
                  color: active ? "#FFFDF8" : "var(--color-ink-2)",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Save */}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12 }}>
        {error && <span style={{ fontSize: 13, color: "var(--color-red)" }}>{error}</span>}
        {savedMsg && <span style={{ fontSize: 13, color: "var(--color-green)" }}>✓ {savedMsg}</span>}
        <button
          onClick={handleSave}
          disabled={pending}
          style={{
            padding: "10px 22px",
            borderRadius: 10,
            border: "1px solid var(--color-accent-dark)",
            background: "var(--color-accent)",
            color: "#FFFDF8",
            fontSize: 14,
            fontWeight: 500,
            fontFamily: "inherit",
            cursor: pending ? "not-allowed" : "pointer",
            opacity: pending ? 0.5 : 1,
          }}
        >
          {pending ? "Saving…" : "Save preferences"}
        </button>
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 className="serif" style={{ fontSize: 20, marginBottom: 4 }}>{title}</h2>
      <p style={{ fontSize: 12, color: "var(--color-ink-3)" }}>{subtitle}</p>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 4 }}>
      {children}
    </label>
  );
}

const card: React.CSSProperties = {
  background: "var(--color-bg-card)",
  border: "1px solid var(--color-rule)",
  borderRadius: 12,
  padding: "22px 26px",
  boxShadow: "var(--shadow-card)",
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid var(--color-rule)",
  borderRadius: 8,
  background: "var(--color-bg)",
  color: "var(--color-ink)",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

const reorderBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--color-rule)",
  borderRadius: 6,
  width: 26,
  height: 26,
  fontSize: 12,
  cursor: "pointer",
  color: "var(--color-ink-3)",
  padding: 0,
  fontFamily: "inherit",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const secondaryBtn: React.CSSProperties = {
  padding: "9px 16px",
  borderRadius: 8,
  border: "1px solid var(--color-rule)",
  background: "var(--color-bg-card)",
  color: "var(--color-ink-2)",
  fontSize: 13,
  fontWeight: 500,
  fontFamily: "inherit",
  cursor: "pointer",
  whiteSpace: "nowrap",
};
