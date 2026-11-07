import { cronAuthorized } from "@/lib/security/model";
import { sendSecurityAlerts } from "@/lib/security/server";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  if (!cronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try { await sendSecurityAlerts(); return Response.json({ ok: true }); }
  catch { return Response.json({ error: "Security notifications pending; check admin tracker" }, { status: 503 }); }
}
