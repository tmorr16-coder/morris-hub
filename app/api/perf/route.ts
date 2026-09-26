import { NextRequest, NextResponse } from "next/server";

// TEMPORARY sink for components/PerfBeacon.tsx. Logs the device's own timings
// so they appear in Vercel runtime logs beside the server's. Remove together.
export async function POST(req: NextRequest) {
  const ua = req.headers.get("user-agent") ?? "";
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && /Mobile/.test(ua));
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* ignore */ }
  // Numbers and booleans only, so nothing arbitrary is echoed into the logs.
  const clean: Record<string, number | boolean | string> = {};
  for (const [k, v] of Object.entries(body)) {
    if (typeof v === "number" || typeof v === "boolean") clean[k] = v;
    else if ((k === "path" || k === "type") && typeof v === "string") clean[k] = v.slice(0, 80);
  }
  console.log(JSON.stringify({ perf: "device", ios, ...clean }));
  return new NextResponse(null, { status: 204 });
}
