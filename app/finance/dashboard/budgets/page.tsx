export const dynamic = "force-dynamic";

import { createServiceClient } from "@/lib/supabase/server";
import { requireFinanceAccess } from "@/lib/finance/access";
import { getPreferences } from "@/lib/prefs";
import { LargeTitle, Group, Cell, IconBadge, Icons } from "@/components/ios";
import { flowOf, labelForPrimary } from "@/lib/finance/insights";
import { primaryOf } from "@/lib/finance/spending";
import { evaluateBudgets, loadBudgetTransactions, loadRecentAlerts, suggestLimit } from "@/lib/finance/budgets";
import BudgetList, { type BudgetRowData, type CategoryOption } from "./_components/BudgetList";

// Budgets.
//
// Opening this screen is also when the month's alerts are raised — every
// standing is recomputed, anything newly crossed is written once, and a
// reminder lands on Today. The daily bank sync does the same pass, so a limit
// crossed overnight is on Today in the morning whether or not anyone opens
// this page.

/* eslint-disable @typescript-eslint/no-explicit-any */

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const KIND_LABEL = { warn: "Close to the limit", over: "Over budget", projected: "On pace to go over" } as const;

export default async function BudgetsPage() {
  const { user } = await requireFinanceAccess();
  const svc = createServiceClient() as any;
  const today = new Date().toISOString().slice(0, 10);

  const [txns, prefs] = await Promise.all([loadBudgetTransactions(svc, user.id, today), getPreferences(user.id).catch(() => null)]);
  const { statuses, tables } = await evaluateBudgets(svc, user.id, today, { txns });
  const alerts = tables.ok ? await loadRecentAlerts(svc, user.id) : [];
  const smsAvailable = !!prefs?.phone_number && prefs?.sms_notifications_enabled !== false;

  // Categories worth budgeting: everything the household has actually spent in
  // over the last three months, with what it has cost, plus "all spending".
  const month = today.slice(0, 7);
  const perCat = new Map<string, Map<string, number>>();
  for (const t of txns) {
    if (flowOf(t) !== "spend") continue;
    const p = primaryOf(t); if (!p) continue;
    const m = t.date.slice(0, 7); if (m === month) continue;
    const mm = perCat.get(p) ?? new Map<string, number>();
    mm.set(m, (mm.get(m) ?? 0) + t.amount); perCat.set(p, mm);
  }
  const categories: CategoryOption[] = [
    { value: "*", label: "All spending", suggested: suggestLimit(txns, "*", today), recentMonthly: suggestLimit(txns, "*", today) },
    ...[...perCat.entries()].map(([p, mm]) => {
      const vals = [...mm.values()];
      const avg = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
      return { value: p, label: labelForPrimary(p), suggested: suggestLimit(txns, p, today), recentMonthly: Math.round(avg), avg };
    }).sort((a, b) => b.avg - a.avg).map((c) => ({ value: c.value, label: c.label, suggested: c.suggested, recentMonthly: c.recentMonthly })),
  ];

  const rows: BudgetRowData[] = statuses.map((s) => ({
    id: s.budget.id, category: s.budget.category, label: s.label, limit: s.limit, spent: s.spent, pct: s.pct, projected: s.projected,
    remaining: s.remaining, daysLeft: s.daysLeft, perDayLeft: s.perDayLeft, state: s.state, warnAtPct: s.budget.warn_at_pct, notifySms: s.budget.notify_sms, count: s.txnIds.length,
  }));
  const totalLimit = rows.reduce((a, r) => a + r.limit, 0);
  const totalSpent = rows.reduce((a, r) => a + r.spent, 0);
  const daysLeft = rows[0]?.daysLeft ?? 0;
  const over = rows.filter((r) => r.state === "over").length;
  const close = rows.filter((r) => r.state === "warn" || r.state === "projected").length;

  return (
    <div className="ios-scroll">
      <LargeTitle title="Budgets" subtitle={rows.length ? `${new Date(`${today}T12:00:00`).toLocaleDateString("en-US", { month: "long" })} · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : "Monthly limits, with alerts"} />

      {!tables.ok ? (
        <Group footer={tables.reason === "missing" ? "Run supabase/migrations/20261003_budgets.sql in the Supabase SQL editor, then reload. Nothing else is needed." : tables.message}>
          <Cell lead={<IconBadge color="var(--ios-orange)"><Icons.BellIcon /></IconBadge>} title={tables.reason === "missing" ? "Budgets need their tables" : "Budgets could not load"} subtitle={tables.reason === "missing" ? "One migration to apply" : "Try again in a moment"} />
        </Group>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingTop: 4 }}>
          {rows.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, padding: "0 16px" }}>
              <Stat label="Budgeted this month" value={fmt(totalLimit)} sub={`${rows.length} budget${rows.length === 1 ? "" : "s"}`} />
              <Stat label="Spent against them" value={fmt(totalSpent)} sub={`${Math.round((totalSpent / Math.max(1, totalLimit)) * 100)}% of the total`} color={totalSpent > totalLimit ? "var(--ios-red)" : undefined} />
              <Stat label="Standing" value={over ? `${over} over` : close ? `${close} close` : "All on track"} sub={over ? `${close} more close to the line` : close ? "worth a look" : `${daysLeft} days to go`} color={over ? "var(--ios-red)" : close ? "var(--ios-orange)" : "var(--ios-green)"} />
            </div>
          )}

          <div style={{ padding: "0 16px" }}>
            <BudgetList rows={rows} categories={categories} smsAvailable={smsAvailable} />
          </div>

          <div style={{ padding: "0 16px" }}>
            <div className="ios-list" style={{ margin: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, padding: "14px 16px 6px" }}>
                <h2 className="ios-title-3" style={{ margin: 0 }}>Alerts</h2>
                <span className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>each fires once a month</span>
              </div>
              {alerts.length === 0 ? (
                <p className="ios-footnote" style={{ color: "var(--ios-label-2)", padding: "8px 16px 16px", margin: 0 }}>
                  None yet. When a budget passes its warning line, goes over, or is on pace to, it is written here, a reminder appears on Today, and — if the budget asks — you get a text.
                </p>
              ) : alerts.map((a, i) => (
                <div key={a.id} style={{ padding: "10px 16px", boxShadow: i === 0 ? undefined : "inset 0 0.5px 0 0 var(--ios-separator)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                    <span className="ios-caption" style={{ color: a.kind === "over" ? "var(--ios-red)" : "var(--ios-orange)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{KIND_LABEL[a.kind]}</span>
                    <span className="ios-caption" style={{ color: "var(--ios-label-3)" }}>{new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  </div>
                  <p className="ios-footnote" style={{ margin: "2px 0 0", lineHeight: 1.45 }}>{a.message}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="ios-caption" style={{ color: "var(--ios-label-3)", padding: "0 16px", margin: 0, lineHeight: 1.5 }}>
            Spending counts posted transactions in the category from the 1st of the month. Transfers between your own accounts and credit-card payments are left out. The pace mark on each bar is where the month is heading, worked out the same way as on Spending.
          </p>
          <div style={{ height: 12 }} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="ios-list" style={{ margin: 0, padding: "14px 16px" }}>
      <div className="ios-footnote" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div className="ios-num" style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", marginTop: 4, color }}>{value}</div>
      {sub && <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
