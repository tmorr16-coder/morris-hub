"use client";

import { useState } from "react";
import type { RssArticle } from "@/lib/news";
import type { NewsSource } from "@/lib/prefs-shared";

interface Props {
  articles: RssArticle[];
  sources: NewsSource[];
}

// Accent colors per publication (used for the colored left bar)
const SOURCE_ACCENT: Record<string, string> = {
  atlantic:    "#C62828",
  nytimes:     "#1a1a1a",
  "medium-tech": "#00AB6C",
  wapo:        "#1a3a6a",
};

export default function NewsSubscriptionsClient({ articles, sources }: Props) {
  const [activeSource, setActiveSource] = useState<string | null>(null);

  const filtered = activeSource
    ? articles.filter((a) => a.sourceId === activeSource)
    : articles;

  // Count articles per source for the filter tabs
  const countBySource = articles.reduce<Record<string, number>>((acc, a) => {
    acc[a.sourceId] = (acc[a.sourceId] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{
      background: "var(--color-bg-card)",
      border: "1px solid var(--color-rule)",
      borderRadius: 12,
      boxShadow: "var(--shadow-card)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 20px 12px",
        borderBottom: articles.length > 0 ? "1px solid var(--color-rule-soft)" : "none",
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-3)" }}>
          My Subscriptions
        </span>
        <a href="/home/settings#news-subscriptions" style={{ fontSize: 11, color: "var(--color-accent)", textDecoration: "none", fontWeight: 500 }}>
          Manage
        </a>
      </div>

      {/* ── Source filter tabs (only when > 1 source has articles) ── */}
      {sources.length > 1 && articles.length > 0 && (
        <div style={{
          display: "flex", gap: 0,
          borderBottom: "1px solid var(--color-rule-soft)",
          overflowX: "auto",
        }}>
          <TabButton label="All" count={articles.length} active={!activeSource} onClick={() => setActiveSource(null)} />
          {sources.filter((s) => countBySource[s.id]).map((s) => (
            <TabButton
              key={s.id}
              label={s.name}
              count={countBySource[s.id] ?? 0}
              active={activeSource === s.id}
              onClick={() => setActiveSource(activeSource === s.id ? null : s.id)}
              accent={SOURCE_ACCENT[s.id]}
            />
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {filtered.length === 0 && (
        <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--color-ink-3)" }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>📰</div>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>No articles yet</div>
          <div style={{ fontSize: 12 }}>
            {sources.length === 0
              ? <a href="/home/settings#news-subscriptions" style={{ color: "var(--color-accent)" }}>Add a subscription →</a>
              : "Feeds refresh every 30 minutes."}
          </div>
        </div>
      )}

      {/* ── Article list ── */}
      <div style={{ flex: 1 }}>
        {filtered.slice(0, 8).map((article, i) => {
          const accent = SOURCE_ACCENT[article.sourceId] ?? "var(--color-accent)";
          const isLast = i === Math.min(filtered.length, 8) - 1;
          return (
            <a
              key={article.url + i}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block",
                padding: "13px 20px 13px 16px",
                borderBottom: isLast ? "none" : "1px solid var(--color-rule-soft)",
                textDecoration: "none",
                borderLeft: `3px solid ${accent}`,
                transition: "background 120ms",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-bg-deep)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              {/* Meta row */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {article.sourceName}
                </span>
                <span style={{ fontSize: 10, color: "var(--color-ink-4)" }}>·</span>
                <span style={{ fontSize: 10, color: "var(--color-ink-4)" }}>
                  {formatDate(article.pubDate)}
                </span>
              </div>

              {/* Headline */}
              <div style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--color-ink)",
                lineHeight: 1.45,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}>
                {article.title}
              </div>

              {/* Summary preview */}
              {article.summary && (
                <div style={{
                  fontSize: 12,
                  color: "var(--color-ink-3)",
                  lineHeight: 1.5,
                  marginTop: 4,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}>
                  {article.summary}
                </div>
              )}
            </a>
          );
        })}
      </div>

      {/* ── Quick-access footer ── */}
      {sources.length > 0 && (
        <div style={{
          borderTop: "1px solid var(--color-rule-soft)",
          padding: "10px 20px",
          display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center",
          background: "var(--color-bg)",
        }}>
          <span style={{ fontSize: 10, color: "var(--color-ink-4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>
            Open
          </span>
          {sources.map((s) => (
            <a
              key={s.id}
              href={s.authUrl || s.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "4px 10px", borderRadius: 6,
                border: "1px solid var(--color-rule)",
                background: "var(--color-bg-card)",
                color: "var(--color-ink-2)", textDecoration: "none",
                fontSize: 11, fontWeight: 500,
              }}
            >
              {s.auth === "google" && <GoogleDot />}
              {s.name}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({ label, count, active, onClick, accent }: {
  label: string; count: number; active: boolean;
  onClick: () => void; accent?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "9px 14px",
        border: "none",
        borderBottom: active ? `2px solid ${accent ?? "var(--color-accent)"}` : "2px solid transparent",
        background: "transparent",
        color: active ? (accent ?? "var(--color-accent)") : "var(--color-ink-3)",
        fontSize: 12, fontWeight: active ? 700 : 500,
        cursor: "pointer", whiteSpace: "nowrap",
        transition: "color 100ms",
      }}
    >
      {label}
      {count > 0 && (
        <span style={{
          marginLeft: 5, fontSize: 10, fontWeight: 700,
          color: active ? (accent ?? "var(--color-accent)") : "var(--color-ink-4)",
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

function GoogleDot() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const diffH = (Date.now() - d.getTime()) / 3600000;
    if (diffH < 1)  return "just now";
    if (diffH < 24) return `${Math.round(diffH)}h ago`;
    if (diffH < 48) return "yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return ""; }
}
