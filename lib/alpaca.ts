// Alpaca Markets API — paper trading integration
// Docs: https://docs.alpaca.markets/reference

const IS_PAPER = process.env.ALPACA_ENV !== "live";
const BASE = IS_PAPER ? "https://paper-api.alpaca.markets" : "https://api.alpaca.markets";
const DATA_BASE = "https://data.alpaca.markets";

function headers(): Record<string, string> {
  return {
    "APCA-API-KEY-ID": process.env.ALPACA_API_KEY ?? "",
    "APCA-API-SECRET-KEY": process.env.ALPACA_API_SECRET ?? "",
    "Content-Type": "application/json",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function get(path: string, base = BASE): Promise<any> {
  const res = await fetch(`${base}${path}`, { headers: headers(), next: { revalidate: 0 } });
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

export async function getAccount(): Promise<AlpacaAccount> {
  return get("/v2/account");
}

// ── Market Clock ──────────────────────────────────────────────────────────────

export interface AlpacaClock {
  timestamp: string;
  is_open: boolean;
  next_open: string;
  next_close: string;
}

export async function getClock(): Promise<AlpacaClock> {
  return get("/v2/clock");
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

export async function getPositions(): Promise<AlpacaPosition[]> {
  return get("/v2/positions");
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

export async function placeOrder(order: OrderRequest): Promise<AlpacaOrder> {
  const body: Record<string, unknown> = {
    symbol: order.symbol.toUpperCase(),
    qty: String(order.qty),
    side: order.side,
    type: order.type,
    time_in_force: order.time_in_force,
  };
  if (order.type === "limit" && order.limit_price) body.limit_price = String(order.limit_price);
  if (order.type === "stop" && order.stop_price) body.stop_price = String(order.stop_price);

  const res = await fetch(`${BASE}/v2/orders`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Alpaca order ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function cancelOrder(orderId: string): Promise<void> {
  await fetch(`${BASE}/v2/orders/${orderId}`, { method: "DELETE", headers: headers() });
}

export async function getOrders(status = "open"): Promise<AlpacaOrder[]> {
  return get(`/v2/orders?status=${status}&limit=20`);
}

// ── Latest Quote (for estimated cost) ────────────────────────────────────────

export async function getLatestQuote(symbol: string): Promise<{ ask: number; bid: number } | null> {
  try {
    const data = await get(`/v2/stocks/quotes/latest?symbols=${symbol}`, DATA_BASE);
    const q = data?.quotes?.[symbol];
    if (!q) return null;
    return { ask: q.ap ?? 0, bid: q.bp ?? 0 };
  } catch {
    return null;
  }
}
