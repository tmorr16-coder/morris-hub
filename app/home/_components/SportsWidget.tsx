import { fetchSportsData } from "@/lib/sports";
import SportsClient from "./SportsClient";

export default async function SportsWidget({ teams }: { teams: string[] }) {
  const scores = await fetchSportsData(teams);

  if (scores.length === 0) {
    return (
      <div style={card}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 className="serif" style={{ fontSize: 22 }}>
            <span style={{ fontStyle: "italic", color: "var(--color-accent-dark)" }}>Sports</span>
          </h2>
          <span style={{ fontSize: 10, color: "var(--color-ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            scores
          </span>
        </div>
        <p style={{ fontSize: 13, color: "var(--color-ink-4)", padding: "30px 0", textAlign: "center" }}>
          No sports data fetched yet. Refreshes on each cache miss.
        </p>
      </div>
    );
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 className="serif" style={{ fontSize: 22 }}>
          <span style={{ fontStyle: "italic", color: "var(--color-accent-dark)" }}>Sports</span>
        </h2>
        <span style={{ fontSize: 10, color: "var(--color-ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          scores
        </span>
      </div>
      <SportsClient scores={scores} />
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--color-bg-card)",
  border: "1px solid var(--color-rule)",
  borderRadius: 12,
  padding: "20px 24px",
  boxShadow: "var(--shadow-card)",
  minHeight: 320,
  height: "100%",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
};
