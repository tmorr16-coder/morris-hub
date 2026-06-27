// Temporary diagnostic endpoint — DELETE after E*TRADE is confirmed working
import crypto from "crypto";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";

function pct(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) =>
    "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

function buildHeader(
  method: string,
  url: string,
  consumerKey: string,
  consumerSecret: string,
  callbackUrl: string
): string {
  const params: Record<string, string> = {
    oauth_callback: callbackUrl,
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
  };

  const paramStr = Object.keys(params)
    .sort()
    .map((k) => `${pct(k)}=${pct(params[k])}`)
    .join("&");

  const baseStr = `${method}&${pct(url)}&${pct(paramStr)}`;
  const signingKey = `${pct(consumerSecret)}&`;
  params.oauth_signature = crypto.createHmac("sha1", signingKey).update(baseStr).digest("base64");

  return "OAuth " + Object.entries(params).map(([k, v]) => `${pct(k)}="${pct(v)}"`).join(", ");
}

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const key = process.env.ETRADE_CONSUMER_KEY;
  const secret = process.env.ETRADE_CONSUMER_SECRET;
  const etEnv = process.env.ETRADE_ENV ?? "production";
  const apiBase = etEnv === "sandbox" ? "https://apisb.etrade.com" : "https://api.etrade.com";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://morrisai.family";
  const callbackUrl = `${appUrl}/api/investments/etrade/callback`;

  if (!key || !secret) {
    return Response.json({ error: "Env vars missing", hasKey: !!key, hasSecret: !!secret });
  }

  const url = `${apiBase}/oauth/request_token`;
  const header = buildHeader("GET", url, key, secret, callbackUrl);

  let status: number;
  let body: string;
  try {
    const res = await fetch(url, { headers: { Authorization: header } });
    status = res.status;
    body = await res.text();
  } catch (err) {
    return Response.json({ config: { etEnv, apiBase, callbackUrl }, fetchError: String(err) });
  }

  return Response.json({
    config: { etEnv, apiBase, callbackUrl, keyPrefix: key.slice(0, 8) + "…" },
    etradeStatus: status,
    etradeBody: body,
    ok: status === 200,
  });
}
