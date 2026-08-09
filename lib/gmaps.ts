// Google Maps Routes API — driving time/distance for the drive-vs-fly tool.
// Reads GOOGLE_MAPS_API_KEY (optional). Free monthly credit covers personal use.
// Docs: https://developers.google.com/maps/documentation/routes

export function gmapsConfigured(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY);
}

export interface DriveRoute {
  hours: number;
  miles: number;
}

/** Compute driving time + distance between two place/address strings. */
export async function computeDrive(origin: string, destination: string): Promise<DriveRoute | null> {
  const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY ?? "",
      "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
    },
    body: JSON.stringify({
      origin: { address: origin },
      destination: { address: destination },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_UNAWARE",
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Google Routes failed (${res.status}): ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const route = data.routes?.[0];
  if (!route) return null;
  const seconds = parseInt(String(route.duration ?? "0").replace("s", "")) || 0;
  const meters = route.distanceMeters ?? 0;
  return { hours: seconds / 3600, miles: meters / 1609.34 };
}
