"use client";

import { useState } from "react";
import { Sparkline, BarRows, Chip } from "@/components/ios";

export interface DailyCount {
  date: string;
  event_type: string;
  count: number;
}

export interface TokenSummary {
  tokens_in: number;
  tokens_out: number;
  chat_count: number;
}

export interface EventTotals {
  event_type: string;
  count: number;
}

export interface AnalyticsProps {
  dailyCounts: DailyCount[];
  tokenSummary: TokenSummary;
  eventTotals: EventTotals[];
  activeUsers30d: number;
  totalUsers: number;
  resendCount30d: number;
}

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

const EVENT_COLORS: Record<string, string> = {
  chat: "#356FB0",
  email: "#6366f1",
  signup: "#34C759",
  oura_sync: "#FF9F0A",
  withings_sync: "#3b82f6",
  apple_sync: "#FF3B30",
  support_ticket: "#8b5cf6",
  integration_request: "#06b6d4",
};

const HAIKU_INPUT_PER_TOKEN  = 0.0000008;  // $0.80 / 1M
const HAIKU_OUTPUT_PER_TOKEN = 0.000004;   // $4.00 / 1M
const RESEND_FREE_TIER       = 3000;
const RESEND_PRICE_PER_EMAIL = 0.001;

// Alert thresholds
const ANTHROPIC_ALERT_THRESHOLD = 5;   // $ per month
const DAILY_CHAT_SPIKE          = 30;  // chats in one day
const RESEND_WARNING_THRESHOLD  = 2500; // approaching free tier

function fmtCurrency(n: number) {
  if (n < 0.01) return "< $0.01";
  return `$${n.toFixed(2)}`;
}

function buildChartData(dailyCounts: DailyCount[]) {
  const dateMap = new Map<string, Record<string, number>>();
  for (const row of dailyCounts) {
    if (!dateMap.has(row.date)) dateMap.set(row.date, {});
    dateMap.get(row.date)![row.event_type] = row.count;
  }
  const dates = Array.from(dateMap.keys()).sort();
  return { dates, dateMap };
}

interface BarChartProps {
  dates: string[];
  dateMap: Map<string, Record<string, number>>;
  selectedTypes: string[];
}

function MiniBarChart({ dates, dateMap, selectedTypes }: BarChartProps) {
  if (!dates.length) {
    return (
      <div className="ios-footnote" style={{ padding: "40px 0", textAlign: "center", color: "var(--ios-label-3)" }}>
        No data yet
      </div>
    );
  }

  const points = dates.map((d) => {
    const row = dateMap.get(d) ?? {};
    return selectedTypes.reduce((s, t) => s + (row[t] ?? 0), 0);
  });
  const total = points.reduce((s, v) => s + v, 0);
  const peak = Math.max(0, ...points);
  const color = selectedTypes.length === 1
    ? (EVENT_COLORS[selectedTypes[0]] ?? "var(--ios-tint)")
    : "var(--ios-tint)";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
        <span className="ios-title-2 ios-num" style={{ color: "var(--ios-label)" }}>{total.toLocaleString()}</span>
        <span className="ios-caption" style={{ color: "var(--ios-label-2)", marginLeft: "auto" }}>peak {peak.toLocaleString()}/day</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <Sparkline points={points} color={color} width={320} height={64} />
      </div>
    </div>
  );
}

export default function AnalyticsClient({
  dailyCounts,
  tokenSummary,
  eventTotals,
  activeUsers30d,
  totalUsers,
  resendCount30d,
}: AnalyticsProps) {
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["chat"]);

  const { dates, dateMap } = buildChartData(dailyCounts);

  const anthropicCost =
    tokenSummary.tokens_in  * HAIKU_INPUT_PER_TOKEN +
    tokenSummary.tokens_out * HAIKU_OUTPUT_PER_TOKEN;

  const resendCost =
    resendCount30d > RESEND_FREE_TIER
      ? (resendCount30d - RESEND_FREE_TIER) * RESEND_PRICE_PER_EMAIL
      : 0;

  const totalCost = anthropicCost + resendCost;

  // Spike detection
  const peakDailyChats = Math.max(
    0,
    ...dates.map((d) => dateMap.get(d)?.["chat"] ?? 0)
  );

  type Alert = { level: "warn" | "critical"; message: string };
  const alerts: Alert[] = [];

  if (anthropicCost >= ANTHROPIC_ALERT_THRESHOLD) {
    alerts.push({
      level: "critical",
      message: `Anthropic spend is ${fmtCurrency(anthropicCost)} this month — above the $${ANTHROPIC_ALERT_THRESHOLD} threshold.`,
    });
  }
  if (peakDailyChats >= DAILY_CHAT_SPIKE) {
    alerts.push({
      level: "warn",
      message: `${peakDailyChats} AI chats logged in a single day — unusual for a personal dashboard.`,
    });
  }
  if (resendCount30d >= RESEND_WARNING_THRESHOLD) {
    alerts.push({
      level: "warn",
      message: `${resendCount30d} emails sent this month — approaching Resend's free tier limit of ${RESEND_FREE_TIER.toLocaleString()}.`,
    });
  }

  function toggleType(t: string) {
    setSelectedTypes((prev) =>
      prev.includes(t) ? (prev.length > 1 ? prev.filter((x) => x !== t) : prev) : [...prev, t]
    );
  }

  const allTypes = Array.from(new Set(dailyCounts.map((d) => d.event_type)));

  const totalItems = eventTotals.map((row) => ({
    label: EVENT_LABELS[row.event_type] ?? row.event_type,
    value: row.count,
    display: row.count.toLocaleString(),
    color: EVENT_COLORS[row.event_type] ?? "var(--ios-label-2)",
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingBottom: 40 }}>

      {/* Alerts */}
      {alerts.map((a, i) => (
        <div
          key={i}
          className="ios-footnote"
          style={{
            background: "var(--ios-cell)",
            boxShadow: `inset 0 0 0 1px ${a.level === "critical" ? "var(--ios-red)" : "var(--ios-orange)"}`,
            borderRadius: "var(--ios-radius-card)",
            padding: "12px 16px",
            color: "var(--ios-label)",
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <span style={{ color: a.level === "critical" ? "var(--ios-red)" : "var(--ios-orange)", flexShrink: 0, display: "flex" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
          </span>
          {a.message}
        </div>
      ))}

      {/* Stat row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <StatCard label="Total users" value={String(totalUsers)} />
        <StatCard label="Active (30d)" value={String(activeUsers30d)} />
        <StatCard label="AI messages (30d)" value={String(tokenSummary.chat_count)} />
      </div>

      {/* Cost section */}
      <div style={{ background: "var(--ios-cell)", borderRadius: "var(--ios-radius-card)", padding: "16px 18px" }}>
        <div className="ios-group-header" style={{ padding: "0 0 14px" }}>
          Variable costs — this month to date
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <CostRow
            label="Anthropic (Haiku)"
            amount={fmtCurrency(anthropicCost)}
            sub={`${(tokenSummary.tokens_in / 1000).toFixed(1)}k in · ${(tokenSummary.tokens_out / 1000).toFixed(1)}k out`}
          />
          <CostRow
            label="Resend"
            amount={resendCost > 0 ? fmtCurrency(resendCost) : "Free"}
            sub={`${resendCount30d} / ${RESEND_FREE_TIER.toLocaleString()} emails`}
          />
        </div>
        <div style={{
          borderTop: "var(--ios-hair) solid var(--ios-separator)",
          paddingTop: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}>
          <span className="ios-subhead" style={{ fontWeight: 600 }}>Total</span>
          <span className="ios-title-3 ios-num" style={{ color: "var(--ios-label)" }}>
            {fmtCurrency(totalCost)}
          </span>
        </div>
      </div>

      {/* Activity chart */}
      <div style={{ background: "var(--ios-cell)", borderRadius: "var(--ios-radius-card)", padding: "16px 18px" }}>
        <div className="ios-group-header" style={{ padding: "0 0 12px" }}>
          Daily activity — last 30 days
        </div>
        {allTypes.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {allTypes.map((t) => (
              <Chip key={t} small selected={selectedTypes.includes(t)} onClick={() => toggleType(t)}>
                {EVENT_LABELS[t] ?? t}
              </Chip>
            ))}
          </div>
        )}
        <MiniBarChart dates={dates} dateMap={dateMap} selectedTypes={selectedTypes} />
      </div>

      {/* Event totals */}
      <div style={{ background: "var(--ios-cell)", borderRadius: "var(--ios-radius-card)", padding: "16px 0 2px" }}>
        <div className="ios-group-header" style={{ padding: "0 18px 4px" }}>
          All-time totals
        </div>
        {eventTotals.length === 0 ? (
          <p className="ios-footnote" style={{ color: "var(--ios-label-3)", padding: "0 18px 16px" }}>No events logged yet.</p>
        ) : (
          <BarRows items={totalItems} />
        )}
      </div>

    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: "var(--ios-cell)",
      borderRadius: "var(--ios-radius-tile)",
      padding: "14px 16px",
    }}>
      <div className="ios-caption" style={{ fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase", color: "var(--ios-label-2)", marginBottom: 4 }}>
        {label}
      </div>
      <div className="ios-title-1 ios-num" style={{ color: "var(--ios-label)" }}>
        {value}
      </div>
    </div>
  );
}

function CostRow({ label, amount, sub }: { label: string; amount: string; sub: string }) {
  return (
    <div style={{
      background: "var(--ios-bg)",
      borderRadius: 10,
      padding: "10px 14px",
    }}>
      <div className="ios-caption" style={{ color: "var(--ios-label-2)", marginBottom: 2 }}>{label}</div>
      <div className="ios-headline ios-num" style={{ color: "var(--ios-label)" }}>{amount}</div>
      <div className="ios-caption ios-num" style={{ color: "var(--ios-label-3)", marginTop: 2 }}>{sub}</div>
    </div>
  );
}
