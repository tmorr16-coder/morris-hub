"use client";

import { useState } from "react";
import type { SportsScore } from "@/lib/sports";
import { getTeamDisplayName, getLeagueFromTeamId } from "@/lib/sports-teams";

const LEAGUE_COLORS: Record<string, string> = {
  MLB: "#BD3039",
  NFL: "#003f87",
  NBA: "#C4102E",
  WNBA: "#E31937",
  COLLEGE: "#8B4513",
};

export default function SportsClient({ scores }: { scores: SportsScore[] }) {
  const [currentIdx, setCurrentIdx] = useState(0);

  if (scores.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "var(--color-ink-4)", padding: "20px 0", textAlign: "center" }}>
        No teams selected.
      </p>
    );
  }

  const current = scores[currentIdx];
  if (!current) return null;

  const league = getLeagueFromTeamId(current.teamId);
  const leagueColor = LEAGUE_COLORS[league] ?? "var(--color-ink-3)";

  function prev() {
    setCurrentIdx((prev) => (prev - 1 + scores.length) % scores.length);
  }

  function next() {
    setCurrentIdx((prev) => (prev + 1) % scores.length);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
      {/* Team Header */}
      <div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: leagueColor,
            }}
          >
            {league}
          </span>
          {scores.length > 1 && (
            <span style={{ fontSize: 9, color: "var(--color-ink-4)" }}>
              {currentIdx + 1}/{scores.length}
            </span>
          )}
        </div>

        <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-ink)", marginBottom: 12 }}>
          {current.teamName}
        </h3>

        {/* Record */}
        <div style={{ fontSize: 12, color: "var(--color-ink-2)", marginBottom: 10 }}>
          Record: <strong>{current.record}</strong>
          {current.standing && (
            <span style={{ color: "var(--color-ink-3)", marginLeft: 8 }}>• {current.standing}</span>
          )}
        </div>

        {/* Latest Game */}
        {current.latestGame && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "var(--color-ink-3)", marginBottom: 4, textTransform: "uppercase" }}>
              Latest Game
            </div>
            <div style={{ fontSize: 13, color: "var(--color-ink)" }}>
              <strong>vs {current.latestGame.opponent}</strong>
              {current.latestGame.score && (
                <span style={{ color: "var(--color-ink-2)", marginLeft: 8 }}>
                  {current.latestGame.won ? "✓" : "✗"} {current.latestGame.score}
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: "var(--color-ink-4)" }}>{current.latestGame.date}</div>
          </div>
        )}

        {/* Next Game */}
        {current.nextGame && (
          <div>
            <div style={{ fontSize: 10, color: "var(--color-ink-3)", marginBottom: 4, textTransform: "uppercase" }}>
              Next Game
            </div>
            <div style={{ fontSize: 13, color: "var(--color-ink)" }}>
              <strong>vs {current.nextGame.opponent}</strong>
            </div>
            <div style={{ fontSize: 11, color: "var(--color-ink-4)" }}>
              {current.nextGame.date}
              {current.nextGame.date && (
                <span> • {typeof current.nextGame.date === "string" && current.nextGame.date.includes(":") ? current.nextGame.date.split(" ")[1] : "TBD"}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      {scores.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--color-rule)" }}>
          <button
            onClick={prev}
            style={navBtn}
            title="Previous team"
          >
            ‹
          </button>
          <button
            onClick={next}
            style={navBtn}
            title="Next team"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}

const navBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--color-rule)",
  borderRadius: 5,
  width: 28,
  height: 28,
  fontSize: 14,
  cursor: "pointer",
  color: "var(--color-ink-3)",
  padding: 0,
  fontFamily: "inherit",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
