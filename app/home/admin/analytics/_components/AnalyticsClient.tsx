"use client";

import { useState } from "react";

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
  chat: "#1a1a1a",
  email: "#6366f1",
  signup: "#10b981",
  oura_sync: "#f59e0b",
  withings_sync: "#3b82f6",
  apple_sync: "#ef4444",
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
      <div style={{ padding: "40px 0", textAlign: "center", color: "var(--color-ink-4)", fontSize: 13 }}>
        No data yet
      </div>
    );
  }

  const maxVal = Math.max(
    1,
    ...dates.map((d) => {
      const row = dateMap.get(d) ?? {};
      return selectedTypes.reduce((s, t) => s + (row[t] ?? 0), 0);
    })
  );

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80, padding: "0 4px" }}>
      {dates.map((date) => {
        const row = dateMap.get(date) ?? {};
        const total = selectedTypes.reduce((s, t) => s + (row[t] ?? 0), 0);
        const heightPct = (total / maxVal) * 100;
        const label = date.slice(5);
        return (
          <div
            key={date}
            title={`${date}: ${total} events`}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "default" }}
          >
            <div
              style={{
                width: "100%",
                height: `${Math.max(heightPct, total > 0 ? 4 : 0)}%`,
                background: selectedTypes.length === 1
                  ? (EVENT_COLORS[selectedTypes[0]] ?? "var(--color-ink-3)")
                  : "var(--color-ink)",
                borderRadius: 2,
                transition: "height 0.2s",
                minHeight: total > 0 ? 3 : 0,
              }}
            />
            {dates.length <= 14 && (
              <span style={{ fontSize: 8, color: "var(--color-ink-4)", whiteSpace: "nowrap" }}>{label}</span>
            )}
          </div>
        );
      })}
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingBottom: 40 }}>

      {/* Alerts */}
      {alerts.map((a, i) => (
        <div
          key={i}
          style={{
            background: a.level === "critical" ? "#fff1f0" : "#fffbeb",
            border: `1px solid ${a.level === "critical" ? "#fca5a5" : "#fcd34d"}`,
            borderRadius: 12,
            padding: "12px 16px",
            fontSize: 13,
            color: a.level === "critical" ? "#991b1b" : "#78350f",
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1.3 }}>{a.level === "critical" ? "⚠️" : "ℹ️"}</span>
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
      <div style={{ background: "var(--color-bg-raised)", border: "1px solid var(--color-line)", borderRadius: 16, padding: "20px 20px 16px" }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 16 }}>
          Variable costs — this month to date
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
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
          borderTop: "1px solid var(--color-line)",
          paddingTop: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)" }}>Total</span>
          <span style={{ fontSize: 20, fontWeight: 600, fontFamily: "var(--font-display)", color: "var(--color-ink)", letterSpacing: "-0.02em" }}>
            {fmtCurrency(totalCost)}
          </span>
        </div>
      </div>

      {/* Activity chart */}
      <div style={{ background: "var(--color-bg-raised)", border: "1px solid var(--color-line)", borderRadius: 16, padding: "20px 20px 16px" }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 12 }}>
          Daily activity — last 30 days
        </div>
        {allTypes.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {allTypes.map((t) => {
              const active = selectedTypes.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => toggleType(t)}
                  style={{
                    padding: "3px 10px",
                    borderRadius: 20,
                    border: `1px solid ${active ? (EVENT_COLORS[t] ?? "var(--color-ink)") : "var(--color-line)"}`,
                    background: active ? (EVENT_COLORS[t] ?? "var(--color-ink)") : "transparent",
                    color: active ? "#fff" : "var(--color-ink-3)",
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "all 0.15s",
                  }}
                >
                  {EVENT_LABELS[t] ?? t}
                </button>
              );
            })}
          </div>
        )}
        <MiniBarChart dates={dates} dateMap={dateMap} selectedTypes={selectedTypes} />
      </div>

      {/* Event totals table */}
      <div style={{ background: "var(--color-bg-raised)", border: "1px solid var(--color-line)", borderRadius: 16, padding: "20px 20px 4px" }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 14 }}>
          All-time totals
        </div>
        {eventTotals.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--color-ink-4)", paddingBottom: 16 }}>No events logged yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              {eventTotals.map((row, i) => (
                <tr key={row.event_type} style={{ borderTop: i > 0 ? "1px solid var(--color-line)" : undefined }}>
                  <td style={{ padding: "10px 0", color: "var(--color-ink-3)" }}>
                    <span style={{
                      display: "inline-block",
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: EVENT_COLORS[row.event_type] ?? "var(--color-ink-4)",
                      marginRight: 8,
                    }} />
                    {EVENT_LABELS[row.event_type] ?? row.event_type}
                  </td>
                  <td style={{ padding: "10px 0", textAlign: "right", fontWeight: 600, color: "var(--color-ink)" }}>
                    {row.count.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: "var(--color-bg-raised)",
      border: "1px solid var(--color-line)",
      borderRadius: 14,
      padding: "14px 16px",
    }}>
      <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 600, fontFamily: "var(--font-display)", color: "var(--color-ink)", letterSpacing: "-0.02em" }}>
        {value}
      </div>
    </div>
  );
}

function CostRow({ label, amount, sub }: { label: string; amount: string; sub: string }) {
  return (
    <div style={{
      background: "var(--color-bg)",
      border: "1px solid var(--color-line)",
      borderRadius: 10,
      padding: "10px 14px",
    }}>
      <div style={{ fontSize: 11, color: "var(--color-ink-3)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: "var(--color-ink)", fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}>{amount}</div>
      <div style={{ fontSize: 10, color: "var(--color-ink-4)", marginTop: 2 }}>{sub}</div>
    </div>
  );
}
