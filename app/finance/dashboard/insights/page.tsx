export const dynamic = "force-dynamic";

import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { requireFinanceAccess } from "@/lib/finance/access";
import { Suspense } from "react";
import MonthlyTrendChart, { type MonthPoint } from "./_components/MonthlyTrendChart";
import CategoryBreakdown, { type CategoryRow } from "./_components/CategoryBreakdown";
import RecurringCharges, { type RecurringRow } from "./_components/RecurringCharges";
import TopMerchants, { type MerchantRow } from "./_components/TopMerchants";
import SpendingRecommendations from "./_components/SpendingRecommendations";

interface TxRow {
  id: string;
  account_id: string;
  date: string;
  amount: number;
  merchant_name: string | null;
  name: string;
  pending: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  personal_finance_category: any;
  category: string[] | null;        // legacy Plaid category array fallback
}

// Primary categories to exclude from spending analysis (case-insensitive via .toUpperCase()).
// Covers transfer, payment, and balance categories regardless of Plaid API version.
const EXCLUDED_PRIMARIES_UPPER = new Set([
  "TRANSFER_IN", "TRANSFER_OUT", "LOAN_PAYMENTS",
  "BANK_FEES", "INCOME", "BALANCE",
  "TRANSFER", "PAYMENT", "ADJUSTMENT",
]);

function categoryFromPFC(
  pfc: { primary?: string; detailed?: string } | string | string[] | null | undefined,
  legacyCategory?: string[] | null
): string | null {
  // ── Handle array format (old Plaid /transactions/get category field) ──
  // e.g. ["Food and Drink", "Restaurants"]
  if (Array.isArray(pfc)) {
    const first = (pfc as string[])[0];
    if (!first) return null;
    const upper = first.toUpperCase().replace(/\s+/g, "_");
    if (EXCLUDED_PRIMARIES_UPPER.has(upper) || EXCLUDED_PRIMARIES_UPPER.has(first.toUpperCase())) return null;
    return first;
  }

  // ── Handle stringified JSON ──
  if (typeof pfc === "string") {
    const raw = pfc;
    try { pfc = JSON.parse(pfc) as { primary?: string }; } catch {
      // Not JSON — treat as raw primary string
      const upper = raw.toUpperCase();
      if (EXCLUDED_PRIMARIES_UPPER.has(upper)) return null;
      return raw.toLowerCase().split("_").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
  }

  // ── Standard object format {primary, detailed} ──
  const p = (pfc as { primary?: string } | null)?.primary;
  if (p) {
    // Case-insensitive exclusion — catches "BALANCE", "Balance", "balance", etc.
    if (EXCLUDED_PRIMARIES_UPPER.has(p.toUpperCase())) return null;
    return p.toLowerCase().split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }

  // ── Fallback: use legacy category array if PFC has no primary ──
  if (legacyCategory && Array.isArray(legacyCategory) && legacyCategory.length > 0) {
    const first = legacyCategory[0];
    const upper = first.toUpperCase().replace(/\s+/g, "_");
    if (EXCLUDED_PRIMARIES_UPPER.has(upper) || EXCLUDED_PRIMARIES_UPPER.has(first.toUpperCase())) return null;
    return first;
  }

  return null;
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // YYYY-MM
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

// Picks the most common account_id from a transaction list and returns
// a short label like "Chase ····4321" for display.
function topAccountSource(
  txns: TxRow[],
  accountById: Map<string, { name: string; mask: string | null }>
): string | null {
  if (txns.length === 0) return null;
  const counts = new Map<string, number>();
  for (const t of txns) {
    counts.set(t.account_id, (counts.get(t.account_id) ?? 0) + 1);
  }
  let topId: string | null = null;
  let topCount = 0;
  for (const [id, c] of counts) {
    if (c > topCount) {
      topCount = c;
      topId = id;
    }
  }
  if (!topId) return null;
  const acct = accountById.get(topId);
  if (!acct) return null;
  return `${acct.name.split(" ")[0]}${acct.mask ? ` ····${acct.mask}` : ""}`;
}

// ── Recurring charge detection ─────────────────────────────────────────────
// Groups transactions by normalized merchant, finds groups with consistent
// amounts and regular cadence (weekly / biweekly / monthly).
function detectRecurring(
  transactions: TxRow[],
  accountById: Map<string, { name: string; mask: string | null }>
): RecurringRow[] {
  const byMerchant = new Map<string, TxRow[]>();
  for (const t of transactions) {
    if (t.amount <= 0) continue; // outflows only
    const merchant = (t.merchant_name ?? t.name).trim();
    if (!merchant) continue;
    const key = merchant.toLowerCase();
    if (!byMerchant.has(key)) byMerchant.set(key, []);
    byMerchant.get(key)!.push(t);
  }

  const recurring: RecurringRow[] = [];
  for (const [key, txns] of byMerchant) {
    if (txns.length < 2) continue;
    const sorted = [...txns].sort((a, b) => (a.date < b.date ? -1 : 1));

    // Check amount consistency — coefficient of variation < 0.1 means amounts are similar
    const amounts = sorted.map((t) => t.amount);
    const meanAmt = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const variance = amounts.reduce((s, a) => s + (a - meanAmt) ** 2, 0) / amounts.length;
    const stdDev = Math.sqrt(variance);
    const amountConsistency = meanAmt > 0 ? stdDev / meanAmt : 1;
    if (amountConsistency > 0.15) continue; // amounts too variable

    // Check cadence — calculate gaps between consecutive charges
    if (sorted.length < 2) continue;
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const a = new Date(sorted[i - 1].date + "T12:00:00").getTime();
      const b = new Date(sorted[i].date + "T12:00:00").getTime();
      gaps.push(Math.round((b - a) / 86400_000));
    }
    const meanGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;

    // Classify cadence
    let cadence: "Weekly" | "Biweekly" | "Monthly" | "Quarterly" | null = null;
    if (meanGap >= 6 && meanGap <= 8) cadence = "Weekly";
    else if (meanGap >= 13 && meanGap <= 16) cadence = "Biweekly";
    else if (meanGap >= 26 && meanGap <= 35) cadence = "Monthly";
    else if (meanGap >= 85 && meanGap <= 95) cadence = "Quarterly";
    if (!cadence) continue;

    // Need at least 2 cycles to confirm
    if (sorted.length < 2) continue;

    const merchant = sorted[0].merchant_name ?? sorted[0].name;
    const lastTx = sorted[sorted.length - 1];
    const category = categoryFromPFC(lastTx.personal_finance_category, lastTx.category) ?? "Other";

    // Monthly cost normalization
    const monthlyCost =
      cadence === "Weekly" ? meanAmt * 4.33 :
      cadence === "Biweekly" ? meanAmt * 2.17 :
      cadence === "Monthly" ? meanAmt :
      meanAmt / 3;

    recurring.push({
      merchant,
      cadence,
      amount: meanAmt,
      monthlyCost,
      lastCharged: lastTx.date,
      occurrences: sorted.length,
      category,
      key,
      accountSource: topAccountSource(sorted, accountById),
    });
  }

  return recurring.sort((a, b) => b.monthlyCost - a.monthlyCost);
}

interface InsightsAccount {
  id: string;
  name: string;
  mask: string | null;
  is_hidden: boolean;
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await requireFinanceAccess();
  const params = await searchParams;
  const rawTopN = Array.isArray(params.topN) ? params.topN[0] : params.topN;
  const parsed = rawTopN ? parseInt(rawTopN, 10) : 10;
  const topN = Number.isFinite(parsed) ? Math.max(5, Math.min(100, parsed)) : 10;

  const service = createServiceClient();

  // Get user's accounts (visible only)
  const { data: itemRows } = await service
    .schema("finance")
    .from("plaid_items")
    .select("id")
    .eq("user_id", user.id);
  const itemIds = (itemRows ?? []).map((r) => r.id);

  let transactions: TxRow[] = [];
  const accountById = new Map<string, { name: string; mask: string | null }>();
  if (itemIds.length > 0) {
    const { data: acctRows } = await service
      .schema("finance")
      .from("accounts")
      .select("id, name, mask, is_hidden")
      .in("item_id", itemIds);
    const allAccts = ((acctRows as InsightsAccount[]) ?? []);
    const visibleAccts = allAccts.filter((a) => !a.is_hidden);
    for (const a of visibleAccts) accountById.set(a.id, { name: a.name, mask: a.mask });
    const acctIds = visibleAccts.map((a) => a.id);

    if (acctIds.length > 0) {
      // Pull last 12 months of transactions
      const twelveAgo = new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10);
      const { data: txRows } = await service
        .schema("finance")
        .from("transactions")
        .select("id, account_id, date, amount, merchant_name, name, pending, personal_finance_category, category")
        .in("account_id", acctIds)
        .gte("date", twelveAgo)
        .order("date", { ascending: true });
      transactions = (txRows as TxRow[]) ?? [];
    }
  }

  // ── Monthly trend ─────────────────────────────────────────────────────
  const byMonth = new Map<string, { outflow: number; inflow: number }>();
  for (const t of transactions) {
    const key = monthKey(t.date);
    if (!byMonth.has(key)) byMonth.set(key, { outflow: 0, inflow: 0 });
    const m = byMonth.get(key)!;
    if (t.amount > 0) m.outflow += t.amount;
    else m.inflow += Math.abs(t.amount);
  }
  // Group transactions by month for the chart drill-down
  const txByMonth = new Map<string, TxRow[]>();
  for (const t of transactions) {
    const key = monthKey(t.date);
    if (!txByMonth.has(key)) txByMonth.set(key, []);
    txByMonth.get(key)!.push(t);
  }

  const monthlyTrend: MonthPoint[] = Array.from(byMonth.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, v]) => ({
      key,
      label: monthLabel(key),
      outflow: v.outflow,
      inflow: v.inflow,
      txns: (txByMonth.get(key) ?? []).map((t) => ({
        id: t.id,
        date: t.date,
        merchant: t.merchant_name ?? t.name,
        amount: t.amount,
        category: categoryFromPFC(t.personal_finance_category, t.category) ?? "Uncategorized",
        isIncome: t.amount < 0,
      })).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)),
    }))
    .slice(-6);

  // ── Category breakdown — current month vs previous month ──────────────
  const today = new Date();
  const currentMonth = today.toISOString().slice(0, 7);
  const prevDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevMonth = prevDate.toISOString().slice(0, 7);

  // Build top-level + detailed (subcategory) totals so the UI can drill
  // into "Food and Drink → Coffee Shops, Restaurants, Groceries…"
  function detailedLabel(pfc: { detailed?: string } | null | undefined): string {
    if (!pfc?.detailed) return "Other";
    return pfc.detailed
      .toLowerCase()
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  const currentByCat = new Map<string, number>();
  const prevByCat = new Map<string, number>();
  const currentDetail = new Map<string, Map<string, number>>(); // primary → detailed → amt
  const prevDetail = new Map<string, Map<string, number>>();
  for (const t of transactions) {
    if (t.amount <= 0) continue;
    const cat = categoryFromPFC(t.personal_finance_category, t.category);
    if (!cat) continue; // skip transfers, income, balance adjustments
    const sub = detailedLabel(t.personal_finance_category);
    const mk = monthKey(t.date);
    if (mk === currentMonth) {
      currentByCat.set(cat, (currentByCat.get(cat) ?? 0) + t.amount);
      if (!currentDetail.has(cat)) currentDetail.set(cat, new Map());
      const sm = currentDetail.get(cat)!;
      sm.set(sub, (sm.get(sub) ?? 0) + t.amount);
    } else if (mk === prevMonth) {
      prevByCat.set(cat, (prevByCat.get(cat) ?? 0) + t.amount);
      if (!prevDetail.has(cat)) prevDetail.set(cat, new Map());
      const sm = prevDetail.get(cat)!;
      sm.set(sub, (sm.get(sub) ?? 0) + t.amount);
    }
  }
  const allCategories = new Set([...currentByCat.keys(), ...prevByCat.keys()]);
  const categoryBreakdown: CategoryRow[] = Array.from(allCategories)
    .map((cat) => {
      const curSub = currentDetail.get(cat) ?? new Map();
      const prevSub = prevDetail.get(cat) ?? new Map();
      const subKeys = new Set([...curSub.keys(), ...prevSub.keys()]);
      // Include actual transactions for each subcategory so the UI can drill down
      const subTxns = new Map<string, TxRow[]>();
      for (const t of transactions) {
        if (t.amount <= 0) continue;
        if (monthKey(t.date) !== currentMonth) continue;
        if (categoryFromPFC(t.personal_finance_category, t.category) !== cat) continue;
        const sub = detailedLabel(t.personal_finance_category);
        if (!subTxns.has(sub)) subTxns.set(sub, []);
        subTxns.get(sub)!.push(t);
      }
      const details = Array.from(subKeys)
        .map((s) => ({
          subcategory: s,
          current: curSub.get(s) ?? 0,
          previous: prevSub.get(s) ?? 0,
          txns: (subTxns.get(s) ?? []).map((t) => ({
            id: t.id,
            date: t.date,
            merchant: t.merchant_name ?? t.name,
            amount: t.amount,
          })).sort((a, b) => b.amount - a.amount),
        }))
        .sort((a, b) => b.current - a.current);
      return {
        category: cat,
        current: currentByCat.get(cat) ?? 0,
        previous: prevByCat.get(cat) ?? 0,
        details,
      };
    })
    .sort((a, b) => b.current - a.current);

  // ── Recurring charges ─────────────────────────────────────────────────
  const recurring = detectRecurring(transactions, accountById);

  // ── Top merchants this month ──────────────────────────────────────────
  // Track the constituent transactions per merchant so we can also report
  // which account is the most common source for each.
  const merchantsThisMonth = new Map<
    string,
    { merchant: string; total: number; count: number; category: string; txns: TxRow[] }
  >();
  for (const t of transactions) {
    if (t.amount <= 0) continue;
    if (monthKey(t.date) !== currentMonth) continue;
    const merchant = (t.merchant_name ?? t.name).trim();
    if (!merchant) continue;
    const key = merchant.toLowerCase();
    if (!merchantsThisMonth.has(key)) {
      merchantsThisMonth.set(key, { merchant, total: 0, count: 0, category: categoryFromPFC(t.personal_finance_category, t.category) ?? "Uncategorized", txns: [] });
    }
    const m = merchantsThisMonth.get(key)!;
    m.total += t.amount;
    m.count += 1;
    m.txns.push(t);
  }
  const topMerchants: MerchantRow[] = Array.from(merchantsThisMonth.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, topN)
    .map((m) => ({
      merchant: m.merchant,
      total: m.total,
      count: m.count,
      category: m.category,
      accountSource: topAccountSource(m.txns, accountById),
    }));

  // ── Summary stats ─────────────────────────────────────────────────────
  const currentMonthOutflow = byMonth.get(currentMonth)?.outflow ?? 0;
  const prevMonthOutflow = byMonth.get(prevMonth)?.outflow ?? 0;
  const totalRecurringMonthly = recurring.reduce((s, r) => s + r.monthlyCost, 0);

  return (
    <div>

      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 28px 80px" }}>

        {/* Header section */}
        <section style={{ marginBottom: 32, paddingBottom: 20, borderBottom: "1px solid var(--color-rule)" }}>
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 10 }}>
            Last 12 months · {transactions.length.toLocaleString()} transactions
          </div>
          <h1 className="serif" style={{ fontSize: 40, lineHeight: 1.05 }}>
            Insights<span style={{ fontStyle: "italic", color: "var(--color-bronze-dark)" }}>.</span>
          </h1>
        </section>

        {transactions.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--color-ink-3)", textAlign: "center", padding: "60px 0" }}>
            No transactions to analyze yet. <Link href="/finance/dashboard" style={{ color: "var(--color-bronze-dark)" }}>Connect a bank →</Link>
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

            {/* Top-line stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              <StatCard
                label="This month spend"
                value={currentMonthOutflow}
                delta={prevMonthOutflow > 0 ? ((currentMonthOutflow - prevMonthOutflow) / prevMonthOutflow) * 100 : null}
                deltaSuffix="vs last month"
                invert
              />
              <StatCard
                label="Last month spend"
                value={prevMonthOutflow}
                delta={null}
              />
              <StatCard
                label="Recurring monthly"
                value={totalRecurringMonthly}
                delta={null}
                sub={`${recurring.length} subscription${recurring.length !== 1 ? "s" : ""}`}
              />
            </div>

            {/* Monthly trend */}
            <MonthlyTrendChart data={monthlyTrend} />

            {/* Category breakdown */}
            <CategoryBreakdown rows={categoryBreakdown.slice(0, 12)} />

            {/* Top-N picker — controls how many rows show in Recurring + Top merchants */}
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, paddingBottom: 4, fontSize: 11, color: "var(--color-ink-3)" }}>
              <span style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>Show top</span>
              {[10, 20, 50, 100].map((n) => (
                <Link
                  key={n}
                  href={`/finance/dashboard/insights?topN=${n}#top`}
                  scroll={false}
                  prefetch={false}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 14,
                    border: `1px solid ${n === topN ? "var(--color-bronze)" : "var(--color-rule)"}`,
                    background: n === topN ? "var(--color-bronze)" : "transparent",
                    color: n === topN ? "#fff" : "var(--color-ink-2)",
                    textDecoration: "none",
                    fontWeight: 600,
                    fontSize: 11,
                  }}
                >
                  {n}
                </Link>
              ))}
            </div>

            {/* Recurring + top merchants — side by side */}
            <div id="top" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 14 }}>
              <RecurringCharges rows={recurring.slice(0, topN)} />
              <TopMerchants rows={topMerchants} />
            </div>

            {/* AI Recommendations */}
            <Suspense fallback={
              <div style={{ background: "var(--color-paper-card)", border: "1px solid var(--color-rule)", borderRadius: 12, padding: "20px 24px", boxShadow: "var(--shadow-card)" }}>
                <h2 className="serif" style={{ fontSize: 20, marginBottom: 10 }}>Recommendations</h2>
                <p style={{ fontSize: 13, color: "var(--color-ink-4)", textAlign: "center", padding: "20px 0" }}>Analyzing your spending…</p>
              </div>
            }>
              <SpendingRecommendations
                currentMonthSpend={currentMonthOutflow}
                prevMonthSpend={prevMonthOutflow}
                recurringMonthly={totalRecurringMonthly}
                topCategories={categoryBreakdown.slice(0, 8).map((c) => ({ category: c.category, amount: c.current, prevAmount: c.previous }))}
                topMerchants={Array.from(merchantsThisMonth.values()).slice(0, 5).map((m) => ({ merchant: m.merchant, total: m.total, count: m.count }))}
              />
            </Suspense>

          </div>
        )}
      </main>
    </div>
  );
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function StatCard({
  label,
  value,
  delta,
  sub,
  deltaSuffix,
  invert,
}: {
  label: string;
  value: number;
  delta: number | null;
  sub?: string;
  deltaSuffix?: string;
  invert?: boolean; // if true, negative delta is good (e.g. less spending)
}) {
  const deltaColor =
    delta == null
      ? "var(--color-ink-4)"
      : invert
      ? delta < 0
        ? "var(--color-green)"
        : "var(--color-red)"
      : delta > 0
      ? "var(--color-green)"
      : "var(--color-red)";

  return (
    <div
      style={{
        background: "var(--color-paper-card)",
        border: "1px solid var(--color-rule)",
        borderRadius: 12,
        padding: "16px 18px",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 8 }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: 26, fontWeight: 500, color: "var(--color-ink)", letterSpacing: "-0.01em" }}>
        {fmtMoney(value)}
      </div>
      {delta != null && (
        <div style={{ fontSize: 11, color: deltaColor, marginTop: 6 }}>
          {delta > 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(1)}% <span style={{ color: "var(--color-ink-4)" }}>{deltaSuffix}</span>
        </div>
      )}
      {sub && <div style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
