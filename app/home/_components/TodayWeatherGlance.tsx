import { cache } from "react";
import { fetchWeather } from "@/lib/weather";

/**
 * Today's weather glance, split into the two slots the tile renders.
 *
 * These exist so the Today page stops blocking on weather. `fetchWeather` hits
 * api.weather.gov twice in sequence — resolve the grid point, then fetch the
 * forecast — and awaiting it inline made the entire home screen (reminders,
 * timeline, family, everything) wait on a third-party API before any of it
 * could paint. Rendered inside <Suspense>, the page ships immediately and the
 * tile fills in when the forecast lands.
 *
 * Value and sub are separate nodes in the tile markup, so each one asks for the
 * forecast independently; `cache()` collapses that back to a single request per
 * render pass. fetchWeather also carries `next: { revalidate: 1800 }`, so most
 * loads are served from Next's fetch cache without leaving the box.
 */
const getWeather = cache(async (lat: number, lon: number) =>
  fetchWeather(lat, lon).catch(() => null)
);

export async function TodayWeatherValue({ lat, lon }: { lat: number; lon: number }) {
  const wx = await getWeather(lat, lon);
  if (!wx) return <>—</>;
  const today = wx.periods.find((p) => p.isDaytime) ?? wx.periods[0];
  const temp = wx.current.temperature ?? today?.temperature ?? null;
  return <>{temp != null ? `${Math.round(temp)}°` : "—"}</>;
}

export async function TodayWeatherSub({ lat, lon }: { lat: number; lon: number }) {
  const wx = await getWeather(lat, lon);
  if (!wx) return null;
  const today = wx.periods.find((p) => p.isDaytime) ?? wx.periods[0];
  const cond = wx.current.description || today?.shortForecast || "—";
  return <>{[cond, today ? `H ${today.temperature}°` : null].filter(Boolean).join(" · ")}</>;
}
