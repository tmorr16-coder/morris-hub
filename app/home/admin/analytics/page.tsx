export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createServiceClient, getCurrentUser } from "@/lib/supabase/server";
import { IOSScreen, LargeTitle, Group, Cell, IconBadge, Sparkline, BarRows, TabBar, Icons } from "@/components/ios";
import {
  type DailyCount,
  type TokenSummary,
  type EventTotals,
} from "./_components/AnalyticsClient";

// Cost model (mirrors AnalyticsClient) — Haiku token pricing + Resend free tier.
const HAIKU_INPUT_PER_TOKEN = 0.0000008; // $0.80 / 1M
const HAIKU_OUTPUT_PER_TOKEN = 0.000004; // $4.00 / 1M
const RESEND_FREE_TIER = 3000;
const RESEND_PRICE_PER_EMAIL = 0.001;

const EVENT_LABELS: Record<string, string> = {
  chat: "AI chats",
  email: "Emails sent",
  signup: "New signups",
  oura_sync: "Oura syncs",
  withings_sync: "Withings syncs",
  apple_sync: "Apple Health syncs",
  support_ticket: "Support tickets",
  integration_request: "Integration requests",
};

function fmtCurrency(n: number): string {
  if (n < 0.01) return "< $0.01";
  return `$${n.toFixed(2)}`;
}

export default async function AnalyticsPage() {
  const authUser = await getCurrentUser();
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

  // ── Derived presentation data ──────────────────────────────────────────────
  // Daily chat activity → sparkline points (chronological).
  const chatByDate = new Map<string, number>();
  for (const row of dailyCounts) {
    if (row.event_type === "chat") {
      chatByDate.set(row.date, (chatByDate.get(row.date) ?? 0) + row.count);
    }
  }
  const chatDates = Array.from(chatByDate.keys()).sort();
  const chatPoints = chatDates.map((d) => chatByDate.get(d) ?? 0);
  const chatTotal = chatPoints.reduce((s, n) => s + n, 0);

  const anthropicCost =
    tokenSummary.tokens_in * HAIKU_INPUT_PER_TOKEN +
    tokenSummary.tokens_out * HAIKU_OUTPUT_PER_TOKEN;
  const resendCost =
    resendCount30d > RESEND_FREE_TIER
      ? (resendCount30d - RESEND_FREE_TIER) * RESEND_PRICE_PER_EMAIL
      : 0;
  const totalCost = anthropicCost + resendCost;

  const totalBars = eventTotals.slice(0, 8).map((e) => ({
    label: EVENT_LABELS[e.event_type] ?? e.event_type,
    value: e.count,
    display: e.count.toLocaleString(),
    color: "var(--ios-tint)",
  }));

  return (
    <IOSScreen>      <LargeTitle
        title="Usage & costs"
        subtitle="Daily activity trends & platform cost breakdown"
        trailing={<Icons.ChartIcon style={{ width: 26, height: 26, color: "var(--ios-label-2)" }} />}
      />

      <Group header="Overview">
        <Cell lead={<IconBadge color="var(--ios-tint)"><Icons.PeopleIcon /></IconBadge>} title="Total users" trailing={<span className="ios-num">{totalUsers}</span>} chevron={false} />
        <Cell lead={<IconBadge color="var(--ios-green)"><Icons.PersonIcon /></IconBadge>} title="Active" subtitle="last 30 days" trailing={<span className="ios-num">{activeUsers30d}</span>} chevron={false} />
        <Cell lead={<IconBadge color="#5E5CE6"><Icons.SparkleIcon /></IconBadge>} title="AI messages" subtitle="last 30 days" trailing={<span className="ios-num">{tokenSummary.chat_count}</span>} chevron={false} />
      </Group>

      {/* Daily AI activity — sparkline hero */}
      <div className="ios-list" style={{ margin: "14px 16px 0", padding: "12px 16px 14px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div className="ios-group-header" style={{ padding: 0 }}>AI chats · last 30 days</div>
            <div className="ios-title-2 ios-num" style={{ marginTop: 2 }}>{chatTotal.toLocaleString()}</div>
          </div>
          {chatPoints.length >= 2 && <Sparkline points={chatPoints} width={132} height={44} />}
        </div>
        {chatPoints.length < 2 && (
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 6 }}>Not enough data to chart yet.</div>
        )}
      </div>

      <Group header="Variable costs — month to date">
        <Cell
          lead={<IconBadge color="#C97A3A"><Icons.SparkleIcon /></IconBadge>}
          title="Anthropic (Haiku)"
          subtitle={`${(tokenSummary.tokens_in / 1000).toFixed(1)}k in · ${(tokenSummary.tokens_out / 1000).toFixed(1)}k out`}
          trailing={<span className="ios-num">{fmtCurrency(anthropicCost)}</span>}
          chevron={false}
        />
        <Cell
          lead={<IconBadge color="#5E5CE6"><Icons.BellIcon /></IconBadge>}
          title="Resend"
          subtitle={`${resendCount30d} / ${RESEND_FREE_TIER.toLocaleString()} emails`}
          trailing={<span className="ios-num">{resendCost > 0 ? fmtCurrency(resendCost) : "Free"}</span>}
          chevron={false}
        />
        <Cell
          lead={<IconBadge color="var(--ios-finance)"><Icons.WalletIcon /></IconBadge>}
          title="Total"
          trailing={<span className="ios-num ios-headline">{fmtCurrency(totalCost)}</span>}
          chevron={false}
        />
      </Group>

      {totalBars.length > 0 && (
        <div className="ios-list" style={{ margin: "14px 16px 0", padding: "4px 0 6px" }}>
          <div className="ios-group-header" style={{ padding: "12px 16px 0" }}>All-time event totals</div>
          <BarRows items={totalBars} />
        </div>
      )}

      <div style={{ height: 12 }} />
      <TabBar current="more" currentUserId={authUser.id} sourceApp="hub" />
    </IOSScreen>
  );
}
