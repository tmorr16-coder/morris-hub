"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePreferences, lookupZip } from "../../actions";
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

export default function SettingsForm({ initialPrefs }: { initialPrefs: Preferences }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Location state
  const [zip, setZip] = useState("");
  const [locationName, setLocationName] = useState(initialPrefs.location_name ?? "");
  const [latitude, setLatitude] = useState(initialPrefs.latitude ?? 0);
  const [longitude, setLongitude] = useState(initialPrefs.longitude ?? 0);
  const [resolvingZip, setResolvingZip] = useState(false);

  // Stocks state
  const [tickersInput, setTickersInput] = useState(initialPrefs.stock_tickers.join(", "));

  // News topics state
  const [topics, setTopics] = useState<string[]>(initialPrefs.news_topics);

  async function handleResolveZip() {
    if (!zip.trim()) return;
    setResolvingZip(true);
    setError(null);
    const res = await lookupZip(zip);
    setResolvingZip(false);
    if (res.error) {
      setError(res.error);
      return;
    }
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

  async function handleSave() {
    setError(null);
    setSavedMsg(null);

    // Parse and validate tickers
    const tickers = tickersInput
      .split(/[,\s]+/)
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);

    if (tickers.some((t) => !/^[A-Z0-9.-]{1,8}$/.test(t))) {
      setError("Tickers must be uppercase letters, numbers, dots, or dashes (e.g. LLY, BRK.B)");
      return;
    }

    startTransition(async () => {
      const res = await savePreferences({
        location_name: locationName,
        latitude,
        longitude,
        stock_tickers: tickers,
        news_topics: topics,
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

      {/* Location */}
      <section style={card}>
        <SectionHeader title="Location" subtitle="Used for the Today / Weather widget" />
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <Label>ZIP code</Label>
            <input
              type="text"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="e.g. 46037"
              maxLength={5}
              style={input}
            />
          </div>
          <button onClick={handleResolveZip} disabled={resolvingZip || !zip.trim()} style={secondaryBtn}>
            {resolvingZip ? "Looking up…" : "Look up"}
          </button>
        </div>
        <div style={{ fontSize: 12, color: "var(--color-ink-3)" }}>
          Current:{" "}
          <strong style={{ color: "var(--color-ink)" }}>{locationName || "Not set"}</strong>
          {latitude !== 0 && (
            <span className="mono" style={{ color: "var(--color-ink-4)", marginLeft: 6, fontSize: 11 }}>
              ({latitude.toFixed(4)}, {longitude.toFixed(4)})
            </span>
          )}
        </div>
      </section>

      {/* Stocks */}
      <section style={card}>
        <SectionHeader title="Stocks" subtitle="Comma-separated list of tickers to track" />
        <Label>Tickers</Label>
        <input
          type="text"
          value={tickersInput}
          onChange={(e) => setTickersInput(e.target.value)}
          placeholder="LLY, GOOGL, AMZN, NVDA, MSFT"
          style={input}
        />
        <p style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 6 }}>
          Examples: LLY (Eli Lilly), GOOGL (Google), MSFT (Microsoft), NVDA (Nvidia), AAPL (Apple),
          AMZN (Amazon), META (Meta), TSLA (Tesla), BRK.B (Berkshire)
        </p>
      </section>

      {/* News topics */}
      <section style={card}>
        <SectionHeader title="News topics" subtitle="What Claude searches for when refreshing the news feed" />
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
    <label
      style={{
        display: "block",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--color-ink-3)",
        marginBottom: 4,
      }}
    >
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
