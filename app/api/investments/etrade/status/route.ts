import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ connected: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { data } = await service
    .schema("hub")
    .from("etrade_connections")
    .select("account_id_key, account_name, connected_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return Response.json({ connected: false });

  // Tokens expire at midnight ET — flag if connected yesterday or before
  const connectedAt = new Date(data.connected_at);
  const now = new Date();
  // Midnight ET in UTC is 04:00 or 05:00 depending on DST
  const midnightET = new Date(now);
  midnightET.setUTCHours(5, 0, 0, 0); // 00:00 ET = 05:00 UTC (EST)
  if (midnightET > now) midnightET.setDate(midnightET.getDate() - 1);

  const expired = connectedAt < midnightET;

  return Response.json({
    connected: true,
    expired,
    accountIdKey: data.account_id_key,
    accountName: data.account_name,
    connectedAt: data.connected_at,
  });
}
