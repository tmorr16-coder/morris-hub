import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { getAccount, getPositions, getClock } from "@/lib/alpaca";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const account = await getAccount(userId);
    // No connection for this user → 200 with connected:false so clients can
    // render the "connect a brokerage" prompt instead of treating it as an error.
    if (!account) return Response.json({ connected: false }, { status: 200 });

    const [positions, clock] = await Promise.all([
      getPositions(userId),
      getClock(userId),
    ]);
    return Response.json({ connected: true, account, positions, clock });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Alpaca fetch failed";
    console.error("[alpaca/account]", msg);
    return Response.json({ error: msg }, { status: 502 });
  }
}
