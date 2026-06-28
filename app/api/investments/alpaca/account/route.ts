import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { getAccount, getPositions, getClock } from "@/lib/alpaca";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  if (!process.env.ALPACA_API_KEY || !process.env.ALPACA_API_SECRET) {
    return Response.json({ error: "Alpaca API keys not configured" }, { status: 500 });
  }

  try {
    const [account, positions, clock] = await Promise.all([
      getAccount(),
      getPositions(),
      getClock(),
    ]);
    return Response.json({ account, positions, clock });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Alpaca fetch failed";
    console.error("[alpaca/account]", msg);
    return Response.json({ error: msg }, { status: 502 });
  }
}
