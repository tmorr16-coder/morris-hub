export const dynamic = "force-dynamic";

import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/health/auth";
import { LargeTitle, Icons } from "@/components/ios";
import WithingsCard from "./_components/WithingsCard";
import OuraCard from "./_components/OuraCard";
import AppleHealthCard from "./_components/AppleHealthCard";
import RequestIntegrationCard from "./_components/RequestIntegrationCard";

interface TokenRow {
  updated_at: string;
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const [userId, params] = await Promise.all([
    getCurrentUserId(),
    searchParams,
  ]);

  // Oura token fetched separately — table may not exist yet on some deployments
  let ouraToken: string | null = null;
  try {
    const { data: ouraRow } = await db.from("oura_tokens").select("access_token").eq("user_id", userId).maybeSingle();
    ouraToken = (ouraRow as { access_token: string } | null)?.access_token ?? null;
  } catch { /* oura_tokens table not yet created */ }

  const [
    { data: tokenRow },
    { data: lastWithingsRow },
    { data: ouraLastRow },
    { data: appleLastRow },
    { count: appleMetricsCount },
    { count: appleWorkoutsCount },
  ] = await Promise.all([
    db.from("withings_tokens").select("updated_at").eq("user_id", userId).maybeSingle() as Promise<{ data: TokenRow | null }>,
    db.from("apple_health_metrics").select("created_at").eq("user_id", userId).eq("source", "withings").order("created_at", { ascending: false }).limit(1).maybeSingle() as Promise<{ data: { created_at: string } | null }>,
    db.from("apple_health_metrics").select("created_at").eq("user_id", userId).eq("source", "oura").order("created_at", { ascending: false }).limit(1).maybeSingle() as Promise<{ data: { created_at: string } | null }>,
    db.from("apple_health_metrics").select("created_at").eq("user_id", userId).eq("source", "apple_health").order("created_at", { ascending: false }).limit(1).maybeSingle() as Promise<{ data: { created_at: string } | null }>,
    db.from("apple_health_metrics").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("source", "apple_health") as Promise<{ count: number | null }>,
    db.from("apple_health_workouts").select("id", { count: "exact", head: true }).eq("user_id", userId) as Promise<{ count: number | null }>,
  ]);

  const connected       = tokenRow !== null;
  const connectedAt     = (tokenRow as TokenRow | null)?.updated_at ?? null;
  const lastSyncAt      = (lastWithingsRow as { created_at: string } | null)?.created_at ?? null;
  // Fall back to env var for backward compat (Terry's existing setup)
  const ouraConfigured  = !!ouraToken || !!process.env.OURA_ACCESS_TOKEN;
  const ouraLastSyncAt  = (ouraLastRow as { created_at: string } | null)?.created_at ?? null;
  const appleLastSyncAt = (appleLastRow as { created_at: string } | null)?.created_at ?? null;
  const siteUrl         = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  // Per-user webhook URL — userId tells the endpoint whose data this is
  const webhookUrl      = `${siteUrl}/api/health/webhooks/apple-health?userId=${encodeURIComponent(userId)}`;

  const successMessage =
    params.connected === "1" ? "Withings connected successfully!" : null;
  const errorMessages: Record<string, string> = {
    invalid_state:  "OAuth state mismatch — please try again.",
    no_code:        "No authorization code returned by Withings.",
    token_exchange: "Withings rejected the authorization code.",
    fetch_failed:   "Network error reaching Withings servers.",
    db_error:       "Tokens received but failed to save. Check server logs.",
  };
  const errorMessage = params.error
    ? (errorMessages[params.error] ?? `Unknown error: ${params.error}`)
    : null;

  return (
    <div className="ios-scroll">

      {/* Back */}
      <Link href="/health" className="ios-navbar" style={{ textDecoration: "none" }}>
        <span className="ios-back">
          <Icons.ChevronLeft aria-hidden style={{ width: 20, height: 20 }} />
          Health
        </span>
      </Link>

      <LargeTitle
        title="Data integrations"
        subtitle="Connect devices and services to sync health data automatically."
      />

      <div style={{ padding: "8px 16px 0" }}>

        {/* Error banner */}
        {errorMessage && (
          <div
            className="ios-list"
            style={{
              margin: "0 0 16px",
              padding: "12px 14px",
              fontSize: 13,
              color: "var(--ios-red)",
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <AppleHealthCard
          configured={appleMetricsCount !== null && appleMetricsCount > 0}
          lastSyncAt={appleLastSyncAt}
          metricsCount={appleMetricsCount ?? 0}
          workoutsCount={appleWorkoutsCount ?? 0}
          webhookUrl={webhookUrl}
        />
        <WithingsCard
          connected={connected}
          connectedAt={connectedAt}
          lastSyncAt={lastSyncAt}
          successMessage={successMessage}
        />
        <OuraCard
          tokenConfigured={ouraConfigured}
          lastSyncAt={ouraLastSyncAt}
        />
        <RequestIntegrationCard />
        </div>
      </div>

    </div>
  );
}
