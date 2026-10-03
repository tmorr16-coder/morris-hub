// Budgets: a monthly limit per category, where the month stands against it,
// and the alerts that raises.
//
// A budget is the one place a calendar month is the right window — the limit
// is "per month", so the question is what this month has spent. The
// projection comes from the same pace logic Insights uses: this month so far,
// plus what the last three full months spent after today's day, so a bill on
// the 1st does not turn into "on pace for triple".
//
// Alerts fire once. Each (budget, month, kind) is unique in the table, so the
// figures can be recomputed on every page view and every sync and the person
// is told once that they crossed 80%, once that they went over, once that the
// pace says they will. An alert raises a reminder — which is how Today's
// "Needs attention" hears about it — and, when the budget asks for it and the
// account has a number, a text.

/* eslint-disable @typescript-eslint/no-explicit-any */

import { flowOf, projectPace, labelForPrimary, type InsightTx, type Insight } from "./insights";
import { primaryOf } from "./spending";

export interface Budget {
  id: string;
  user_id: string;
  category: string;        // primary token, or "*"
  monthly_limit: number;
  warn_at_pct: number;
  notify_sms: boolean;
}

export type BudgetState = "ok" | "warn" | "projected" | "over";

export interface BudgetStatus {
  budget: Budget;
  label: string;
  month: string;           // YYYY-MM
  spent: number;
  limit: number;
  pct: number;             // 0..∞, spent / limit
  projected: number | null;
  remaining: number;       // limit − spent, may be negative
  daysLeft: number;
  /** What a day could spend from here to land exactly on the limit. */
  perDayLeft: number | null;
  state: BudgetState;
  txnIds: string[];
}

export interface BudgetAlert {
  id: string;
  budget_id: string;
  month: string;
  kind: "warn" | "over" | "projected";
  spent: number;
  limit_amount: number;
  projected: number | null;
  message: string;
  created_at: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

/** Transactions that count against this budget: posted spending in its category. */
export function inBudget(t: InsightTx, category: string): boolean {
  if (flowOf(t) !== "spend") return false;
  return category === "*" || primaryOf(t) === category;
}

/** Where one budget stands for the month `today` falls in. Pure. */
export function budgetStatus(txns: InsightTx[], budget: Budget, today: string): BudgetStatus {
  const month = today.slice(0, 7);
  const mine = txns.filter((t) => inBudget(t, budget.category));
  const thisMonth = mine.filter((t) => t.date.slice(0, 7) === month && t.date <= today);
  const spent = round2(thisMonth.reduce((s, t) => s + t.amount, 0));
  const limit = Number(budget.monthly_limit);
  const pace = projectPace(mine, today);
  const daysLeft = pace.daysInMonth - pace.dayOfMonth;
  const remaining = round2(limit - spent);
  const pct = limit > 0 ? spent / limit : 0;
  const projected = pace.projected;

  let state: BudgetState = "ok";
  if (spent >= limit) state = "over";
  else if (pct * 100 >= budget.warn_at_pct) state = "warn";
  else if (projected != null && projected > limit && pace.dayOfMonth >= 5) state = "projected";

  return {
    budget, label: labelForPrimary(budget.category), month, spent, limit, pct, projected,
    remaining, daysLeft,
    perDayLeft: daysLeft > 0 && remaining > 0 ? round2(remaining / daysLeft) : null,
    state, txnIds: thisMonth.map((t) => t.id),
  };
}

/** The alerts a status calls for. Which of them are new is the database's call. */
export function alertsFor(s: BudgetStatus): { kind: BudgetAlert["kind"]; message: string }[] {
  const out: { kind: BudgetAlert["kind"]; message: string }[] = [];
  const left = `${s.daysLeft} day${s.daysLeft === 1 ? "" : "s"} left`;
  if (s.spent >= s.limit) {
    out.push({ kind: "over", message: `${s.label} is over budget: ${fmt(s.spent)} of ${fmt(s.limit)}, with ${left} in the month.` });
  } else {
    if (s.pct * 100 >= s.budget.warn_at_pct) {
      out.push({ kind: "warn", message: `${s.label} is at ${Math.round(s.pct * 100)}% of its ${fmt(s.limit)} budget — ${fmt(s.spent)} spent, ${fmt(s.remaining)} left for ${left}.` });
    }
    if (s.projected != null && s.projected > s.limit && s.daysLeft > 0) {
      out.push({ kind: "projected", message: `${s.label} is on pace for ${fmt(s.projected)} against a ${fmt(s.limit)} budget. Staying under means about ${fmt(s.perDayLeft ?? 0)} a day from here.` });
    }
  }
  return out;
}

/** Budget standings as insight rows, so the Insights screen and its narrative carry them. */
export function budgetInsights(statuses: BudgetStatus[]): Insight[] {
  const out: Insight[] = [];
  for (const s of statuses) {
    const base = { anchor: "budgets" as unknown as Insight["anchor"], txnIds: s.txnIds, amount: s.spent, delta: round2(s.spent - s.limit) };
    const method = `Posted spending in ${s.label} from the 1st of the month to today, against the ${fmt(s.limit)} monthly limit you set. The projection adds what the last three full months spent after day ${s.month === "" ? "" : new Date().getDate()}.`;
    if (s.state === "over") out.push({ ...base, id: `budget-over:${s.budget.id}`, kind: "budget-over", level: "alert", title: `${s.label} is over budget`, detail: `${fmt(s.spent)} of ${fmt(s.limit)} with ${s.daysLeft} days left.`, method });
    else if (s.state === "warn") out.push({ ...base, id: `budget-warn:${s.budget.id}`, kind: "budget-warn", level: "watch", title: `${s.label} at ${Math.round(s.pct * 100)}% of budget`, detail: `${fmt(s.spent)} of ${fmt(s.limit)}; ${fmt(s.remaining)} left for ${s.daysLeft} days${s.perDayLeft != null ? ` — about ${fmt(s.perDayLeft)} a day` : ""}.`, method });
    else if (s.state === "projected") out.push({ ...base, id: `budget-projected:${s.budget.id}`, kind: "budget-projected", level: "watch", title: `${s.label} on pace to go over`, detail: `${fmt(s.spent)} so far, heading for ${fmt(s.projected ?? 0)} against ${fmt(s.limit)}.`, method, delta: round2((s.projected ?? 0) - s.limit) });
    else if (s.pct >= 0.5 || s.daysLeft <= 7) out.push({ ...base, id: `budget-ok:${s.budget.id}`, kind: "budget-ok", level: "good", title: `${s.label} within budget`, detail: `${fmt(s.spent)} of ${fmt(s.limit)}, ${s.daysLeft} days left.`, method });
  }
  return out;
}

// ── Database side ───────────────────────────────────────────────────────────

export type BudgetTables = { ok: true } | { ok: false; reason: "missing" | "error"; message: string };

export async function loadBudgets(svc: any, userId: string): Promise<{ budgets: Budget[]; tables: BudgetTables }> {
  const { data, error } = await svc.schema("finance").from("budgets")
    .select("id, user_id, category, monthly_limit, warn_at_pct, notify_sms")
    .eq("user_id", userId).order("created_at", { ascending: true });
  if (error) {
    const missing = /relation .* does not exist|schema cache|PGRST205|42P01/i.test(`${error.code} ${error.message}`);
    return { budgets: [], tables: { ok: false, reason: missing ? "missing" : "error", message: error.message } };
  }
  return { budgets: ((data ?? []) as any[]).map((b) => ({ ...b, monthly_limit: Number(b.monthly_limit), warn_at_pct: Number(b.warn_at_pct) })), tables: { ok: true } };
}

export async function loadRecentAlerts(svc: any, userId: string, limit = 12): Promise<BudgetAlert[]> {
  const { data } = await svc.schema("finance").from("budget_alerts")
    .select("id, budget_id, month, kind, spent, limit_amount, projected, message, created_at")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  return ((data ?? []) as any[]).map((a) => ({ ...a, spent: Number(a.spent), limit_amount: Number(a.limit_amount), projected: a.projected == null ? null : Number(a.projected) }));
}

/**
 * Transactions for the viewer's visible accounts, back far enough for the
 * three-month projection. Same source and filters as the Insights screen.
 */
export async function loadBudgetTransactions(svc: any, userId: string, today: string): Promise<InsightTx[]> {
  const { data: items } = await svc.schema("finance").from("plaid_items").select("id").eq("user_id", userId);
  const itemIds = ((items ?? []) as { id: string }[]).map((i) => i.id);
  if (itemIds.length === 0) return [];
  const { data: accts } = await svc.schema("finance").from("accounts").select("id, is_hidden").in("item_id", itemIds).is("deleted_at", null);
  const ids = ((accts ?? []) as { id: string; is_hidden: boolean }[]).filter((a) => !a.is_hidden).map((a) => a.id);
  if (ids.length === 0) return [];
  const from = new Date(new Date(`${today}T12:00:00Z`).getTime() - 125 * 86_400_000).toISOString().slice(0, 10);
  const { data } = await svc.schema("finance").from("transactions")
    .select("id, account_id, date, amount, merchant_name, name, pending, personal_finance_category, category")
    .in("account_id", ids).gte("date", from).order("date", { ascending: true });
  return (data ?? []) as InsightTx[];
}

export interface EvaluationResult {
  statuses: BudgetStatus[];
  fired: { status: BudgetStatus; kind: BudgetAlert["kind"]; message: string; sms: boolean }[];
  tables: BudgetTables;
}

/**
 * Compute every budget's standing and raise whatever alerts are new.
 *
 * Safe to call as often as you like: the unique key on (budget, month, kind)
 * means a second call in the same month inserts nothing and sends nothing.
 */
export async function evaluateBudgets(svc: any, userId: string, today: string, opts: { txns?: InsightTx[]; notify?: boolean } = {}): Promise<EvaluationResult> {
  const { budgets, tables } = await loadBudgets(svc, userId);
  if (!tables.ok || budgets.length === 0) return { statuses: [], fired: [], tables };
  const txns = opts.txns ?? (await loadBudgetTransactions(svc, userId, today));
  const statuses = budgets.map((b) => budgetStatus(txns, b, today));
  const fired: EvaluationResult["fired"] = [];

  for (const s of statuses) {
    for (const a of alertsFor(s)) {
      const { data: inserted, error } = await svc.schema("finance").from("budget_alerts")
        .insert({ user_id: userId, budget_id: s.budget.id, month: s.month, kind: a.kind, spent: s.spent, limit_amount: s.limit, projected: s.projected, message: a.message })
        .select("id").maybeSingle();
      if (error || !inserted) continue;          // already raised this month, or the table is not there

      let reminderId: string | null = null;
      let sms = false;
      if (opts.notify !== false) {
        const { data: rem } = await svc.schema("hub").from("reminders")
          .insert({
            user_id: userId,
            title: `Budget: ${s.label} ${a.kind === "over" ? "over" : a.kind === "warn" ? `at ${Math.round(s.pct * 100)}%` : "on pace to go over"}`,
            notes: `${a.message} See /finance/dashboard/budgets.`,
            due_at: new Date().toISOString(),
            category: "bill",
            source_app: "finance",
          }).select("id").maybeSingle();
        reminderId = (rem as { id: string } | null)?.id ?? null;

        if (s.budget.notify_sms) sms = await textAlert(svc, userId, s, a.message);
        await svc.schema("finance").from("budget_alerts").update({ reminder_id: reminderId, sms_sent: sms }).eq("id", (inserted as { id: string }).id);
      }
      fired.push({ status: s, kind: a.kind, message: a.message, sms });
    }
  }
  return { statuses, fired, tables };
}

async function textAlert(svc: any, userId: string, s: BudgetStatus, message: string): Promise<boolean> {
  try {
    const { data: prefs } = await svc.schema("hub").from("preferences").select("phone_number, sms_notifications_enabled").eq("user_id", userId).maybeSingle();
    const p = prefs as { phone_number?: string | null; sms_notifications_enabled?: boolean | null } | null;
    if (!p?.phone_number || p.sms_notifications_enabled === false) return false;
    const { sendSMSReminder } = await import("@/lib/sms");
    const r = await sendSMSReminder(p.phone_number, `Budget — ${s.label}`, new Date().toISOString(), undefined, message);
    return r.success;
  } catch {
    return false;
  }
}

/** Every user who has set a budget — for the daily pass after the bank sync. */
export async function usersWithBudgets(svc: any): Promise<string[]> {
  const { data, error } = await svc.schema("finance").from("budgets").select("user_id");
  if (error) return [];
  return [...new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id))];
}

/** A limit to suggest for a category: its per-month average over the last three full months, rounded up to $10. */
export function suggestLimit(txns: InsightTx[], category: string, today: string): number | null {
  const month = today.slice(0, 7);
  const months = new Map<string, number>();
  for (const t of txns) {
    if (!inBudget(t, category)) continue;
    const m = t.date.slice(0, 7);
    if (m === month) continue;
    months.set(m, (months.get(m) ?? 0) + t.amount);
  }
  const recent = [...months.entries()].sort(([a], [b]) => b.localeCompare(a)).slice(0, 3).map(([, v]) => v);
  if (recent.length === 0) return null;
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  return Math.ceil(avg / 10) * 10;
}
