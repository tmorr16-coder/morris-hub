import { fetchWeather } from "@/lib/weather";

function forecastEmoji(shortForecast: string): string {
  const f = shortForecast.toLowerCase();
  if (f.includes("tornado"))                          return "🌪️";
  if (f.includes("thunder") || f.includes("t-storm")) return "⛈️";
  if (f.includes("hail"))                             return "🌨️";
  if (f.includes("blizzard") || f.includes("heavy snow")) return "❄️";
  if (f.includes("snow") || f.includes("flurr"))      return "🌨️";
  if (f.includes("sleet") || f.includes("ice"))       return "🧊";
  if (f.includes("freezing rain"))                    return "🌧️";
  if (f.includes("rain") || f.includes("shower"))     return "🌧️";
  if (f.includes("drizzle"))                          return "🌦️";
  if (f.includes("fog") || f.includes("mist"))        return "🌫️";
  if (f.includes("smoke") || f.includes("haze"))      return "😶‍🌫️";
  if (f.includes("windy") || f.includes("breezy"))    return "💨";
  if (f.includes("mostly cloudy") || f.includes("overcast")) return "☁️";
  if (f.includes("partly cloudy") || f.includes("partly sunny")) return "⛅";
  if (f.includes("mostly sunny"))                     return "🌤️";
  if (f.includes("sunny") || f.includes("clear"))     return "☀️";
  if (f.includes("cloud"))                            return "☁️";
  return "🌡️";
}

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
        <Header label="Weather" subtitle={locationName} />
        <p style={{ fontSize: 13, color: "var(--color-ink-4)", padding: "20px 0", textAlign: "center" }}>
          Weather unavailable: {(e as Error).message}
        </p>
      </div>
    );
  }

  const upcoming = data.periods.slice(1, 7);

  return (
    <div style={card}>
      <Header label="Weather" subtitle={locationName} />

      {/* Current */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 44, lineHeight: 1 }}>
          {forecastEmoji(data.current.description)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono" style={{ fontSize: 36, fontWeight: 500, lineHeight: 1, color: "var(--color-ink)" }}>
            {data.current.temperature != null ? `${data.current.temperature}°F` : "—"}
          </div>
          <div style={{ fontSize: 13, color: "var(--color-ink)", fontWeight: 500, marginTop: 2 }}>
            {data.current.description}
          </div>
          <div style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 2 }}>
            {[
              data.current.humidity != null ? `${data.current.humidity}% RH` : null,
              data.current.windSpeed,
            ].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>

      {/* Upcoming periods */}
      <div style={{ borderTop: "1px solid var(--color-rule-soft)", paddingTop: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {upcoming.map((p) => (
            <div key={p.startTime} style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, color: "var(--color-ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>
                {p.name}
              </div>
              <div style={{ fontSize: 18, marginBottom: 2 }}>
                {forecastEmoji(p.shortForecast)}
              </div>
              <div className="mono" style={{ fontSize: 15, color: "var(--color-ink)", fontWeight: 500, marginBottom: 2 }}>
                {p.temperature}°
              </div>
              <div style={{ fontSize: 10, color: "var(--color-ink-3)", lineHeight: 1.4, wordBreak: "break-word" }}>
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
  minHeight: 320,
  height: "100%",
  boxSizing: "border-box" as const,
};
