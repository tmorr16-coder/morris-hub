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
      <div style={header}>
        <span className="ios-headline">Local news</span>
        <span
          className="ios-footnote ios-truncate"
          style={{ color: "var(--ios-label-2)", maxWidth: "55%" }}
        >
          {cities.join(" · ")}
        </span>
      </div>
      <CityNewsClient byCity={byCity} />
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ios-cell)",
  borderRadius: "var(--ios-radius-card)",
  overflow: "hidden",
};

const header: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 8,
  padding: "12px 16px 6px",
};
