export const dynamic = "force-dynamic";

import Link from "next/link";
import { Suspense } from "react";
import { createServiceClient } from "@/lib/supabase/server";
import { requireFinanceAccess } from "@/lib/finance/access";
import { LargeTitle, Group, Cell, IconBadge, Icons } from "@/components/ios";
import {
  computeInsights, flowOf, categoryLabel, detailedOf, normalizeMerchant, prettyMerchant,
  type InsightTx,
} from "@/lib/finance/insights";
import MonthlyTrendChart, { type MonthPoint } from "./_components/MonthlyTrendChart";
import CategoryBreakdown, { type CategoryRow } from "./_components/CategoryBreakdown";
import RecurringCharges, { type RecurringRow } from "./_components/RecurringCharges";
import TopMerchants, { type MerchantRow } from "./_components/TopMerchants";
import InsightCards, { type EvidenceTx } from "./_components/InsightCards";
import { evaluateBudgets, budgetInsights } from "@/lib/finance/budgets";
import InsightNarrative from "./_components/InsightNarrative";

// Insights.
//
// Every number on this screen comes from lib/finance/insights.ts, which is
// pure and tested; this file fetches, hands over, and lays out. The narrative
// at the top is a model reading the same report and is told to use nothing
// else, so the sentence and the figure beside it always agree.
//
// Windows are rolling — the last 30 days against the 30 before, against the
// per-30-day average of the 90 before that — because a calendar month is empty
// on the 3rd and the old screen said "$212, down 94%" every month until the
// bills landed. The one calendar-month figure left is the projection, which is
// the question a calendar month actually answers: where is this one heading.

interface AccountRow { id: string; name: string; mask: string | null; is_hidden: boolean; type: string | null; current_balance: number | null }

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}
function subLabel(t: InsightTx): string {
  const d = detailedOf(t);
  if (!d) return "Other";
  return d.toLowerCase().split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
function accountLabel(id: string | null, accounts: Map<string, AccountRow>): string | null {
  const a = id ? accounts.get(id) : null;
  return a ? `${a.name.split(" ")[0]}${a.mask ? ` ····${a.mask}` : ""}` : null;
}
function topAccount(txns: InsightTx[], accounts: Map<string, AccountRow>): string | null {
  const counts = new Map<string, number>();
  for (const t of txns) counts.set(t.account_id, (counts.get(t.account_id) ?? 0) + 1);
  let top: string | null = null, n = 0;
  for (const [id, c] of counts) if (c > n) { top = id; n = c; }
  return accountLabel(top, accounts);
}
function shiftDays(day: string, n: number): string {
  return new Date(new Date(`${day}T12:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
}

export default async function InsightsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user } = await requireFinanceAccess();
  const params = await searchParams;
  const rawTopN = Array.isArray(params.topN) ? params.topN[0] : params.topN;
  const parsedN = rawTopN ? parseInt(rawTopN, 10) : 10;
  const topN = Number.isFinite(parsedN) ? Math.max(5, Math.min(100, parsedN)) : 10;

  const service = createServiceClient();
  const { data: itemRows } = await service.schema("finance").from("plaid_items").select("id").eq("user_id", user.id);
  const itemIds = (itemRows ?? []).map((r) => r.id);

  let transactions: InsightTx[] = [];
  const accounts = new Map<string, AccountRow>();
  let cashBalance: number | null = null;
  if (itemIds.length > 0) {
    const { data: acctRows } = await service.schema("finance").from("accounts")
      .select("id, name, mask, is_hidden, type, current_balance")
      .in("item_id", itemIds).is("deleted_at", null);
    const visible = ((acctRows as AccountRow[]) ?? []).filter((a) => !a.is_hidden);
    for (const a of visible) accounts.set(a.id, a);
    const cash = visible.filter((a) => a.type === "depository");
    cashBalance = cash.length ? cash.reduce((s, a) => s + (a.current_balance ?? 0), 0) : null;

    if (visible.length > 0) {
      const yearAgo = shiftDays(new Date().toISOString().slice(0, 10), -365);
      const { data: txRows } = await service.schema("finance").from("transactions")
        .select("id, account_id, date, amount, merchant_name, name, pending, personal_finance_category, category")
        .in("account_id", visible.map((a) => a.id))
        .gte("date", yearAgo)
        .order("date", { ascending: true });
      transactions = (txRows as InsightTx[]) ?? [];
    }
  }

  const report = computeInsights(transactions, { cashBalance });
  const { today, last30, prior30, pace, recurring } = report;
  const posted = transactions.filter((t) => !t.pending);

  // Budgets stand alongside the computed insights, ranked with them, so the
  // narrative sees them too. Opening Spending also raises the month's alerts.
  const budgets = await evaluateBudgets(service, user.id, today, { txns: transactions }).catch(() => null);
  if (budgets && budgets.statuses.length > 0) {
    const order = { alert: 0, watch: 1, good: 2, info: 3 } as const;
    report.insights = [...budgetInsights(budgets.statuses), ...report.insights]
      .sort((a, b) => order[a.level] - order[b.level] || Math.abs(b.delta ?? b.amount ?? 0) - Math.abs(a.delta ?? a.amount ?? 0));
  }

  // The transactions behind each insight, for the row's analysis panel.
  const txById = new Map(posted.map((t) => [t.id, t]));
  const evidence: Record<string, EvidenceTx[]> = {};
  for (const i of report.insights) {
    const rows = i.txnIds.map((id) => txById.get(id)).filter((t): t is InsightTx => !!t)
      .map((t) => ({ id: t.id, date: t.date, merchant: prettyMerchant(t.merchant_name ?? t.name), amount: t.amount, category: categoryLabel(t), account: accountLabel(t.account_id, accounts) }))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    if (rows.length) evidence[i.id] = rows;
  }

  // ── Monthly trend: spend out, income in, by calendar month ────────────────
  const byMonth = new Map<string, { outflow: number; inflow: number; txns: InsightTx[] }>();
  for (const t of posted) {
    const f = flowOf(t);
    if (f === "ignore" || f === "transfer") continue;
    const key = t.date.slice(0, 7);
    const m = byMonth.get(key) ?? { outflow: 0, inflow: 0, txns: [] };
    if (f === "spend") m.outflow += t.amount; else m.inflow += Math.abs(t.amount);
    m.txns.push(t);
    byMonth.set(key, m);
  }
  const monthlyTrend: MonthPoint[] = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([key, v]) => ({
    key, label: monthLabel(key), outflow: v.outflow, inflow: v.inflow,
    txns: v.txns.map((t) => ({ id: t.id, date: t.date, merchant: prettyMerchant(t.merchant_name ?? t.name), amount: t.amount, category: categoryLabel(t), isIncome: flowOf(t) === "income" }))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)),
  }));

  // ── Categories: last 30 against the 30 before ─────────────────────────────
  const curCat = new Map<string, Map<string, number>>();
  const prevCat = new Map<string, Map<string, number>>();
  const curTx = new Map<string, Map<string, InsightTx[]>>();
  for (const t of posted) {
    if (flowOf(t) !== "spend") continue;
    const cat = categoryLabel(t), sub = subLabel(t);
    const into = t.date >= last30.from ? curCat : t.date >= prior30.from ? prevCat : null;
    if (!into) continue;
    const sm = into.get(cat) ?? new Map<string, number>();
    sm.set(sub, (sm.get(sub) ?? 0) + t.amount);
    into.set(cat, sm);
    if (into === curCat) {
      const cm = curTx.get(cat) ?? new Map<string, InsightTx[]>();
      cm.set(sub, [...(cm.get(sub) ?? []), t]);
      curTx.set(cat, cm);
    }
  }
  const sum = (m?: Map<string, number>) => [...(m?.values() ?? [])].reduce((a, b) => a + b, 0);
  const categoryBreakdown: CategoryRow[] = [...new Set([...curCat.keys(), ...prevCat.keys()])].map((cat) => {
    const cur = curCat.get(cat), prev = prevCat.get(cat);
    const details = [...new Set([...(cur?.keys() ?? []), ...(prev?.keys() ?? [])])].map((s) => ({
      subcategory: s, current: cur?.get(s) ?? 0, previous: prev?.get(s) ?? 0,
      txns: (curTx.get(cat)?.get(s) ?? []).map((t) => ({ id: t.id, date: t.date, merchant: prettyMerchant(t.merchant_name ?? t.name), amount: t.amount })).sort((a, b) => b.amount - a.amount),
    })).sort((a, b) => b.current - a.current);
    return { category: cat, current: sum(cur), previous: sum(prev), details };
  }).sort((a, b) => b.current - a.current);

  // ── Recurring, from the engine ────────────────────────────────────────────
  const recurringRows: RecurringRow[] = recurring.map((r) => ({
    merchant: r.merchant, cadence: r.cadence, amount: r.amount, monthlyCost: r.monthlyCost, lastCharged: r.lastCharged,
    occurrences: r.occurrences, category: r.category, key: r.key, accountSource: accountLabel(r.accountId, accounts),
    variable: r.variable, isNew: r.isNew, priceChange: r.priceChange, status: r.status, nextExpected: r.nextExpected,
  }));

  // ── Top merchants: last 30 days, one row per real merchant ────────────────
  const merchants = new Map<string, { merchant: string; total: number; count: number; category: string; txns: InsightTx[] }>();
  for (const t of posted) {
    if (flowOf(t) !== "spend" || t.date < last30.from) continue;
    const key = normalizeMerchant(t.merchant_name ?? t.name);
    if (!key) continue;
    const m = merchants.get(key) ?? { merchant: prettyMerchant(t.merchant_name ?? t.name), total: 0, count: 0, category: categoryLabel(t), txns: [] };
    m.total += t.amount; m.count++; m.txns.push(t);
    merchants.set(key, m);
  }
  const topMerchants: MerchantRow[] = [...merchants.values()].sort((a, b) => b.total - a.total).slice(0, topN)
    .map((m) => ({ merchant: m.merchant, total: m.total, count: m.count, category: m.category, accountSource: topAccount(m.txns, accounts) }));

  const live = recurring.filter((r) => r.status !== "lapsed");
  const newCount = live.filter((r) => r.isNew).length;
  const risesCount = live.filter((r) => (r.priceChange ?? 0) > 0).length;
  const spendDelta = prior30.spend > 0 ? ((last30.spend - prior30.spend) / prior30.spend) * 100 : null;
  const paceDelta = pace.projected != null && pace.baseline ? ((pace.projected - pace.baseline) / pace.baseline) * 100 : null;

  return (
    <div className="ios-scroll">
      <LargeTitle
        title="Insights"
        subtitle={report.span ? `${transactions.length.toLocaleString()} transactions · history since ${monthLabel(report.span.from.slice(0, 7))}` : "No history yet"}
      />

      {transactions.length === 0 ? (
        <Group footer="Connect a bank to start analyzing your spending.">
          <Cell lead={<IconBadge color="var(--ios-finance)"><Icons.WalletIcon /></IconBadge>} title="Connect a bank" subtitle="No transactions to analyze yet" href="/finance/dashboard" />
        </Group>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingTop: 4 }}>
          <div id="trend" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, padding: "0 16px" }}>
            <StatCard label="Last 30 days" value={last30.spend} delta={spendDelta} deltaSuffix="vs the 30 before" invert />
            <StatCard
              label="This month, projected"
              value={pace.projected ?? pace.spentSoFar}
              delta={paceDelta}
              deltaSuffix={pace.baselineMonths ? `vs ${pace.baselineMonths}-mo average` : undefined}
              sub={pace.projected == null ? `${fmtMoney(pace.spentSoFar)} so far · no prior month to project from` : `${fmtMoney(pace.spentSoFar)} so far, day ${pace.dayOfMonth} of ${pace.daysInMonth}`}
              invert
            />
            <StatCard
              label="Income, last 30 days"
              value={last30.income}
              delta={null}
              sub={last30.income > 0 ? (last30.net >= 0 ? `Kept ${Math.round((last30.savingsRate ?? 0) * 100)}% · ${fmtMoney(last30.net)} net` : `${fmtMoney(-last30.net)} over income`) : "No income recorded"}
            />
            <StatCard
              label="Recurring, per month"
              value={report.recurringMonthly}
              delta={null}
              sub={[`${live.length} charge${live.length === 1 ? "" : "s"}`, newCount ? `${newCount} new` : null, risesCount ? `${risesCount} price rise${risesCount === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ")}
            />
          </div>

          <div style={{ padding: "0 16px" }}>
            <Suspense fallback={null}>
              <InsightNarrative report={report} />
            </Suspense>
          </div>

          <div style={{ padding: "0 16px" }}>
            <InsightCards insights={report.insights} evidence={evidence} />
          </div>

          <div style={{ padding: "0 16px" }}>
            <MonthlyTrendChart data={monthlyTrend} />
          </div>

          <div id="categories" style={{ padding: "0 16px" }}>
            <CategoryBreakdown rows={categoryBreakdown.slice(0, 12)} />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, padding: "0 16px" }}>
            <span className="ios-footnote" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Show top</span>
            {[10, 20, 50, 100].map((n) => (
              <Link key={n} href={`/finance/dashboard/insights?topN=${n}#merchants`} scroll={false} prefetch={false} className={`ios-chip ios-chip--sm${n === topN ? " is-selected" : ""}`}>{n}</Link>
            ))}
          </div>

          <div id="merchants" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14, padding: "0 16px" }}>
            <RecurringCharges rows={recurringRows.slice(0, topN)} />
            <TopMerchants rows={topMerchants} />
          </div>

          {budgets && budgets.statuses.length > 0 && (
            <div id="budgets" style={{ padding: "0 16px" }}>
              <Group header="Budgets" footer="Set and edit limits on the Budgets tab. Each alert fires once a month and lands on Today.">
                {budgets.statuses.map((s) => (
                  <Cell key={s.budget.id} href="/finance/dashboard/budgets" title={s.label}
                    subtitle={`${fmtMoney(s.spent)} of ${fmtMoney(s.limit)} · ${s.daysLeft} days left${s.projected != null ? ` · pace ${fmtMoney(s.projected)}` : ""}`}
                    trailing={<span className="ios-caption" style={{ color: s.state === "over" ? "var(--ios-red)" : s.state === "ok" ? "var(--ios-green)" : "var(--ios-orange)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.state === "over" ? "Over" : s.state === "ok" ? "On track" : s.state === "warn" ? "Close" : "On pace to go over"}</span>} />
                ))}
              </Group>
            </div>
          )}

          {last30.transfers > 0 && (
            <p className="ios-caption" style={{ color: "var(--ios-label-3)", padding: "0 16px", margin: 0, lineHeight: 1.5 }}>
              {fmtMoney(last30.transfers)} of transfers between your own accounts and credit-card payments in the last 30 days is left out of every spending figure above, so money is not counted on both sides. Pending transactions are left out until they post. Today is {today}.
            </p>
          )}
          <div style={{ height: 12 }} />
        </div>
      )}
    </div>
  );
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function StatCard({ label, value, delta, sub, deltaSuffix, invert }: {
  label: string; value: number; delta: number | null; sub?: string; deltaSuffix?: string;
  invert?: boolean; // negative delta is good (less spending)
}) {
  const deltaColor = delta == null ? "var(--ios-label-2)"
    : Math.abs(delta) < 3 ? "var(--ios-label-2)"
    : (invert ? delta < 0 : delta > 0) ? "var(--ios-green)" : "var(--ios-red)";
  return (
    <div className="ios-list" style={{ margin: 0, padding: "14px 16px" }}>
      <div className="ios-footnote" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div className="ios-num" style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em", marginTop: 4 }}>{fmtMoney(value)}</div>
      {delta != null && (
        <div className="ios-footnote" style={{ color: deltaColor, marginTop: 4 }}>
          {delta > 0 ? "▲" : delta < 0 ? "▼" : "▶"} {Math.abs(delta).toFixed(0)}% {deltaSuffix && <span style={{ color: "var(--ios-label-2)" }}>{deltaSuffix}</span>}
        </div>
      )}
      {sub && <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
