// The spending insight engine.
//
// Everything on the Insights screen that makes a claim with a dollar figure in
// it comes from here, computed, so it is right by construction. The model that
// writes the narrative on top is handed these facts and told to use only them —
// it narrates and ranks; it never invents a number.
//
// What was here before: a calendar-month total that read "$212, down 94%" on
// the third of every month, a recurring detector that threw away any bill
// whose amount varied, and an AI prompt fed eight category totals and asked to
// think of something to say. Nothing noticed a new subscription, a price rise,
// a double charge, or a merchant that had tripled.
//
// Sign convention follows the rest of finance/: a positive amount is money
// leaving the account, a negative one is money arriving. Pending rows are
// skipped throughout — the posted copy that follows would double-count them.

import { primaryOf } from "./spending";

export interface InsightTx {
  id: string;
  account_id: string;
  date: string;            // YYYY-MM-DD
  amount: number;
  merchant_name: string | null;
  name: string;
  pending: boolean | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  personal_finance_category: any;
  category: string[] | null;
}

// ── Classification ──────────────────────────────────────────────────────────

const EXCLUDED_PRIMARIES = new Set(["TRANSFER_IN", "INCOME", "BALANCE"]);

/** The detailed category as an upper-case token, or null. */
export function detailedOf(t: InsightTx): string | null {
  const pfc = t.personal_finance_category;
  if (!pfc || typeof pfc !== "object" || Array.isArray(pfc)) return null;
  const d = (pfc as { detailed?: string }).detailed;
  return d ? String(d).toUpperCase() : null;
}

/**
 * A card payment seen from the paying account. When the card itself is linked
 * its purchases are already counted, so the payment is the same money twice.
 * Plaid labels these precisely; SimpleFIN does not, so the name is checked too,
 * narrowly — only phrasings banks actually print on a payment line.
 */
const CARD_PAYMENT_NAME = /\b(payment|pymt|autopay)\b[^a-z]*\b(thank you|received|rec'd)\b|^(chase|amex|american express|capital one|discover|citi|barclays|synchrony|us bank|wells fargo|apple card)\b.*\b(payment|pymt|autopay)\b/i;

export type Flow = "spend" | "income" | "transfer" | "ignore";

/** Which side of the ledger a transaction belongs to, for every window below. */
export function flowOf(t: InsightTx): Flow {
  if (t.pending) return "ignore";
  const primary = primaryOf(t);
  if (t.amount < 0) return primary === "INCOME" ? "income" : "transfer";
  if (t.amount === 0) return "ignore";
  if (primary && EXCLUDED_PRIMARIES.has(primary)) return "transfer";
  const detailed = detailedOf(t);
  if (detailed === "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT") return "transfer";
  if (detailed === "TRANSFER_OUT_ACCOUNT_TRANSFER") return "transfer";
  if ((primary === "LOAN_PAYMENTS" || primary === "TRANSFER_OUT" || primary == null) && CARD_PAYMENT_NAME.test(`${t.merchant_name ?? ""} ${t.name}`)) return "transfer";
  return "spend";
}

/** "Food And Drink" from FOOD_AND_DRINK, or the legacy array's first entry. */
export function categoryLabel(t: InsightTx): string {
  const p = primaryOf(t);
  if (!p) return "Uncategorized";
  return p.toLowerCase().split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// ── Merchant normalisation ──────────────────────────────────────────────────

/**
 * One key per real merchant, from the strings banks actually send.
 *
 * "AMAZON PRIME*2K3J7" and "AMAZON PRIME*8H2D1" are the same subscription;
 * "SQ *BLUE BOTTLE" is Blue Bottle, not Square; "NETFLIX.COM DES:NETFLIX" is
 * Netflix. Grouping on the raw string missed every one of these, which is why
 * the old detector found so little that recurs.
 */
export function cleanMerchant(raw: string): string {
  let s = raw.replace(/\s+/g, " ").trim();
  // Processor prefixes: the real merchant follows them.
  s = s.replace(/^(sq|tst|pp|py|pypl|paypal|dd|sp|ebay o)\s*\*\s*/i, "");
  // ACH descriptors carry the merchant before "des:".
  s = s.replace(/\s+des:.*$/i, "");
  // A trailing "*token" is an order or store reference, not a name.
  s = s.replace(/\s*\*\s*[a-z0-9.\-]*$/i, "");
  // Store numbers, order numbers and dates at the end. Two digits or more for
  // a store number, three or more for a bare one: "Corner Store 4" is a name,
  // "WALMART STORE 1234" is a name and a store.
  s = s.replace(/(\s+(#|no\.?|store)\s*\d{2,}|\s+\d{1,2}\/\d{1,2}(\/\d{2,4})?|\s+[-–]\s*\d{2,}|\s+\d{3,})+$/gi, "");
  s = s.replace(/^(www\.)/i, "").replace(/\.(com|net|org|co)\b/gi, "");
  s = s.replace(/[^a-z0-9& ]+/gi, " ").replace(/\s+/g, " ").trim();
  return s;
}

export function normalizeMerchant(raw: string): string {
  return cleanMerchant(raw).toLowerCase();
}

/** The commonest raw name in the group, cleaned, and out of shouting case. */
function displayName(txns: InsightTx[]): string {
  const counts = new Map<string, number>();
  for (const t of txns) {
    const n = (t.merchant_name ?? t.name).trim();
    if (n) counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  let best = "";
  let bestN = 0;
  for (const [n, c] of counts) if (c > bestN) { best = n; bestN = c; }
  return prettyMerchant(best);
}

export function prettyMerchant(raw: string): string {
  const c = cleanMerchant(raw) || raw.trim();
  if (c !== c.toUpperCase() || !/[a-z]/i.test(c)) return c;
  return c.toLowerCase().replace(/(^|\s|&)([a-z])/g, (m) => m.toUpperCase());
}

// ── Dates ───────────────────────────────────────────────────────────────────

const DAY = 86_400_000;
function iso(d: Date): string { return d.toISOString().slice(0, 10); }
function atNoon(day: string): Date { return new Date(`${day}T12:00:00Z`); }
function daysBetween(a: string, b: string): number { return Math.round((atNoon(b).getTime() - atNoon(a).getTime()) / DAY); }
function shiftDays(day: string, n: number): string { return iso(new Date(atNoon(day).getTime() + n * DAY)); }
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function mean(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
function round2(n: number): number { return Math.round(n * 100) / 100; }

// ── Recurring ───────────────────────────────────────────────────────────────

export type Cadence = "Weekly" | "Biweekly" | "Monthly" | "Quarterly" | "Annual";

export interface RecurringSeries {
  key: string;
  merchant: string;
  category: string;
  cadence: Cadence;
  /** Fixed amounts (a subscription) or ones that move with usage (a utility). */
  variable: boolean;
  amount: number;          // typical charge — the median
  lastAmount: number;
  monthlyCost: number;
  occurrences: number;
  firstCharged: string;
  lastCharged: string;
  nextExpected: string;
  /** Overdue: a cycle late. Lapsed: more than two — probably cancelled. */
  status: "active" | "overdue" | "lapsed";
  isNew: boolean;
  /** Last charge against the typical one, in dollars. Null when within noise. */
  priceChange: number | null;
  accountId: string;
  txnIds: string[];
}

const MONTHS_PER: Record<Cadence, number> = { Weekly: 4.33, Biweekly: 2.17, Monthly: 1, Quarterly: 1 / 3, Annual: 1 / 12 };

function cadenceOf(medianGap: number): Cadence | null {
  if (medianGap >= 5 && medianGap <= 9) return "Weekly";
  if (medianGap >= 12 && medianGap <= 17) return "Biweekly";
  if (medianGap >= 25 && medianGap <= 36) return "Monthly";
  if (medianGap >= 80 && medianGap <= 100) return "Quarterly";
  if (medianGap >= 350 && medianGap <= 380) return "Annual";
  return null;
}

function gapDays(cadence: Cadence): number {
  return { Weekly: 7, Biweekly: 14, Monthly: 30, Quarterly: 91, Annual: 365 }[cadence];
}

export function detectRecurring(txns: InsightTx[], today: string): RecurringSeries[] {
  const groups = new Map<string, InsightTx[]>();
  for (const t of txns) {
    if (flowOf(t) !== "spend") continue;
    const key = normalizeMerchant(t.merchant_name ?? t.name);
    if (!key) continue;
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }

  const out: RecurringSeries[] = [];
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    // One charge per day: a split tender on the same day is one bill.
    const byDay = new Map<string, InsightTx>();
    for (const t of [...group].sort((a, b) => a.date.localeCompare(b.date))) {
      const prev = byDay.get(t.date);
      byDay.set(t.date, prev ? { ...prev, amount: prev.amount + t.amount } : t);
    }
    const sorted = [...byDay.values()];
    if (sorted.length < 2) continue;

    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) gaps.push(daysBetween(sorted[i - 1].date, sorted[i].date));
    const cadence = cadenceOf(median(gaps));
    if (!cadence) continue;
    // Most gaps must agree with the cadence, not just the middle one.
    const expected = gapDays(cadence);
    const agree = gaps.filter((g) => Math.abs(g - expected) <= Math.max(3, expected * 0.25)).length;
    if (agree / gaps.length < 0.6) continue;

    const amounts = sorted.map((t) => t.amount);
    const typical = median(amounts);
    if (typical <= 0) continue;
    const cv = Math.sqrt(mean(amounts.map((a) => (a - typical) ** 2))) / typical;
    // A subscription is the same to the cent; anything that moves at all is
    // usage-priced, and reads as a bill rather than a plan.
    const variable = cv > 0.05;
    if (cv > 0.45) continue;

    const minOcc = cadence === "Weekly" ? 4 : cadence === "Biweekly" ? 3 : variable ? 3 : 2;
    if (sorted.length < minOcc) continue;

    const last = sorted[sorted.length - 1];
    const first = sorted[0];
    const nextExpected = shiftDays(last.date, Math.round(median(gaps)));
    const late = daysBetween(nextExpected, today);
    const status: RecurringSeries["status"] = late > expected * 1.5 ? "lapsed" : late > expected * 0.5 ? "overdue" : "active";

    // A price change only means something against a price that held still:
    // the earlier charges must agree with each other to the cent (or near
    // enough), otherwise the last reading moved because the usage did.
    const prior = amounts.slice(0, -1);
    const priorTypical = prior.length ? median(prior) : typical;
    const priorCv = prior.length > 1 ? Math.sqrt(mean(prior.map((a) => (a - priorTypical) ** 2))) / priorTypical : 0;
    const change = last.amount - priorTypical;
    const priceChange = priorCv <= 0.03 && Math.abs(change) >= Math.max(1, priorTypical * 0.05) ? round2(change) : null;

    out.push({
      key,
      merchant: displayName(group),
      category: categoryLabel(last),
      cadence,
      variable,
      amount: round2(typical),
      lastAmount: round2(last.amount),
      monthlyCost: round2(typical * MONTHS_PER[cadence]),
      occurrences: sorted.length,
      firstCharged: first.date,
      lastCharged: last.date,
      nextExpected,
      status,
      isNew: daysBetween(first.date, today) <= 45,
      priceChange,
      accountId: last.account_id,
      txnIds: group.map((t) => t.id),
    });
  }
  return out.sort((a, b) => b.monthlyCost - a.monthlyCost);
}

// ── Windows and pace ────────────────────────────────────────────────────────

export interface Window {
  from: string;            // inclusive
  to: string;              // inclusive
  spend: number;
  income: number;
  transfers: number;
  net: number;
  savingsRate: number | null;
  count: number;
}

export function summariseWindow(txns: InsightTx[], from: string, to: string): Window {
  const w: Window = { from, to, spend: 0, income: 0, transfers: 0, net: 0, savingsRate: null, count: 0 };
  for (const t of txns) {
    if (t.date < from || t.date > to) continue;
    const f = flowOf(t);
    if (f === "ignore") continue;
    w.count++;
    if (f === "spend") w.spend += t.amount;
    else if (f === "income") w.income += Math.abs(t.amount);
    else w.transfers += Math.abs(t.amount);
  }
  w.spend = round2(w.spend); w.income = round2(w.income); w.transfers = round2(w.transfers);
  w.net = round2(w.income - w.spend);
  w.savingsRate = w.income > 0 ? round2(w.net / w.income) : null;
  return w;
}

export interface Pace {
  month: string;           // YYYY-MM
  dayOfMonth: number;
  daysInMonth: number;
  spentSoFar: number;
  /** spentSoFar plus what the prior full months spent after this day. */
  projected: number | null;
  /** Average of the prior full months used for the projection. */
  baseline: number | null;
  baselineMonths: number;
}

/**
 * Where this month is heading.
 *
 * Not spent-so-far scaled by the calendar — rent on the 1st makes that read
 * "on pace for $19,000" on the 2nd. The projection adds what the last three
 * full months spent *after* this day of the month, which carries the shape of
 * a month: the mid-month card bill, the late-month groceries.
 */
export function projectPace(txns: InsightTx[], today: string): Pace {
  const month = today.slice(0, 7);
  const dayOfMonth = Number(today.slice(8, 10));
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const spentSoFar = summariseWindow(txns, `${month}-01`, today).spend;

  const remainders: number[] = [];
  const fulls: number[] = [];
  for (let back = 1; back <= 3; back++) {
    const d = new Date(Date.UTC(y, m - 1 - back, 1));
    const mk = iso(d).slice(0, 7);
    const dim = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    const whole = summariseWindow(txns, `${mk}-01`, `${mk}-${String(dim).padStart(2, "0")}`);
    if (whole.count === 0) continue;
    const upTo = summariseWindow(txns, `${mk}-01`, `${mk}-${String(Math.min(dayOfMonth, dim)).padStart(2, "0")}`);
    fulls.push(whole.spend);
    remainders.push(whole.spend - upTo.spend);
  }
  return {
    month, dayOfMonth, daysInMonth,
    spentSoFar: round2(spentSoFar),
    projected: remainders.length ? round2(spentSoFar + mean(remainders)) : null,
    baseline: fulls.length ? round2(mean(fulls)) : null,
    baselineMonths: fulls.length,
  };
}

// ── Insights ────────────────────────────────────────────────────────────────

export type InsightKind =
  | "pace" | "cashflow" | "runway"
  | "category-up" | "category-down"
  | "merchant-spike" | "merchant-new"
  | "recurring-new" | "recurring-price" | "recurring-lapsed" | "recurring-overdue"
  | "large" | "duplicate";

/** alert: act on it. watch: worth a look. good: a thing going right. info: context. */
export type InsightLevel = "alert" | "watch" | "good" | "info";

export interface Insight {
  id: string;
  kind: InsightKind;
  level: InsightLevel;
  title: string;
  detail: string;
  amount: number | null;
  /** Change against the comparison, in dollars, where there is one. */
  delta: number | null;
  /** Where on the screen the evidence lives. */
  anchor: "recurring" | "categories" | "merchants" | "trend" | null;
  txnIds: string[];
}

export interface InsightReport {
  today: string;
  last30: Window;
  prior30: Window;
  /** Per-30-day average over the 90 days before the last 30. Null with under 60 days of history. */
  baseline30: Window | null;
  pace: Pace;
  recurring: RecurringSeries[];
  recurringMonthly: number;
  insights: Insight[];
  /** Earliest and latest dates seen, so the screen can say how much history it has. */
  span: { from: string; to: string; days: number } | null;
  /** Stable hash of every number above, for caching whatever is built on top. */
  fingerprint: string;
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
/** The move from `from` to `to` as a share of `from`. */
function pct(from: number, to: number): string {
  if (from <= 0) return "—";
  return `${Math.round((Math.abs(to - from) / from) * 100)}%`;
}

const LEVEL_ORDER: Record<InsightLevel, number> = { alert: 0, watch: 1, good: 2, info: 3 };

export function computeInsights(
  all: InsightTx[],
  opts: { today?: string; cashBalance?: number | null } = {},
): InsightReport {
  const today = opts.today ?? iso(new Date());
  const txns = all.filter((t) => !t.pending && t.date <= today);
  const dates = txns.map((t) => t.date).sort();
  const span = dates.length ? { from: dates[0], to: dates[dates.length - 1], days: daysBetween(dates[0], today) + 1 } : null;

  const last30 = summariseWindow(txns, shiftDays(today, -29), today);
  const prior30 = summariseWindow(txns, shiftDays(today, -59), shiftDays(today, -30));
  let baseline30: Window | null = null;
  if (span && span.days >= 60) {
    const base = summariseWindow(txns, shiftDays(today, -119), shiftDays(today, -30));
    const covered = Math.min(90, Math.max(1, daysBetween(span.from, shiftDays(today, -30)) + 1));
    const k = covered / 30;
    baseline30 = {
      ...base,
      spend: round2(base.spend / k), income: round2(base.income / k), transfers: round2(base.transfers / k),
      net: round2((base.income - base.spend) / k), count: Math.round(base.count / k),
      savingsRate: base.income > 0 ? round2((base.income - base.spend) / base.income) : null,
    };
  }
  const compare = baseline30 ?? (prior30.count > 0 ? prior30 : null);
  const compareLabel = baseline30 ? "your 3-month average" : "the 30 days before";

  const pace = projectPace(txns, today);
  const recurring = detectRecurring(txns, today);
  const recurringKeys = new Set(recurring.map((r) => r.key));
  const recurringMonthly = round2(recurring.filter((r) => r.status !== "lapsed").reduce((s, r) => s + r.monthlyCost, 0));

  const insights: Insight[] = [];
  const push = (i: Omit<Insight, "id">) => insights.push({ id: `${i.kind}:${insights.length}`, ...i });

  // Pace.
  if (pace.projected != null && pace.baseline != null && pace.baseline > 0 && pace.dayOfMonth >= 3) {
    const delta = pace.projected - pace.baseline;
    const rel = delta / pace.baseline;
    const level: InsightLevel = rel >= 0.15 && delta >= 200 ? "alert" : rel >= 0.05 ? "watch" : rel <= -0.05 ? "good" : "info";
    push({
      kind: "pace", level,
      title: `On pace for ${fmt(pace.projected)} this month`,
      detail: `${fmt(pace.spentSoFar)} spent through day ${pace.dayOfMonth}. ${delta >= 0 ? "Above" : "Below"} your ${pace.baselineMonths}-month average of ${fmt(pace.baseline)} by ${fmt(Math.abs(delta))}.`,
      amount: pace.projected, delta: round2(delta), anchor: "trend", txnIds: [],
    });
  }

  // Cash flow.
  if (last30.income > 0) {
    const rate = last30.savingsRate ?? 0;
    push({
      kind: "cashflow",
      level: last30.net < 0 ? "alert" : rate >= 0.2 ? "good" : "info",
      title: last30.net < 0 ? `Spent ${fmt(-last30.net)} more than came in` : `Kept ${Math.round(rate * 100)}% of what came in`,
      detail: `Last 30 days: ${fmt(last30.income)} in, ${fmt(last30.spend)} out${last30.transfers > 0 ? `, ${fmt(last30.transfers)} in transfers and card payments set aside` : ""}.`,
      amount: last30.net, delta: null, anchor: "trend", txnIds: [],
    });
  } else if (last30.count > 0 && prior30.income > 0) {
    push({
      kind: "cashflow", level: "watch",
      title: "No income recorded in the last 30 days",
      detail: `The 30 days before had ${fmt(prior30.income)} in. If pay is late or lands elsewhere, the savings figures below are off.`,
      amount: null, delta: null, anchor: "trend", txnIds: [],
    });
  }

  // Runway.
  const monthlySpend = baseline30 ? (baseline30.spend * 3 + last30.spend) / 4 : last30.spend;
  if (opts.cashBalance != null && monthlySpend > 0) {
    const months = opts.cashBalance / monthlySpend;
    push({
      kind: "runway",
      level: months < 1 ? "alert" : months < 3 ? "watch" : months >= 6 ? "good" : "info",
      title: `${months < 1 ? "Under a month" : `${months.toFixed(1)} months`} of spending in cash`,
      detail: `${fmt(opts.cashBalance)} across cash accounts against about ${fmt(monthlySpend)} a month out.`,
      amount: opts.cashBalance, delta: null, anchor: null, txnIds: [],
    });
  }

  // Categories against the comparison window.
  if (compare) {
    const cur = new Map<string, number>();
    const base = new Map<string, number>();
    const curIds = new Map<string, string[]>();
    for (const t of txns) {
      if (flowOf(t) !== "spend") continue;
      const c = categoryLabel(t);
      if (t.date >= last30.from) {
        cur.set(c, (cur.get(c) ?? 0) + t.amount);
        curIds.set(c, [...(curIds.get(c) ?? []), t.id]);
      } else if (t.date >= compare.from && t.date <= compare.to) {
        base.set(c, (base.get(c) ?? 0) + t.amount);
      }
    }
    const k = baseline30 ? (daysBetween(compare.from, compare.to) + 1) / 30 : 1;
    const movers: { c: string; now: number; then: number }[] = [];
    for (const c of new Set([...cur.keys(), ...base.keys()])) {
      movers.push({ c, now: cur.get(c) ?? 0, then: (base.get(c) ?? 0) / k });
    }
    const ups = movers.filter((m) => m.then > 0 && m.now >= m.then * 1.3 && m.now - m.then >= 75).sort((a, b) => (b.now - b.then) - (a.now - a.then)).slice(0, 3);
    for (const m of ups) push({
      kind: "category-up", level: m.now - m.then >= 300 ? "alert" : "watch",
      title: `${m.c} up ${pct(m.then, m.now)}`,
      detail: `${fmt(m.now)} in the last 30 days against ${fmt(m.then)} for ${compareLabel}.`,
      amount: round2(m.now), delta: round2(m.now - m.then), anchor: "categories", txnIds: curIds.get(m.c) ?? [],
    });
    // A category at zero is usually a bill that has not landed yet, not a
    // saving, so "down" needs some spending in the window to be worth saying.
    const downs = movers.filter((m) => m.then > 0 && m.now > 0 && m.now <= m.then * 0.6 && m.then - m.now >= 75).sort((a, b) => (b.then - b.now) - (a.then - a.now)).slice(0, 2);
    for (const m of downs) push({
      kind: "category-down", level: "good",
      title: `${m.c} down ${pct(m.then, m.now)}`,
      detail: `${fmt(m.now)} in the last 30 days against ${fmt(m.then)} for ${compareLabel}.`,
      amount: round2(m.now), delta: round2(m.now - m.then), anchor: "categories", txnIds: curIds.get(m.c) ?? [],
    });
  }

  // Merchants: spikes against their own history, and big newcomers.
  {
    const cur = new Map<string, { name: string; total: number; ids: string[] }>();
    const hist = new Map<string, { total: number; first: string }>();
    for (const t of txns) {
      if (flowOf(t) !== "spend") continue;
      const key = normalizeMerchant(t.merchant_name ?? t.name);
      if (!key) continue;
      if (t.date >= last30.from) {
        const c = cur.get(key) ?? { name: prettyMerchant(t.merchant_name ?? t.name), total: 0, ids: [] };
        c.total += t.amount; c.ids.push(t.id); cur.set(key, c);
      } else {
        const h = hist.get(key) ?? { total: 0, first: t.date };
        h.total += t.amount; if (t.date < h.first) h.first = t.date; hist.set(key, h);
      }
    }
    const histDays = span ? Math.max(30, Math.min(335, daysBetween(span.from, shiftDays(today, -30)) + 1)) : 30;
    const spikes: { key: string; name: string; now: number; then: number; ids: string[] }[] = [];
    const newcomers: { name: string; now: number; ids: string[] }[] = [];
    for (const [key, c] of cur) {
      if (recurringKeys.has(key)) continue;
      const h = hist.get(key);
      if (h) {
        const then = h.total / (histDays / 30);
        if (c.total >= then * 2 && c.total - then >= 60) spikes.push({ key, name: c.name, now: c.total, then, ids: c.ids });
      } else if (c.total >= 200 && c.ids.length >= 2 && span && span.days >= 60) {
        newcomers.push({ name: c.name, now: c.total, ids: c.ids });
      }
    }
    for (const s of spikes.sort((a, b) => (b.now - b.then) - (a.now - a.then)).slice(0, 3)) push({
      kind: "merchant-spike", level: s.now - s.then >= 250 ? "alert" : "watch",
      title: `${s.name}: ${fmt(s.now)} this month`,
      detail: `Usually about ${fmt(s.then)} a month — ${Math.round(s.now / s.then * 10) / 10}× the norm.`,
      amount: round2(s.now), delta: round2(s.now - s.then), anchor: "merchants", txnIds: s.ids,
    });
    for (const n of newcomers.sort((a, b) => b.now - a.now).slice(0, 2)) push({
      kind: "merchant-new", level: "info",
      title: `New: ${n.name}, ${fmt(n.now)}`,
      detail: `First seen in the last 30 days, with nothing in the ${Math.round(histDays / 30)} months before.`,
      amount: round2(n.now), delta: null, anchor: "merchants", txnIds: n.ids,
    });
  }

  // Recurring: what changed.
  for (const r of recurring) {
    if (r.isNew) push({
      kind: "recurring-new", level: r.monthlyCost >= 50 ? "watch" : "info",
      title: `New ${r.cadence.toLowerCase()} charge: ${r.merchant}`,
      detail: `${fmt(r.amount)} each time, ${r.occurrences}× since ${r.firstCharged}. About ${fmt(r.monthlyCost)} a month if it keeps going.`,
      amount: r.monthlyCost, delta: null, anchor: "recurring", txnIds: r.txnIds,
    });
    if (r.priceChange != null) push({
      kind: "recurring-price", level: r.priceChange > 0 ? "watch" : "good",
      title: `${r.merchant} ${r.priceChange > 0 ? "went up" : "went down"} ${fmt(Math.abs(r.priceChange))}`,
      detail: `Last charge ${fmt(r.lastAmount)} against the usual ${fmt(r.amount)}${r.cadence === "Monthly" ? ` — ${fmt(Math.abs(r.priceChange) * 12)} a year` : ""}.`,
      amount: r.lastAmount, delta: r.priceChange, anchor: "recurring", txnIds: r.txnIds,
    });
    if (r.status === "lapsed" && r.monthlyCost >= 5) push({
      kind: "recurring-lapsed", level: "info",
      title: `${r.merchant} stopped charging`,
      detail: `Was ${fmt(r.amount)} ${r.cadence.toLowerCase()}; last seen ${r.lastCharged}. If that was a cancellation, it saves ${fmt(r.monthlyCost)} a month.`,
      amount: r.monthlyCost, delta: null, anchor: "recurring", txnIds: r.txnIds,
    });
    else if (r.status === "overdue" && r.monthlyCost >= 20 && !r.variable) push({
      kind: "recurring-overdue", level: "info",
      title: `${r.merchant} is late`,
      detail: `Expected around ${r.nextExpected}; the last ${fmt(r.amount)} was ${r.lastCharged}.`,
      amount: r.amount, delta: null, anchor: "recurring", txnIds: r.txnIds,
    });
  }

  // Duplicates: same merchant, same amount, within two days.
  {
    const seen = new Map<string, InsightTx>();
    const flagged = new Set<string>();
    for (const t of [...txns].sort((a, b) => a.date.localeCompare(b.date))) {
      if (flowOf(t) !== "spend" || t.amount < 20) continue;
      const key = `${normalizeMerchant(t.merchant_name ?? t.name)}|${t.amount.toFixed(2)}`;
      const prev = seen.get(key);
      if (prev && prev.id !== t.id && daysBetween(prev.date, t.date) <= 2 && !flagged.has(prev.id) && !recurringKeys.has(normalizeMerchant(t.merchant_name ?? t.name))) {
        flagged.add(prev.id); flagged.add(t.id);
        if (t.date >= shiftDays(today, -59)) push({
          kind: "duplicate", level: "alert",
          title: `${prettyMerchant(t.merchant_name ?? t.name)} charged ${fmt(t.amount)} twice`,
          detail: `${prev.date} and ${t.date}. Worth checking it was not a double charge.`,
          amount: round2(t.amount), delta: null, anchor: "merchants", txnIds: [prev.id, t.id],
        });
      }
      seen.set(key, t);
    }
  }

  // Large one-offs in the last 30 days.
  {
    const spends = txns.filter((t) => flowOf(t) === "spend" && t.date >= shiftDays(today, -89)).map((t) => t.amount);
    if (spends.length >= 20) {
      const threshold = Math.max(250, 4 * median(spends));
      const big = txns
        .filter((t) => flowOf(t) === "spend" && t.date >= last30.from && t.amount >= threshold && !recurringKeys.has(normalizeMerchant(t.merchant_name ?? t.name)))
        .sort((a, b) => b.amount - a.amount).slice(0, 3);
      for (const t of big) push({
        kind: "large", level: "info",
        title: `${fmt(t.amount)} at ${prettyMerchant(t.merchant_name ?? t.name)}`,
        detail: `${t.date} · ${categoryLabel(t)}. Larger than ${Math.round(threshold / median(spends))}× your typical charge.`,
        amount: round2(t.amount), delta: null, anchor: "merchants", txnIds: [t.id],
      });
    }
  }

  insights.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || Math.abs(b.delta ?? b.amount ?? 0) - Math.abs(a.delta ?? a.amount ?? 0));

  const fingerprint = hashString(JSON.stringify({
    today, l: [last30.spend, last30.income], p: [prior30.spend, prior30.income], pace: [pace.spentSoFar, pace.projected],
    rec: recurring.map((r) => [r.key, r.lastAmount, r.status, r.priceChange]),
    ins: insights.map((i) => [i.kind, i.title, i.amount, i.delta]),
  }));

  return { today, last30, prior30, baseline30, pace, recurring, recurringMonthly, insights, span, fingerprint };
}

/** FNV-1a, enough to tell two reports apart. Not a security hash. */
function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0") + s.length.toString(16);
}
