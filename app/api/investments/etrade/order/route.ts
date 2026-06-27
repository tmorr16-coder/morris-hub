import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { createServiceClient } from "@/lib/supabase/server";
import {
  decryptToken,
  previewOrder,
  placeOrder,
  type OrderRequest,
} from "@/lib/etrade";

async function getConnection(userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { data: conn } = await service
    .schema("hub")
    .from("etrade_connections")
    .select("access_token, access_token_secret, account_id_key")
    .eq("user_id", userId)
    .maybeSingle();
  if (!conn) throw new Error("Not connected to E*TRADE");
  return {
    token: decryptToken(conn.access_token),
    secret: decryptToken(conn.access_token_secret),
    accountIdKey: conn.account_id_key as string,
  };
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  let body: {
    step: "preview" | "place";
    order: OrderRequest;
    previewId?: number;
    cashMargin?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const { step, order, previewId, cashMargin } = body;

  // Validate order basics
  if (!order?.symbol || !order?.action || !order?.quantity || !order?.priceType) {
    return Response.json({ error: "symbol, action, quantity, priceType required" }, { status: 400 });
  }
  if (order.priceType === "LIMIT" && !order.limitPrice) {
    return Response.json({ error: "limitPrice required for LIMIT orders" }, { status: 400 });
  }

  let conn: Awaited<ReturnType<typeof getConnection>>;
  try {
    conn = await getConnection(userId);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 401 });
  }

  if (step === "preview") {
    try {
      const result = await previewOrder(conn.token, conn.secret, conn.accountIdKey, order);
      return Response.json(result);
    } catch (err) {
      console.error("[etrade/order] preview failed:", err);
      return Response.json({ error: (err as Error).message }, { status: 502 });
    }
  }

  if (step === "place") {
    if (!previewId) return Response.json({ error: "previewId required" }, { status: 400 });
    try {
      const result = await placeOrder(
        conn.token,
        conn.secret,
        conn.accountIdKey,
        order,
        previewId,
        cashMargin ?? "CASH"
      );
      return Response.json(result);
    } catch (err) {
      console.error("[etrade/order] place failed:", err);
      return Response.json({ error: (err as Error).message }, { status: 502 });
    }
  }

  return Response.json({ error: "step must be preview or place" }, { status: 400 });
}
