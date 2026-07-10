import { fetchSportsData } from "@/lib/sports";
import SportsClient from "./SportsClient";

export default async function SportsWidget({ teams }: { teams: string[] }) {
  const scores = await fetchSportsData(teams);

  if (scores.length === 0) {
    return (
      <div style={card}>
        <div style={header}>
          <span className="ios-headline">Sports</span>
          <span className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>Scores</span>
        </div>
        <p className="ios-footnote" style={{ color: "var(--ios-label-3)", padding: "24px 16px", textAlign: "center" }}>
          No teams selected.
        </p>
      </div>
    );
  }

  return (
    <div style={card}>
      <div style={header}>
        <span className="ios-headline">Sports</span>
        <span className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>Scores</span>
      </div>
      <SportsClient scores={scores} />
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ios-cell)",
  borderRadius: "var(--ios-radius-card)",
  overflow: "hidden",
  minHeight: 320,
  display: "flex",
  flexDirection: "column",
};

const header: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 8,
  padding: "12px 16px 6px",
};
