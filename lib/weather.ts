// National Weather Service (api.weather.gov) — free, no key, US-only.
// Two-step flow:
//   1. /points/{lat},{lon}  → resolves to a forecast office + gridX,gridY
//   2. /gridpoints/{office}/{x},{y}/forecast  → 7-day forecast in 12-hour periods
// Also fetch current observations from the nearest station.

export interface ForecastPeriod {
  name: string;          // "Today", "Tonight", "Monday"
  startTime: string;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: "F" | "C";
  shortForecast: string; // "Sunny", "Partly cloudy"
  detailedForecast: string;
  icon: string;
  windSpeed: string;
  windDirection: string;
  probabilityOfPrecipitation: { value: number | null };
}

export interface WeatherData {
  current: {
    temperature: number | null;
    description: string;
    icon: string;
    observedAt: string | null;
    humidity: number | null;
    windSpeed: string | null;
  };
  periods: ForecastPeriod[];   // 14 periods (today + tonight + 6 days)
  fetchedAt: string;
}

const UA = "morrisai-hub (https://morrisai.family)";

// A deadline on every outbound call on the Today path. Without one, a single
// slow or hanging upstream holds the streamed /home response open until the
// function's own 60s ceiling — and because the PWA shows its white
// background_color until that response lands, the app looks broken rather than
// slow. A missing forecast, quote or headline is a far smaller failure.
const NWS_TIMEOUT_MS = 6000;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/geo+json" },
    next: { revalidate: 1800 }, // 30 min cache
    signal: AbortSignal.timeout(NWS_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`NWS ${res.status} on ${url}`);
  return res.json();
}

interface PointsResp {
  properties: {
    forecast: string;
    forecastHourly: string;
    observationStations: string;
    relativeLocation: { properties: { city: string; state: string } };
  };
}

interface ForecastResp {
  properties: { periods: ForecastPeriod[] };
}

interface StationsResp {
  features: Array<{ id: string; properties: { stationIdentifier: string; name: string } }>;
}

interface ObservationResp {
  properties: {
    temperature: { value: number | null; unitCode: string };
    textDescription: string;
    icon: string;
    timestamp: string;
    relativeHumidity: { value: number | null };
    windSpeed: { value: number | null; unitCode: string };
  };
}

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  // Step 1: resolve grid
  const pts = await fetchJson<PointsResp>(`https://api.weather.gov/points/${lat},${lon}`);

  // Step 2: parallel fetch forecast + nearest station observation
  const [forecast, stations] = await Promise.all([
    fetchJson<ForecastResp>(pts.properties.forecast),
    fetchJson<StationsResp>(pts.properties.observationStations),
  ]);

  let current: WeatherData["current"] = {
    temperature: null,
    description: "—",
    icon: "",
    observedAt: null,
    humidity: null,
    windSpeed: null,
  };

  if (stations.features.length > 0) {
    try {
      const obs = await fetchJson<ObservationResp>(`${stations.features[0].id}/observations/latest`);
      const tempVal = obs.properties.temperature.value;
      const tempF = tempVal != null
        ? obs.properties.temperature.unitCode.includes("degC")
          ? Math.round(tempVal * 9 / 5 + 32)
          : Math.round(tempVal)
        : null;
      const windVal = obs.properties.windSpeed.value;
      const windMph = windVal != null
        ? obs.properties.windSpeed.unitCode.includes("km_h-1")
          ? Math.round(windVal * 0.621371)
          : Math.round(windVal)
        : null;
      current = {
        temperature: tempF,
        description: obs.properties.textDescription || "—",
        icon: obs.properties.icon || "",
        observedAt: obs.properties.timestamp,
        humidity: obs.properties.relativeHumidity.value != null
          ? Math.round(obs.properties.relativeHumidity.value)
          : null,
        windSpeed: windMph != null ? `${windMph} mph` : null,
      };
    } catch {
      // Station might not have recent observations — fall back to first forecast period
      const next = forecast.properties.periods[0];
      if (next) {
        current = {
          temperature: next.temperature,
          description: next.shortForecast,
          icon: next.icon,
          observedAt: null,
          humidity: null,
          windSpeed: next.windSpeed,
        };
      }
    }
  }

  return {
    current,
    periods: forecast.properties.periods.slice(0, 14),
    fetchedAt: new Date().toISOString(),
  };
}
