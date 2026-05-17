import { fetchWeather } from "@/lib/weather";

export default async function WeatherWidget({
  lat,
  lon,
  locationName,
}: {
  lat: number;
  lon: number;
  locationName: string;
}) {
  let data;
  try {
    data = await fetchWeather(lat, lon);
  } catch (e) {
    return (
      <div style={card}>
        <Header label="Today" subtitle={locationName} />
        <p style={{ fontSize: 13, color: "var(--color-ink-4)", padding: "20px 0", textAlign: "center" }}>
          Weather unavailable: {(e as Error).message}
        </p>
      </div>
    );
  }

  const upcoming = data.periods.slice(1, 7); // next 6 periods after current

  return (
    <div style={card}>
      <Header label="Today" subtitle={locationName} />

      {/* Current */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 16 }}>
        <div className="mono" style={{ fontSize: 48, fontWeight: 500, lineHeight: 1, color: "var(--color-ink)" }}>
          {data.current.temperature != null ? `${data.current.temperature}°` : "—"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, color: "var(--color-ink)", fontWeight: 500, marginBottom: 2 }}>
            {data.current.description}
          </div>
          <div style={{ fontSize: 11, color: "var(--color-ink-3)" }}>
            {[
              data.current.humidity != null ? `${data.current.humidity}% RH` : null,
              data.current.windSpeed,
            ].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>

      {/* Upcoming periods */}
      <div style={{ borderTop: "1px solid var(--color-rule-soft)", paddingTop: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {upcoming.map((p) => (
            <div key={p.startTime} style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, color: "var(--color-ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>
                {p.name.slice(0, 10)}
              </div>
              <div className="mono" style={{ fontSize: 16, color: "var(--color-ink)", fontWeight: 500 }}>
                {p.temperature}°
              </div>
              <div style={{ fontSize: 10, color: "var(--color-ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.shortForecast}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Header({ label, subtitle }: { label: string; subtitle: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
      <h2 className="serif" style={{ fontSize: 20 }}>{label}</h2>
      <span style={{ fontSize: 10, color: "var(--color-ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {subtitle}
      </span>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--color-bg-card)",
  border: "1px solid var(--color-rule)",
  borderRadius: 12,
  padding: "18px 20px",
  boxShadow: "var(--shadow-card)",
  minHeight: 180,
};
