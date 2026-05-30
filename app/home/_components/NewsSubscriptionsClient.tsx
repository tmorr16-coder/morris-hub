"use client";

import { useState } from "react";
import type { RssArticle } from "@/lib/news";
import type { NewsSource } from "@/lib/prefs-shared";

interface Props {
  articles: RssArticle[];
  sources: NewsSource[];
}

const SOURCE_COLORS: Record<string, string> = {
  medium:   "#000000",
  atlantic: "#C62828",
  wapo:     "#212121",
  nytimes:  "#000000",
};

const SOURCE_ICONS: Record<string, string> = {
  medium:   "M",
  atlantic: "A",
  wapo:     "WP",
  nytimes:  "NYT",
};

export default function NewsSubscriptionsClient({ articles, sources }: Props) {
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = activeSource
    ? articles.filter((a) => a.sourceId === activeSource)
    : articles;

  const card: React.CSSProperties = {
    background: "var(--color-bg-card)",
    border: "1px solid var(--color-rule)",
    borderRadius: 12,
    padding: "20px 24px",
    boxShadow: "var(--shadow-card)",
    height: "100%",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: 0,
  };

  return (
    <div style={card}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-3)" }}>
          My Subscriptions
        </div>
        <a
          href="/home/settings#news-subscriptions"
          style={{ fontSize: 11, color: "var(--color-accent)", textDecoration: "none" }}
        >
          Manage
        </a>
      </div>

      {/* Source filter tabs */}
      {sources.length > 1 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          <button
            onClick={() => setActiveSource(null)}
            style={{
              padding: "4px 10px",
              borderRadius: 20,
              border: `1px solid ${!activeSource ? "var(--color-accent)" : "var(--color-rule)"}`,
              background: !activeSource ? "var(--color-accent-soft)" : "transparent",
              color: !activeSource ? "var(--color-accent)" : "var(--color-ink-3)",
              fontSize: 11, fontWeight: 600, cursor: "pointer",
            }}
          >
            All
          </button>
          {sources.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSource(activeSource === s.id ? null : s.id)}
              style={{
                padding: "4px 10px",
                borderRadius: 20,
                border: `1px solid ${activeSource === s.id ? (SOURCE_COLORS[s.id] || "var(--color-accent)") : "var(--color-rule)"}`,
                background: activeSource === s.id ? (SOURCE_COLORS[s.id] || "var(--color-accent)") + "15" : "transparent",
                color: activeSource === s.id ? (SOURCE_COLORS[s.id] || "var(--color-accent)") : "var(--color-ink-3)",
                fontSize: 11, fontWeight: 600, cursor: "pointer",
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--color-ink-3)", gap: 8, padding: "24px 0" }}>
          <div style={{ fontSize: 28 }}>📰</div>
          <div style={{ fontSize: 13 }}>No articles loaded yet.</div>
          <div style={{ fontSize: 11 }}>RSS feeds refresh every 30 minutes.</div>
        </div>
      )}

      {/* Article list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, overflowY: "auto" }}>
        {filtered.slice(0, 8).map((article, i) => {
          const isExpanded = expanded === article.url;
          const color = SOURCE_COLORS[article.sourceId] || "var(--color-accent)";
          const icon = SOURCE_ICONS[article.sourceId] || article.sourceName[0];
          return (
            <div key={article.url + i} style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--color-rule-soft)" : "none", paddingBottom: i < filtered.length - 1 ? 12 : 0 }}>
              {/* Source badge + date */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  background: color, color: "#fff", borderRadius: 4,
                  fontSize: 8, fontWeight: 800, padding: "1px 5px", letterSpacing: "0.02em",
                  minWidth: 20,
                }}>
                  {icon}
                </span>
                <span style={{ fontSize: 10, color: "var(--color-ink-4)" }}>
                  {formatDate(article.pubDate)}
                </span>
              </div>

              {/* Title */}
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--color-ink)",
                  textDecoration: "none",
                  lineHeight: 1.4,
                  marginBottom: 4,
                }}
              >
                {article.title}
              </a>

              {/* Summary toggle */}
              {article.summary && (
                <div>
                  <button
                    onClick={() => setExpanded(isExpanded ? null : article.url)}
                    style={{ background: "none", border: "none", padding: 0, fontSize: 11, color: "var(--color-ink-3)", cursor: "pointer" }}
                  >
                    {isExpanded ? "▲ Less" : "▼ More"}
                  </button>
                  {isExpanded && (
                    <div style={{ fontSize: 12, color: "var(--color-ink-2)", lineHeight: 1.5, marginTop: 4 }}>
                      {article.summary}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick-access sign-in row */}
      {sources.length > 0 && (
        <div style={{ borderTop: "1px solid var(--color-rule-soft)", marginTop: 14, paddingTop: 12 }}>
          <div style={{ fontSize: 10, color: "var(--color-ink-4)", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Quick access
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {sources.map((s) => (
              <a
                key={s.id}
                href={s.authUrl || s.url}
                target="_blank"
                rel="noopener noreferrer"
                title={s.auth === "google" ? `Sign in to ${s.name} with Google` : `Open ${s.name}`}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "5px 10px", borderRadius: 20,
                  border: "1px solid var(--color-rule)",
                  background: "var(--color-bg)",
                  color: "var(--color-ink-2)", textDecoration: "none",
                  fontSize: 11, fontWeight: 500,
                }}
              >
                {s.auth === "google" && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                {s.name}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffH = (now.getTime() - d.getTime()) / 3600000;
    if (diffH < 1) return "just now";
    if (diffH < 24) return `${Math.round(diffH)}h ago`;
    if (diffH < 48) return "yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}
