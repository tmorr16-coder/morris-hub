"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePreferences, lookupZip } from "../../actions";
import { ALL_WIDGETS, DEFAULT_REMINDER_CATEGORIES } from "@/lib/prefs-shared";
import { AVAILABLE_SPORTS_TEAMS } from "@/lib/sports-teams";
import { CATEGORY_LABELS } from "@/lib/investment-ideas-constants";
import type { WidgetId } from "@/lib/prefs-shared";
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
  health:    "Health Summary",
  weather:   "Weather",
  reminders: "Reminders",
  todos:     "To-dos",
  stocks:    "Stocks",
  sports:    "Sports Scores",
  lly_news:  "LLY News",
  news:      "News",
  city_news: "Local News",
  tips:      "Claude Tips",
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
        news_topics: topics,
        city_names: cities,
        sports_enabled_teams: sportsTeams,
        investment_categories: investmentCategories,
        visible_widgets: visibleWidgets,
        reminder_categories: reminderCats,
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
        <input type="text" value={tickersInput} onChange={(e) => setTickersInput(e.target.value)} placeholder="LLY, GOOGL, AMZN, NVDA, MSFT" style={input} />
        <p style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 6 }}>
          Examples: LLY · GOOGL · MSFT · NVDA · AAPL · AMZN · META · TSLA · BRK.B
        </p>
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
