export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createServiceClient, getCurrentUser } from "@/lib/supabase/server";
import { IOSScreen, LargeTitle, TabBar } from "@/components/ios";
import { explainSyncFailure } from "@/lib/finance/explain";
import StatusClient, { type BrokenConnection, type EventGroup } from "./_components/StatusClient";

/**
 * Platform status — everything currently broken, in one place.
 *
 * The motivating problem: five connections had been failing for weeks and the
 * only way to find out was to open each integration and infer from a stale
 * timestamp. Failures were reported in three different ways (a column, the
 * console, nowhere), so there was no single question that answered "what needs
 * my attention?".
 *
 * Two sections, because they answer different questions. "Right now" reads live
 * state from the sources of truth, so it is correct even before any events have
 * accumulated. "Recent failures" reads the shared event log, which is what
 * makes previously-console-only failures visible at all.
 */
const STALE_DAYS = 5;

/**
 * Is this connection worth listing?
 *
 * A recorded failure is definitive. Beyond that, a connection that has not
 * succeeded in days is worth surfacing even with no error on file — that is the
 * case that hid for weeks, because the timestamp stopped moving at the same
 * moment the syncing did. Module scope, matching freshnessTone on the Money
 * dashboard, so the clock read stays outside the component body.
 */
/** Days since a timestamp. Module scope, same reason as needsAttention. */
function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function needsAttention(it: any): boolean {
  if (it.status === "error") return true;
  if (!it.last_synced_at) return true; // connected and never once synced
  return (Date.now() - new Date(it.last_synced_at).getTime()) / 86_400_000 > STALE_DAYS;
}

export default async function StatusPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  // Admin gate, matching the rest of /home/admin.
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") redirect("/home");

  // ── Live state ────────────────────────────────────────────────────────────
  // Read from the tables that own the truth rather than from the log, so a
  // connection that broke before the log existed still shows up.
  // scoping-ok: admin-only page (gated above) — showing every household's
  // connections is the point; a per-user view would answer the wrong question.
  const { data: itemRows } = await db
    .schema("finance")
    .from("plaid_items")
    .select("id, user_id, institution_name, status, last_synced_at, last_error, last_error_at")
    .order("last_error_at", { ascending: false, nullsFirst: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (itemRows ?? []) as any[];

  const brokenConnections: BrokenConnection[] = items
    .filter(needsAttention)
    .map((it) => {
      const why = explainSyncFailure(it.last_error ?? null);
      return {
        id: it.id as string,
        institution: (it.institution_name ?? "Unknown institution") as string,
        userId: (it.user_id ?? null) as string | null,
        status: (it.status ?? "unknown") as string,
        lastSyncedAt: (it.last_synced_at ?? null) as string | null,
        lastErrorAt: (it.last_error_at ?? null) as string | null,
        rawError: (it.last_error ?? null) as string | null,
        // Three different situations were being shown as one. A connection
        // that has never pulled is usually a new one waiting for its first
        // sync, not a broken one — reporting it in the same red as a refused
        // credential is how a healthy connection gets mistaken for a fault.
        kind: (it.status === "error" ? "failed" : it.last_synced_at ? "stale" : "never") as BrokenConnection["kind"],
        headline:
          it.status === "error"
            ? why.headline
            : it.last_synced_at
            ? "Hasn't synced recently"
            : "Waiting for its first sync",
        detail:
          it.status === "error"
            ? why.detail
            : it.last_synced_at
            ? "No failure was recorded, so this may simply be an account the provider updates rarely — or a sync that is not running."
            : "Connected, with no failure recorded. Tap Sync now on the Money dashboard to pull straight away, or leave it for the nightly run.",
        canReconnect: it.status === "error" ? why.canReconnect : false,
      };
    });

  // ── Apple Watch, per person ───────────────────────────────────────────────
  // Health Auto Export pushes to us; nothing here can fail loudly when it
  // simply stops. So the silence is the signal: a person whose watch data
  // once arrived and has not in STALE_DAYS is listed like a stale bank.
  try {
    const { data: appleRows } = await db
      .from("apple_health_metrics")
      .select("user_id, created_at")
      .eq("source", "apple_health")
      .order("created_at", { ascending: false })
      .limit(3000);
    const latestByUser = new Map<string, string>();
    for (const r of (appleRows ?? []) as { user_id: string; created_at: string }[]) {
      if (!latestByUser.has(r.user_id)) latestByUser.set(r.user_id, r.created_at);
    }
    for (const [userId, lastAt] of latestByUser) {
      if (daysSince(lastAt) <= STALE_DAYS) continue;
      brokenConnections.push({
        id: `apple-health-${userId}`,
        institution: "Apple Watch · Health Auto Export",
        userId,
        status: "stale",
        lastSyncedAt: lastAt,
        lastErrorAt: null,
        rawError: null,
        kind: "stale",
        headline: "Apple Watch data hasn't arrived recently",
        detail: "The export app only runs while the phone is unlocked and when iOS gives it background time. Open Health Auto Export and tap Export Now, or set the Shortcuts schedule under Health → Settings → Integrations.",
        canReconnect: false,
      });
    }
  } catch { /* the table is per-deployment; a missing one is not a broken watch */ }

  // A phone running the native app reports on its own. One that has been
  // paired and then falls silent is the app force-quit, signed out of, or
  // expired on the device — none of which can announce themselves.
  try {
    const { data: deviceRows } = await db
      .from("health_devices")
      .select("id, user_id, label, paired_at, last_seen_at")
      .is("revoked_at", null)
      .not("token_hash", "is", null);
    for (const d of (deviceRows ?? []) as { id: string; user_id: string; label: string | null; paired_at: string | null; last_seen_at: string | null }[]) {
      const last = d.last_seen_at ?? d.paired_at;
      if (!last || daysSince(last) <= STALE_DAYS) continue;
      brokenConnections.push({
        id: `health-device-${d.id}`,
        institution: `${d.label ?? "iPhone"} · Morris Health app`,
        userId: d.user_id,
        status: "stale",
        lastSyncedAt: d.last_seen_at,
        lastErrorAt: null,
        rawError: null,
        kind: d.last_seen_at ? "stale" : "never",
        headline: d.last_seen_at ? "This phone has stopped reporting" : "Paired, but has never reported",
        detail: "Open the Morris Health app on that phone. If it was swiped away in the app switcher iOS stops waking it; an app installed from Xcode also expires after a year and needs installing again.",
        canReconnect: false,
      });
    }
  } catch { /* health_devices arrives with a migration */ }

  // ── The shared failure log ────────────────────────────────────────────────
  // Grouped by source+subject: fifty identical nightly failures are one problem,
  // and listing them fifty times buries everything else.
  let eventGroups: EventGroup[] = [];
  let logMissing = false;
  const { data: eventRows, error: eventsError } = await db
    .schema("hub")
    .from("system_events")
    .select("id, source, subject, severity, message, occurred_at, resolved_at, user_id")
    .is("resolved_at", null)
    .order("occurred_at", { ascending: false })
    .limit(500);

  if (eventsError) {
    logMissing = true;
  } else {
    const groups = new Map<string, EventGroup>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const e of (eventRows ?? []) as any[]) {
      const key = `${e.source}:${e.subject ?? ""}:${e.message}`;
      const existing = groups.get(key);
      if (existing) {
        existing.count += 1;
        existing.firstSeen = e.occurred_at;   // rows arrive newest-first
      } else {
        groups.set(key, {
          key,
          source: e.source as string,
          subject: (e.subject ?? null) as string | null,
          severity: (e.severity ?? "error") as string,
          message: e.message as string,
          count: 1,
          firstSeen: e.occurred_at as string,
          lastSeen: e.occurred_at as string,
        });
      }
    }
    eventGroups = [...groups.values()].sort(
      (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
    );
  }

  // Names, so a failing integration points at a person rather than a UUID.
  const nameById = new Map<string, string>();
  try {
    const { data } = await db.auth.admin.listUsers({ perPage: 200 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const u of (data?.users ?? []) as any[]) {
      nameById.set(u.id, u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.email ?? u.id);
    }
  } catch { /* names are a nicety; the ids still identify the row */ }

  return (
    <IOSScreen>
      <LargeTitle
        brand
        title="Platform status"
        subtitle={
          brokenConnections.length + eventGroups.length === 0
            ? "Everything is reporting healthy"
            : `${brokenConnections.length + eventGroups.length} thing${brokenConnections.length + eventGroups.length === 1 ? "" : "s"} need attention`
        }
      />
      <div style={{ padding: "0 16px" }}>
        <StatusClient
          connections={brokenConnections}
          events={eventGroups}
          names={Object.fromEntries(nameById)}
          logMissing={logMissing}
          totalConnections={items.length}
        />
      </div>
      <div style={{ height: 12 }} />
      <TabBar current="more" currentUserId={user.id} sourceApp="hub" />
    </IOSScreen>
  );
}
