"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { childForGuardian } from "./children";
import { hashPin, newPairCode, pairExpiry, sha256, validPin, weakPin } from "./kid-device";

// A parent's controls for a child's own iPad: the PIN, setting up an iPad,
// and removing one. Every action re-checks that the caller is a parent of
// this child.

const db = () => createServiceClient() as any;

async function requireParent(childId: string) {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "Not signed in" as const };
  const child = await childForGuardian(db(), childId, userId);
  if (!child) return { error: "Not found" as const };
  return { userId, child };
}

const MISSING = "The iPad tables aren't in the database yet. Run supabase/migrations/20261117_kid_devices.sql in the Supabase SQL editor, then try again.";
const missingTable = (e: { code?: string; message?: string } | null) => !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache/i.test(e.message ?? ""));

export async function setKidPin(childId: string, pin: string): Promise<{ error?: string }> {
  const g = await requireParent(childId);
  if ("error" in g) return { error: g.error };
  if (!validPin(pin)) return { error: "The PIN is exactly four digits." };
  if (weakPin(pin)) return { error: "Pick something less guessable than a repeat or a run, like 1234." };
  const { error } = await db().schema("hub").from("child_kid_pins").upsert(
    { child_id: childId, pin_hash: hashPin(pin), updated_by: g.userId, updated_at: new Date().toISOString() },
    { onConflict: "child_id" },
  );
  if (missingTable(error)) return { error: MISSING };
  if (error) return { error: error.message };
  revalidatePath(`/children/${childId}`);
  return {};
}

export async function createKidPairing(childId: string, label: string): Promise<{ error?: string; code?: string; expiresAt?: string }> {
  const g = await requireParent(childId);
  if ("error" in g) return { error: g.error };
  const code = newPairCode();
  const expiresAt = pairExpiry();
  const name = String(label ?? "").trim().slice(0, 40) || "iPad";
  // Codes not used in time are just rows that never paired; clear this
  // child's stale ones so the list stays about real devices.
  await db().schema("hub").from("child_devices").delete()
    .eq("child_id", childId).is("token_hash", null).lt("pair_expires_at", new Date().toISOString());
  const { error } = await db().schema("hub").from("child_devices").insert({
    child_id: childId, label: name, created_by: g.userId, pair_code_hash: sha256(code), pair_expires_at: expiresAt,
  });
  if (missingTable(error)) return { error: MISSING };
  if (error) return { error: error.message };
  revalidatePath(`/children/${childId}`);
  return { code, expiresAt };
}

/** Takes the iPad off this child's account at once: its next request sees no device. */
export async function removeKidDevice(childId: string, deviceId: string): Promise<{ error?: string }> {
  const g = await requireParent(childId);
  if ("error" in g) return { error: g.error };
  const { error } = await db().schema("hub").from("child_devices")
    .update({ revoked_at: new Date().toISOString(), token_hash: null, pair_code_hash: null, unlocked_until: null })
    .eq("id", deviceId).eq("child_id", childId);
  if (error) return { error: error.message };
  revalidatePath(`/children/${childId}`);
  return {};
}

/** Back to the keypad on that iPad, from a parent's phone. */
export async function lockKidDevice(childId: string, deviceId: string): Promise<{ error?: string }> {
  const g = await requireParent(childId);
  if ("error" in g) return { error: g.error };
  const { error } = await db().schema("hub").from("child_devices")
    .update({ unlocked_until: null }).eq("id", deviceId).eq("child_id", childId);
  if (error) return { error: error.message };
  revalidatePath(`/children/${childId}`);
  return {};
}
