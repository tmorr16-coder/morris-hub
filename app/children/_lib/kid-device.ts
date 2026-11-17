import "server-only";
import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { childForGuardian } from "./children";

/* eslint-disable @typescript-eslint/no-explicit-any */

// A child's own iPad.
//
// Two things together let a child in: a pairing token the iPad received when
// a parent set it up (a long random secret in an httpOnly cookie, stored here
// only as a hash), and the child's four-digit PIN. Four digits is a small
// space, so the PIN is only ever checked on a paired device, and a run of
// wrong guesses locks the keypad for longer each time.
//
// An unlocked iPad can do exactly what the child's screen does — read their
// own week, finish a job, practise a word, talk to Buddy — and nothing else.
// It is not a sign-in to the platform: there is no Supabase session on the
// device, so every other page still asks for a parent's account.

export const KID_COOKIE = "kid_device";
const COOKIE_DAYS = 400;            // as long as browsers allow
export const UNLOCK_HOURS = 12;     // a school day plus homework, then the PIN again
const PAIR_MINUTES = 15;

const db = () => createServiceClient() as any;
export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

// ── PIN ────────────────────────────────────────────────────────────────────
export function validPin(pin: unknown): pin is string {
  return typeof pin === "string" && /^\d{4}$/.test(pin);
}
/** Codes a parent should not pick: they are the first ones anyone tries. */
export function weakPin(pin: string): boolean {
  return /^(\d)\1{3}$/.test(pin) || ["0123", "1234", "2345", "3456", "4567", "5678", "6789", "9876", "4321", "1212"].includes(pin);
}
export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(pin, salt, 32).toString("hex")}`;
}
export function verifyPin(pin: string, stored: string): boolean {
  const [scheme, salt, hex] = String(stored).split("$");
  if (scheme !== "scrypt" || !salt || !hex) return false;
  const expected = Buffer.from(hex, "hex");
  const actual = scryptSync(pin, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** How long the keypad rests after this many wrong tries in a row. */
export function lockoutSeconds(failures: number): number {
  if (failures < 5) return 0;
  if (failures < 8) return 60;
  if (failures < 12) return 15 * 60;
  return 60 * 60;
}

// ── Pairing ────────────────────────────────────────────────────────────────
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L
export function newPairCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}
export function normalisePairCode(raw: unknown): string | null {
  const s = String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.length !== 8 || [...s].some((c) => !ALPHABET.includes(c))) return null;
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}
export const pairExpiry = () => new Date(Date.now() + PAIR_MINUTES * 60_000).toISOString();
export const newDeviceToken = () => randomBytes(32).toString("base64url");

export async function setDeviceCookie(token: string) {
  (await cookies()).set(KID_COOKIE, token, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: COOKIE_DAYS * 86_400,
  });
}

// ── The device in hand ─────────────────────────────────────────────────────
export interface KidDevice {
  id: string;
  childId: string;
  label: string;
  unlocked: boolean;
  lockedSeconds: number;
  failedAttempts: number;
}

/** The paired, unrevoked device this browser holds, or null. */
export async function currentKidDevice(): Promise<KidDevice | null> {
  const token = (await cookies()).get(KID_COOKIE)?.value;
  if (!token || token.length < 30 || token.length > 100) return null;
  const { data } = await db().schema("hub").from("child_devices")
    .select("id, child_id, label, unlocked_until, locked_until, failed_attempts, revoked_at")
    .eq("token_hash", sha256(token))
    .maybeSingle();
  if (!data || data.revoked_at) return null;
  const now = Date.now();
  return {
    id: data.id,
    childId: data.child_id,
    label: data.label,
    unlocked: !!data.unlocked_until && Date.parse(data.unlocked_until) > now,
    lockedSeconds: data.locked_until ? Math.max(0, Math.ceil((Date.parse(data.locked_until) - now) / 1000)) : 0,
    failedAttempts: data.failed_attempts ?? 0,
  };
}

/** Seen-at, at most every ten minutes, so the parent's list shows the iPad is in use. */
export async function touchKidDevice(deviceId: string): Promise<void> {
  const tenMinutesAgo = new Date(Date.now() - 600_000).toISOString();
  await db().schema("hub").from("child_devices").update({ last_seen_at: new Date().toISOString() })
    .eq("id", deviceId).or(`last_seen_at.is.null,last_seen_at.lt.${tenMinutesAgo}`);
}

export interface ChildAccess {
  via: "parent" | "kid";
  /** For rate limits: the parent, or the device. */
  rateKey: string;
  /** For records that need a user (practice log, failure log): the parent, or the child's owning parent. */
  actorUserId: string;
  child: { id: string; user_id: string; display_name: string | null; birth_year: number | null };
}

/**
 * May this request act on this child's screen? A parent (owner or co-parent)
 * always may. Otherwise only an unlocked iPad paired to this same child.
 * Used by the child's screen and nothing else.
 */
export async function childScreenAccess(childId: string): Promise<ChildAccess | null> {
  if (!/^[0-9a-f-]{36}$/i.test(childId)) return null;
  const svc = db();
  const userId = await getCurrentUserId();
  if (userId) {
    const child = await childForGuardian(svc, childId, userId);
    if (child) return { via: "parent", rateKey: userId, actorUserId: userId, child };
  }
  const device = await currentKidDevice();
  if (!device || !device.unlocked || device.childId !== childId) return null;
  const { data: child } = await svc.schema("hub").from("family_members")
    .select("id, user_id, display_name, birth_year, role").eq("id", childId).maybeSingle();
  if (!child || child.role !== "child") return null;
  return { via: "kid", rateKey: `device:${device.id}`, actorUserId: child.user_id, child };
}
