// E*TRADE API — OAuth 1.0a + REST helpers
// Tokens expire at midnight ET each trading day; user reconnects each morning.

import crypto from "crypto";

const IS_SANDBOX = process.env.ETRADE_ENV === "sandbox";
const API_BASE = IS_SANDBOX ? "https://apisb.etrade.com" : "https://api.etrade.com";
const CONSUMER_KEY = process.env.ETRADE_CONSUMER_KEY ?? "";
const CONSUMER_SECRET = process.env.ETRADE_CONSUMER_SECRET ?? "";

// ── Encryption (AES-256-GCM) ─────────────────────────────────────────────────
// Tokens are encrypted before storing in the DB.

const ENC_KEY_HEX = process.env.TOKEN_ENCRYPTION_KEY ?? "";

function encKey(): Buffer {
  if (!ENC_KEY_HEX || ENC_KEY_HEX.length < 64) throw new Error("TOKEN_ENCRYPTION_KEY not set");
  return Buffer.from(ENC_KEY_HEX.slice(0, 64), "hex");
}

export function encryptToken(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptToken(data: string): string {
  const buf = Buffer.from(data, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", encKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

// ── OAuth 1.0a signing ────────────────────────────────────────────────────────

function pct(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) =>
    "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

function buildAuthHeader(
  method: string,
  url: string,
  oauthToken = "",
  oauthTokenSecret = "",
  extra: Record<string, string> = {}
): string {
  const params: Record<string, string> = {
    oauth_consumer_key: CONSUMER_KEY,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
    ...extra,
  };
  if (oauthToken) params.oauth_token = oauthToken;

  const paramStr = Object.keys(params)
    .sort()
    .map((k) => `${pct(k)}=${pct(params[k])}`)
    .join("&");

  const baseStr = `${method.toUpperCase()}&${pct(url)}&${pct(paramStr)}`;
  const signingKey = `${pct(CONSUMER_SECRET)}&${pct(oauthTokenSecret)}`;
  params.oauth_signature = crypto
    .createHmac("sha1", signingKey)
    .update(baseStr)
    .digest("base64");

  return (
    "OAuth " +
    Object.entries(params)
      .map(([k, v]) => `${pct(k)}="${pct(v)}"`)
      .join(", ")
  );
}

// ── OAuth flow ────────────────────────────────────────────────────────────────

export async function getRequestToken(
  callbackUrl: string
): Promise<{ token: string; secret: string }> {
  const url = `${API_BASE}/oauth/request_token`;
  const header = buildAuthHeader("GET", url, "", "", { oauth_callback: callbackUrl });
  const res = await fetch(url, { headers: { Authorization: header } });
  if (!res.ok) throw new Error(`Request token failed: ${res.status} ${await res.text()}`);
  const p = new URLSearchParams(await res.text());
  return { token: p.get("oauth_token")!, secret: p.get("oauth_token_secret")! };
}

export function getAuthorizationUrl(requestToken: string): string {
  return `https://us.etrade.com/e/t/etws/authorize?key=${CONSUMER_KEY}&token=${requestToken}`;
}

export async function getAccessToken(
  requestToken: string,
  requestTokenSecret: string,
  verifier: string
): Promise<{ token: string; secret: string }> {
  const url = `${API_BASE}/oauth/access_token`;
  const header = buildAuthHeader("GET", url, requestToken, requestTokenSecret, {
    oauth_verifier: verifier,
  });
  const res = await fetch(url, { headers: { Authorization: header } });
  if (!res.ok) throw new Error(`Access token failed: ${res.status} ${await res.text()}`);
  const p = new URLSearchParams(await res.text());
  return { token: p.get("oauth_token")!, secret: p.get("oauth_token_secret")! };
}

// ── Authenticated requests ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function apiGet(path: string, token: string, secret: string): Promise<any> {
  const url = `${API_BASE}${path}`;
  const header = buildAuthHeader("GET", url, token, secret);
  const res = await fetch(url, { headers: { Authorization: header } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`E*TRADE ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ── Accounts ──────────────────────────────────────────────────────────────────

export interface ETradeAccount {
  accountId: string;
  accountIdKey: string;
  accountMode: string;
  accountName: string;
  accountType: string;
  institutionType: string;
  accountStatus: string;
}

export async function getAccounts(token: string, secret: string): Promise<ETradeAccount[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await apiGet("/v1/accounts/list.json", token, secret);
  const accounts = data?.AccountListResponse?.Accounts?.Account;
  if (!accounts) return [];
  return (Array.isArray(accounts) ? accounts : [accounts]) as ETradeAccount[];
}

// ── Balance ───────────────────────────────────────────────────────────────────

export interface ETradeBalance {
  cashBuyingPower: number;
  marginBuyingPower: number;
  dayTradingBuyingPower: number;
  totalAccountValue: number;
  dayChange: number;
  dayChangePct: number;
}

export async function getBalance(
  token: string,
  secret: string,
  accountIdKey: string
): Promise<ETradeBalance | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await apiGet(
      `/v1/accounts/${accountIdKey}/balance.json?instType=BROKERAGE&realTimeNAV=true`,
      token,
      secret
    );
    const b = data?.BalanceResponse;
    const computed = b?.Computed;
    const bal = b?.accountBalance ?? {};
    return {
      cashBuyingPower: computed?.cashBuyingPower ?? bal.cashAvailableForInvestment ?? 0,
      marginBuyingPower: computed?.marginBuyingPower ?? 0,
      dayTradingBuyingPower: computed?.dayTradingBuyingPower ?? 0,
      totalAccountValue: bal.totalAccountValue ?? computed?.totalEquity ?? 0,
      dayChange: computed?.dayChangeClose ?? 0,
      dayChangePct: computed?.dayChangeClosePercent ?? 0,
    };
  } catch (e) {
    console.error("[etrade] balance fetch failed:", e);
    return null;
  }
}

// ── Portfolio ─────────────────────────────────────────────────────────────────

export interface ETradePosition {
  symbol: string;
  description: string;
  quantity: number;
  pricePaid: number;
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  totalGain: number;
  totalGainPct: number;
  daysGain: number;
  daysGainPct: number;
}

export async function getPortfolio(
  token: string,
  secret: string,
  accountIdKey: string
): Promise<ETradePosition[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await apiGet(
      `/v1/accounts/${accountIdKey}/portfolio.json`,
      token,
      secret
    );
    const portfolios = data?.PortfolioResponse?.AccountPortfolio;
    if (!portfolios) return [];
    const portfolio = Array.isArray(portfolios) ? portfolios[0] : portfolios;
    const positions = portfolio?.Position;
    if (!positions) return [];
    const arr = Array.isArray(positions) ? positions : [positions];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return arr.map((p: any): ETradePosition => ({
      symbol: p.Product?.symbol ?? "",
      description: p.symbolDescription ?? "",
      quantity: p.quantity ?? 0,
      pricePaid: p.pricePaid ?? 0,
      currentPrice: p.Quick?.lastTrade ?? (p.quantity ? p.marketValue / p.quantity : 0),
      marketValue: p.marketValue ?? 0,
      costBasis: p.costBasis ?? 0,
      totalGain: p.totalGain ?? 0,
      totalGainPct: p.totalGainPct ?? 0,
      daysGain: p.daysGain ?? 0,
      daysGainPct: p.daysGainPct ?? 0,
    }));
  } catch (e) {
    console.error("[etrade] portfolio fetch failed:", e);
    return [];
  }
}
