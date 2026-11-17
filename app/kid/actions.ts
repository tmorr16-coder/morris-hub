"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import {
  currentKidDevice, lockoutSeconds, newDeviceToken, normalisePairCode, setDeviceCookie, sha256,
  UNLOCK_HOURS, validPin, verifyPin,
} from "@/app/children/_lib/kid-device";

// What the iPad itself can ask for: to be set up with a parent's code, to be
// unlocked with the child's PIN, and to lock again. Nothing here needs, or
// creates, a platform sign-in.

const db = () => createServiceClient() as any;

// Pairing codes are 8 characters from a 31-letter alphabet and live for 15
// minutes, so guessing one is hopeless; this just keeps a script from trying.
const attempts = new Map<string, number[]>();
function allow(key: string, limit = 10, windowMs = 10 * 60_000): boolean {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) return false;
  recent.push(now);
  attempts.set(key, recent);
  return true;
}

export type PairResult = { ok?: true; error?: string };

export async function pairThisDevice(raw: string): Promise<PairResult> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allow(`pair:${ip}`)) return { error: "Too many tries. Wait ten minutes and try again." };
  const code = normalisePairCode(raw);
  if (!code) return { error: "That code is 8 letters and numbers, like ABCD-2345." };

  const svc = db();
  const { data: row } = await svc.schema("hub").from("child_devices")
    .select("id, pair_expires_at, token_hash, revoked_at")
    .eq("pair_code_hash", sha256(code))
    .maybeSingle();
  if (!row || row.token_hash || row.revoked_at || !row.pair_expires_at || Date.parse(row.pair_expires_at) < Date.now()) {
    return { error: "That code didn't work. Codes last 15 minutes. Make a new one in the child's page under “iPad”." };
  }

  const token = newDeviceToken();
  // Single use: the code is cleared in the same write that stores the token,
  // and only if it is still unclaimed.
  const { data: claimed } = await svc.schema("hub").from("child_devices")
    .update({ token_hash: sha256(token), pair_code_hash: null, pair_expires_at: null, paired_at: new Date().toISOString() })
    .eq("id", row.id).is("token_hash", null)
    .select("id").maybeSingle();
  if (!claimed) return { error: "That code was already used. Make a new one." };

  await setDeviceCookie(token);
  revalidatePath("/kid");
  return { ok: true };
}

export type UnlockResult = { ok?: true; wrong?: true; lockedSeconds?: number; error?: string };

export async function unlockKidScreen(pin: string): Promise<UnlockResult> {
  const device = await currentKidDevice();
  if (!device) return { error: "This iPad isn't set up yet." };
  if (device.lockedSeconds > 0) return { lockedSeconds: device.lockedSeconds };
  if (!validPin(pin)) return { wrong: true };

  const svc = db();
  const { data: pinRow } = await svc.schema("hub").from("child_kid_pins")
    .select("pin_hash").eq("child_id", device.childId).maybeSingle();
  if (!pinRow) return { error: "A grown-up needs to choose your secret number first." };

  if (verifyPin(pin, pinRow.pin_hash)) {
    await svc.schema("hub").from("child_devices").update({
      unlocked_until: new Date(Date.now() + UNLOCK_HOURS * 3_600_000).toISOString(),
      failed_attempts: 0, locked_until: null, last_seen_at: new Date().toISOString(),
    }).eq("id", device.id);
    revalidatePath("/kid");
    return { ok: true };
  }

  const failures = device.failedAttempts + 1;
  const rest = lockoutSeconds(failures);
  await svc.schema("hub").from("child_devices").update({
    failed_attempts: failures,
    locked_until: rest ? new Date(Date.now() + rest * 1000).toISOString() : null,
  }).eq("id", device.id);
  return rest ? { wrong: true, lockedSeconds: rest } : { wrong: true };
}

/** Back to the keypad. For a grown-up handing the iPad over, or at bedtime. */
export async function lockKidScreen(): Promise<void> {
  const device = await currentKidDevice();
  if (!device) return;
  await db().schema("hub").from("child_devices").update({ unlocked_until: null }).eq("id", device.id);
  revalidatePath("/kid");
}
