"use client";

import { useState } from "react";
import type { NewsItem } from "@/lib/news";
import { IconBadge, Icons } from "@/components/ios";

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
      <p className="ios-footnote" style={{ color: "var(--ios-label-3)", padding: "24px 16px", textAlign: "center" }}>
        No local stories right now.
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
    <div>
      {cities.map((city) => {
        const items = byCity[city];
        const idx = indices[city] ?? 0;
        const it = items[idx];
        if (!it) return null;
        const color = CITY_COLORS[city] ?? "var(--ios-label-2)";
        return (
          <div key={city} className="ios-cell" style={{ alignItems: "flex-start" }}>
            <span className="ios-cell-lead" style={{ marginTop: 2 }}>
              <IconBadge color={color}>
                <Icons.NewsIcon />
              </IconBadge>
            </span>
            <a
              href={it.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ios-cell-body"
              style={{ color: "inherit" }}
            >
              <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span
                  className="ios-caption"
                  style={{ color, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.04em" }}
                >
                  {city}
                </span>
                {items.length > 1 && (
                  <span className="ios-caption ios-num" style={{ color: "var(--ios-label-3)" }}>
                    {idx + 1}/{items.length}
                  </span>
                )}
              </span>
              <span
                className="ios-cell-title"
                style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.35, marginTop: 2 }}
              >
                {it.headline}
              </span>
              <span className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 2 }}>
                {it.summary}
              </span>
              <span className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 3 }}>
                {it.source}
              </span>
            </a>
            {items.length > 1 && (
              <span className="ios-cell-trail" style={{ flexDirection: "column", gap: 4 }}>
                <button onClick={() => prev(city)} style={navBtn} aria-label="Previous story">
                  <Icons.ChevronLeft width={15} height={15} />
                </button>
                <button onClick={() => next(city)} style={navBtn} aria-label="Next story">
                  <Icons.ChevronRight width={15} height={15} />
                </button>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

const navBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: "50%",
  background: "var(--ios-fill)",
  border: "none",
  color: "var(--ios-label-2)",
  cursor: "pointer",
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
