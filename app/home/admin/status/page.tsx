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
        headline: it.status === "error" ? why.headline : "Hasn't synced recently",
        detail:
          it.status === "error"
            ? why.detail
            : it.last_synced_at
            ? "No failure was recorded, so this may simply be an account the provider updates rarely — or a sync that is not running."
            : "This connection has never completed a sync since it was created.",
        canReconnect: it.status === "error" ? why.canReconnect : false,
      };
    });

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
