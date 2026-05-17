export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import PlatformMenu from "@/components/PlatformMenu";
import AnalyticsClient, {
  type DailyCount,
  type TokenSummary,
  type EventTotals,
} from "./_components/AnalyticsClient";

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const { data: currentProfile } = await db
    .from("profiles")
    .select("role")
    .eq("id", authUser.id)
    .maybeSingle();
  if ((currentProfile as { role: string } | null)?.role !== "admin") {
    redirect("/home");
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

  // Daily event counts (last 30 days)
  type DailyRow = { date: string; event_type: string; count: number };
  let dailyCounts: DailyCount[] = [];
  try {
    const { data } = await db.rpc("usage_daily_counts", { since: thirtyDaysAgoStr });
    dailyCounts = ((data as DailyRow[]) ?? []).map((r) => ({
      date: r.date,
      event_type: r.event_type,
      count: Number(r.count),
    }));
  } catch {
    // RPC may not exist yet — fall back to raw query
    try {
      const { data } = await db
        .from("usage_logs")
        .select("event_type, created_at")
        .gte("created_at", thirtyDaysAgoStr);

      type RawRow = { event_type: string; created_at: string };
      const buckets = new Map<string, number>();
      for (const row of (data as RawRow[]) ?? []) {
        const date = row.created_at.slice(0, 10);
        const key = `${date}::${row.event_type}`;
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }
      for (const [key, count] of buckets) {
        const [date, event_type] = key.split("::");
        dailyCounts.push({ date, event_type, count });
      }
    } catch { /* table not yet created */ }
  }

  // Token summary for this calendar month (approximates current-month cost)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  type TokenRow = { tokens_in: number | null; tokens_out: number | null };
  let tokenSummary: TokenSummary = { tokens_in: 0, tokens_out: 0, chat_count: 0 };
  try {
    const { data } = await db
      .from("usage_logs")
      .select("tokens_in, tokens_out")
      .eq("event_type", "chat")
      .gte("created_at", monthStart);
    const rows = (data as TokenRow[]) ?? [];
    tokenSummary = {
      tokens_in: rows.reduce((s, r) => s + (r.tokens_in ?? 0), 0),
      tokens_out: rows.reduce((s, r) => s + (r.tokens_out ?? 0), 0),
      chat_count: rows.length,
    };
  } catch { /* table not yet created */ }

  // Email count this month (for Resend cost)
  let resendCount30d = 0;
  try {
    const { count } = await db
      .from("usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "email")
      .gte("created_at", monthStart);
    resendCount30d = count ?? 0;
  } catch { /* table not yet created */ }

  // All-time totals by event type
  type TotalRow = { event_type: string; count: number };
  let eventTotals: EventTotals[] = [];
  try {
    const { data } = await db.rpc("usage_event_totals");
    eventTotals = ((data as TotalRow[]) ?? []).map((r) => ({
      event_type: r.event_type,
      count: Number(r.count),
    }));
  } catch {
    // Fallback: group in JS
    try {
      const { data } = await db.from("usage_logs").select("event_type");
      type ERow = { event_type: string };
      const totals = new Map<string, number>();
      for (const r of (data as ERow[]) ?? []) {
        totals.set(r.event_type, (totals.get(r.event_type) ?? 0) + 1);
      }
      eventTotals = Array.from(totals.entries())
        .map(([event_type, count]) => ({ event_type, count }))
        .sort((a, b) => b.count - a.count);
    } catch { /* table not yet created */ }
  }

  // Active users (distinct user_ids in last 30 days with at least one event)
  let activeUsers30d = 0;
  try {
    const { data } = await db
      .from("usage_logs")
      .select("user_id")
      .gte("created_at", thirtyDaysAgoStr)
      .not("user_id", "is", null);
    type URow = { user_id: string };
    activeUsers30d = new Set(((data as URow[]) ?? []).map((r) => r.user_id)).size;
  } catch { /* table not yet created */ }

  // Total user count
  let totalUsers = 0;
  try {
    const { count } = await db
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved");
    totalUsers = count ?? 0;
  } catch { /* status column may not exist yet */ }

  const menuUser = {
    name: authUser.user_metadata?.full_name ?? authUser.user_metadata?.name ?? null,
    email: authUser.email,
    avatarUrl: authUser.user_metadata?.avatar_url ?? authUser.user_metadata?.picture ?? null,
  };

  return (
    <div>
      <PlatformMenu currentApp="hub" user={menuUser} />

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 28px 80px" }}>
        <Link
          href="/home/admin"
          style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--color-ink-3)", textDecoration: "none", marginBottom: 16 }}
        >
          ← Admin
        </Link>

        <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 6 }}>
          Platform
        </div>
        <h1 className="serif" style={{ fontSize: 40, lineHeight: 1.05, marginBottom: 6 }}>
          Usage &amp; costs<span style={{ fontStyle: "italic", color: "var(--color-accent-dark)" }}>.</span>
        </h1>
        <p style={{ fontSize: 13, color: "var(--color-ink-3)", marginBottom: 24 }}>
          Daily activity trends and platform cost breakdown across all apps.
        </p>

        <AnalyticsClient
          dailyCounts={dailyCounts}
          tokenSummary={tokenSummary}
          eventTotals={eventTotals}
          activeUsers30d={activeUsers30d}
          totalUsers={totalUsers}
          resendCount30d={resendCount30d}
        />
      </main>
    </div>
  );
}
