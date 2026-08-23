/**
 * Cash-flow summary from transactions.
 *
 * The Money dashboard already fetched `personal_finance_category` on every
 * transaction and never read it — the categorisation lived one screen away in
 * Insights, so the first screen anyone opens could report what they *have* but
 * never what they earn, spend or keep. This is the shared piece so both can.
 *
 * Sign convention follows SimpleFIN/Plaid: a positive `amount` is money leaving
 * the account, a negative one is money arriving.
 */

/** Categories that are not user spending — money in, or pure balance noise. */
const EXCLUDED_PRIMARIES_UPPER = new Set(["TRANSFER_IN", "INCOME", "BALANCE"]);

/** Categories that represent money arriving, for the income side. */
const INCOME_PRIMARIES_UPPER = new Set(["INCOME"]);

export interface TxnLike {
  date: string;
  amount: number;
  pending?: boolean | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  personal_finance_category?: any;
  category?: string[] | null;
}

/** The primary category as an upper-case token, or null when unreadable. */
export function primaryOf(t: TxnLike): string | null {
  const pfc = t.personal_finance_category;
  if (Array.isArray(pfc) && pfc[0]) return String(pfc[0]).toUpperCase().replace(/\s+/g, "_");
  if (typeof pfc === "string") {
    try {
      const parsed = JSON.parse(pfc) as { primary?: string };
      if (parsed?.primary) return parsed.primary.toUpperCase();
    } catch {
      return pfc.toUpperCase();
    }
  }
  const p = (pfc as { primary?: string } | null)?.primary;
  if (p) return p.toUpperCase();
  if (Array.isArray(t.category) && t.category[0]) return String(t.category[0]).toUpperCase().replace(/\s+/g, "_");
  return null;
}

export interface CashflowSummary {
  /** Money in over the window. */
  income: number;
  /** Money out over the window, excluding transfers in and balance noise. */
  spending: number;
  /** income − spending. Negative means the period ran a deficit. */
  net: number;
  /** Share of income kept. Null when there is no income to divide by. */
  savingsRate: number | null;
  /** Average monthly spending across whole months in the window. */
  monthlySpending: number;
  /** Whole months the window covers, used for the average. */
  months: number;
}

/**
 * Summarise a window of transactions.
 *
 * `months` is how many whole months of history to include, counting back from
 * today. Pending transactions are skipped: they double-count against the posted
 * copy that follows.
 */
export function summariseCashflow(txns: TxnLike[], months = 3, now = new Date()): CashflowSummary {
  const cutoff = new Date(now.getFullYear(), now.getMonth() - months, 1);
  let income = 0;
  let spending = 0;

  for (const t of txns) {
    if (t.pending) continue;
    const d = new Date(`${t.date}T12:00:00`);
    if (Number.isNaN(d.getTime()) || d < cutoff) continue;

    const primary = primaryOf(t);
    if (t.amount < 0) {
      // Money in. Only count it as income when it is labelled as such —
      // otherwise a transfer between the user's own accounts inflates both
      // sides and makes the savings rate meaningless.
      if (primary && INCOME_PRIMARIES_UPPER.has(primary)) income += Math.abs(t.amount);
      continue;
    }
    if (primary && EXCLUDED_PRIMARIES_UPPER.has(primary)) continue;
    spending += t.amount;
  }

  const net = income - spending;
  return {
    income,
    spending,
    net,
    savingsRate: income > 0 ? net / income : null,
    monthlySpending: months > 0 ? spending / months : spending,
    months,
  };
}

/**
 * Months of spending a cash balance covers.
 *
 * The usual emergency-fund read. Returns null when there isn't enough spending
 * history to divide by — better no number than a fabricated one.
 */
export function monthsOfRunway(cash: number, monthlySpending: number): number | null {
  if (monthlySpending <= 0) return null;
  return cash / monthlySpending;
}
