import type { WorkoutShareSummary } from "@/lib/workout-sharing";

export default function WorkoutShareCard({ summary }: { summary: WorkoutShareSummary }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: 28, borderRadius: 20, background: "#102b2b", color: "#effcf4" }}>
    <span style={{ fontSize: 13, fontWeight: 700, color: "#9aebc0", letterSpacing: 1 }}>SHOWING UP TOGETHER</span>
    <h2 style={{ margin: 0, fontSize: 30, lineHeight: 1.15 }}>{summary.title}</h2>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
      {[[summary.minutes, "MINUTES"], [summary.exercises, "EXERCISES"], [summary.sets, "SETS"], [summary.reps, "REPS"]].map(([value, label]) => <div key={label} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <strong style={{ fontSize: 30 }}>{value}</strong><span style={{ fontSize: 11, color: "#b6d9cf" }}>{label}</span>
      </div>)}
    </div>
    {summary.volume != null && <span>{summary.volume.toLocaleString("en-US")} lb total volume</span>}
    {summary.caption && <p style={{ margin: 0, fontSize: 17, lineHeight: 1.5 }}>{summary.caption}</p>}
    <span style={{ fontSize: 12, color: "#b6d9cf" }}>Morris AI Family · Community workout motivation</span>
  </div>;
}
