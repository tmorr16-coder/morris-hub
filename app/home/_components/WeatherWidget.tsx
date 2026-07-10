import type { CSSProperties } from "react";
import { fetchWeather } from "@/lib/weather";

type Glyph =
  | "storm" | "snow" | "ice" | "rain" | "drizzle" | "fog"
  | "wind" | "cloudy" | "partly" | "sunny" | "default";

function forecastGlyph(shortForecast: string): Glyph {
  const f = shortForecast.toLowerCase();
  if (f.includes("tornado"))                          return "storm";
  if (f.includes("thunder") || f.includes("t-storm")) return "storm";
  if (f.includes("hail"))                             return "snow";
  if (f.includes("blizzard") || f.includes("heavy snow")) return "snow";
  if (f.includes("snow") || f.includes("flurr"))      return "snow";
  if (f.includes("sleet") || f.includes("ice"))       return "ice";
  if (f.includes("freezing rain"))                    return "rain";
  if (f.includes("rain") || f.includes("shower"))     return "rain";
  if (f.includes("drizzle"))                          return "drizzle";
  if (f.includes("fog") || f.includes("mist"))        return "fog";
  if (f.includes("smoke") || f.includes("haze"))      return "fog";
  if (f.includes("windy") || f.includes("breezy"))    return "wind";
  if (f.includes("mostly cloudy") || f.includes("overcast")) return "cloudy";
  if (f.includes("partly cloudy") || f.includes("partly sunny")) return "partly";
  if (f.includes("mostly sunny"))                     return "partly";
  if (f.includes("sunny") || f.includes("clear"))     return "sunny";
  if (f.includes("cloud"))                            return "cloudy";
  return "default";
}

function glyphColor(g: Glyph): string {
  switch (g) {
    case "sunny": return "var(--ios-orange)";
    case "partly": return "var(--ios-orange)";
    case "storm": return "var(--ios-tint)";
    case "rain":
    case "drizzle": return "var(--ios-tint)";
    case "snow":
    case "ice": return "var(--ios-tint)";
    default: return "var(--ios-label-2)";
  }
}

function WeatherGlyph({ forecast, size = 22 }: { forecast: string; size?: number }) {
  const g = forecastGlyph(forecast);
  const s = { width: size, height: size, color: glyphColor(g), display: "block" } as CSSProperties;
  const svg = (children: React.ReactNode) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={s} aria-hidden>
      {children}
    </svg>
  );
  const cloud = <path d="M6.5 18a3.5 3.5 0 0 1 0-7 5 5 0 0 1 9.6-1.5A3.75 3.75 0 0 1 16 18H6.5Z" />;
  switch (g) {
    case "sunny":
      return svg(<><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" /></>);
    case "partly":
      return svg(<><circle cx="8" cy="8" r="3" /><path d="M8 2.5v1.5M2.5 8H4M4.4 4.4l1 1M11.6 4.4l-1 1" /><path d="M8.5 19a3 3 0 0 1 0-6 4.2 4.2 0 0 1 8 .6A3 3 0 0 1 16 19H8.5Z" /></>);
    case "cloudy":
      return svg(cloud);
    case "rain":
      return svg(<>{cloud}<path d="M8.5 20l-1 2M12 20l-1 2M15.5 20l-1 2" /></>);
    case "drizzle":
      return svg(<>{cloud}<path d="M9 20v1.5M13 20v1.5" /></>);
    case "snow":
      return svg(<>{cloud}<path d="M8.5 20.5h.01M12 21h.01M15.5 20.5h.01" /></>);
    case "ice":
      return svg(<>{cloud}<path d="M12 20v3M10.5 21.5h3" /></>);
    case "storm":
      return svg(<>{cloud}<path d="M12 19l-2 3h3l-2 3" /></>);
    case "fog":
      return svg(<path d="M4 8h16M4 12h16M6 16h12M8 20h8" />);
    case "wind":
      return svg(<path d="M4 9h9a2.5 2.5 0 1 0-2.5-2.5M4 13h13a2.5 2.5 0 1 1-2.5 2.5M4 17h7" />);
    default:
      return svg(<><path d="M12 3v11" /><circle cx="12" cy="18" r="2.5" /></>);
  }
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
        <p className="ios-footnote" style={{ color: "var(--ios-label-3)", padding: "24px 16px", textAlign: "center" }}>
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
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "6px 16px 16px" }}>
        <WeatherGlyph forecast={data.current.description} size={52} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ios-num" style={{ fontSize: 40, fontWeight: 500, lineHeight: 1, color: "var(--ios-label)" }}>
            {data.current.temperature != null ? `${data.current.temperature}°F` : "—"}
          </div>
          <div className="ios-subhead" style={{ color: "var(--ios-label)", fontWeight: 500, marginTop: 4 }}>
            {data.current.description}
          </div>
          <div className="ios-caption" style={{ color: "var(--ios-label-2)", marginTop: 2 }}>
            {[
              data.current.humidity != null ? `${data.current.humidity}% RH` : null,
              data.current.windSpeed,
            ].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>

      {/* Upcoming periods */}
      <div style={{ borderTop: "var(--ios-hair) solid var(--ios-separator)", padding: "14px 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {upcoming.map((p) => (
            <div key={p.startTime} style={{ minWidth: 0 }}>
              <div className="ios-caption" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 5 }}>
                {p.name}
              </div>
              <div style={{ marginBottom: 4 }}>
                <WeatherGlyph forecast={p.shortForecast} size={22} />
              </div>
              <div className="ios-num" style={{ fontSize: 15, color: "var(--ios-label)", fontWeight: 500, marginBottom: 2 }}>
                {p.temperature}°
              </div>
              <div className="ios-caption" style={{ color: "var(--ios-label-2)", lineHeight: 1.4, wordBreak: "break-word" }}>
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
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, padding: "12px 16px 6px" }}>
      <span className="ios-headline">{label}</span>
      <span className="ios-footnote ios-truncate" style={{ color: "var(--ios-label-2)", maxWidth: "55%" }}>
        {subtitle}
      </span>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ios-cell)",
  borderRadius: "var(--ios-radius-card)",
  overflow: "hidden",
  minHeight: 320,
};
