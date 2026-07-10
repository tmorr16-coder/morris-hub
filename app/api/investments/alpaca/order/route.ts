import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { placeOrder, AlpacaNotConnectedError, type OrderRequest } from "@/lib/alpaca";

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  let body: OrderRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const { symbol, qty, side, type, time_in_force, limit_price } = body;
  if (!symbol || !qty || !side || !type || !time_in_force) {
    return Response.json({ error: "symbol, qty, side, type, time_in_force required" }, { status: 400 });
  }

  try {
    const order = await placeOrder(userId, { symbol, qty, side, type, time_in_force, limit_price });
    return Response.json(order);
  } catch (err) {
    if (err instanceof AlpacaNotConnectedError) {
      return Response.json({ error: err.message }, { status: 503 });
    }
    const msg = err instanceof Error ? err.message : "Order failed";
    console.error("[alpaca/order]", msg);
    return Response.json({ error: msg }, { status: 502 });
  }
}
