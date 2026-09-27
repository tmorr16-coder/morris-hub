"use server";

// Pairing a phone with the native sync app, and taking one away again.

import { createHash, randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";

// No 0/O, 1/I/L: the code is read off one screen and typed into another.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_TTL_MINUTES = 10;

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export async function createPairingCode(): Promise<{ error?: string; code?: string; expiresAt?: string }> {
  // A real signed-in user, never the development fallback id.
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  // Codes this person asked for and never used are cleared, so only the
  // newest one works.
  await db.from("health_devices").delete().eq("user_id", user.id).is("token_hash", null);

  let code = "";
  for (let i = 0; i < 8; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString();
  const { error } = await db.from("health_devices").insert({
    user_id: user.id,
    pairing_code_hash: sha256(code),
    pairing_expires_at: expiresAt,
  });
  if (error) {
    if (/health_devices/.test(error.message)) return { error: "The database needs a migration first: run supabase/migrations/20260927_health_devices.sql." };
    return { error: error.message };
  }
  return { code: `${code.slice(0, 4)}-${code.slice(4)}`, expiresAt };
}

export async function revokeDevice(id: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const { error } = await db.from("health_devices")
    .update({ revoked_at: new Date().toISOString(), token_hash: null })
    .eq("id", id).eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/health/settings/integrations");
  return {};
}
