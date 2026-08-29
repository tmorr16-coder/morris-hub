import { mccToCategory } from "./mcc";

/**
 * SimpleFIN bank-aggregation integration.
 *
 * SimpleFIN connections are stored in the SAME finance tables Plaid uses —
 * a connection is a `finance.plaid_items` row tagged `institution_id='simplefin'`,
 * with the SimpleFIN **access URL** (which embeds credentials) stored encrypted
 * in `access_token_encrypted`. Never log or return the access URL or setup token.
 *
 * Protocol:
 *  1. Setup token = base64 string that decodes to a one-time claim URL.
 *  2. Claim: POST the claim URL (empty body) → response body is the access URL.
 *  3. Fetch: GET {accessUrl}/accounts?start-date=<unixSeconds> → JSON.
 *
 * Sign convention differs from Plaid: SimpleFIN `amount` is negative for money
 * leaving the account (debit/spend), positive for money in (deposit). The
 * finance tables use Plaid's convention (positive = money OUT / expense), so
 * transaction amounts are sign-flipped when mapped (see mapSimpleFinTransaction).
 * Balances are stored as-is (NOT sign-flipped).
 */

const FETCH_TIMEOUT_MS = 15_000;

export interface SimpleFinTransaction {
  id: string;
  posted?: number;
  transacted_at?: number;
  amount: string;
  description?: string;
  payee?: string;
  memo?: string;
  mcc?: string;
  pending?: boolean;
}

export interface SimpleFinOrg {
  name?: string;
  domain?: string;
  id?: string;
}

export interface SimpleFinAccount {
  id: string;
  name: string;
  currency?: string;
  balance: string;
  "available-balance"?: string;
  "balance-date"?: number;
  org?: SimpleFinOrg;
  transactions?: SimpleFinTransaction[];
  holdings?: unknown[];
}

export interface SimpleFinAccountsResponse {
  errors: string[];
  accounts: SimpleFinAccount[];
  /** Same as `errors`, normalised to strings — the accounts behind these are missing. */
  providerErrors: string[];
}

/**
 * Base64-decode a setup token to its one-time claim URL, POST it (empty body),
 * and return the resulting access URL. Throws on invalid token or non-2xx.
 */
export async function claimAccessUrl(setupToken: string): Promise<string> {
  const token = (setupToken ?? "").trim();
  if (!token) throw new Error("Setup token is required");

  let claimUrl: string;
  try {
    claimUrl = Buffer.from(token, "base64").toString("utf8").trim();
  } catch {
    throw new Error("Setup token is not valid base64");
  }

  if (!/^https:\/\//i.test(claimUrl)) {
    throw new Error("Setup token did not decode to a valid https claim URL");
  }

  const res = await fetch(claimUrl, {
    method: "POST",
    body: "",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`SimpleFIN claim failed with status ${res.status}`);
  }

  const accessUrl = (await res.text()).trim();
  if (!/^https:\/\//i.test(accessUrl)) {
    throw new Error("SimpleFIN claim did not return a valid access URL");
  }
  return accessUrl;
}

/**
 * Fetch accounts (and their recent transactions) from a SimpleFIN access URL.
 * Pass startDateUnix (unix seconds) to bound the transaction window.
 */
export async function fetchSimpleFinAccounts(
  accessUrl: string,
  startDateUnix?: number
): Promise<SimpleFinAccountsResponse> {
  // The SimpleFIN access URL embeds credentials (https://user:pass@host/...).
  // fetch()/undici REJECTS a URL with credentials, so split them out and send
  // them as an Authorization: Basic header against a credential-free URL.
  const parsed = new URL(accessUrl);
  const username = decodeURIComponent(parsed.username);
  const password = decodeURIComponent(parsed.password);
  parsed.username = "";
  parsed.password = "";
  const base = parsed.toString().replace(/\/$/, "");

  let url = `${base}/accounts`;
  if (startDateUnix != null) {
    url += `?start-date=${Math.floor(startDateUnix)}`;
  }

  const headers: Record<string, string> = {};
  if (username || password) {
    headers.Authorization = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
  }

  const res = await fetch(url, {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`SimpleFIN accounts fetch failed with status ${res.status}`);
  }

  const json = (await res.json()) as Partial<SimpleFinAccountsResponse>;
  // `errors` is not an HTTP failure — the request succeeded. It is SimpleFIN
  // saying "these connections need attention", and the accounts behind them are
  // missing from `accounts`. Named explicitly because both callers previously
  // destructured past it.
  return {
    errors: json.errors ?? [],
    providerErrors: (json.errors ?? []).map((e) => String(e)),
    accounts: json.accounts ?? [],
  };
}

/**
 * Infer an account type. SimpleFIN doesn't expose type/subtype, so we guess:
 * credit-card-like names or a negative balance → "credit", else "depository".
 */
export function inferType(a: SimpleFinAccount): string {
  const hay = `${a.name ?? ""} ${a.org?.name ?? ""}`.toLowerCase();
  if (/mortgage|\bloan\b|auto|heloc|line of credit/.test(hay)) return "loan";
  if (/credit|card/.test(hay)) return "credit";
  if (/brokerage|invest|401|\bira\b|roth|stock plan|\bhsa\b|retirement/.test(hay)) return "investment";
  const bal = parseFloat(a.balance);
  // A negative balance with no matching name is almost always a liability.
  if (!Number.isNaN(bal) && bal < 0) return "loan";
  return "depository";
}

/** Map a SimpleFIN account to a `finance.accounts` row (item_id added by caller). */
export function mapSimpleFinAccount(a: SimpleFinAccount) {
  const type = inferType(a);
  const isLiability = type === "credit" || type === "loan";
  const rawBal = parseFloat(a.balance);
  const availRaw = a["available-balance"] != null ? parseFloat(a["available-balance"]) : null;
  return {
    plaid_account_id: a.id,
    name: a.name,
    official_name: a.org?.name ?? null,
    type,
    subtype: null as string | null,
    mask: null as string | null,
    // Net-worth math negates credit/loan balances (Plaid's convention: a liability
    // is a POSITIVE amount owed). SimpleFIN reports liabilities as NEGATIVE, so store
    // the absolute value — otherwise a $634k mortgage gets ADDED instead of subtracted.
    current_balance: isLiability && !Number.isNaN(rawBal) ? Math.abs(rawBal) : rawBal,
    available_balance:
      availRaw != null ? (isLiability ? Math.abs(availRaw) : availRaw) : null,
    iso_currency_code: a.currency ?? "USD",
    balance_as_of: new Date((a["balance-date"] ?? 0) * 1000).toISOString(),
  };
}

/**
 * Map a SimpleFIN transaction to a `finance.transactions` row.
 *
 * `plaid_transaction_id` is namespaced (`sf:<accountId>:<txId>`) so it can never
 * collide with a Plaid transaction id. Amount is sign-flipped to Plaid's
 * convention: SimpleFIN debit "-55.50" → stored +55.50 (expense); deposit
 * "+2000" → stored -2000 (income).
 */
export function mapSimpleFinTransaction(
  accountId: string,
  acctCurrency: string,
  t: SimpleFinTransaction
) {
  const postedSec = t.posted ?? t.transacted_at ?? 0;
  return {
    plaid_transaction_id: `sf:${accountId}:${t.id}`,
    amount: -parseFloat(t.amount),
    iso_currency_code: acctCurrency,
    date: new Date(postedSec * 1000).toISOString().slice(0, 10),
    authorized_date: t.transacted_at
      ? new Date(t.transacted_at * 1000).toISOString().slice(0, 10)
      : null,
    merchant_name: t.payee ?? null,
    name: t.description ?? t.memo ?? "",
    payment_channel: null as string | null,
    pending: !!t.pending,
    category: null as string | null,
    // SimpleFIN has no Plaid-style category; derive one from the MCC so the
    // insights category breakdown works.
    personal_finance_category: mccToCategory(t.mcc) as unknown,
    location: null as unknown,
  };
}
