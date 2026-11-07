import { ImageResponse } from "next/og";
import { parseWorkoutShare } from "@/lib/workout-sharing";

export async function GET(request: Request) {
  const summary = parseWorkoutShare(new URL(request.url).searchParams.get("s"));
  if (!summary) return new Response("Invalid summary", { status: 400 });
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", background: "#102b2b", color: "#effcf4", padding: "56px 64px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div style={{ display: "flex", color: "#9aebc0", fontSize: 22 }}>SHOWING UP TOGETHER</div>
      <div style={{ display: "flex", fontSize: 60, fontWeight: 700 }}>{summary.title}</div>
      <div style={{ display: "flex", gap: 52 }}>
        {[[summary.minutes, "MINUTES"], [summary.exercises, "EXERCISES"], [summary.sets, "SETS"], [summary.reps, "REPS"]].map(([n, label]) => <div key={label} style={{ display: "flex", flexDirection: "column", gap: 8 }}><span style={{ fontSize: 54 }}>{n}</span><span style={{ fontSize: 18, color: "#b6d9cf" }}>{label}</span></div>)}
      </div>
      <div style={{ display: "flex", fontSize: 24 }}>{summary.volume != null ? `${summary.volume.toLocaleString("en-US")} lb total volume` : "Every session counts."}</div>
      <div style={{ display: "flex", fontSize: 25, lineHeight: 1.4 }}>{summary.caption}</div>
      <div style={{ display: "flex", fontSize: 18, color: "#b6d9cf" }}>Morris AI Family · Community workout motivation</div>
    </div>, { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
