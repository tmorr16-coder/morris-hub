"use client";

import { useState } from "react";
import type { NewsItem } from "@/lib/news";

const CITY_COLORS: Record<string, string> = {
  "Indianapolis, IN": "#9A3B2A",
  "Fishers, IN": "#3B5C7F",
  "Tallahassee, FL": "#7B5BA2",
  "Perry, FL": "#6B6258",
};

export default function CityNewsClient({
  byCity,
}: {
  byCity: Record<string, NewsItem[]>;
}) {
  // Track which story index is shown per city
  const [indices, setIndices] = useState<Record<string, number>>({});

  const cities = Object.keys(byCity).filter((c) => byCity[c].length > 0);
  const totalItems = cities.reduce((s, c) => s + byCity[c].length, 0);

  if (totalItems === 0) {
    return (
      <p style={{ fontSize: 13, color: "var(--color-ink-4)", padding: "30px 0", textAlign: "center" }}>
        No local news fetched yet. Refreshes on each cache miss.
      </p>
    );
  }

  function next(city: string) {
    const len = byCity[city].length;
    setIndices((prev) => ({ ...prev, [city]: ((prev[city] ?? 0) + 1) % len }));
  }
  function prev(city: string) {
    const len = byCity[city].length;
    setIndices((prev) => ({ ...prev, [city]: ((prev[city] ?? 0) - 1 + len) % len }));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      {cities.map((city, ci) => {
        const items = byCity[city];
        const idx = indices[city] ?? 0;
        const it = items[idx];
        if (!it) return null;
        return (
          <div
            key={city}
            style={{
              padding: "12px 0",
              borderTop: ci === 0 ? undefined : "1px solid var(--color-rule-soft)",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
                    color: CITY_COLORS[city] ?? "var(--color-ink-3)",
                  }}>
                    {city}
                  </span>
                  {items.length > 1 && (
                    <span style={{ fontSize: 9, color: "var(--color-ink-4)" }}>
                      {idx + 1}/{items.length}
                    </span>
                  )}
                </div>
                <a
                  href={it.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div style={{ fontSize: 13, color: "var(--color-ink)", fontWeight: 500, lineHeight: 1.4, marginBottom: 3 }}>
                    {it.headline}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-ink-3)", lineHeight: 1.5 }}>
                    {it.summary}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--color-ink-4)", marginTop: 2 }}>
                    {it.source}
                  </div>
                </a>
              </div>
              {items.length > 1 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0 }}>
                  <button onClick={() => prev(city)} style={navBtn} title="Previous story">‹</button>
                  <button onClick={() => next(city)} style={navBtn} title="Next story">›</button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const navBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--color-rule)",
  borderRadius: 5,
  width: 22,
  height: 22,
  fontSize: 13,
  cursor: "pointer",
  color: "var(--color-ink-3)",
  padding: 0,
  fontFamily: "inherit",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
