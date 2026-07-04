// Alpaca Markets API — per-user brokerage integration
// Docs: https://docs.alpaca.markets/reference
//
// Credentials are loaded per-user from the `alpaca_credentials` table (mirrors
// the per-user Oura token flow). The owner/admin keeps working via the legacy
// ALPACA_API_KEY / ALPACA_API_SECRET env fallback; everyone else must connect
// their own keys, and callers treat a missing connection as "not connected".

import { createAdminClient } from "@/lib/supabase/admin";

const PAPER_BASE = "https://paper-api.alpaca.markets";
const LIVE_BASE = "https://api.alpaca.markets";
const DATA_BASE = "https://data.alpaca.markets";

export interface AlpacaCreds {
  apiKey: string;
  apiSecret: string;
  isPaper: boolean;
}

/**
 * Load a user's Alpaca credentials.
 *
 * Order of resolution:
 *   1. Their own row in `alpaca_credentials` (per-user connection).
 *   2. Admin/owner fallback to the shared ALPACA_API_KEY/SECRET env pair.
 *   3. Otherwise null → callers treat this as "not connected".
 *
 * The `alpaca_credentials` read is wrapped in try/catch so a deployment where
 * the migration has not been applied yet behaves as "not connected" rather than
 * crashing (same tolerance as the Oura token read).
 */
export async function loadAlpacaCreds(userId: string): Promise<AlpacaCreds | null> {
  if (!userId) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  try {
    const { data } = await db
      .from("alpaca_credentials")
      .select("api_key, api_secret, is_paper")
      .eq("user_id", userId)
      .maybeSingle();
    if (data?.api_key && data?.api_secret) {
      return { apiKey: data.api_key, apiSecret: data.api_secret, isPaper: data.is_paper !== false };
    }
  } catch { /* alpaca_credentials table not yet created — fall through */ }

  // Owner/admin fallback: the shared env keys are the owner's personal brokerage,
  // so only treat them as a connection for an admin, never for a standard user.
  if (process.env.ALPACA_API_KEY && process.env.ALPACA_API_SECRET) {
    try {
      const { data: profile } = await db
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();
      if ((profile as { role?: string } | null)?.role === "admin") {
        return {
          apiKey: process.env.ALPACA_API_KEY,
          apiSecret: process.env.ALPACA_API_SECRET,
          isPaper: process.env.ALPACA_ENV !== "live",
        };
      }
    } catch { /* profiles read failed — treat as not connected */ }
  }

  return null;
}

/** True if the user has a usable Alpaca connection (own creds or owner fallback). */
export async function hasAlpacaConnection(userId: string): Promise<boolean> {
  return (await loadAlpacaCreds(userId)) !== null;
}

/** Non-sensitive connection status for UI (never exposes the key/secret). */
export async function getAlpacaStatus(userId: string): Promise<{ connected: boolean; isPaper: boolean }> {
  const creds = await loadAlpacaCreds(userId);
  return { connected: creds !== null, isPaper: creds?.isPaper ?? true };
}

function headers(creds: AlpacaCreds): Record<string, string> {
  return {
    "APCA-API-KEY-ID": creds.apiKey,
    "APCA-API-SECRET-KEY": creds.apiSecret,
    "Content-Type": "application/json",
  };
}

function tradeBase(creds: AlpacaCreds): string {
  return creds.isPaper ? PAPER_BASE : LIVE_BASE;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function get(creds: AlpacaCreds, path: string, base = tradeBase(creds)): Promise<any> {
  const res = await fetch(`${base}${path}`, { headers: headers(creds), next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Alpaca ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Account ───────────────────────────────────────────────────────────────────

export interface AlpacaAccount {
  id: string;
  account_number: string;
  status: string;
  currency: string;
  buying_power: string;
  cash: string;
  portfolio_value: string;
  equity: string;
  last_equity: string;
  daytrade_count: number;
  pattern_day_trader: boolean;
}

export async function getAccount(userId: string): Promise<AlpacaAccount | null> {
  const creds = await loadAlpacaCreds(userId);
  if (!creds) return null;
  return get(creds, "/v2/account");
}

// ── Market Clock ──────────────────────────────────────────────────────────────

export interface AlpacaClock {
  timestamp: string;
  is_open: boolean;
  next_open: string;
  next_close: string;
}

export async function getClock(userId: string): Promise<AlpacaClock | null> {
  const creds = await loadAlpacaCreds(userId);
  if (!creds) return null;
  return get(creds, "/v2/clock");
}

// ── Positions ─────────────────────────────────────────────────────────────────

export interface AlpacaPosition {
  asset_id: string;
  symbol: string;
  exchange: string;
  asset_class: string;
  qty: string;
  qty_available: string;
  avg_entry_price: string;
  side: "long" | "short";
  market_value: string;
  cost_basis: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  unrealized_intraday_pl: string;
  unrealized_intraday_plpc: string;
  current_price: string;
  lastday_price: string;
  change_today: string;
}

export async function getPositions(userId: string): Promise<AlpacaPosition[]> {
  const creds = await loadAlpacaCreds(userId);
  if (!creds) return [];
  return get(creds, "/v2/positions");
}

// ── Orders ────────────────────────────────────────────────────────────────────

export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit" | "stop" | "stop_limit";
export type OrderTif = "day" | "gtc" | "ioc" | "fok";

export interface OrderRequest {
  symbol: string;
  qty: number;
  side: OrderSide;
  type: OrderType;
  time_in_force: OrderTif;
  limit_price?: number;
  stop_price?: number;
}

export interface AlpacaOrder {
  id: string;
  client_order_id: string;
  status: string;
  symbol: string;
  qty: string;
  filled_qty: string;
  side: string;
  type: string;
  time_in_force: string;
  limit_price: string | null;
  stop_price: string | null;
  filled_avg_price: string | null;
  submitted_at: string;
  created_at: string;
}

/** Thrown when a user has no Alpaca connection but a trade action is attempted. */
export class AlpacaNotConnectedError extends Error {
  constructor() {
    super("No Alpaca brokerage connected");
    this.name = "AlpacaNotConnectedError";
  }
}

export async function placeOrder(userId: string, order: OrderRequest): Promise<AlpacaOrder> {
  const creds = await loadAlpacaCreds(userId);
  if (!creds) throw new AlpacaNotConnectedError();

  const body: Record<string, unknown> = {
    symbol: order.symbol.toUpperCase(),
    qty: String(order.qty),
    side: order.side,
    type: order.type,
    time_in_force: order.time_in_force,
  };
  if (order.type === "limit" && order.limit_price) body.limit_price = String(order.limit_price);
  if (order.type === "stop" && order.stop_price) body.stop_price = String(order.stop_price);

  const res = await fetch(`${tradeBase(creds)}/v2/orders`, {
    method: "POST",
    headers: headers(creds),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Alpaca order ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function cancelOrder(userId: string, orderId: string): Promise<void> {
  const creds = await loadAlpacaCreds(userId);
  if (!creds) throw new AlpacaNotConnectedError();
  await fetch(`${tradeBase(creds)}/v2/orders/${orderId}`, { method: "DELETE", headers: headers(creds) });
}

export async function getOrders(userId: string, status = "open"): Promise<AlpacaOrder[]> {
  const creds = await loadAlpacaCreds(userId);
  if (!creds) return [];
  return get(creds, `/v2/orders?status=${status}&limit=20`);
}

// ── Latest Quote (for estimated cost) ────────────────────────────────────────

export async function getLatestQuote(userId: string, symbol: string): Promise<{ ask: number; bid: number } | null> {
  const creds = await loadAlpacaCreds(userId);
  if (!creds) return null;
  try {
    const data = await get(creds, `/v2/stocks/quotes/latest?symbols=${symbol}`, DATA_BASE);
    const q = data?.quotes?.[symbol];
    if (!q) return null;
    return { ask: q.ap ?? 0, bid: q.bp ?? 0 };
  } catch {
    return null;
  }
}
