import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordFailure } from "@/lib/system-events";

export const runtime = "nodejs";

// The native app trades a one-time pairing code for its own token.
//
// The code was shown to a signed-in user on the integrations page and lives
// ten minutes. It is single-use: the row that held it becomes the device, and
// the code hash is cleared in the same write. The token is returned exactly
// once and only its hash is stored.

const attempts = new Map<string, number[]>();
function allow(key: string, limit = 8, windowMs = 60_000): boolean {
  const now = Date.now();
  const arr = (attempts.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) return false;
  arr.push(now);
  attempts.set(key, arr);
  return true;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!allow(ip)) return NextResponse.json({ error: "Too many attempts. Wait a minute." }, { status: 429 });

  let body: { code?: string; label?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const code = String(body.code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== 8) return NextResponse.json({ error: "That code is not the right length." }, { status: 400 });
  const label = String(body.label ?? "iPhone").slice(0, 60);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const { data: row, error } = await db.from("health_devices")
    .select("id, user_id, pairing_expires_at")
    .eq("pairing_code_hash", sha256(code))
    .is("token_hash", null)
    .is("revoked_at", null)
    .maybeSingle();
  if (error) {
    await recordFailure({ source: "apple-health", subject: "pairing", message: `Pairing lookup failed: ${error.message}` });
    return NextResponse.json({ error: "Pairing is not available right now." }, { status: 503 });
  }
  if (!row) return NextResponse.json({ error: "That code was not recognised. Ask for a new one." }, { status: 404 });
  if (!row.pairing_expires_at || new Date(row.pairing_expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "That code has expired. Ask for a new one." }, { status: 410 });
  }

  const token = randomBytes(32).toString("base64url");
  const { error: upErr } = await db.from("health_devices").update({
    label,
    token_hash: sha256(token),
    pairing_code_hash: null,
    pairing_expires_at: null,
    paired_at: new Date().toISOString(),
  }).eq("id", row.id).is("token_hash", null);
  if (upErr) return NextResponse.json({ error: "Could not finish pairing." }, { status: 500 });

  return NextResponse.json({ token, deviceId: row.id });
}
