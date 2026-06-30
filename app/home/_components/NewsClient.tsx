"use client";

import { useState } from "react";
import type { NewsItem } from "@/lib/news";

const TOPIC_COLORS: Record<string, string> = {
  politics: "#9A3B2A",
  ai: "#3B5C7F",
  claude: "#7B5BA2",
};

export default function NewsClient({
  byTopic,
}: {
  byTopic: Record<string, NewsItem[]>;
}) {
  // Track which story index is shown per topic
  const [indices, setIndices] = useState<Record<string, number>>({});

  const topics = Object.keys(byTopic).filter((t) => byTopic[t].length > 0);
  const totalItems = topics.reduce((s, t) => s + byTopic[t].length, 0);

  if (totalItems === 0) {
    return (
      <p style={{ fontSize: 13, color: "var(--color-ink-4)", padding: "30px 0", textAlign: "center" }}>
        
      </p>
    );
  }

  function next(topic: string) {
    const len = byTopic[topic].length;
    setIndices((prev) => ({ ...prev, [topic]: ((prev[topic] ?? 0) + 1) % len }));
  }
  function prev(topic: string) {
    const len = byTopic[topic].length;
    setIndices((prev) => ({ ...prev, [topic]: ((prev[topic] ?? 0) - 1 + len) % len }));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      {topics.map((topic, ti) => {
        const items = byTopic[topic];
        const idx = indices[topic] ?? 0;
        const it = items[idx];
        if (!it) return null;
        return (
          <div
            key={topic}
            style={{
              padding: "12px 0",
              borderTop: ti === 0 ? undefined : "1px solid var(--color-rule-soft)",
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
                    color: TOPIC_COLORS[topic] ?? "var(--color-ink-3)",
                  }}>
                    {topic}
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
                  <button onClick={() => prev(topic)} style={navBtn} title="Previous story">‹</button>
                  <button onClick={() => next(topic)} style={navBtn} title="Next story">›</button>
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
