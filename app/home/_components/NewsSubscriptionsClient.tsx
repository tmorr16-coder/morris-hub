"use client";

import { useState } from "react";
import type { RssArticle } from "@/lib/news";
import type { NewsSource } from "@/lib/prefs-shared";
import { Chip, Icons } from "@/components/ios";

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
    <div style={card}>
      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px 8px",
      }}>
        <span className="ios-headline">My Subscriptions</span>
        <a href="/home/settings#news-subscriptions" className="ios-footnote" style={{ color: "var(--ios-tint)", fontWeight: 500 }}>
          Manage
        </a>
      </div>

      {/* ── Source filter chips (only when > 1 source has articles) ── */}
      {sources.length > 1 && articles.length > 0 && (
        <div style={{
          display: "flex", gap: 8, padding: "2px 16px 10px",
          overflowX: "auto", scrollbarWidth: "none",
        }}>
          <Chip small selected={!activeSource} onClick={() => setActiveSource(null)}>
            All {articles.length}
          </Chip>
          {sources.filter((s) => countBySource[s.id]).map((s) => (
            <Chip
              key={s.id}
              small
              selected={activeSource === s.id}
              onClick={() => setActiveSource(activeSource === s.id ? null : s.id)}
            >
              {s.name} {countBySource[s.id] ?? 0}
            </Chip>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {filtered.length === 0 && (
        <div style={{ padding: "28px 16px", textAlign: "center", color: "var(--ios-label-2)" }}>
          <Icons.NewsIcon width={30} height={30} style={{ color: "var(--ios-label-3)" }} />
          <div className="ios-subhead" style={{ fontWeight: 500, margin: "8px 0 4px", color: "var(--ios-label)" }}>No articles yet</div>
          <div className="ios-footnote">
            {sources.length === 0
              ? <a href="/home/settings#news-subscriptions" style={{ color: "var(--ios-tint)" }}>Add a subscription →</a>
              : "Feeds refresh every 30 minutes."}
          </div>
        </div>
      )}

      {/* ── Article list ── */}
      <div>
        {filtered.slice(0, 8).map((article, i) => {
          const accent = SOURCE_ACCENT[article.sourceId] ?? "var(--ios-tint)";
          return (
            <a
              key={article.url + i}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ios-cell"
              style={{
                alignItems: "flex-start",
                color: "inherit",
                borderLeft: `3px solid ${accent}`,
              }}
            >
              <span className="ios-cell-body">
                {/* Meta row */}
                <span style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <span className="ios-caption" style={{ fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                    {article.sourceName}
                  </span>
                  <span className="ios-caption" style={{ color: "var(--ios-label-3)" }}>·</span>
                  <span className="ios-caption ios-num" style={{ color: "var(--ios-label-3)" }}>
                    {formatDate(article.pubDate)}
                  </span>
                </span>

                {/* Headline */}
                <span style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--ios-label)",
                  lineHeight: 1.4,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}>
                  {article.title}
                </span>

                {/* Summary preview */}
                {article.summary && (
                  <span className="ios-footnote" style={{
                    color: "var(--ios-label-2)",
                    lineHeight: 1.45,
                    marginTop: 3,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}>
                    {article.summary}
                  </span>
                )}
              </span>
            </a>
          );
        })}
      </div>

      {/* ── Quick-access footer ── */}
      {sources.length > 0 && (
        <div style={{
          borderTop: "var(--ios-hair) solid var(--ios-separator)",
          padding: "10px 16px",
          display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center",
        }}>
          <span className="ios-caption" style={{ color: "var(--ios-label-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", flexShrink: 0 }}>
            Open
          </span>
          {sources.map((s) => (
            <a
              key={s.id}
              href={s.authUrl || s.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "5px 12px", borderRadius: 999,
                background: "var(--ios-fill)",
                color: "var(--ios-label)", textDecoration: "none",
                fontSize: 13, fontWeight: 500,
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

function GoogleDot() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
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

const card: React.CSSProperties = {
  background: "var(--ios-cell)",
  borderRadius: "var(--ios-radius-card)",
  overflow: "hidden",
};
