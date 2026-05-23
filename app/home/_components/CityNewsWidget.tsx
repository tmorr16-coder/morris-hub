import { fetchCityNews } from "@/lib/news";
import CityNewsClient from "./CityNewsClient";

export default async function CityNewsWidget({ cities }: { cities: string[] }) {
  const items = await fetchCityNews(cities);

  // Group by city, keep up to 5 per city for the client-side next/prev
  const byCity: Record<string, typeof items> = {};
  for (const it of items) {
    if (!byCity[it.topic]) byCity[it.topic] = [];
    if (byCity[it.topic].length < 5) byCity[it.topic].push(it);
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 className="serif" style={{ fontSize: 22 }}>
          Local <span style={{ fontStyle: "italic", color: "var(--color-accent-dark)" }}>news</span>
        </h2>
        <span style={{ fontSize: 10, color: "var(--color-ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {cities.join(" · ")}
        </span>
      </div>
      <CityNewsClient byCity={byCity} />
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--color-bg-card)",
  border: "1px solid var(--color-rule)",
  borderRadius: 12,
  padding: "20px 24px",
  boxShadow: "var(--shadow-card)",
  height: "100%",
  boxSizing: "border-box",
};
