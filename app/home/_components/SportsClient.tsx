"use client";

import { useState } from "react";
import type { SportsScore } from "@/lib/sports";
import { getLeagueFromTeamId } from "@/lib/sports-teams";
import { Icons } from "@/components/ios";

const LEAGUE_COLORS: Record<string, string> = {
  MLB: "#BD3039",
  NFL: "#003f87",
  NBA: "#C4102E",
  WNBA: "#E31937",
  COLLEGE: "#8B4513",
};

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" width={13} height={13} aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 6.5" />
    </svg>
  );
}
function CrossIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" width={13} height={13} aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export default function SportsClient({ scores }: { scores: SportsScore[] }) {
  const [currentIdx, setCurrentIdx] = useState(0);

  if (scores.length === 0) {
    return (
      <p className="ios-footnote" style={{ color: "var(--ios-label-3)", padding: "24px 16px", textAlign: "center" }}>
        No teams selected.
      </p>
    );
  }

  const current = scores[currentIdx];
  if (!current) return null;

  const league = getLeagueFromTeamId(current.teamId);
  const leagueColor = LEAGUE_COLORS[league] ?? "var(--ios-label-2)";

  function prev() {
    setCurrentIdx((prev) => (prev - 1 + scores.length) % scores.length);
  }

  function next() {
    setCurrentIdx((prev) => (prev + 1) % scores.length);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between", padding: "6px 16px 14px" }}>
      {/* Team Header */}
      <div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <span
            className="ios-caption"
            style={{ fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: leagueColor }}
          >
            {league}
          </span>
          {scores.length > 1 && (
            <span className="ios-caption ios-num" style={{ color: "var(--ios-label-3)" }}>
              {currentIdx + 1}/{scores.length}
            </span>
          )}
        </div>

        <h3 className="ios-title-2" style={{ marginBottom: 10 }}>{current.teamName}</h3>

        {/* Record */}
        <div className="ios-subhead" style={{ color: "var(--ios-label-2)", marginBottom: 12 }}>
          Record: <strong className="ios-num" style={{ color: "var(--ios-label)" }}>{current.record}</strong>
          {current.standing && (
            <span style={{ color: "var(--ios-label-3)", marginLeft: 8 }}>• {current.standing}</span>
          )}
        </div>

        {/* Latest Game */}
        {current.latestGame && (
          <div style={{ marginBottom: 12 }}>
            <div className="ios-caption" style={{ color: "var(--ios-label-2)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Latest Game
            </div>
            <div className="ios-subhead" style={{ color: "var(--ios-label)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <strong>vs {current.latestGame.opponent}</strong>
              {current.latestGame.score && (
                <span
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, color: current.latestGame.won ? "var(--ios-green)" : "var(--ios-red)" }}
                >
                  {current.latestGame.won ? <CheckIcon /> : <CrossIcon />}
                  <span className="ios-num" style={{ color: "var(--ios-label-2)" }}>{current.latestGame.score}</span>
                </span>
              )}
            </div>
            <div className="ios-caption ios-num" style={{ color: "var(--ios-label-3)" }}>{current.latestGame.date}</div>
          </div>
        )}

        {/* Next Game */}
        {current.nextGame && (
          <div>
            <div className="ios-caption" style={{ color: "var(--ios-label-2)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Next Game
            </div>
            <div className="ios-subhead" style={{ color: "var(--ios-label)" }}>
              <strong>vs {current.nextGame.opponent}</strong>
            </div>
            <div className="ios-caption ios-num" style={{ color: "var(--ios-label-3)" }}>
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
        <div style={{ display: "flex", gap: 8, marginTop: 14, paddingTop: 14, borderTop: "var(--ios-hair) solid var(--ios-separator)" }}>
          <button onClick={prev} style={navBtn} aria-label="Previous team">
            <Icons.ChevronLeft width={16} height={16} />
          </button>
          <button onClick={next} style={navBtn} aria-label="Next team">
            <Icons.ChevronRight width={16} height={16} />
          </button>
        </div>
      )}
    </div>
  );
}

const navBtn: React.CSSProperties = {
  width: 32,
  height: 32,
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
